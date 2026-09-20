use std::{
  fs,
  path::{Path, PathBuf},
  process::Command,
};

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaProbe {
  media_type: String,
  duration_ms: Option<u64>,
}

#[tauri::command]
fn inspect_media(path: String) -> Result<MediaProbe, String> {
  let media_path = media_path(&path)?;
  let media_type = media_type(&media_path)?;
  let duration_ms = match media_type.as_str() {
    "image" => None,
    _ => Some(probe_duration_ms(&media_path)?),
  };

  Ok(MediaProbe {
    media_type,
    duration_ms,
  })
}

#[tauri::command]
fn prepare_media_preview(path: String) -> Result<String, String> {
  let source_path = media_path(&path)?;
  let metadata = fs::metadata(&source_path)
    .map_err(|error| format!("Could not inspect media metadata: {error}"))?;

  let home = std::env::var_os("HOME")
    .map(PathBuf::from)
    .ok_or_else(|| "Could not determine the home directory for preview caching.".to_string())?;
  let cache_root = std::env::var_os("XDG_CACHE_HOME")
    .map(PathBuf::from)
    .unwrap_or_else(|| home.join(".cache"))
    .join("frameflow")
    .join("previews-v3");

  fs::create_dir_all(&cache_root).map_err(|error| {
    format!(
      "Could not create preview cache directory '{}': {error}",
      cache_root.display()
    )
  })?;

  let cache_key = preview_cache_key(&source_path, metadata.len(), metadata.modified().ok());
  let output_path = cache_root.join(format!("{cache_key}.mp4"));
  let temporary_path = cache_root.join(format!("{cache_key}.partial.mp4"));

  if output_path.is_file() {
    return Ok(output_path.to_string_lossy().into_owned());
  }

  let output = Command::new("ffmpeg")
    .args([
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
    ])
    .arg(&source_path)
    .args([
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-sn",
      "-dn",
      "-vf",
      "scale=w=1280:h=1280:force_original_aspect_ratio=decrease",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-profile:v",
      "main",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "28",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "-f",
      "mp4",
    ])
    .arg(&temporary_path)
    .output()
    .map_err(|error| format!("Could not run ffmpeg for preview generation: {error}"))?;

  if !output.status.success() {
    let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let _ = fs::remove_file(&temporary_path);

    return Err(if detail.is_empty() {
      "FFmpeg could not create a browser-compatible preview.".to_string()
    } else {
      format!("FFmpeg could not create a browser-compatible preview: {detail}")
    });
  }

  let metadata = fs::metadata(&temporary_path).map_err(|error| {
    let _ = fs::remove_file(&temporary_path);
    format!("Generated preview file could not be inspected: {error}")
  })?;

  if metadata.len() == 0 {
    let _ = fs::remove_file(&temporary_path);
    return Err("Generated preview file is empty.".to_string());
  }

  fs::rename(&temporary_path, &output_path).map_err(|error| {
    let _ = fs::remove_file(&temporary_path);
    format!(
      "Could not finalize preview cache file '{}': {error}",
      output_path.display()
    )
  })?;

  Ok(output_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn open_project(path: String) -> Result<String, String> {
  let project_path = project_path(&path)?;

  fs::read_to_string(&project_path)
    .map_err(|error| format!("Could not open project '{}': {error}", project_path.display()))
}

#[tauri::command]
fn save_project(path: String, content: String) -> Result<(), String> {
  let project_path = project_path(&path)?;
  let parent = project_path
    .parent()
    .ok_or_else(|| "Project path must have a parent directory.".to_string())?;

  fs::create_dir_all(parent)
    .map_err(|error| format!("Could not create project directory '{}': {error}", parent.display()))?;

  let temporary_path = temporary_path(&project_path);

  fs::write(&temporary_path, content).map_err(|error| {
    format!(
      "Could not write temporary project '{}': {error}",
      temporary_path.display()
    )
  })?;

  fs::rename(&temporary_path, &project_path).map_err(|error| {
    format!(
      "Could not finalize project '{}': {error}",
      project_path.display()
    )
  })
}

fn media_path(value: &str) -> Result<PathBuf, String> {
  let path = PathBuf::from(value);

  if !path.is_file() {
    return Err("Selected media file does not exist.".to_string());
  }

  Ok(path)
}

fn media_type(path: &Path) -> Result<String, String> {
  let extension = path
    .extension()
    .and_then(|value| value.to_str())
    .map(str::to_ascii_lowercase)
    .ok_or_else(|| "Selected media file has no extension.".to_string())?;

  let media_type = match extension.as_str() {
    "aac" | "flac" | "m4a" | "mp3" | "ogg" | "opus" | "wav" => "audio",
    "avif" | "bmp" | "gif" | "jpeg" | "jpg" | "png" | "webp" => "image",
    "avi" | "mkv" | "mov" | "mp4" | "mpeg" | "mpg" | "webm" => "video",
    _ => return Err("Selected file type is not supported.".to_string()),
  };

  Ok(media_type.to_string())
}

fn probe_duration_ms(path: &Path) -> Result<u64, String> {
  let format_output = run_ffprobe(path, &[
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
  ])?;

  if let Some(duration_ms) = parse_duration_ms(&format_output.stdout) {
    return Ok(duration_ms);
  }

  let stream_output = run_ffprobe(path, &[
    "-show_entries",
    "stream=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
  ])?;

  if let Some(duration_ms) = parse_duration_ms(&stream_output.stdout) {
    return Ok(duration_ms);
  }

  if let Some(duration_ms) = probe_duration_from_audio_packets(path)? {
    return Ok(duration_ms);
  }

  if let Some(duration_ms) = probe_duration_with_ffmpeg(path)? {
    return Ok(duration_ms);
  }

  let format_detail = ffprobe_detail(&format_output.stderr, &format_output.stdout);
  let stream_detail = ffprobe_detail(&stream_output.stderr, &stream_output.stdout);

  Err(if !format_detail.is_empty() {
    format!("ffprobe could not determine the selected media duration: {format_detail}")
  } else if !stream_detail.is_empty() {
    format!("ffprobe could not determine the selected media duration: {stream_detail}")
  } else {
    "ffprobe could not determine the selected media duration.".to_string()
  })
}

fn run_ffprobe(path: &Path, args: &[&str]) -> Result<std::process::Output, String> {
  Command::new("ffprobe")
    .args(["-v", "error"])
    .args(args)
    .arg(path)
    .output()
    .map_err(|error| format!("Could not run ffprobe: {error}"))
}

fn probe_duration_from_audio_packets(path: &Path) -> Result<Option<u64>, String> {
  let output = run_ffprobe(
    path,
    &[
      "-select_streams",
      "a:0",
      "-show_entries",
      "packet=pts_time,duration_time",
      "-of",
      "csv=p=0",
    ],
  )?;

  if !output.status.success() {
    return Ok(None);
  }

  let mut latest_end_ms = None;

  for line in String::from_utf8_lossy(&output.stdout).lines() {
    let mut values = line.split(',').map(str::trim);
    let Some(pts_text) = values.next() else {
      continue;
    };

    let Some(pts_seconds) = pts_text.parse::<f64>().ok() else {
      continue;
    };

    if !pts_seconds.is_finite() || pts_seconds < 0.0 {
      continue;
    }

    let duration_seconds = values
      .next()
      .and_then(|value| value.parse::<f64>().ok())
      .filter(|value| value.is_finite() && *value >= 0.0)
      .unwrap_or(0.0);

    let end_seconds = pts_seconds + duration_seconds;

    if end_seconds.is_finite() && end_seconds >= 0.0 {
      let end_ms = (end_seconds * 1000.0).round() as u64;
      latest_end_ms = Some(latest_end_ms.map_or(end_ms, |current: u64| current.max(end_ms)));
    }
  }

  Ok(latest_end_ms)
}

fn probe_duration_with_ffmpeg(path: &Path) -> Result<Option<u64>, String> {
  let output = Command::new("ffmpeg")
    .args(["-hide_banner", "-nostats", "-i"])
    .arg(path)
    .args(["-map", "0:0", "-f", "null", "-", "-progress", "pipe:1"])
    .output()
    .map_err(|error| format!("Could not run ffmpeg: {error}"))?;

  if let Some(duration_ms) = parse_ffmpeg_duration(&output.stderr) {
    return Ok(Some(duration_ms));
  }

  Ok(parse_ffmpeg_progress(&output.stdout))
}

fn parse_ffmpeg_duration(output: &[u8]) -> Option<u64> {
  let text = String::from_utf8_lossy(output);
  let mut last_progress_time_ms = None;

  for line in text.lines() {
    if let Some(marker_index) = line.find("Duration:") {
      let value = line[marker_index + "Duration:".len()..]
        .split(',')
        .next()
        .unwrap_or_default()
        .trim();

      if let Some(duration_ms) = parse_timestamp_ms(value) {
        return Some(duration_ms);
      }
    }

    if let Some(marker_index) = line.rfind("time=") {
      let value = line[marker_index + "time=".len()..]
        .split_whitespace()
        .next()
        .unwrap_or_default()
        .trim();

      if let Some(duration_ms) = parse_timestamp_ms(value) {
        last_progress_time_ms = Some(duration_ms);
      }
    }
  }

  last_progress_time_ms
}

fn parse_ffmpeg_progress(output: &[u8]) -> Option<u64> {
  let text = String::from_utf8_lossy(output);
  let mut last_out_time_ms = None;

  for line in text.lines() {
    let Some(value) = line.strip_prefix("out_time_ms=") else {
      continue;
    };

    if let Ok(out_time_us) = value.trim().parse::<u64>() {
      last_out_time_ms = Some(out_time_us / 1000);
    }
  }

  last_out_time_ms
}

fn parse_timestamp_ms(value: &str) -> Option<u64> {
  let mut parts = value.split(':');

  let hours = parts.next()?.trim().parse::<u64>().ok()?;
  let minutes = parts.next()?.trim().parse::<u64>().ok()?;
  let seconds = parts.next()?.trim().parse::<f64>().ok()?;

  if hours > 23 || minutes > 59 || !seconds.is_finite() || seconds < 0.0 {
    return None;
  }

  Some(
    (hours * 3_600_000)
      .saturating_add(minutes * 60_000)
      .saturating_add((seconds * 1000.0).round() as u64),
  )
}

fn ffprobe_detail(stderr: &[u8], stdout: &[u8]) -> String {
  let stderr = String::from_utf8_lossy(stderr).trim().to_string();

  if !stderr.is_empty() {
    return stderr;
  }

  String::from_utf8_lossy(stdout).trim().to_string()
}

fn parse_duration_ms(output: &[u8]) -> Option<u64> {
  String::from_utf8_lossy(output)
    .lines()
    .filter_map(|line| line.trim().parse::<f64>().ok())
    .find_map(|duration| {
      if duration.is_finite() && duration >= 0.0 {
        Some((duration * 1000.0).round() as u64)
      } else {
        None
      }
    })
}

fn preview_cache_key(path: &Path, size: u64, modified: Option<std::time::SystemTime>) -> String {
  let mut hash = 0xcbf29ce484222325u64;

  for byte in path.to_string_lossy().as_bytes() {
    hash ^= *byte as u64;
    hash = hash.wrapping_mul(0x100000001b3);
  }

  for byte in size.to_le_bytes() {
    hash ^= byte as u64;
    hash = hash.wrapping_mul(0x100000001b3);
  }

  if let Some(modified) = modified {
    if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
      for byte in duration.as_nanos().to_le_bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
      }
    }
  }

  format!("{hash:016x}")
}

