use std::{
  fs::{self, File},
  io::{self, Read, Seek, SeekFrom, Write},
  net::{TcpListener, TcpStream},
  path::{Path, PathBuf},
  thread,
};

pub struct MediaServerState {
  base_url: String,
  capability_token: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MediaPathError {
  BadRequest,
  NotFound,
  UnsupportedMediaType,
  Forbidden,
}

impl MediaPathError {
  fn status(self) -> (u16, &'static str) {
    match self {
      Self::BadRequest => (400, "Bad Request"),
      Self::NotFound => (404, "Not Found"),
      Self::UnsupportedMediaType => (415, "Unsupported Media Type"),
      Self::Forbidden => (403, "Forbidden"),
    }
  }

  fn message(self) -> &'static str {
    match self {
      Self::BadRequest => "Media path must be absolute.",
      Self::NotFound => "Media file could not be resolved.",
      Self::UnsupportedMediaType => "Media file type is not supported.",
      Self::Forbidden => "Media path is outside the allowed local media directories.",
    }
  }
}

impl std::fmt::Display for MediaPathError {
  fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    formatter.write_str(self.message())
  }
}

impl MediaServerState {
  pub fn start() -> Result<Self, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
      .map_err(|error| format!("Could not start the local media server: {error}"))?;

    let port = listener
      .local_addr()
      .map_err(|error| format!("Could not determine the local media server port: {error}"))?
      .port();
    let capability_token = generate_capability_token()?;

    thread::Builder::new()
      .name("frameflow-media-server".to_string())
      .spawn({
        let capability_token = capability_token.clone();
        move || {
          for stream in listener.incoming() {
            match stream {
              Ok(stream) => {
                let capability_token = capability_token.clone();
                thread::spawn(move || {
                  let _ = handle_connection(stream, &capability_token);
                });
              }
              Err(_) => break,
            }
          }
        }
      })
      .map_err(|error| format!("Could not launch the local media server: {error}"))?;

    Ok(Self {
      base_url: format!("http://127.0.0.1:{port}"),
      capability_token,
    })
  }

  pub fn url_for_path(&self, value: &str) -> Result<String, String> {
    let path = validate_media_path(Path::new(value))
      .map_err(|error| error.to_string())?;

    Ok(format!(
      "{}/media?path={}&token={}",
      self.base_url,
      percent_encode_path(&path),
      self.capability_token,
    ))
  }
}

