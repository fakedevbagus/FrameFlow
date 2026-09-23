use std::{
  fs,
  path::{Path, PathBuf},

};

use serde::{Deserialize, Serialize};

use crate::{export_process, probe_has_audio, validate_native_export_settings};

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



#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeVideoWithAudioGraphRenderRequest {
  pub video_source_path: String,
  pub audio_inputs: Vec<String>,
  pub audio_filter_complex: String,
  pub audio_map: String,
  pub duration_ms: u64,
  pub output_path: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeVideoAudioGraphRenderRequest {
  pub video_inputs: Vec<String>,
  pub video_input_media_types: Vec<String>,
  pub audio_inputs: Vec<String>,
  pub video_filter_complex: String,
  pub video_map: String,
  pub audio_filter_complex: String,
  pub audio_map: String,
  pub duration_ms: u64,
  pub width: u32,
  pub height: u32,
  pub frame_rate: f64,
  pub output_path: String,
}

#[tauri::command]
pub fn render_video_audio_graph_to_mp4(
  app: tauri::AppHandle,
  state: tauri::State<'_, export_process::ExportProcessState>,
  job_id: Option<String>,
  request: NativeVideoAudioGraphRenderRequest,
) -> Result<NativeAudioRenderResult, String> {
  validate_video_audio_graph_request(&request)?;

  let output_path = PathBuf::from(&request.output_path);

  let video_paths = request
    .video_inputs
    .iter()
    .enumerate()
    .map(|(index, value)| {
      let path = PathBuf::from(value);

      if !path.is_absolute() {
        return Err(
          "Native unified AV graph video inputs must use absolute paths.".to_string()
        );
      }

      if !path.is_file() {
        return Err(format!(
          "Native unified AV graph video input does not exist: {}",
          path.display()
        ));
      }

      let actual_type = media_type(&path)?;
      let expected_type = request
        .video_input_media_types
        .get(index)
        .map(String::as_str)
        .unwrap_or_default();

      if actual_type != expected_type {
        return Err(format!(
          "Native unified AV graph video input media type mismatch at index {index}."
        ));
      }

      if actual_type != "video" && actual_type != "image" {
        return Err(
          "Native unified AV graph video inputs must be video or image sources.".to_string()
        );
      }

      if same_path(&path, &output_path) {
        return Err(
          "Export output must differ from every unified AV graph video input.".to_string()
        );
      }

      Ok(path)
    })
    .collect::<Result<Vec<_>, String>>()?;

  let audio_paths = request
    .audio_inputs
    .iter()
    .map(|value| {
      let path = PathBuf::from(value);

      if !path.is_absolute() {
        return Err(
          "Native unified AV graph audio inputs must use absolute paths.".to_string()
        );
      }

      if !path.is_file() {
        return Err(format!(
          "Native unified AV graph audio input does not exist: {}",
          path.display()
        ));
      }

      if media_type(&path)? != "audio" {
        return Err(
          "Native unified AV graph audio inputs must be audio sources only.".to_string()
        );
      }

      if same_path(&path, &output_path) {
        return Err(
          "Export output must differ from every unified AV graph audio input.".to_string()
        );
      }

      Ok(path)
    })
    .collect::<Result<Vec<_>, String>>()?;

  let args = build_ffmpeg_video_audio_graph_args(
    &video_paths,
    &request.video_input_media_types,
    &audio_paths,
    &request.video_filter_complex,
    &request.video_map,
    &request.audio_filter_complex,
    &request.audio_map,
    request.duration_ms,
    request.width,
    request.height,
    request.frame_rate,
    &output_path,
  );

  if let Err(error) = export_process::run_ffmpeg_with_progress(
    &app,
    state.inner(),
    args,
    job_id.as_deref(),
    "export",
    Some(request.duration_ms),
    0,
    None,
    "the unified video and audio graph",
  ) {
    let _ = fs::remove_file(&output_path);
    return Err(error);
  }

  let metadata = fs::metadata(&output_path).map_err(|error| {
    let _ = fs::remove_file(&output_path);
    format!(
      "FFmpeg completed but the unified AV export file could not be inspected: {error}"
    )
  })?;

  if metadata.len() == 0 {
    let _ = fs::remove_file(&output_path);
    return Err("FFmpeg completed but produced an empty unified AV export.".to_string());
  }

  Ok(NativeAudioRenderResult {
    output_path: output_path.to_string_lossy().into_owned(),
  })
}

