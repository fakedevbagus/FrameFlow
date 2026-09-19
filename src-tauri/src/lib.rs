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

fn probe_duration_with_ffmpeg(path: &Path) -> Result<Option<u64>, String> {
  let output = Command::new("ffmpeg")
    .args(["-hide_banner", "-i"])
    .arg(path)
    .args(["-f", "null", "-"])
    .output()
    .map_err(|error| format!("Could not run ffmpeg: {error}"))?;

  Ok(parse_ffmpeg_duration(&output.stderr))
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
    .invoke_handler(tauri::generate_handler![inspect_media, open_project, save_project])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}


#[cfg(test)]
mod tests {
  use super::{media_type, parse_duration_ms};
  use std::path::Path;

  #[test]
  fn recognizes_mp3_as_audio() {
    assert_eq!(media_type(Path::new("music.MP3")).unwrap(), "audio");
  }

  #[test]
  fn parses_first_valid_duration_value() {
    assert_eq!(parse_duration_ms(b"N/A\n42.125\n"), Some(42_125));
  }
}