fn handle_connection(
  mut stream: TcpStream,
  capability_token: &str,
) -> Result<(), String> {
  let request = match read_request(&mut stream) {
    Ok(request) => request,
    Err(MediaRequestError::HeadersTooLarge { suppress_body }) => {
      write_status(
        &mut stream,
        431,
        "Request Header Fields Too Large",
        b"Media request headers are too large.",
        !suppress_body,
      )?;
      return Ok(());
    }
    Err(MediaRequestError::InvalidUtf8 { suppress_body }) => {
      write_status(
        &mut stream,
        400,
        "Bad Request",
        b"Media request must use valid UTF-8.",
        !suppress_body,
      )?;
      return Ok(());
    }
    Err(MediaRequestError::IncompleteHeaders { suppress_body }) => {
      write_status(
        &mut stream,
        400,
        "Bad Request",
        b"Media request headers were not terminated correctly.",
        !suppress_body,
      )?;
      return Ok(());
    }
    Err(MediaRequestError::Io(error)) => return Err(error),
  };

  let Some(request_line) = request.lines().next() else {
    write_status(
      &mut stream,
      400,
      "Bad Request",
      b"Invalid request.",
      true,
    )?;
    return Ok(());
  };

  let mut request_parts = request_line.split(' ');
  let Some(method) = request_parts.next().filter(|value| !value.is_empty()) else {
    write_status(
      &mut stream,
      400,
      "Bad Request",
      b"Invalid request.",
      true,
    )?;
    return Ok(());
  };

  let Some(target) = request_parts.next().filter(|value| !value.is_empty()) else {
    write_status(
      &mut stream,
      400,
      "Bad Request",
      b"Invalid request.",
      method != "HEAD",
    )?;
    return Ok(());
  };

  let Some(version) = request_parts.next().filter(|value| !value.is_empty()) else {
    write_status(
      &mut stream,
      400,
      "Bad Request",
      b"Invalid request.",
      method != "HEAD",
    )?;
    return Ok(());
  };

  if request_parts.next().is_some() {
    write_status(
      &mut stream,
      400,
      "Bad Request",
      b"Invalid request.",
      method != "HEAD",
    )?;
    return Ok(());
  }

  if version != "HTTP/1.1" {
    write_status(
      &mut stream,
      505,
      "HTTP Version Not Supported",
      b"HTTP version is not supported.",
      method != "HEAD",
    )?;
    return Ok(());
  }

  if method == "OPTIONS" {
    write_headers(
      &mut stream,
      204,
      "No Content",
      "text/plain; charset=utf-8",
      0,
      None,
    )?;
    return Ok(());
  }

  if method != "GET" && method != "HEAD" {
    write_status(
      &mut stream,
      405,
      "Method Not Allowed",
      b"Method not allowed.",
      true,
    )?;
    return Ok(());
  }

  let Some(query) = target.strip_prefix("/media?") else {
    write_status(
      &mut stream,
      404,
      "Not Found",
      b"Media endpoint not found.",
      method != "HEAD",
    )?;
    return Ok(());
  };

  let (encoded_path, request_token) = match extract_media_request(query) {
    Ok(values) => values,
    Err(error) => {
      write_status(
        &mut stream,
        400,
        "Bad Request",
        error.as_bytes(),
        method != "HEAD",
      )?;
      return Ok(());
    }
  };

  if !constant_time_eq(request_token.as_bytes(), capability_token.as_bytes()) {
    write_status(
      &mut stream,
      403,
      "Forbidden",
      b"Media server capability token is invalid.",
      method != "HEAD",
    )?;
    return Ok(());
  }

  let decoded_path = match percent_decode(encoded_path) {
    Ok(path) => path,
    Err(error) => {
      write_status(
        &mut stream,
        400,
        "Bad Request",
        error.as_bytes(),
        method != "HEAD",
      )?;
      return Ok(());
    }
  };

  let path = match validate_media_path(Path::new(&decoded_path)) {
    Ok(path) => path,
    Err(error) => {
      write_media_path_error(&mut stream, error, method != "HEAD")?;
      return Ok(());
    }
  };

  let metadata = match fs::metadata(&path) {
    Ok(metadata) => metadata,
    Err(_) => {
      write_status(
        &mut stream,
        404,
        "Not Found",
        b"Media file could not be found.",
        method != "HEAD",
      )?;
      return Ok(());
    }
  };

  if !metadata.is_file() {
    write_status(
      &mut stream,
      404,
      "Not Found",
      b"Media file not found.",
      method != "HEAD",
    )?;
    return Ok(());
  }

  let file_len = metadata.len();
  let content_type = content_type_for_path(&path);

  match parse_range_header(&request, file_len) {
    RangeResult::Invalid => {
      write_range_not_satisfiable(&mut stream, file_len)?;
    }
    RangeResult::Multiple => {
      write_status(
        &mut stream,
        416,
        "Range Not Satisfiable",
        b"Multiple byte ranges are not supported.",
        method != "HEAD",
      )?;
    }
    RangeResult::DuplicateHeaders => {
      write_status(
        &mut stream,
        400,
        "Bad Request",
        b"Multiple Range headers are not supported.",
        method != "HEAD",
      )?;
    }
    RangeResult::MalformedHeader => {
      write_status(
        &mut stream,
        400,
        "Bad Request",
        b"Malformed Range header.",
        method != "HEAD",
      )?;
    }
    RangeResult::Single(start, end) => {
      let length = end - start + 1;

      write_headers(
        &mut stream,
        206,
        "Partial Content",
        content_type,
        length,
        Some(format!("bytes {start}-{end}/{file_len}")),
      )?;

      if method == "GET" {
        stream_file_range(&mut stream, &path, start, length)?;
      }
    }
    RangeResult::None => {
      write_headers(
        &mut stream,
        200,
        "OK",
        content_type,
        file_len,
        None,
      )?;

      if method == "GET" {
        let mut file = File::open(&path)
          .map_err(|error| format!("Could not open media file: {error}"))?;

        io::copy(&mut file, &mut stream)
          .map_err(|error| format!("Could not stream media file: {error}"))?;
      }
    }
  }

  Ok(())
}

