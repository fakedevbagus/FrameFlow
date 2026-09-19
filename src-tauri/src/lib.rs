use std::{
  fs,
  path::{Path, PathBuf},
};

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
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![open_project, save_project])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
