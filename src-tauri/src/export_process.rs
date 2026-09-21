use std::{
  collections::{HashMap, HashSet},
  ffi::OsString,
  io::{BufRead, BufReader, Read},
  process::{Child, Command, ExitStatus, Stdio},
  sync::{Arc, Mutex},
  thread,
  time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};

pub const EXPORT_PROGRESS_EVENT: &str = "export-progress";

type SharedChild = Arc<Mutex<Child>>;

#[derive(Default)]
pub struct ExportProcessState {
  children: Mutex<HashMap<String, SharedChild>>,
  cancelled: Mutex<HashSet<String>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgressEvent {
  pub job_id: String,
  pub stage: String,
  pub progress: f64,
}

impl ExportProcessState {
  fn register(&self, job_id: &str, child: SharedChild) {
    if let Ok(mut children) = self.children.lock() {
      children.insert(job_id.to_string(), child);
    }

    if let Ok(mut cancelled) = self.cancelled.lock() {
      cancelled.remove(job_id);
    }
  }

  fn cancel(&self, job_id: &str) -> Result<(), String> {
    if let Ok(mut cancelled) = self.cancelled.lock() {
      cancelled.insert(job_id.to_string());
    }

    let child = self
      .children
      .lock()
      .map_err(|_| "Export process state is unavailable.".to_string())?
      .get(job_id)
      .cloned();

    let Some(child) = child else {
      return Err("Export job is no longer running.".to_string());
    };

    let mut child = child
      .lock()
      .map_err(|_| "Export process state is unavailable.".to_string())?;

    match child
      .try_wait()
      .map_err(|error| format!("Could not inspect export process: {error}"))?
    {
      Some(_) => Ok(()),
      None => child
        .kill()
        .map_err(|error| format!("Could not cancel export process: {error}")),
    }
  }

