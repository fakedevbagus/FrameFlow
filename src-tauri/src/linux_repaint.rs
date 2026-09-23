//! Linux-specific WebKitGTK repaint workaround.
//!
//! Some Linux desktop environments/WebKitGTK compositor combinations can keep
//! a valid WebKit frame from being presented to the GTK window until another
//! native expose/focus/resize occurs. FrameFlow uses a low-frequency GTK redraw
//! request so frontend DOM/React changes become visible without requiring a
//! user interaction.

#[cfg(target_os = "linux")]
use std::time::Duration;

#[cfg(target_os = "linux")]
use gtk::prelude::*;

#[cfg(target_os = "linux")]
const REPAINT_INTERVAL: Duration = Duration::from_millis(50);

/// Install the Linux repaint watchdog on the GTK main loop.
///
/// This only requests a redraw; it does not resize or move the window and
/// does not force a WebView re-navigation.
#[cfg(target_os = "linux")]
pub fn install(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        log::warn!("FrameFlow repaint watchdog: main window not found");
        return;
    };

    let native_window = match window.gtk_window() {
        Ok(window) => window,
        Err(error) => {
            log::warn!(
                "FrameFlow repaint watchdog: could not access GTK window: {error}"
            );
            return;
        }
    };

    let default_vbox = window.default_vbox().ok();

    gtk::glib::timeout_add_local(REPAINT_INTERVAL, move || {
        native_window.queue_draw();

        if let Some(vbox) = default_vbox.as_ref() {
            vbox.queue_draw();
        }

        gtk::glib::ControlFlow::Continue
    });
}