enum MediaRequestError {
  HeadersTooLarge { suppress_body: bool },
  InvalidUtf8 { suppress_body: bool },
  IncompleteHeaders { suppress_body: bool },
  Io(String),
}

enum RangeResult {
  None,
  Single(u64, u64),
  Multiple,
  DuplicateHeaders,
  MalformedHeader,
  Invalid,
}

fn parse_range_header(request: &str, len: u64) -> RangeResult {
  let mut range_line = None;

  for line in request.lines() {
    let Some((name, _)) = line.split_once(':') else {
      continue;
    };

    if name.eq_ignore_ascii_case("range") {
      if range_line.is_some() {
        return RangeResult::DuplicateHeaders;
      }

      range_line = Some(line);
      continue;
    }

    if name.trim().eq_ignore_ascii_case("range") {
      return RangeResult::MalformedHeader;
    }
  }

  let Some(range_line) = range_line else {
    return RangeResult::None;
  };

  let Some(value) = range_line.split_once(':').map(|(_, value)| value.trim()) else {
    return RangeResult::Invalid;
  };

  if len == 0 || !value.starts_with("bytes=") {
    return RangeResult::Invalid;
  }

  let specifications = value["bytes=".len()..].split(',').collect::<Vec<_>>();

  if specifications.len() > 1 {
    return RangeResult::Multiple;
  }

  let spec = specifications[0].trim();
  let Some((start_text, end_text)) = spec.split_once('-') else {
    return RangeResult::Invalid;
  };

  let range = if start_text.is_empty() {
    let Ok(suffix) = end_text.parse::<u64>() else {
      return RangeResult::Invalid;
    };

    if suffix == 0 {
      return RangeResult::Invalid;
    }

    let length = suffix.min(len);
    (len - length, len - 1)
  } else {
    let Ok(start) = start_text.parse::<u64>() else {
      return RangeResult::Invalid;
    };

    if start >= len {
      return RangeResult::Invalid;
    }

    let end = if end_text.is_empty() {
      len - 1
    } else {
      let Ok(end) = end_text.parse::<u64>() else {
        return RangeResult::Invalid;
      };
      end.min(len - 1)
    };

    if end < start {
      return RangeResult::Invalid;
    }

    (start, end)
  };

  RangeResult::Single(range.0, range.1)
}

fn stream_file_range(
  stream: &mut TcpStream,
  path: &Path,
  start: u64,
  length: u64,
) -> Result<(), String> {
  let mut file = File::open(path)
    .map_err(|error| format!("Could not open media file: {error}"))?;

  file
    .seek(SeekFrom::Start(start))
    .map_err(|error| format!("Could not seek media file: {error}"))?;

  let mut limited = file.take(length);

  io::copy(&mut limited, stream)
    .map_err(|error| format!("Could not stream media range: {error}"))?;

  Ok(())
}