  fn finish(&self, job_id: &str) -> bool {
    if let Ok(mut children) = self.children.lock() {
      children.remove(job_id);
    }

    self
      .cancelled
      .lock()
      .ok()
      .and_then(|mut cancelled| cancelled.take(job_id))
      .unwrap_or(false)
  }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelExportJobRequest {
  pub job_id: String,
}

#[tauri::command]
pub fn cancel_export_job(
  request: CancelExportJobRequest,
  state: State<'_, ExportProcessState>,
) -> Result<(), String> {
  state.cancel(&request.job_id)
}

pub fn run_ffmpeg_with_progress(
  app: &tauri::AppHandle,
  state: &ExportProcessState,
  mut args: Vec<OsString>,
  job_id: Option<&str>,
  stage: &str,
  process_duration_ms: Option<u64>,
  progress_offset_ms: u64,
  total_duration_ms: Option<u64>,
  error_context: &str,
) -> Result<ExitStatus, String> {
  append_progress_arguments(&mut args);

  let mut child = Command::new("ffmpeg")
    .args(&args)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .map_err(|error| format!("Could not run ffmpeg for {error_context}: {error}"))?;

  let stdout = child.stdout.take();
  let stderr = child.stderr.take();
  let shared_child = Arc::new(Mutex::new(child));

  if let Some(job_id) = job_id {
    state.register(job_id, shared_child.clone());
    emit_progress(app, job_id, stage, 0.0);
  }

  let progress_job_id = job_id.map(str::to_owned);
  let progress_stage = stage.to_string();
  let progress_app = app.clone();
  let progress_thread = stdout.map(|stdout| {
    thread::spawn(move || {
      let reader = BufReader::new(stdout);

      for line in reader.lines().flatten() {
        let Some(out_time_ms) = parse_progress_line_ms(&line) else {
          continue;
        };

        let Some(job_id) = progress_job_id.as_deref() else {
          continue;
        };

        let total_duration_ms = total_duration_ms.or(process_duration_ms);
        let progress = total_duration_ms
          .filter(|duration| *duration > 0)
          .map(|duration| {
            let completed_ms = progress_offset_ms
              .saturating_add(out_time_ms.min(process_duration_ms.unwrap_or(out_time_ms)));
            (completed_ms as f64 / duration as f64).clamp(0.0, 1.0)
          })
          .unwrap_or(0.0);

        emit_progress(
          &progress_app,
          job_id,
          &progress_stage,
          progress,
        );
      }
    })
  });

  let stderr_thread = stderr.map(|stderr| {
    thread::spawn(move || {
      let mut bytes = Vec::new();
      let mut reader = BufReader::new(stderr);
      let _ = reader.read_to_end(&mut bytes);
      bytes
    })
  });

  let status = loop {
    let status = {
      let mut child = shared_child
        .lock()
        .map_err(|_| "Export process state is unavailable.".to_string())?;

      child
        .try_wait()
        .map_err(|error| format!("Could not inspect ffmpeg process: {error}"))?
    };

    if let Some(status) = status {
      break status;
    }

    thread::sleep(Duration::from_millis(40));
  };

  let was_cancelled = job_id
    .map(|job_id| state.finish(job_id))
    .unwrap_or(false);

  if let Some(thread) = progress_thread {
    let _ = thread.join();
  }

  let stderr = stderr_thread
    .and_then(|thread| thread.join().ok())
    .unwrap_or_default();

  if was_cancelled {
    return Err("Export cancelled.".to_string());
  }

  if !status.success() {
    let detail = String::from_utf8_lossy(&stderr).trim().to_string();

    return Err(if detail.is_empty() {
      format!("FFmpeg could not render {error_context}.")
    } else {
      format!("FFmpeg could not render {error_context}: {detail}")
    });
  }

  if let Some(job_id) = job_id {
    emit_progress(app, job_id, stage, 1.0);
  }

  Ok(status)
}

fn append_progress_arguments(args: &mut Vec<OsString>) {
  let Some(output_path) = args.pop() else {
    return;
  };

  args.push("-progress".into());
  args.push("pipe:1".into());
  args.push("-nostats".into());
  args.push(output_path);
}

fn parse_progress_line_ms(line: &str) -> Option<u64> {
  if let Some(value) = line.strip_prefix("out_time_ms=") {
    return value
      .trim()
      .parse::<u64>()
      .ok()
      .map(|microseconds| microseconds / 1000);
  }

  if let Some(value) = line.strip_prefix("out_time_us=") {
    return value
      .trim()
      .parse::<u64>()
      .ok()
      .map(|microseconds| microseconds / 1000);
  }

  None
}

fn emit_progress(app: &tauri::AppHandle, job_id: &str, stage: &str, progress: f64) {
  let payload = ExportProgressEvent {
    job_id: job_id.to_string(),
    stage: stage.to_string(),
    progress: progress.clamp(0.0, 1.0),
  };

  let _ = app.emit(EXPORT_PROGRESS_EVENT, payload);
}

#[cfg(test)]
mod tests {
  use super::{parse_progress_line_ms, ExportProgressEvent, EXPORT_PROGRESS_EVENT};

  #[test]
  fn parses_ffmpeg_progress_microseconds_to_milliseconds() {
    assert_eq!(parse_progress_line_ms("out_time_ms=1234567"), Some(1_234));
    assert_eq!(parse_progress_line_ms("out_time_us=7654321"), Some(7_654));
  }

  #[test]
  fn ignores_unknown_progress_lines() {
    assert_eq!(parse_progress_line_ms("progress=end"), None);
    assert_eq!(parse_progress_line_ms("out_time_ms=N/A"), None);
  }

  #[test]
  fn progress_event_keeps_expected_contract() {
    let event = ExportProgressEvent {
      job_id: "export-1".to_string(),
      stage: "video".to_string(),
      progress: 0.5,
    };

    assert_eq!(event.job_id, "export-1");
    assert_eq!(event.stage, "video");
    assert_eq!(event.progress, 0.5);
    assert_eq!(EXPORT_PROGRESS_EVENT, "export-progress");
  }
}
