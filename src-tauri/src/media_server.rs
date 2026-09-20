use std::{
  fs::{self, File},
  io::{self, Read, Write},
  net::{TcpListener, TcpStream},
  path::{Path, PathBuf},
  thread,
};

pub struct MediaServerState {
  base_url: String,
}

impl MediaServerState {
  pub fn start() -> Result<Self, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
      .map_err(|error| format!("Could not start the local media server: {error}"))?;

    let port = listener
      .local_addr()
      .map_err(|error| format!("Could not determine the local media server port: {error}"))?
      .port();

    thread::Builder::new()
      .name("frameflow-media-server".to_string())
      .spawn(move || {
        for stream in listener.incoming() {
          match stream {
            Ok(stream) => {
              thread::spawn(|| {
                let _ = handle_connection(stream);
              });
            }
            Err(_) => break,
          }
        }
      })
      .map_err(|error| format!("Could not launch the local media server: {error}"))?;

    Ok(Self {
      base_url: format!("http://127.0.0.1:{port}"),
    })
  }

  pub fn url_for_path(&self, value: &str) -> Result<String, String> {
    let path = PathBuf::from(value);
    validate_media_path(&path)?;

    Ok(format!(
      "{}/media?path={}",
      self.base_url,
      percent_encode_path(&path),
    ))
  }
}

fn handle_connection(mut stream: TcpStream) -> Result<(), String> {
  let request = read_request(&mut stream)?;

  let Some((method, remainder)) = request.split_once(' ') else {
    write_status(&mut stream, 400, "Bad Request", b"Invalid request.")?;
    return Ok(());
  };

  let Some((target, _version)) = remainder.split_once(' ') else {
    write_status(&mut stream, 400, "Bad Request", b"Invalid request.")?;
    return Ok(());
  };

  if method == "OPTIONS" {
    write_headers(
      &mut stream,
      204,
      "No Content",
      "text/plain; charset=utf-8",
      0,
    )?;
    return Ok(());
  }

  if method != "GET" && method != "HEAD" {
    write_status(&mut stream, 405, "Method Not Allowed", b"Method not allowed.")?;
    return Ok(());
  }

  let Some(query) = target.strip_prefix("/media?") else {
    write_status(&mut stream, 404, "Not Found", b"Media endpoint not found.")?;
    return Ok(());
  };

  let Some(encoded_path) = query
    .split('&')
    .find_map(|part| part.strip_prefix("path="))
  else {
    write_status(&mut stream, 400, "Bad Request", b"Missing media path.")?;
    return Ok(());
  };

  let path = PathBuf::from(percent_decode(encoded_path)?);
  validate_media_path(&path)?;

  let metadata = fs::metadata(&path)
    .map_err(|_| "Media file could not be found.".to_string())?;

  if !metadata.is_file() {
    write_status(&mut stream, 404, "Not Found", b"Media file not found.")?;
    return Ok(());
  }

  let content_length = metadata.len();
  let content_type = content_type_for_path(&path);

  write_headers(
    &mut stream,
    200,
    "OK",
    content_type,
    content_length,
  )?;

  if method == "GET" {
    let mut file = File::open(&path)
      .map_err(|error| format!("Could not open media file: {error}"))?;

    io::copy(&mut file, &mut stream)
      .map_err(|error| format!("Could not stream media file: {error}"))?;
  }

  Ok(())
}

fn read_request(stream: &mut TcpStream) -> Result<String, String> {
  let mut buffer = Vec::with_capacity(4096);
  let mut chunk = [0_u8; 4096];

  loop {
    let read = stream
      .read(&mut chunk)
      .map_err(|error| format!("Could not read media request: {error}"))?;

    if read == 0 {
      break;
    }

    buffer.extend_from_slice(&chunk[..read]);

    if buffer.windows(4).any(|window| window == b"\r\n\r\n") {
      break;
    }

    if buffer.len() > 32 * 1024 {
      return Err("Media request header is too large.".to_string());
    }
  }

  String::from_utf8(buffer).map_err(|_| "Media request was not valid UTF-8.".to_string())
}

