  }

  #[test]
  fn validates_native_video_graph_request_metadata() {
    let valid = super::NativeVideoGraphRenderRequest {
      inputs: vec!["/media/a.mp4".to_string()],
      input_media_types: vec!["video".to_string()],
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
      input_media_types: vec!["video".to_string()],
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