fn validate_video_audio_graph_request(
  request: &NativeVideoAudioGraphRenderRequest,
) -> Result<(), String> {
  if request.video_inputs.is_empty() {
    return Err("Native unified AV graph requires at least one video input.".to_string());
  }

  if request.video_input_media_types.len() != request.video_inputs.len() {
    return Err(
      "Native unified AV graph video media types must match the video input count.".to_string(),
    );
  }

  if request.audio_inputs.is_empty() {
    return Err("Native unified AV graph requires at least one audio input.".to_string());
  }

  if request.video_filter_complex.trim().is_empty() {
    return Err("Native unified AV graph requires a video filter graph.".to_string());
  }

  if request.audio_filter_complex.trim().is_empty() {
    return Err("Native unified AV graph requires an audio filter graph.".to_string());
  }

  if request.video_map != "[vout]" {
    return Err("Native unified AV graph requires the [vout] video map.".to_string());
  }

  if request.audio_map != "[aout]" {
    return Err("Native unified AV graph requires the [aout] audio map.".to_string());
  }

  if request.duration_ms == 0 {
    return Err("Native unified AV graph requires a positive duration.".to_string());
  }

  for media_type in &request.video_input_media_types {
    if media_type != "video" && media_type != "image" {
      return Err(
        "Native unified AV graph video media types must be video or image.".to_string(),
      );
    }
  }

  validate_native_export_settings(
    request.width,
    request.height,
    request.frame_rate,
  )?;

  validate_mp4_output_path(Path::new(&request.output_path))
}