fn read_request(stream: &mut TcpStream) -> Result<String, MediaRequestError> {
  const MAX_REQUEST_HEADER_BYTES: usize = 32 * 1024;
  let mut buffer = Vec::with_capacity(4096);
  let mut chunk = [0_u8; 4096];

  loop {
    let read = stream
      .read(&mut chunk)
      .map_err(|error| MediaRequestError::Io(format!("Could not read media request: {error}")))?;

    if read == 0 {
      return Err(MediaRequestError::IncompleteHeaders {
        suppress_body: is_head_request(&buffer),
      });
    }

    buffer.extend_from_slice(&chunk[..read]);

    if buffer.len() > MAX_REQUEST_HEADER_BYTES {
      return Err(MediaRequestError::HeadersTooLarge {
        suppress_body: is_head_request(&buffer),
      });
    }

    if buffer.windows(4).any(|window| window == b"\r\n\r\n") {
      return String::from_utf8(buffer).map_err(|_| MediaRequestError::InvalidUtf8 {
        suppress_body: is_head_request(&buffer),
      });
    }
  }
}

fn is_head_request(buffer: &[u8]) -> bool {
  buffer.starts_with(b"HEAD ")
}

fn write_headers(
  stream: &mut TcpStream,
  status: u16,
  reason: &str,
  content_type: &str,
  content_length: u64,
  content_range: Option<String>,
) -> Result<(), String> {
  let mut headers = format!(
    "HTTP/1.1 {status} {reason}\r\n\
Content-Type: {content_type}\r\n\
Content-Length: {content_length}\r\n\
Cache-Control: no-store\r\n\
Accept-Ranges: bytes\r\n\
Access-Control-Allow-Origin: *\r\n\
Access-Control-Expose-Headers: Accept-Ranges, Content-Length, Content-Range, Content-Type\r\n\
Connection: close\r\n"
  );

  if let Some(content_range) = content_range {
    headers.push_str(&format!("Content-Range: {content_range}\r\n"));
  }

  headers.push_str("\r\n");

  stream
    .write_all(headers.as_bytes())
    .map_err(|error| format!("Could not write media response headers: {error}"))
}

fn write_status(
  stream: &mut TcpStream,
  status: u16,
  reason: &str,
  body: &[u8],
  include_body: bool,
) -> Result<(), String> {
  write_headers(
    stream,
    status,
    reason,
    "text/plain; charset=utf-8",
    body.len() as u64,
    None,
  )?;

  if include_body {
    stream
      .write_all(body)
      .map_err(|error| format!("Could not write media response: {error}"))?;
  }

  Ok(())
}

fn write_range_not_satisfiable(
  stream: &mut TcpStream,
  len: u64,
) -> Result<(), String> {
  let headers = format!(
    "HTTP/1.1 416 Range Not Satisfiable\r\n\
Content-Length: 0\r\n\
Content-Range: bytes */{len}\r\n\
Access-Control-Allow-Origin: *\r\n\
Connection: close\r\n\
\r\n"
  );

  stream
    .write_all(headers.as_bytes())
    .map_err(|error| format!("Could not write range error: {error}"))
}

fn validate_media_path(path: &Path) -> Result<PathBuf, MediaPathError> {
  if path.is_relative() {
    return Err(MediaPathError::BadRequest);
  }

  let canonical =
    fs::canonicalize(path).map_err(|_| MediaPathError::NotFound)?;

  if !canonical.is_file() {
    return Err(MediaPathError::NotFound);
  }

  crate::media_type(&canonical)
    .map_err(|_| MediaPathError::UnsupportedMediaType)?;

  if canonical.starts_with("/media/")
    || canonical.starts_with("/mnt/")
    || canonical.starts_with("/run/media/")
  {
    return Ok(canonical);
  }

  if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
    if canonical.starts_with(&home) {
      return Ok(canonical);
    }
  }

  Err(MediaPathError::Forbidden)
}

fn write_media_path_error(
  stream: &mut TcpStream,
  error: MediaPathError,
  include_body: bool,
) -> Result<(), String> {
  let (status, reason) = error.status();
  let body = error.to_string();

  write_status(stream, status, reason, body.as_bytes(), include_body)
}

