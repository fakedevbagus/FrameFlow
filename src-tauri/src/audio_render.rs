use std::{
  fs,
  path::{Path, PathBuf},
  process::Command,
};

use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAudioGraphRenderRequest {
  pub inputs: Vec<String>,
  pub output_path: String,
  pub filter_complex: String,
  pub audio_map: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAudioRenderResult {
  output_path: String,
}

#[tauri::command]
pub fn render_audio_graph_to_mp4(
  request: NativeAudioGraphRenderRequest,
) -> Result<NativeAudioRenderResult, String> {
  validate_request(&request)?;

  let output_path = PathBuf::from(&request.output_path);

  let input_paths = request
    .inputs
    .iter()
    .map(|value| {
      let path = PathBuf::from(value);

      if !path.is_absolute() {
        return Err("Native audio graph inputs must use absolute paths.".to_string());
      }

      if !path.is_file() {
        return Err(format!(
          "Native audio graph input does not exist: {}",
          path.display()
        ));
      }

      if media_type(&path)? != "audio" {
        return Err("Native audio graph inputs must be audio sources only.".to_string());
      }

      if same_path(&path, &output_path) {
        return Err("Export output must differ from every audio graph input.".to_string());
      }

      Ok(path)
    })
    .collect::<Result<Vec<_>, String>>()?;

  let args = build_ffmpeg_audio_graph_args(
    &input_paths,
    &request.filter_complex,
    &request.audio_map,
    &output_path,
  );

  let output = Command::new("ffmpeg")
    .args(&args)
    .output()
    .map_err(|error| format!("Could not run ffmpeg for native audio graph export: {error}"))?;

  if !output.status.success() {
    let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();

    return Err(if detail.is_empty() {
      "FFmpeg could not render the requested audio graph.".to_string()
    } else {
      format!("FFmpeg could not render the requested audio graph: {detail}")
    });
  }

  let metadata = fs::metadata(&output_path).map_err(|error| {
    format!(
      "FFmpeg completed but the audio graph export file could not be inspected: {error}"
    )
  })?;

  if metadata.len() == 0 {
    let _ = fs::remove_file(&output_path);
    return Err("FFmpeg completed but produced an empty audio graph export.".to_string());
  }

  Ok(NativeAudioRenderResult {
    output_path: output_path.to_string_lossy().into_owned(),
  })
}

fn validate_request(request: &NativeAudioGraphRenderRequest) -> Result<(), String> {
  if request.inputs.is_empty() {
    return Err("Native audio graph render requires at least one input.".to_string());
  }

  if request.filter_complex.trim().is_empty() {
    return Err("Native audio graph render requires a filter graph.".to_string());
  }

  if request.audio_map != "[aout]" {
    return Err("Native audio graph render requires the [aout] output map.".to_string());
  }

  let output_path = Path::new(&request.output_path);

  if !output_path.is_absolute() {
    return Err("Export output path must be absolute.".to_string());
  }

  if output_path.extension().and_then(|value| value.to_str()).map(str::to_ascii_lowercase).as_deref()
    != Some("mp4")
  {
    return Err("Export output path must use the .mp4 extension.".to_string());
  }

  let parent = output_path
    .parent()
    .filter(|parent| !parent.as_os_str().is_empty())
    .ok_or_else(|| "Export output path must have a parent directory.".to_string())?;

  if !parent.is_dir() {
    return Err("Export output directory does not exist.".to_string());
  }

  Ok(())
}

fn build_ffmpeg_audio_graph_args(
  input_paths: &[PathBuf],
  filter_complex: &str,
  audio_map: &str,
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
    audio_map.into(),
    "-vn".into(),
    "-c:a".into(),
    "aac".into(),
    "-b:a".into(),
    "192k".into(),
    "-ar".into(),
    "48000".into(),
    "-ac".into(),
    "2".into(),
    "-movflags".into(),
    "+faststart".into(),
    "-f".into(),
    "mp4".into(),
    output_path.as_os_str().to_os_string(),
  ]);

  args
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

#[cfg(test)]
mod tests {
  use super::{
    build_ffmpeg_audio_graph_args, media_type, validate_request, NativeAudioGraphRenderRequest,
  };
  use std::path::{Path, PathBuf};

  #[test]
  fn recognizes_audio_extensions() {
    assert_eq!(media_type(Path::new("music.MP3")).unwrap(), "audio");
    assert_eq!(media_type(Path::new("voice.wav")).unwrap(), "audio");
  }

  #[test]
  fn rejects_invalid_audio_graph_metadata() {
    let valid = NativeAudioGraphRenderRequest {
      inputs: vec!["/media/music.mp3".to_string()],
      output_path: "/tmp/audio.mp4".to_string(),
      filter_complex: "[silence]anull[aout]".to_string(),
      audio_map: "[aout]".to_string(),
    };

    assert!(validate_request(&valid).is_ok());

    let mut missing_inputs = valid;
    missing_inputs.inputs.clear();
    assert!(validate_request(&missing_inputs).is_err());

    let mut missing_graph = NativeAudioGraphRenderRequest {
      inputs: vec!["/media/music.mp3".to_string()],
      output_path: "/tmp/audio.mp4".to_string(),
      filter_complex: String::new(),
      audio_map: "[aout]".to_string(),
    };
    assert!(validate_request(&missing_graph).is_err());

    missing_graph.filter_complex = "anullsrc[aout]".to_string();
    missing_graph.audio_map = "[other]".to_string();
    assert!(validate_request(&missing_graph).is_err());

    let mut invalid_output = NativeAudioGraphRenderRequest {
      inputs: vec!["/media/music.mp3".to_string()],
      output_path: "relative/audio.mp4".to_string(),
      filter_complex: "anullsrc[aout]".to_string(),
      audio_map: "[aout]".to_string(),
    };
    assert!(validate_request(&invalid_output).is_err());

    invalid_output.output_path = "/tmp/audio.mov".to_string();
    assert!(validate_request(&invalid_output).is_err());
  }

  #[test]
  fn builds_ffmpeg_audio_graph_arguments_without_shell_interpolation() {
    let input_paths = vec![
      PathBuf::from("/media/Music Track; one.mp3"),
      PathBuf::from("/media/Voice Two.wav"),
    ];

    let args = build_ffmpeg_audio_graph_args(
      &input_paths,
      "[0:a:0]atrim=start=0:end=2[a0];[1:a:0]adelay=1500:all=1[a1];[a0][a1]amix=inputs=2[aout]",
      "[aout]",
      Path::new("/tmp/FrameFlow Audio.mp4"),
    );

    let values: Vec<String> = args
      .iter()
      .map(|arg| arg.to_string_lossy().into_owned())
      .collect();

    assert!(values.windows(2).any(|pair| pair == [
      "-i".to_string(),
      "/media/Music Track; one.mp3".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-i".to_string(),
      "/media/Voice Two.wav".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-filter_complex".to_string(),
      "[0:a:0]atrim=start=0:end=2[a0];[1:a:0]adelay=1500:all=1[a1];[a0][a1]amix=inputs=2[aout]".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-map".to_string(),
      "[aout]".to_string()
    ]));
    assert!(values.iter().any(|value| value == "-vn"));
    assert!(values.windows(2).any(|pair| pair == [
      "-c:a".to_string(),
      "aac".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-ar".to_string(),
      "48000".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-ac".to_string(),
      "2".to_string()
    ]));
    assert!(values.iter().any(|value| value == "/tmp/FrameFlow Audio.mp4"));
  }
}
