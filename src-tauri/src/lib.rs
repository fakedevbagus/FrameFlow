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
  let output = Command::new("ffprobe")
    .args([
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
    ])
    .arg(path)
    .output()
    .map_err(|error| format!("Could not run ffprobe: {error}"))?;

  if !output.status.success() {
    let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();

    return Err(if detail.is_empty() {
      "ffprobe could not read the selected media file.".to_string()
    } else {
      format!("ffprobe could not read the selected media file: {detail}")
    });
  }

  let duration = String::from_utf8_lossy(&output.stdout)
    .trim()
    .parse::<f64>()
    .map_err(|_| "ffprobe returned an invalid duration.".to_string())?;

  if !duration.is_finite() || duration < 0.0 {
    return Err("ffprobe returned an invalid duration.".to_string());
  }

  Ok((duration * 1000.0).round() as u64)
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