fn extract_media_request(query: &str) -> Result<(&str, &str), &'static str> {
  let mut encoded_path = None;
  let mut token = None;

  for part in query.split('&') {
    if let Some(path) = part.strip_prefix("path=") {
      if encoded_path.is_some() {
        return Err("Duplicate media path parameter.");
      }

      encoded_path = Some(path);
      continue;
    }

    if let Some(value) = part.strip_prefix("token=") {
      if token.is_some() {
        return Err("Duplicate media server capability token.");
      }

      token = Some(value);
    }
  }

  let encoded_path = encoded_path.ok_or("Missing media path.")?;
  let token = token.ok_or("Missing media server capability token.")?;

  Ok((encoded_path, token))
}

fn generate_capability_token() -> Result<String, String> {
  const TOKEN_BYTES: usize = 32;
  let mut bytes = [0_u8; TOKEN_BYTES];
  let mut file = File::open("/dev/urandom")
    .map_err(|error| format!("Could not open the system random source: {error}"))?;

  file
    .read_exact(&mut bytes)
    .map_err(|error| format!("Could not read the system random source: {error}"))?;

  Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
  if left.len() != right.len() {
    return false;
  }

  let mut difference = 0_u8;

  for (&left, &right) in left.iter().zip(right.iter()) {
    difference |= left ^ right;
  }

  difference == 0
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
    "avif" => "image/avif",
    "bmp" => "image/bmp",
    "gif" => "image/gif",
    "jpeg" | "jpg" => "image/jpeg",
    "png" => "image/png",
    "webp" => "image/webp",
    "aac" => "audio/aac",
    "flac" => "audio/flac",
    "mp3" => "audio/mpeg",
    "m4a" => "audio/mp4",
    "ogg" | "opus" => "audio/ogg",
    "wav" => "audio/wav",
    "avi" => "video/x-msvideo",
    "mkv" => "video/x-matroska",
    "mov" => "video/quicktime",
    "mp4" => "video/mp4",
    "mpeg" | "mpg" => "video/mpeg",
    "webm" => "video/webm",
    _ => "application/octet-stream",
  }
}

#[cfg(test)]
mod tests {
  use super::{
    parse_range_header, percent_decode, percent_encode_path, MediaPathError, RangeResult,
  };
  use std::path::Path;

  #[test]
  fn rejects_oversized_media_request_headers() {
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::thread;

    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let address = listener.local_addr().unwrap();

    let server = thread::spawn(move || {
      let (stream, _) = listener.accept().unwrap();
      super::handle_connection(stream, "test-token").unwrap();
    });

    let request = format!(
      "GET /missing HTTP/1.1\r\nX-FrameFlow: {}\r\n\r\n",
      "a".repeat(32 * 1024)
    );

    let mut client = TcpStream::connect(address).unwrap();
    client.write_all(request.as_bytes()).unwrap();

    let mut response = Vec::new();
    client.read_to_end(&mut response).unwrap();

    let response_text = String::from_utf8(response).unwrap();
    assert!(response_text.starts_with(
      "HTTP/1.1 431 Request Header Fields Too Large\r\n"
    ));
    assert!(response_text.ends_with("Media request headers are too large."));

    server.join().unwrap();
  }

  #[test]
  fn rejects_invalid_utf8_media_requests() {
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::thread;

    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let address = listener.local_addr().unwrap();

    let server = thread::spawn(move || {
      let (stream, _) = listener.accept().unwrap();
      super::handle_connection(stream).unwrap();
    });

    let mut client = TcpStream::connect(address).unwrap();
    client
      .write_all(b"GET /missing HTTP/1.1\r\nX-FrameFlow: \xFF\r\n\r\n")
      .unwrap();

    let mut response = Vec::new();
    client.read_to_end(&mut response).unwrap();

    let response_text = String::from_utf8(response).unwrap();
    assert!(response_text.starts_with("HTTP/1.1 400 Bad Request\r\n"));
    assert!(response_text.ends_with("Media request must use valid UTF-8."));

    server.join().unwrap();
  }