fn build_ffmpeg_video_audio_graph_args(
  video_paths: &[PathBuf],
  video_input_media_types: &[String],
  audio_paths: &[PathBuf],
  video_filter_complex: &str,
  video_map: &str,
  audio_filter_complex: &str,
  audio_map: &str,
  duration_ms: u64,
  _width: u32,
  _height: u32,
  frame_rate: f64,
  output_path: &Path,
) -> Vec<std::ffi::OsString> {
  let mut args = vec![
    "-hide_banner".into(),
    "-loglevel".into(),
    "error".into(),
    "-y".into(),
  ];

  for (index, video_path) in video_paths.iter().enumerate() {
    if video_input_media_types.get(index).map(String::as_str) == Some("image") {
      args.extend([
        "-loop".into(),
        "1".into(),
        "-framerate".into(),
        frame_rate.to_string().into(),
      ]);
    }

    args.push("-i".into());
    args.push(video_path.as_os_str().to_os_string());
  }

  for audio_path in audio_paths {
    args.push("-i".into());
    args.push(audio_path.as_os_str().to_os_string());
  }

  args.extend([
    "-filter_complex".into(),
    format!("{};{}", video_filter_complex, audio_filter_complex).into(),
    "-map".into(),
    video_map.into(),
    "-map".into(),
    audio_map.into(),
    "-t".into(),
    ((duration_ms as f64) / 1000.0).to_string().into(),
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
#[tauri::command]
pub fn render_video_with_audio_graph_to_mp4(
  app: tauri::AppHandle,
  state: tauri::State<'_, export_process::ExportProcessState>,
  job_id: Option<String>,
  request: NativeVideoWithAudioGraphRenderRequest,
) -> Result<NativeAudioRenderResult, String> {
  validate_video_audio_mix_request(&request)?;

  let video_path = PathBuf::from(&request.video_source_path);
  let output_path = PathBuf::from(&request.output_path);

  if !video_path.is_file() {
    return Err(format!(
      "Native video/audio mix video input does not exist: {}",
      video_path.display()
    ));
  }

  let audio_paths = request
    .audio_inputs
    .iter()
    .map(|value| {
      let path = PathBuf::from(value);

      if !path.is_absolute() {
        return Err("Native video/audio mix inputs must use absolute paths.".to_string());
      }

      if !path.is_file() {
        return Err(format!(
          "Native video/audio mix audio input does not exist: {}",
          path.display()
        ));
      }

      if media_type(&path)? != "audio" {
        return Err("Native video/audio mix inputs must be audio sources only.".to_string());
      }

      if same_path(&path, &output_path) {
        return Err(
          "Export output must differ from every independent audio mix input.".to_string()
        );
      }

      Ok(path)
    })
    .collect::<Result<Vec<_>, String>>()?;

  let has_video_audio = probe_has_audio(&video_path)?;
  let temporary_path = temporary_audio_mix_path(&output_path);
  let args = build_ffmpeg_video_with_audio_graph_args(
    &video_path,
    &audio_paths,
    &request.audio_filter_complex,
    &request.audio_map,
    request.duration_ms,
    has_video_audio,
    &temporary_path,
  );

  if let Err(error) = export_process::run_ffmpeg_with_progress(
    &app,
    state.inner(),
    args,
    job_id.as_deref(),
    "audio-mix",
    Some(request.duration_ms),
    0,
    None,
    "the project video and audio graph",
  ) {
    let _ = fs::remove_file(&temporary_path);
    return Err(error);
  }

  let metadata = fs::metadata(&temporary_path).map_err(|error| {
    let _ = fs::remove_file(&temporary_path);
    format!(
      "FFmpeg completed but the mixed export file could not be inspected: {error}"
    )
  })?;

  if metadata.len() == 0 {
    let _ = fs::remove_file(&temporary_path);
    return Err("FFmpeg completed but produced an empty mixed export.".to_string());
  }

  fs::rename(&temporary_path, &output_path).map_err(|error| {
    let _ = fs::remove_file(&temporary_path);
    format!(
      "Could not finalize the mixed export '{}': {error}",
      output_path.display()
    )
  })?;

  Ok(NativeAudioRenderResult {
    output_path: output_path.to_string_lossy().into_owned(),
  })
}

fn validate_video_audio_mix_request(
  request: &NativeVideoWithAudioGraphRenderRequest,
) -> Result<(), String> {
  if request.audio_inputs.is_empty() {
    return Err("Native video/audio mix requires at least one audio input.".to_string());
  }

  if request.duration_ms == 0 {
    return Err("Native video/audio mix requires a positive duration.".to_string());
  }

  if request.audio_filter_complex.trim().is_empty() {
    return Err("Native video/audio mix requires an audio filter graph.".to_string());
  }

  if request.audio_map != "[aout]" {
    return Err("Native video/audio mix requires the [aout] audio map.".to_string());
  }

  let video_path = Path::new(&request.video_source_path);
  if !video_path.is_absolute() {
    return Err("Native video/audio mix video input must use an absolute path.".to_string());
  }

  if media_type(video_path)? != "video" {
    return Err("Native video/audio mix video input must be a video source.".to_string());
  }

  let output_path = Path::new(&request.output_path);
  validate_mp4_output_path(output_path)
}

fn validate_mp4_output_path(output_path: &Path) -> Result<(), String> {
  if !output_path.is_absolute() {
    return Err("Export output path must be absolute.".to_string());
  }

  if output_path
    .extension()
    .and_then(|value| value.to_str())
    .map(str::to_ascii_lowercase)
    .as_deref()
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

fn temporary_audio_mix_path(output_path: &Path) -> PathBuf {
  let stamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|value| value.as_nanos())
    .unwrap_or_default();

  output_path
    .parent()
    .unwrap_or_else(|| Path::new("."))
    .join(format!(".frameflow-audio-mix-{stamp}.tmp.mp4"))
}

fn build_ffmpeg_video_with_audio_graph_args(
  video_path: &Path,
  audio_paths: &[PathBuf],
  audio_filter_complex: &str,
  audio_map: &str,
  duration_ms: u64,
  has_video_audio: bool,
  output_path: &Path,
) -> Vec<std::ffi::OsString> {
  let duration_seconds = duration_ms as f64 / 1000.0;

  let mut args = vec![
    "-hide_banner".into(),
    "-loglevel".into(),
    "error".into(),
    "-y".into(),
    "-i".into(),
    video_path.as_os_str().to_os_string(),
  ];

  for audio_path in audio_paths {
    args.push("-i".into());
    args.push(audio_path.as_os_str().to_os_string());
  }

  let base_audio = if has_video_audio {
    format!(
      "[0:a:0]aformat=sample_rates=48000:channel_layouts=stereo,apad,atrim=duration={duration_seconds},asetpts=PTS-STARTPTS[baseaudio]"
    )
  } else {
    format!(
      "anullsrc=r=48000:cl=stereo,atrim=duration={duration_seconds},asetpts=PTS-STARTPTS[baseaudio]"
    )
  };

  let mixed_graph = format!(
    "{audio_filter_complex};{base_audio};[baseaudio]{audio_map}amix=inputs=2:duration=longest:dropout_transition=0:normalize=1[amixed]"
  );

  args.extend([
    "-filter_complex".into(),
    mixed_graph.into(),
    "-map".into(),
    "0:v:0".into(),
    "-map".into(),
    "[amixed]".into(),
    "-c:v".into(),
    "copy".into(),
    "-c:a".into(),
    "aac".into(),
    "-b:a".into(),
    "192k".into(),
    "-ar".into(),
    "48000".into(),
    "-ac".into(),
    "2".into(),
    "-shortest".into(),
    "-movflags".into(),
    "+faststart".into(),
    "-f".into(),
    "mp4".into(),
    output_path.as_os_str().to_os_string(),
  ]);

  args
}

#[tauri::command]
pub fn render_audio_graph_to_mp4(
  app: tauri::AppHandle,
  state: tauri::State<'_, export_process::ExportProcessState>,
  job_id: Option<String>,
  duration_ms: Option<u64>,
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

  if let Err(error) = export_process::run_ffmpeg_with_progress(
    &app,
    state.inner(),
    args,
    job_id.as_deref(),
    "audio",
    duration_ms,
    0,
    None,
    "the requested audio graph",
  ) {
    let _ = fs::remove_file(&output_path);
    return Err(error);
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
    build_ffmpeg_audio_graph_args, build_ffmpeg_video_audio_graph_args,
    build_ffmpeg_video_with_audio_graph_args, media_type,
    validate_request, validate_video_audio_graph_request, validate_video_audio_mix_request,
    NativeAudioGraphRenderRequest, NativeVideoAudioGraphRenderRequest,
    NativeVideoWithAudioGraphRenderRequest,
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
  #[test]
  fn validates_video_audio_mix_request_metadata() {
    let valid = NativeVideoWithAudioGraphRenderRequest {
      video_source_path: "/media/video.mp4".to_string(),
      audio_inputs: vec!["/media/music.mp3".to_string()],
      audio_filter_complex: "anullsrc=r=48000:cl=stereo[aout]".to_string(),
      audio_map: "[aout]".to_string(),
      duration_ms: 5_000,
      output_path: "/tmp/final.mp4".to_string(),
    };

    assert!(validate_video_audio_mix_request(&valid).is_ok());

    let mut missing_audio = valid;
    missing_audio.audio_inputs.clear();
    assert!(validate_video_audio_mix_request(&missing_audio).is_err());

    let mut missing_graph = NativeVideoWithAudioGraphRenderRequest {
      video_source_path: "/media/video.mp4".to_string(),
      audio_inputs: vec!["/media/music.mp3".to_string()],
      audio_filter_complex: String::new(),
      audio_map: "[aout]".to_string(),
      duration_ms: 5_000,
      output_path: "/tmp/final.mp4".to_string(),
    };
    assert!(validate_video_audio_mix_request(&missing_graph).is_err());

    missing_graph.audio_filter_complex = "anullsrc[aout]".to_string();
    missing_graph.audio_map = "[other]".to_string();
    assert!(validate_video_audio_mix_request(&missing_graph).is_err());

    let mut invalid_duration = NativeVideoWithAudioGraphRenderRequest {
      video_source_path: "/media/video.mp4".to_string(),
      audio_inputs: vec!["/media/music.mp3".to_string()],
      audio_filter_complex: "anullsrc[aout]".to_string(),
      audio_map: "[aout]".to_string(),
      duration_ms: 0,
      output_path: "/tmp/final.mp4".to_string(),
    };
    assert!(validate_video_audio_mix_request(&invalid_duration).is_err());

    invalid_duration.duration_ms = 5_000;
    invalid_duration.output_path = "/tmp/final.mov".to_string();
    assert!(validate_video_audio_mix_request(&invalid_duration).is_err());
  }

  #[test]
  fn validates_unified_video_audio_graph_request_metadata() {
    let valid = NativeVideoAudioGraphRenderRequest {
      video_inputs: vec!["/media/video.mp4".to_string()],
      video_input_media_types: vec!["video".to_string()],
      audio_inputs: vec!["/media/music.mp3".to_string()],
      video_filter_complex: "[0:v:0]null[vout]".to_string(),
      video_map: "[vout]".to_string(),
      audio_filter_complex: "[1:a:0]anull[aout]".to_string(),
      audio_map: "[aout]".to_string(),
      duration_ms: 5_000,
      width: 1_280,
      height: 720,
      frame_rate: 30.0,
      output_path: "/tmp/final.mp4".to_string(),
    };

    assert!(validate_video_audio_graph_request(&valid).is_ok());

    let mut missing_video = NativeVideoAudioGraphRenderRequest {
      video_inputs: Vec::new(),
      video_input_media_types: vec!["video".to_string()],
      audio_inputs: vec!["/media/music.mp3".to_string()],
      video_filter_complex: "[0:v:0]null[vout]".to_string(),
      video_map: "[vout]".to_string(),
      audio_filter_complex: "[1:a:0]anull[aout]".to_string(),
      audio_map: "[aout]".to_string(),
      duration_ms: 5_000,
      width: 1_280,
      height: 720,
      frame_rate: 30.0,
      output_path: "/tmp/final.mp4".to_string(),
    };
    assert!(validate_video_audio_graph_request(&missing_video).is_err());
    missing_video.video_inputs = vec!["/media/video.mp4".to_string()];

    let mut mismatched_types = NativeVideoAudioGraphRenderRequest {
      video_inputs: vec!["/media/video.mp4".to_string()],
      video_input_media_types: Vec::new(),
      audio_inputs: vec!["/media/music.mp3".to_string()],
      video_filter_complex: "[0:v:0]null[vout]".to_string(),
      video_map: "[vout]".to_string(),
      audio_filter_complex: "[1:a:0]anull[aout]".to_string(),
      audio_map: "[aout]".to_string(),
      duration_ms: 5_000,
      width: 1_280,
      height: 720,
      frame_rate: 30.0,
      output_path: "/tmp/final.mp4".to_string(),
    };
    assert!(validate_video_audio_graph_request(&mismatched_types).is_err());

    mismatched_types.video_input_media_types = vec!["audio".to_string()];
    assert!(validate_video_audio_graph_request(&mismatched_types).is_err());

    let missing_audio = NativeVideoAudioGraphRenderRequest {
      video_inputs: vec!["/media/video.mp4".to_string()],
      video_input_media_types: vec!["video".to_string()],
      audio_inputs: Vec::new(),
      video_filter_complex: "[0:v:0]null[vout]".to_string(),
      video_map: "[vout]".to_string(),
      audio_filter_complex: "[1:a:0]anull[aout]".to_string(),
      audio_map: "[aout]".to_string(),
      duration_ms: 5_000,
      width: 1_280,
      height: 720,
      frame_rate: 30.0,
      output_path: "/tmp/final.mp4".to_string(),
    };
    assert!(validate_video_audio_graph_request(&missing_audio).is_err());

    let mut missing_filter = NativeVideoAudioGraphRenderRequest {
      video_inputs: vec!["/media/video.mp4".to_string()],