fn write_headers(
  stream: &mut TcpStream,
  status: u16,
  reason: &str,
  content_type: &str,
  content_length: u64,
) -> Result<(), String> {
  let headers = format!(
    "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {content_length}\r\nCache-Control: no-store\r\nAccept-Ranges: none\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n"
  );

  stream
    .write_all(headers.as_bytes())
    .map_err(|error| format!("Could not write media response headers: {error}"))
}

fn write_status(
  stream: &mut TcpStream,
  status: u16,
  reason: &str,
  body: &[u8],
) -> Result<(), String> {
  write_headers(
    stream,
    status,
    reason,
    "text/plain; charset=utf-8",
    body.len() as u64,
  )?;

  stream
    .write_all(body)
    .map_err(|error| format!("Could not write media response: {error}"))
}

fn validate_media_path(path: &Path) -> Result<(), String> {
  if path.is_relative() {
    return Err("Media path must be absolute.".to_string());
  }

  let canonical = fs::canonicalize(path)
    .map_err(|_| "Media file could not be resolved.".to_string())?;

  if canonical.starts_with("/media/")
    || canonical.starts_with("/mnt/")
    || canonical.starts_with("/run/media/")
  {
    return Ok(());
  }

  if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
    if canonical.starts_with(&home) {
      return Ok(());
    }
  }

  Err("Media path is outside the allowed local media directories.".to_string())
}

fn percent_encode_path(path: &Path) -> String {
  path
    .to_string_lossy()
    .bytes()
    .map(|byte| {
      if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~' | b'/') {
        char::from(byte).to_string()
      } else {
        format!("%{byte:02X}")
      }
    })
    .collect()
}

fn percent_decode(value: &str) -> Result<String, String> {
  let bytes = value.as_bytes();
  let mut output = Vec::with_capacity(bytes.len());
  let mut index = 0;

  while index < bytes.len() {
    if bytes[index] == b'%' {
      if index + 2 >= bytes.len() {
        return Err("Invalid percent-encoded media path.".to_string());
      }

      let high = decode_hex(bytes[index + 1])?;
      let low = decode_hex(bytes[index + 2])?;
      output.push((high << 4) | low);
      index += 3;
    } else {
      output.push(bytes[index]);
      index += 1;
    }
  }

  String::from_utf8(output)
    .map_err(|_| "Media path is not valid UTF-8.".to_string())
}

fn decode_hex(byte: u8) -> Result<u8, String> {
  match byte {
    b'0'..=b'9' => Ok(byte - b'0'),
    b'a'..=b'f' => Ok(byte - b'a' + 10),
    b'A'..=b'F' => Ok(byte - b'A' + 10),
    _ => Err("Invalid percent-encoded media path.".to_string()),
  }
}

fn content_type_for_path(path: &Path) -> &'static str {
  match path
    .extension()
    .and_then(|extension| extension.to_str())
    .unwrap_or_default()
    .to_ascii_lowercase()
    .as_str()
  {
    "mp4" | "m4v" => "video/mp4",
    "webm" => "video/webm",
    "mov" => "video/quicktime",
    "mkv" => "video/x-matroska",
    "avi" => "video/x-msvideo",
    "mp3" => "audio/mpeg",
    "wav" => "audio/wav",
    "ogg" | "opus" => "audio/ogg",
    "m4a" => "audio/mp4",
    _ => "application/octet-stream",
  }
}

#[cfg(test)]
mod tests {
  use super::{percent_decode, percent_encode_path};
  use std::path::Path;

  #[test]
  fn round_trips_encoded_media_paths() {
    let original = Path::new("/media/My Video #1.mp4");
    let encoded = percent_encode_path(original);

    assert_eq!(
      percent_decode(&encoded).unwrap(),
      original.to_string_lossy()
    );
  }
}