  #[test]
  fn rejects_incomplete_media_request_headers() {
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::thread;

    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let address = listener.local_addr().unwrap();

    let server = thread::spawn(move || {
      let (stream, _) = listener.accept().unwrap();
      super::handle_connection(stream).unwrap();
    });

    let mut client = TcpStream::connect(address).unwrap();
    client
      .write_all(b"GET /missing HTTP/1.1\r\nHost: 127.0.0.1\r\n")
      .unwrap();
    client.shutdown(std::net::Shutdown::Write).unwrap();

    let mut response = Vec::new();
    client.read_to_end(&mut response).unwrap();

    let response_text = String::from_utf8(response).unwrap();
    assert!(response_text.starts_with("HTTP/1.1 400 Bad Request\r\n"));
    assert!(response_text.ends_with(
      "Media request headers were not terminated correctly."
    ));

    server.join().unwrap();
  }

  #[test]
  fn suppresses_body_for_head_oversized_request_headers() {
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::thread;

    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let address = listener.local_addr().unwrap();

    let server = thread::spawn(move || {
      let (stream, _) = listener.accept().unwrap();
      super::handle_connection(stream).unwrap();
    });

    let request = format!(
      "HEAD /missing HTTP/1.1\r\nX-FrameFlow: {}\r\n\r\n",
      "a".repeat(32 * 1024)
    );

    let mut client = TcpStream::connect(address).unwrap();
    client.write_all(request.as_bytes()).unwrap();

    let mut response = Vec::new();
    client.read_to_end(&mut response).unwrap();

    let response_text = String::from_utf8(response).unwrap();
    assert!(response_text.starts_with(
      "HTTP/1.1 431 Request Header Fields Too Large\r\n"
    ));
    assert!(response_text.ends_with("\r\n\r\n"));

    server.join().unwrap();
  }

  #[test]
  fn suppresses_body_for_head_invalid_utf8_request() {
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::thread;

    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let address = listener.local_addr().unwrap();

    let server = thread::spawn(move || {
      let (stream, _) = listener.accept().unwrap();
      super::handle_connection(stream).unwrap();
    });

    let mut client = TcpStream::connect(address).unwrap();
    client
      .write_all(b"HEAD /missing HTTP/1.1\r\nX-FrameFlow: \xFF\r\n\r\n")
      .unwrap();

    let mut response = Vec::new();
    client.read_to_end(&mut response).unwrap();

    let response_text = String::from_utf8(response).unwrap();
    assert!(response_text.starts_with("HTTP/1.1 400 Bad Request\r\n"));
    assert!(response_text.ends_with("\r\n\r\n"));

    server.join().unwrap();
  }

  #[test]
  fn suppresses_body_for_head_incomplete_request() {
    use std::io::{Read, Write};
    use std::net::{Shutdown, TcpListener, TcpStream};
    use std::thread;

    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let address = listener.local_addr().unwrap();

    let server = thread::spawn(move || {
      let (stream, _) = listener.accept().unwrap();
      super::handle_connection(stream).unwrap();
    });

    let mut client = TcpStream::connect(address).unwrap();
    client
      .write_all(b"HEAD /missing HTTP/1.1\r\nHost: 127.0.0.1\r\n")
      .unwrap();
    client.shutdown(Shutdown::Write).unwrap();

    let mut response = Vec::new();
    client.read_to_end(&mut response).unwrap();

    let response_text = String::from_utf8(response).unwrap();
    assert!(response_text.starts_with("HTTP/1.1 400 Bad Request\r\n"));
    assert!(response_text.ends_with("\r\n\r\n"));

    server.join().unwrap();
  }

