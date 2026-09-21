mod media_server;

use std::{
  fs,
  path::{Path, PathBuf},
  process::Command,
};

use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaProbe {
  media_type: String,
  duration_ms: Option<u64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeExportRenderRequest {
  source_path: String,
  output_path: String,
  width: u32,
  height: u32,
  frame_rate: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeVideoGraphRenderRequest {
  inputs: Vec<String>,
  output_path: String,
  width: u32,
  height: u32,
  frame_rate: f64,
  filter_complex: String,
  video_map: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeExportRenderResult {
  output_path: String,
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
fn prepare_media_preview(
  app: tauri::AppHandle,
  path: String,
) -> Result<String, String> {
  let source_path = media_path(&path)?;
  let metadata = fs::metadata(&source_path)
    .map_err(|error| format!("Could not inspect media metadata: {error}"))?;

  let cache_root = app
    .path()
    .app_cache_dir()
    .map_err(|error| format!("Could not resolve the FrameFlow app cache directory: {error}"))?
    .join("previews-v4");

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
fn render_single_source_to_mp4(
  request: NativeExportRenderRequest,
) -> Result<NativeExportRenderResult, String> {
  let source_path = media_path(&request.source_path)?;

  if media_type(&source_path)? != "video" {
    return Err("Native export currently requires a video source.".to_string());
  }

  validate_native_export_settings(
    request.width,
    request.height,
    request.frame_rate,
  )?;

  let output_path = PathBuf::from(&request.output_path);
  validate_export_output_path(&output_path)?;

  if same_path(&source_path, &output_path) {
    return Err("Export output must differ from the source media.".to_string());
  }

  let args = build_ffmpeg_export_args(
    &source_path,
    &output_path,
    request.width,
    request.height,
    request.frame_rate,
  );

  let output = Command::new("ffmpeg")
    .args(&args)
    .output()
    .map_err(|error| format!("Could not run ffmpeg for native export: {error}"))?;

  if !output.status.success() {
    let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();

    return Err(if detail.is_empty() {
      "FFmpeg could not render the requested export.".to_string()
    } else {
      format!("FFmpeg could not render the requested export: {detail}")
    });
  }

  let metadata = fs::metadata(&output_path)
    .map_err(|error| format!("FFmpeg completed but the export file could not be inspected: {error}"))?;

  if metadata.len() == 0 {
    let _ = fs::remove_file(&output_path);
    return Err("FFmpeg completed but produced an empty export file.".to_string());
  }

  Ok(NativeExportRenderResult {
    output_path: output_path.to_string_lossy().into_owned(),
  })
}

#[tauri::command]
fn render_video_graph_to_mp4(
  request: NativeVideoGraphRenderRequest,
) -> Result<NativeExportRenderResult, String> {
  validate_native_video_graph_request_metadata(&request)?;

  let output_path = PathBuf::from(&request.output_path);
  validate_export_output_path(&output_path)?;

  let input_paths = request
    .inputs
    .iter()
    .map(|value| {
      let path = media_path(value)?;

      if !path.is_absolute() {
        return Err("Native video graph inputs must use absolute paths.".to_string());
      }

      if media_type(&path)? != "video" {
        return Err("Native video graph render currently supports video inputs only.".to_string());
      }

      if same_path(&path, &output_path) {
        return Err("Export output must differ from every graph input.".to_string());
      }

      Ok(path)
    })
    .collect::<Result<Vec<_>, String>>()?;

  let args = build_ffmpeg_video_graph_args(
    &input_paths,
    &request.filter_complex,
    &request.video_map,
    request.frame_rate,
    &output_path,
  );

  let output = Command::new("ffmpeg")
    .args(&args)
    .output()
    .map_err(|error| format!("Could not run ffmpeg for native video graph export: {error}"))?;

  if !output.status.success() {
    let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();

    return Err(if detail.is_empty() {
      "FFmpeg could not render the requested video graph.".to_string()
    } else {
      format!("FFmpeg could not render the requested video graph: {detail}")
    });
  }

  let metadata = fs::metadata(&output_path).map_err(|error| {
    format!(
      "FFmpeg completed but the video graph export file could not be inspected: {error}"
    )
  })?;

  if metadata.len() == 0 {
    let _ = fs::remove_file(&output_path);
    return Err("FFmpeg completed but produced an empty video graph export.".to_string());
  }

  Ok(NativeExportRenderResult {
    output_path: output_path.to_string_lossy().into_owned(),
  })
}

#[tauri::command]
fn get_media_http_url(
  state: tauri::State<'_, media_server::MediaServerState>,
  path: String,
) -> Result<String, String> {
  state.url_for_path(&path)
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

fn validate_native_export_settings(width: u32, height: u32, frame_rate: f64) -> Result<(), String> {
  if width < 2 || width % 2 != 0 {
    return Err("Export width must be a positive even number.".to_string());
  }

  if height < 2 || height % 2 != 0 {
    return Err("Export height must be a positive even number.".to_string());
  }

  if !frame_rate.is_finite() || frame_rate <= 0.0 || frame_rate > 240.0 {
    return Err("Export frame rate must be between 0 and 240 fps.".to_string());
  }

  Ok(())
}

fn validate_export_output_path(path: &Path) -> Result<(), String> {
  if !path.is_absolute() {
    return Err("Export output path must be absolute.".to_string());
  }

  let extension = path
    .extension()
    .and_then(|value| value.to_str())
    .map(str::to_ascii_lowercase);

  if extension.as_deref() != Some("mp4") {
    return Err("Export output path must use the .mp4 extension.".to_string());
  }

  let parent = path
    .parent()
    .filter(|parent| !parent.as_os_str().is_empty())
    .ok_or_else(|| "Export output path must have a parent directory.".to_string())?;

  if !parent.is_dir() {
    return Err("Export output directory does not exist.".to_string());
  }

  Ok(())
}

fn same_path(first: &Path, second: &Path) -> bool {
  let first_canonical = fs::canonicalize(first).ok();
  let second_canonical = fs::canonicalize(second)
    .ok()
    .or_else(|| {
      second
        .parent()
        .and_then(|parent| fs::canonicalize(parent).ok())
        .map(|parent| parent.join(second.file_name().unwrap_or_default()))
    });

  first_canonical.is_some() && first_canonical == second_canonical
}

fn validate_native_video_graph_request_metadata(
  request: &NativeVideoGraphRenderRequest,
) -> Result<(), String> {
  validate_native_export_settings(request.width, request.height, request.frame_rate)?;

  if request.inputs.is_empty() {
    return Err("Native video graph render requires at least one input.".to_string());
  }

  if request.filter_complex.trim().is_empty() {
    return Err("Native video graph render requires a filter graph.".to_string());
  }

  if request.video_map != "[vout]" {
    return Err("Native video graph render requires the [vout] output map.".to_string());
  }

  Ok(())
}

fn build_ffmpeg_video_graph_args(
  input_paths: &[PathBuf],
  filter_complex: &str,
  video_map: &str,
  frame_rate: f64,
  output_path: &Path,
) -> Vec<std::ffi::OsString> {
  let mut args = vec![
    "-hide_banner".into(),
    "-loglevel".into(),
    "error".into(),
    "-y".into(),
  ];

  for input_path in input_paths {
    args.push("-i".into());
    args.push(input_path.as_os_str().to_os_string());
  }

  args.extend([
    "-filter_complex".into(),
    filter_complex.into(),
    "-map".into(),
    video_map.into(),
    "-an".into(),
    "-r".into(),
    frame_rate.to_string().into(),
    "-c:v".into(),
    "libx264".into(),
    "-preset".into(),
    "veryfast".into(),
    "-pix_fmt".into(),
    "yuv420p".into(),
    "-crf".into(),
    "18".into(),
    "-movflags".into(),
    "+faststart".into(),
    "-f".into(),
    "mp4".into(),
    output_path.as_os_str().to_os_string(),
  ]);

  args
}

fn build_ffmpeg_export_args(
  source_path: &Path,
  output_path: &Path,
  width: u32,
  height: u32,
  frame_rate: f64,
) -> Vec<std::ffi::OsString> {
  vec![
    "-hide_banner".into(),
    "-loglevel".into(),
    "error".into(),
    "-y".into(),
    "-i".into(),
    source_path.as_os_str().to_os_string(),
    "-map".into(),
    "0:v:0".into(),
    "-map".into(),
    "0:a:0?".into(),
    "-sn".into(),
    "-dn".into(),
    "-vf".into(),
    format!(
      "scale=w={width}:h={height}:force_original_aspect_ratio=decrease,pad=w={width}:h={height}:x=(ow-iw)/2:y=(oh-ih)/2"
    ).into(),
    "-r".into(),
    frame_rate.to_string().into(),
    "-c:v".into(),
    "libx264".into(),
    "-preset".into(),
    "veryfast".into(),
    "-pix_fmt".into(),
    "yuv420p".into(),
    "-crf".into(),
    "18".into(),
    "-c:a".into(),
    "aac".into(),
    "-b:a".into(),
    "192k".into(),
    "-movflags".into(),
    "+faststart".into(),
    "-f".into(),
    "mp4".into(),
    output_path.as_os_str().to_os_string(),
  ]
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
    .manage(media_server::MediaServerState::start().expect("could not start local media server"))
    .invoke_handler(tauri::generate_handler![
      inspect_media,
      prepare_media_preview,
      render_single_source_to_mp4,
      render_video_graph_to_mp4,
      get_media_http_url,
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
  fn validates_native_export_settings() {
    assert!(super::validate_native_export_settings(1280, 720, 30.0).is_ok());
    assert!(super::validate_native_export_settings(1279, 720, 30.0).is_err());
    assert!(super::validate_native_export_settings(1280, 719, 30.0).is_err());
    assert!(super::validate_native_export_settings(1280, 720, 0.0).is_err());
    assert!(super::validate_native_export_settings(1280, 720, 241.0).is_err());
  }

  #[test]
  fn validates_native_mp4_output_paths() {
    assert!(super::validate_export_output_path(Path::new("/tmp/output.mp4")).is_ok());
    assert!(super::validate_export_output_path(Path::new("relative/output.mp4")).is_err());
    assert!(super::validate_export_output_path(Path::new("/tmp/output.mov")).is_err());
  }

  #[test]
  fn builds_ffmpeg_export_arguments_without_shell_interpolation() {
    let args = super::build_ffmpeg_export_args(
      Path::new("/media/My Video; clip.mp4"),
      Path::new("/tmp/My Export.mp4"),
      1280,
      720,
      29.97,
    );

    assert!(args.iter().any(|arg| arg.to_string_lossy() == "/media/My Video; clip.mp4"));
    assert!(args.iter().any(|arg| arg.to_string_lossy() == "/tmp/My Export.mp4"));
    assert!(args.iter().any(|arg| arg.to_string_lossy() == "scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=w=1280:h=720:x=(ow-iw)/2:y=(oh-ih)/2"));
    assert!(args.iter().any(|arg| arg.to_string_lossy() == "29.97"));
  }

  #[test]
  fn validates_native_video_graph_request_metadata() {
    let valid = super::NativeVideoGraphRenderRequest {
      inputs: vec!["/media/a.mp4".to_string()],
      output_path: "/tmp/output.mp4".to_string(),
      width: 1280,
      height: 720,
      frame_rate: 30.0,
      filter_complex: "[0:v:0]trim=start=0:end=1[v0]".to_string(),
      video_map: "[vout]".to_string(),
    };

    assert!(super::validate_native_video_graph_request_metadata(&valid).is_ok());

    let mut missing_inputs = valid;
    missing_inputs.inputs.clear();
    assert!(super::validate_native_video_graph_request_metadata(&missing_inputs).is_err());

    let mut missing_graph = super::NativeVideoGraphRenderRequest {
      inputs: vec!["/media/a.mp4".to_string()],
      output_path: "/tmp/output.mp4".to_string(),
      width: 1280,
      height: 720,
      frame_rate: 30.0,
      filter_complex: String::new(),
      video_map: "[vout]".to_string(),
    };
    assert!(super::validate_native_video_graph_request_metadata(&missing_graph).is_err());

    missing_graph.filter_complex = "null[v0]".to_string();
    missing_graph.video_map = "[other]".to_string();
    assert!(super::validate_native_video_graph_request_metadata(&missing_graph).is_err());
  }

  #[test]
  fn builds_ffmpeg_video_graph_arguments_with_structured_inputs() {
    let args = super::build_ffmpeg_video_graph_args(
      &[
        Path::new("/media/First Video.mp4").to_path_buf(),
        Path::new("/media/Second; Video.mp4").to_path_buf(),
      ],
      "[0:v:0]trim=start=0:end=1[clip0];[1:v:0]trim=start=0:end=2[clip1];[clip0][clip1]concat=n=2:v=1:a=0[vout]",
      "[vout]",
      30.0,
      Path::new("/tmp/FrameFlow Export.mp4"),
    );

    let values: Vec<String> = args
      .iter()
      .map(|arg| arg.to_string_lossy().into_owned())
      .collect();

    assert_eq!(values[values.iter().position(|value| value == "-i").unwrap() + 1], "/media/First Video.mp4");
    assert!(values.windows(2).any(|pair| pair == ["-i".to_string(), "/media/Second; Video.mp4".to_string()]));
    assert!(values.windows(2).any(|pair| pair == ["-filter_complex".to_string(), "[0:v:0]trim=start=0:end=1[clip0];[1:v:0]trim=start=0:end=2[clip1];[clip0][clip1]concat=n=2:v=1:a=0[vout]".to_string()]));
    assert!(values.windows(2).any(|pair| pair == ["-map".to_string(), "[vout]".to_string()]));
    assert!(values.iter().any(|value| value == "-an"));
    assert!(values.iter().any(|value| value == "/tmp/FrameFlow Export.mp4"));
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
