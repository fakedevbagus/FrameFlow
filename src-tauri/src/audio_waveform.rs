use std::{
  io::Read,
  path::Path,
  process::{Command, Stdio},
};

use serde::Serialize;

const MIN_PEAK_COUNT: usize = 32;
const MAX_PEAK_COUNT: usize = 2048;
const MIN_SAMPLE_RATE: u32 = 1000;
const MAX_SAMPLE_RATE: u32 = 8000;
const SAMPLES_PER_PEAK: u32 = 8;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioWaveform {
  pub duration_ms: u64,
  pub sample_rate: u32,
  pub peaks: Vec<f32>,
}

#[tauri::command]
pub fn generate_audio_waveform(
  path: String,
  peak_count: usize,
) -> Result<AudioWaveform, String> {
  let source_path = super::media_path(&path)?;

  if super::media_type(&source_path)? != "audio" {
    return Err("Audio waveform generation requires an audio source.".to_string());
  }

  if !super::probe_has_audio(&source_path)? {
    return Err("Selected audio source does not contain an audio stream.".to_string());
  }

  let duration_ms = super::probe_duration_ms(&source_path)?;
  if duration_ms == 0 {
    return Err("Selected audio source has no positive duration.".to_string());
  }

  let peak_count = peak_count.clamp(MIN_PEAK_COUNT, MAX_PEAK_COUNT);
  let sample_rate = waveform_sample_rate(peak_count);
  let peaks = decode_and_reduce_waveform(
    &source_path,
    duration_ms,
    peak_count,
    sample_rate,
  )?;

  Ok(AudioWaveform {
    duration_ms,
    sample_rate,
    peaks,
  })
}

fn waveform_sample_rate(peak_count: usize) -> u32 {
  let requested = (peak_count as u32).saturating_mul(SAMPLES_PER_PEAK);

  requested.clamp(MIN_SAMPLE_RATE, MAX_SAMPLE_RATE)
}

fn decode_and_reduce_waveform(
  source_path: &Path,
  duration_ms: u64,
  peak_count: usize,
  sample_rate: u32,
) -> Result<Vec<f32>, String> {
  let mut child = Command::new("ffmpeg")
    .args(build_ffmpeg_waveform_args(source_path, sample_rate))
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .map_err(|error| format!("Could not run ffmpeg for waveform generation: {error}"))?;

  let mut stdout = child
    .stdout
    .take()
    .ok_or_else(|| "FFmpeg waveform output could not be opened.".to_string())?;

  let mut peaks = vec![0.0_f32; peak_count];
  let expected_samples = ((duration_ms as f64 / 1000.0) * sample_rate as f64)
    .round()
    .max(1.0) as u64;
  let mut sample_index = 0_u64;
  let mut pending = [0_u8; 4];
  let mut pending_len = 0_usize;
  let mut buffer = [0_u8; 64 * 1024];

  loop {
    let read = stdout
      .read(&mut buffer)
      .map_err(|error| format!("Could not read FFmpeg waveform output: {error}"))?;

    if read == 0 {
      break;
    }

    let mut offset = 0_usize;

    while offset < read {
      if pending_len > 0 {
        let needed = 4 - pending_len;
        let take = needed.min(read - offset);

        pending[pending_len..pending_len + take]
          .copy_from_slice(&buffer[offset..offset + take]);
        pending_len += take;
        offset += take;

        if pending_len < 4 {
          continue;
        }

        let sample = f32::from_le_bytes(pending);
        update_peak(
          &mut peaks,
          sample,
          sample_index,
          expected_samples,
        );
        sample_index = sample_index.saturating_add(1);
        pending_len = 0;
        continue;
      }

      let remaining = read - offset;

      if remaining >= 4 {
        let sample = f32::from_le_bytes([
          buffer[offset],
          buffer[offset + 1],
          buffer[offset + 2],
          buffer[offset + 3],
        ]);

        update_peak(
          &mut peaks,
          sample,
          sample_index,
          expected_samples,
        );
        sample_index = sample_index.saturating_add(1);
        offset += 4;
      } else {
        pending[..remaining].copy_from_slice(&buffer[offset..read]);
        pending_len = remaining;
        offset = read;
      }
    }
  }

  let output = child
    .wait_with_output()
    .map_err(|error| format!("Could not finish FFmpeg waveform generation: {error}"))?;

  if !output.status.success() {
    let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();

    return Err(if detail.is_empty() {
      "FFmpeg could not generate an audio waveform.".to_string()
    } else {
      format!("FFmpeg could not generate an audio waveform: {detail}")
    });
  }

  if sample_index == 0 {
    return Err("FFmpeg produced no waveform samples.".to_string());
  }

  normalize_peaks(&mut peaks);
  Ok(peaks)
}