  #[test]
  fn rejects_invalid_media_server_capability_tokens() {
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::thread;

    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let address = listener.local_addr().unwrap();

    let server = thread::spawn(move || {
      let (stream, _) = listener.accept().unwrap();
      super::handle_connection(stream, "expected-token").unwrap();
    });

    let mut client = TcpStream::connect(address).unwrap();
    client
      .write_all(
        b"GET /media?path=%2Fmedia%2Fvideo.mp4&token=wrong-token HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n",
      )
      .unwrap();

    let mut response = Vec::new();
    client.read_to_end(&mut response).unwrap();

    let response_text = String::from_utf8(response).unwrap();
    assert!(response_text.starts_with("HTTP/1.1 403 Forbidden\r\n"));
    assert!(response_text.ends_with("Media server capability token is invalid."));

    server.join().unwrap();
  }

  #[test]
  fn rejects_unsupported_http_versions() {
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::thread;

    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let address = listener.local_addr().unwrap();

    let server = thread::spawn(move || {
      let (stream, _) = listener.accept().unwrap();
      super::handle_connection(stream).unwrap();
    });

    let mut client = TcpStream::connect(address).unwrap();
    client
      .write_all(b"GET /missing HTTP/2.0\r\nHost: 127.0.0.1\r\n\r\n")
      .unwrap();

    let mut response = Vec::new();
    client.read_to_end(&mut response).unwrap();

    let response_text = String::from_utf8(response).unwrap();
    assert!(response_text.starts_with("HTTP/1.1 505 HTTP Version Not Supported\r\n"));
    assert!(response_text.ends_with("HTTP version is not supported."));

    server.join().unwrap();
  }

  #[test]
  fn rejects_duplicate_media_path_parameters() {
    assert_eq!(
      super::extract_media_request("path=%2Fmedia%2Fone.mp4&path=%2Fmedia%2Ftwo.mp4&token=test")
        .expect_err("duplicate media path parameters must be rejected"),
      "Duplicate media path parameter."
    );
  }

  #[test]
  fn rejects_missing_media_path_parameter() {
    assert_eq!(
      super::extract_media_request("foo=bar&token=test")
        .expect_err("missing media path parameters must be rejected"),
      "Missing media path."
    );
  }

  #[test]
  fn rejects_missing_media_server_capability_token() {
    assert_eq!(
      super::extract_media_request("path=%2Fmedia%2Fvideo.mp4")
        .expect_err("missing capability token must be rejected"),
      "Missing media server capability token."
    );
  }

  #[test]
  fn rejects_duplicate_media_server_capability_tokens() {
    assert_eq!(
      super::extract_media_request("path=%2Fmedia%2Fvideo.mp4&token=one&token=two")
        .expect_err("duplicate capability tokens must be rejected"),
      "Duplicate media server capability token."
    );
  }

  #[test]
  fn compares_capability_tokens_without_early_exit() {
    assert!(super::constant_time_eq(b"secret-token", b"secret-token"));
    assert!(!super::constant_time_eq(b"secret-token", b"secret-tokeN"));
    assert!(!super::constant_time_eq(b"secret-token", b"short"));
  }

  #[test]
  fn generates_non_empty_capability_tokens() {
    let first = super::generate_capability_token().unwrap();
    let second = super::generate_capability_token().unwrap();

    assert_eq!(first.len(), 64);
    assert_eq!(second.len(), 64);
    assert_ne!(first, second);
  }

  #[test]
  fn suppresses_body_for_head_error_responses() {
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::thread;

    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let address = listener.local_addr().unwrap();
    let expected_body = b"Media endpoint not found.";

    let server = thread::spawn(move || {
      let (stream, _) = listener.accept().unwrap();
      super::handle_connection(stream).unwrap();
    });

    let mut client = TcpStream::connect(address).unwrap();
    client
      .write_all(b"HEAD /missing HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n")
      .unwrap();

    let mut response = Vec::new();
    client.read_to_end(&mut response).unwrap();

    let response_text = String::from_utf8(response).unwrap();
    assert!(response_text.starts_with("HTTP/1.1 404 Not Found\r\n"));
    assert!(response_text.contains(&format!(
      "Content-Length: {}\r\n",
      expected_body.len()
    )));
    assert!(response_text.ends_with("\r\n\r\n"));
    assert!(!response_text.ends_with(&String::from_utf8_lossy(expected_body)));

    server.join().unwrap();
  }

