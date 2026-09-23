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
#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NativeSourceAudioSegment {
  pub input_index: usize,
  pub source_start_ms: u64,
  pub timeline_start_ms: u64,
  pub duration_ms: u64,
  pub track_volume: f64,
  pub track_pan: f64,
}

struct ResolvedSourceAudioSegment {
  input_index: usize,
  source_start_ms: u64,
  timeline_start_ms: u64,
  duration_ms: u64,
  track_volume: f64,
  track_pan: f64,
  has_audio: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeVideoAudioGraphRenderRequest {
  pub video_inputs: Vec<String>,
  pub video_input_media_types: Vec<String>,
  pub audio_inputs: Vec<String>,
  #[serde(default)]
  pub source_audio_segments: Vec<NativeSourceAudioSegment>,
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

  let source_audio_segments = request
    .source_audio_segments
    .iter()
    .map(|segment| {
      let Some(video_path) = video_paths.get(segment.input_index) else {
        return Err(format!(
          "Native unified AV graph source audio segment references invalid video input index {}.",
          segment.input_index
        ));
      };

      if request
        .video_input_media_types
        .get(segment.input_index)
        .map(String::as_str)
        != Some("video")
      {
        return Err(format!(
          "Native unified AV graph source audio segment at input index {} requires a video input.",
          segment.input_index
        ));
      }

      let has_audio = probe_has_audio(video_path)?;

      Ok(ResolvedSourceAudioSegment {
        input_index: segment.input_index,
        source_start_ms: segment.source_start_ms,
        timeline_start_ms: segment.timeline_start_ms,
        duration_ms: segment.duration_ms,
        track_volume: segment.track_volume,
        track_pan: segment.track_pan,
        has_audio,
      })
    })
    .collect::<Result<Vec<_>, String>>()?;

  let args = build_ffmpeg_video_audio_graph_args(
    &video_paths,
    &request.video_input_media_types,
    &audio_paths,
    &source_audio_segments,
    &request.video_filter_complex,
    &request.video_map,
    &request.audio_filter_complex,
    &request.audio_map,
    request.duration_ms,
    request.width,
    request.height,
    request.frame_rate,
    &output_path,
  )?;

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

  for segment in &request.source_audio_segments {
    if segment.duration_ms == 0 {
      return Err(
        "Native unified AV graph source audio segments require a positive duration."
          .to_string(),
      );
    }

    let Some(media_type) = request.video_input_media_types.get(segment.input_index) else {
      return Err(format!(
        "Native unified AV graph source audio segment references invalid video input index {}.",
        segment.input_index
      ));
    };

    if media_type != "video" {
      return Err(format!(
        "Native unified AV graph source audio segment at input index {} requires a video input.",
        segment.input_index
      ));
    }
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
  source_audio_segments: &[ResolvedSourceAudioSegment],
  video_filter_complex: &str,
  video_map: &str,
  audio_filter_complex: &str,
  audio_map: &str,
  duration_ms: u64,
  _width: u32,
  _height: u32,
  frame_rate: f64,
  output_path: &Path,
) -> Result<Vec<std::ffi::OsString>, String> {
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

  let source_audio_filter = build_source_audio_filter(source_audio_segments);
  let (resolved_audio_filter_complex, resolved_audio_map) =
    if source_audio_filter.labels.is_empty() {
      (audio_filter_complex.to_string(), audio_map.to_string())
    } else {
      let explicit_audio_map = "[frameflow_explicit_audio]";
      let explicit_audio_filter =
        rename_audio_graph_output(audio_filter_complex, audio_map, explicit_audio_map)?;

      let source_labels = source_audio_filter.labels.concat();
      let mix_input_count = source_audio_filter.labels.len() + 1;
      (
        format!(
          "{};{};{}{}amix=inputs={}:duration=longest:dropout_transition=0{}",
          explicit_audio_filter,
          source_audio_filter.filter_complex,
          explicit_audio_map,
          source_labels,
          mix_input_count,
          audio_map,
        ),
        audio_map.to_string(),
      )
    };

  args.extend([
    "-filter_complex".into(),
    format!("{};{}", video_filter_complex, resolved_audio_filter_complex).into(),
    "-map".into(),
    video_map.into(),
    "-map".into(),
    resolved_audio_map.into(),
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

  Ok(args)
}

struct SourceAudioFilter {
  filter_complex: String,
  labels: Vec<String>,
}

fn build_source_audio_filter(
  segments: &[ResolvedSourceAudioSegment],
) -> SourceAudioFilter {
  let mut filter_parts = Vec::new();
  let mut labels = Vec::new();

  for segment in segments.iter().filter(|segment| segment.has_audio) {
    let source_end_ms = segment
      .source_start_ms
      .saturating_add(segment.duration_ms);
    let label = format!("[frameflow_source_audio_{}]", segment.input_index);
    let volume = segment.track_volume.clamp(0.0, 1.0);
    let pan = segment.track_pan.clamp(-1.0, 1.0);
    let mut filters = format!(
      "[{}:a:0]atrim=start={}:end={},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume={}",
      segment.input_index,
      format_seconds(segment.source_start_ms),
      format_seconds(source_end_ms),
      format_number(volume),
    );

    if pan.abs() >= 0.000001 {
      let normalized = (pan + 1.0) * std::f64::consts::PI / 4.0;
      let left_gain = normalized.cos();
      let right_gain = normalized.sin();
      filters.push_str(&format!(
        ",pan=stereo|c0={}*c0|c1={}*c1",
        format_number(left_gain),
        format_number(right_gain),
      ));
    }

    filters.push_str(&format!(
      ",adelay={}:all=1{}",
      segment.timeline_start_ms,
      label,
    ));
    filter_parts.push(filters);
    labels.push(label);
  }

  SourceAudioFilter {
    filter_complex: filter_parts.join(";"),
    labels,
  }
}

fn rename_audio_graph_output(
  filter_complex: &str,
  audio_map: &str,
  replacement: &str,
) -> Result<String, String> {
  let occurrences = filter_complex.match_indices(audio_map).count();

  if occurrences != 1 {
    return Err(
      "Unified AV audio graph must contain exactly one declared audio output label."
        .to_string(),
    );
  }

  let index = filter_complex
    .rfind(audio_map)
    .ok_or_else(|| "Unified AV audio graph audio output label is missing.".to_string())?;

  Ok(format!(
    "{}{}{}",
    &filter_complex[..index],
    replacement,
    &filter_complex[index + audio_map.len()..],
  ))
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

fn format_seconds(milliseconds: u64) -> String {
  format!(
    "{}.{:03}",
    milliseconds / 1_000,
    milliseconds % 1_000
  )
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
    NativeAudioGraphRenderRequest, NativeSourceAudioSegment,
    NativeVideoAudioGraphRenderRequest, NativeVideoWithAudioGraphRenderRequest,
    ResolvedSourceAudioSegment,
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
      source_audio_segments: Vec::new(),
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
      source_audio_segments: Vec::new(),
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

    let invalid_source_audio = NativeVideoAudioGraphRenderRequest {
      video_inputs: vec!["/media/video.mp4".to_string()],
      video_input_media_types: vec!["video".to_string()],
      audio_inputs: vec!["/media/music.mp3".to_string()],
      source_audio_segments: vec![NativeSourceAudioSegment {
        input_index: 1,
        source_start_ms: 0,
        timeline_start_ms: 0,
        duration_ms: 5_000,
      }],
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
    assert!(validate_video_audio_graph_request(&invalid_source_audio).is_err());

    let invalid_image_source_audio = NativeVideoAudioGraphRenderRequest {
      video_inputs: vec!["/media/cover.png".to_string()],
      video_input_media_types: vec!["image".to_string()],
      audio_inputs: vec!["/media/music.mp3".to_string()],
      source_audio_segments: vec![NativeSourceAudioSegment {
        input_index: 0,
        source_start_ms: 0,
        timeline_start_ms: 0,
        duration_ms: 5_000,
      }],
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
    assert!(validate_video_audio_graph_request(&invalid_image_source_audio).is_err());

    let invalid_zero_duration_source_audio = NativeVideoAudioGraphRenderRequest {
      video_inputs: vec!["/media/video.mp4".to_string()],
      video_input_media_types: vec!["video".to_string()],
      audio_inputs: vec!["/media/music.mp3".to_string()],
      source_audio_segments: vec![NativeSourceAudioSegment {
        input_index: 0,
        source_start_ms: 0,
        timeline_start_ms: 0,
        duration_ms: 0,
      }],
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
    assert!(validate_video_audio_graph_request(&invalid_zero_duration_source_audio).is_err());

    let mut mismatched_types = NativeVideoAudioGraphRenderRequest {
      video_inputs: vec!["/media/video.mp4".to_string()],
      video_input_media_types: Vec::new(),
      audio_inputs: vec!["/media/music.mp3".to_string()],
      source_audio_segments: Vec::new(),
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
      source_audio_segments: Vec::new(),
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
      video_input_media_types: vec!["video".to_string()],
      audio_inputs: vec!["/media/music.mp3".to_string()],
      source_audio_segments: Vec::new(),
      video_filter_complex: String::new(),
      video_map: "[vout]".to_string(),
      audio_filter_complex: "[1:a:0]anull[aout]".to_string(),
      audio_map: "[aout]".to_string(),
      duration_ms: 5_000,
      width: 1_280,
      height: 720,
      frame_rate: 30.0,
      output_path: "/tmp/final.mp4".to_string(),
    };
    assert!(validate_video_audio_graph_request(&missing_filter).is_err());

    missing_filter.video_filter_complex = "[0:v:0]null[vout]".to_string();
    missing_filter.video_map = "[other]".to_string();
    assert!(validate_video_audio_graph_request(&missing_filter).is_err());

    missing_filter.video_map = "[vout]".to_string();
    missing_filter.audio_filter_complex = String::new();
    assert!(validate_video_audio_graph_request(&missing_filter).is_err());

    missing_filter.audio_filter_complex = "[1:a:0]anull[aout]".to_string();
    missing_filter.audio_map = "[other]".to_string();
    assert!(validate_video_audio_graph_request(&missing_filter).is_err());

    missing_filter.audio_map = "[aout]".to_string();
    missing_filter.duration_ms = 0;
    assert!(validate_video_audio_graph_request(&missing_filter).is_err());

    missing_filter.duration_ms = 5_000;
    missing_filter.video_input_media_types = vec!["audio".to_string()];
    assert!(validate_video_audio_graph_request(&missing_filter).is_err());

    missing_filter.video_input_media_types = vec!["video".to_string()];
    missing_filter.output_path = "relative/final.mp4".to_string();
    assert!(validate_video_audio_graph_request(&missing_filter).is_err());
  }

  #[test]
  fn builds_ffmpeg_video_audio_graph_arguments() {
    let video_paths = vec![
      PathBuf::from("/media/Video Track.mp4"),
      PathBuf::from("/media/title card.png"),
    ];
    let video_media_types = vec!["video".to_string(), "image".to_string()];
    let audio_paths = vec![PathBuf::from("/media/Music Track.mp3")];

    let args = build_ffmpeg_video_audio_graph_args(
      &video_paths,
      &video_media_types,
      &audio_paths,
      &[],
      "[0:v:0]null[video0];[1:v:0]null[video1];[video0][video1]overlay[outvideo][vout]",
      "[vout]",
      "[2:a:0]anull[aout]",
      "[aout]",
      5_000,
      1_280,
      720,
      29.97,
      Path::new("/tmp/FrameFlow final.mp4"),
    )
    .unwrap();

    let values: Vec<String> = args
      .iter()
      .map(|arg| arg.to_string_lossy().into_owned())
      .collect();

    assert!(values.windows(2).any(|pair| pair == [
      "-loop".to_string(),
      "1".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-framerate".to_string(),
      "29.97".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-i".to_string(),
      "/media/Video Track.mp4".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-i".to_string(),
      "/media/title card.png".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-i".to_string(),
      "/media/Music Track.mp3".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-filter_complex".to_string(),
      "[0:v:0]null[video0];[1:v:0]null[video1];[video0][video1]overlay[outvideo][vout];[2:a:0]anull[aout]".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-map".to_string(),
      "[vout]".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-map".to_string(),
      "[aout]".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-t".to_string(),
      "5".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-r".to_string(),
      "29.97".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-c:v".to_string(),
      "libx264".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-c:a".to_string(),
      "aac".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-b:a".to_string(),
      "192k".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-ar".to_string(),
      "48000".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-ac".to_string(),
      "2".to_string()
    ]));
    assert!(values.iter().any(|value| value == "/tmp/FrameFlow final.mp4"));
  }

  #[test]
  fn builds_unified_graph_with_embedded_source_audio() {
    let video_paths = vec![PathBuf::from("/media/video.mp4")];
    let video_media_types = vec!["video".to_string()];
    let audio_paths = vec![PathBuf::from("/media/music.mp3")];
    let source_audio_segments = vec![ResolvedSourceAudioSegment {
      input_index: 0,
      source_start_ms: 250,
      timeline_start_ms: 1_000,
      duration_ms: 4_000,
      track_volume: 0.65,
      track_pan: -0.25,
      has_audio: true,
    }];

    let args = build_ffmpeg_video_audio_graph_args(
      &video_paths,
      &video_media_types,
      &audio_paths,
      &source_audio_segments,
      "[0:v:0]null[vout]",
      "[vout]",
      "[1:a:0]anull[aout]",
      "[aout]",
      6_000,
      1_280,
      720,
      30.0,
      Path::new("/tmp/unified-source-audio.mp4"),
    )
    .unwrap();

    let values: Vec<String> = args
      .iter()
      .map(|arg| arg.to_string_lossy().into_owned())
      .collect();

    let filter = values
      .windows(2)
      .find(|pair| pair[0] == "-filter_complex")
      .map(|pair| pair[1].clone())
      .expect("filter_complex argument should exist");

    assert!(filter.contains(
      "[0:a:0]atrim=start=0.250:end=4.250,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=0.65,pan=stereo|c0=0.831470*c0|c1=0.555570*c1,adelay=1000:all=1[frameflow_source_audio_0]"
    ));
    assert!(filter.contains("[frameflow_explicit_audio]"));
    assert!(filter.contains(
      "[frameflow_explicit_audio][frameflow_source_audio_0]amix=inputs=2:duration=longest:dropout_transition=0[aout]"
    ));
    assert!(values.windows(2).any(|pair| pair == [
      "-map".to_string(),
      "[aout]".to_string()
    ]));
  }

  #[test]
  fn preserves_unified_video_audio_input_order() {
    let video_paths = vec![
      PathBuf::from("/media/first.mp4"),
      PathBuf::from("/media/second.mp4"),
    ];
    let video_media_types = vec!["video".to_string(), "video".to_string()];
    let audio_paths = vec![
      PathBuf::from("/media/first.mp3"),
      PathBuf::from("/media/second.wav"),
    ];

    let args = build_ffmpeg_video_audio_graph_args(
      &video_paths,
      &video_media_types,
      &audio_paths,
      &[],
      "[0:v:0]null[v0];[1:v:0]null[vout]",
      "[vout]",
      "[2:a:0]anull[aout0];[3:a:0]anull[aout]",
      "[aout]",
      4_000,
      1_920,
      1_080,
      30.0,
      Path::new("/tmp/final.mp4"),
    )
    .unwrap();

    let values: Vec<String> = args
      .iter()
      .map(|arg| arg.to_string_lossy().into_owned())
      .collect();

    let input_positions: Vec<usize> = values
      .iter()
      .enumerate()
      .filter_map(|(index, value)| (value == "-i").then_some(index + 1))
      .collect();

    assert_eq!(
      input_positions
        .iter()
        .map(|index| &values[*index])
        .collect::<Vec<_>>(),
      vec![
        &"/media/first.mp4".to_string(),
        &"/media/second.mp4".to_string(),
        &"/media/first.mp3".to_string(),
        &"/media/second.wav".to_string(),
      ]
    );
  }

  #[test]
  fn retains_legacy_video_audio_graph_argument_coverage() {
    let args = build_ffmpeg_video_with_audio_graph_args(
      Path::new("/media/base video.mp4"),
      &[
        PathBuf::from("/media/Music Track.mp3"),
        PathBuf::from("/media/Voice.wav"),
      ],
      "[1:a:0]atrim=start=0:end=2[audio0];[2:a:0]adelay=1500:all=1[audio1];[audio0][audio1]amix=inputs=2[aout]",
      "[aout]",
      5_000,
      true,
      Path::new("/tmp/final.mix.tmp.mp4"),
    );

    let values: Vec<String> = args
      .iter()
      .map(|arg| arg.to_string_lossy().into_owned())
      .collect();

    assert!(values.windows(2).any(|pair| pair == [
      "-i".to_string(),
      "/media/base video.mp4".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-i".to_string(),
      "/media/Music Track.mp3".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-i".to_string(),
      "/media/Voice.wav".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-map".to_string(),
      "0:v:0".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-map".to_string(),
      "[amixed]".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-c:v".to_string(),
      "copy".to_string()
    ]));
    assert!(values.windows(2).any(|pair| pair == [
      "-c:a".to_string(),
      "aac".to_string()
    ]));
    assert!(values.iter().any(|value| value.contains("[baseaudio]")));
    assert!(values.iter().any(|value| value.contains("[aout]amix=inputs=2")));
    assert!(values.iter().any(|value| value == "-shortest"));
  }

  #[test]
  fn builds_silence_when_base_video_has_no_audio() {
    let args = build_ffmpeg_video_with_audio_graph_args(
      Path::new("/media/base.mp4"),
      &[PathBuf::from("/media/music.mp3")],
      "[1:a:0]anull[aout]",
      "[aout]",
      4_000,
      false,
      Path::new("/tmp/final.mp4"),
    );

    let values: Vec<String> = args
      .iter()
      .map(|arg| arg.to_string_lossy().into_owned())
      .collect();

    assert!(values.iter().any(|value| value.contains("anullsrc=r=48000:cl=stereo")));
    assert!(values.iter().any(|value| value.contains("atrim=duration=4")));
  }
}