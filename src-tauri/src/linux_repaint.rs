//! Linux-specific WebKitGTK redraw workaround.
//!
//! On some Linux desktop/compositor combinations a WebKitGTK frame can be
//! rendered correctly by the web process but not presented by the GTK UI
//! process until another native expose/focus/resize occurs. FrameFlow requests
//! a lightweight GTK redraw on the main GTK loop instead of changing window
//! geometry or reloading the WebView.

#[cfg(target_os = "linux")]
use std::time::Duration;

#[cfg(target_os = "linux")]
use gtk::prelude::*;

#[cfg(target_os = "linux")]
const REDRAW_INTERVAL: Duration = Duration::from_millis(50);

#[cfg(target_os = "linux")]
fn queue_redraw_tree(widget: &gtk::Widget) {
    widget.queue_draw();

    if let Ok(container) = widget.clone().downcast::<gtk::Container>() {
        for child in container.children() {
            queue_redraw_tree(&child);
        }
    }
}

/// Install the Linux repaint watchdog on the GTK main loop.
///
/// The watchdog requests redraws only. It never resizes, moves, reloads, or
/// navigates the application window.
#[cfg(target_os = "linux")]
pub fn install(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("FrameFlow: repaint watchdog could not find the main window");
        return;
    };

    let native_window = match window.gtk_window() {
        Ok(window) => window,
        Err(error) => {
            eprintln!(
                "FrameFlow: repaint watchdog could not access GTK window: {error}"
            );
            return;
        }
    };

    let default_vbox = window.default_vbox().ok();

    gtk::glib::timeout_add_local(REDRAW_INTERVAL, move || {
        native_window.queue_draw();

        if let Some(vbox) = default_vbox.as_ref() {
            let widget = vbox.clone().upcast::<gtk::Widget>();
            queue_redraw_tree(&widget);
        }

        gtk::glib::ControlFlow::Continue
    });
}