  #[test]
  fn maps_media_path_validation_errors_to_http_statuses() {
    assert_eq!(MediaPathError::BadRequest.status(), (400, "Bad Request"));
    assert_eq!(MediaPathError::NotFound.status(), (404, "Not Found"));
    assert_eq!(
      MediaPathError::UnsupportedMediaType.status(),
      (415, "Unsupported Media Type")
    );
    assert_eq!(MediaPathError::Forbidden.status(), (403, "Forbidden"));
  }

  #[test]
  fn preserves_media_path_validation_error_messages() {
    assert_eq!(
      MediaPathError::BadRequest.to_string(),
      "Media path must be absolute."
    );
    assert_eq!(
      MediaPathError::NotFound.to_string(),
      "Media file could not be resolved."
    );
    assert_eq!(
      MediaPathError::UnsupportedMediaType.to_string(),
      "Media file type is not supported."
    );
    assert_eq!(
      MediaPathError::Forbidden.to_string(),
      "Media path is outside the allowed local media directories."
    );
  }

  #[test]
  fn rejects_relative_media_paths_before_resolution() {
    let error = super::validate_media_path(Path::new("relative/file.mp4"))
      .expect_err("relative media paths must be rejected");
    assert!(error.contains("Media path must be absolute"));
  }

  #[test]
  fn rejects_unsupported_media_extensions() {
    let path = std::env::temp_dir().join("frameflow-secret.txt");
    std::fs::write(&path, b"not media").unwrap();

    let error = super::validate_media_path(&path)
      .expect_err("unsupported file extensions must be rejected");
    assert!(error.contains("Media file type is not supported"));

    std::fs::remove_file(path).unwrap();
  }

  #[test]
  fn round_trips_encoded_media_paths() {
    let original = Path::new("/media/My Video #1.mp4");
    let encoded = percent_encode_path(original);

    assert_eq!(percent_decode(&encoded).unwrap(), original.to_string_lossy());
  }

  #[test]
  fn parses_single_media_range() {
    assert!(matches!(
      parse_range_header("GET /media HTTP/1.1\r\nRange: bytes=100-199\r\n\r\n", 1000),
      RangeResult::Single(100, 199)
    ));
  }

  #[test]
  fn parses_open_ended_media_range() {
    assert!(matches!(
      parse_range_header("GET /media HTTP/1.1\r\nRange: bytes=100-\r\n\r\n", 1000),
      RangeResult::Single(100, 999)
    ));
  }

  #[test]
  fn parses_suffix_media_range() {
    assert!(matches!(
      parse_range_header("GET /media HTTP/1.1\r\nRange: bytes=-100\r\n\r\n", 1000),
      RangeResult::Single(900, 999)
    ));
  }

  #[test]
  fn detects_multiple_media_ranges() {
    assert!(matches!(
      parse_range_header("GET /media HTTP/1.1\r\nRange: bytes=0-99,200-299\r\n\r\n", 1000),
      RangeResult::Multiple
    ));
  }

  #[test]
  fn rejects_duplicate_range_headers() {
    assert!(matches!(
      parse_range_header(
        "GET /media HTTP/1.1\r\nRange: bytes=0-99\r\nRange: bytes=200-299\r\n\r\n",
        1000
      ),
      RangeResult::DuplicateHeaders
    ));
  }

  #[test]
  fn rejects_malformed_range_header_name() {
    assert!(matches!(
      parse_range_header(
        "GET /media HTTP/1.1\r\nRange : bytes=0-99\r\n\r\n",
        1000
      ),
      RangeResult::MalformedHeader
    ));
  }
}