fn update_peak(
  peaks: &mut [f32],
  sample: f32,
  sample_index: u64,
  expected_samples: u64,
) {
  if !sample.is_finite() {
    return;
  }

  let amplitude = sample.abs().min(1.0);
  let bucket = if expected_samples <= 1 {
    0
  } else {
    ((sample_index.saturating_mul(peaks.len() as u64)) / expected_samples)
      .min(peaks.len().saturating_sub(1) as u64) as usize
  };

  peaks[bucket] = peaks[bucket].max(amplitude);
}

fn normalize_peaks(peaks: &mut [f32]) {
  let maximum = peaks.iter().copied().fold(0.0_f32, f32::max);

  if maximum <= 0.0 {
    return;
  }

  for peak in peaks {
    *peak = (*peak / maximum).clamp(0.0, 1.0);
  }
}

fn build_ffmpeg_waveform_args(source_path: &Path, sample_rate: u32) -> Vec<String> {
  vec![
    "-hide_banner".to_string(),
    "-loglevel".to_string(),
    "error".to_string(),
    "-i".to_string(),
    source_path.to_string_lossy().into_owned(),
    "-map".to_string(),
    "0:a:0".to_string(),
    "-vn".to_string(),
    "-sn".to_string(),
    "-dn".to_string(),
    "-ac".to_string(),
    "1".to_string(),
    "-ar".to_string(),
    sample_rate.to_string(),
    "-f".to_string(),
    "f32le".to_string(),
    "pipe:1".to_string(),
  ]
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn clamps_waveform_sample_rate_to_supported_bounds() {
    assert_eq!(waveform_sample_rate(32), 1000);
    assert_eq!(waveform_sample_rate(128), 1024);
    assert_eq!(waveform_sample_rate(2048), 8000);
  }

  #[test]
  fn reduces_samples_into_normalized_peak_buckets() {
    let mut peaks = vec![0.0_f32; 4];

    for (index, sample) in [
      0.1_f32, -0.5, 0.2, 0.9, -0.3, 0.4, 0.7, 0.2,
    ]
    .into_iter()
    .enumerate()
    {
      update_peak(
        &mut peaks,
        sample,
        index as u64,
        8,
      );
    }

    normalize_peaks(&mut peaks);

    assert!((peaks[0] - 0.5555556).abs() < 0.0001);
    assert_eq!(peaks[1], 1.0);
    assert!((peaks[2] - 0.44444445).abs() < 0.0001);
    assert!((peaks[3] - 0.7777778).abs() < 0.0001);
  }

  #[test]
  fn ignores_non_finite_samples() {
    let mut peaks = vec![0.25_f32];

    update_peak(&mut peaks, f32::NAN, 0, 1);
    update_peak(&mut peaks, f32::INFINITY, 0, 1);

    assert_eq!(peaks, vec![0.25]);
  }

  #[test]
  fn builds_structured_ffmpeg_arguments() {
    let args = build_ffmpeg_waveform_args(
      Path::new("/tmp/music test.mp3"),
      2048,
    );

    assert_eq!(args[0], "-hide_banner");
    assert_eq!(args[3], "-i");
    assert_eq!(args[4], "/tmp/music test.mp3");
    assert_eq!(
      args[args.iter().position(|value| value == "-ar").unwrap() + 1],
      "2048",
    );
    assert_eq!(args.last().map(String::as_str), Some("pipe:1"));
  }
}