fn project_path(value: &str) -> Result<PathBuf, String> {
  let path = PathBuf::from(value);

  if value.trim().is_empty() || path.file_name().is_none() {
    return Err("Project path must point to a file.".to_string());
  }

  Ok(path)
}

fn temporary_path(project_path: &Path) -> PathBuf {
  let mut temporary_path = project_path.as_os_str().to_os_string();
  temporary_path.push(".tmp");
  PathBuf::from(temporary_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      inspect_media,
      prepare_media_preview,
      open_project,
      save_project
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}


#[cfg(test)]
mod tests {
  use super::{media_type, parse_duration_ms, preview_cache_key};
  use std::path::Path;

  #[test]
  fn recognizes_mp3_as_audio() {
    assert_eq!(media_type(Path::new("music.MP3")).unwrap(), "audio");
  }

  #[test]
  fn parses_first_valid_duration_value() {
    assert_eq!(parse_duration_ms(b"N/A\n42.125\n"), Some(42_125));
  }

  #[test]
  fn parses_ffmpeg_progress_duration() {
    assert_eq!(
      super::parse_ffmpeg_progress(b"out_time_ms=1234567\nprogress=end\n"),
      Some(1_234),
    );
  }

  #[test]
  fn ignores_unknown_ffmpeg_progress_duration() {
    assert_eq!(
      super::parse_ffmpeg_progress(b"out_time_ms=N/A\nprogress=end\n"),
      None,
    );
  }

  #[test]
  fn preview_cache_key_changes_when_media_changes() {
    let first = preview_cache_key(
      Path::new("/media/video.mp4"),
      10,
      Some(std::time::UNIX_EPOCH),
    );
    let second = preview_cache_key(
      Path::new("/media/video.mp4"),
      20,
      Some(std::time::UNIX_EPOCH),
    );

    assert_ne!(first, second);
  }
}
