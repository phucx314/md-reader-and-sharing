use std::path::PathBuf;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use tauri::{AppHandle, Emitter};

static INITIAL_FILE: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

fn extract_path_from_arg(arg: &str) -> Option<String> {
    let trimmed = arg.trim();
    if trimmed.is_empty() {
        return None;
    }
    if !trimmed.to_ascii_lowercase().ends_with(".md")
        && !trimmed.to_ascii_lowercase().ends_with(".markdown")
        && !trimmed.to_ascii_lowercase().ends_with(".mdown")
        && !trimmed.to_ascii_lowercase().ends_with(".txt")
    {
        // Allow any file — user can still open it. We'll just check existence on read.
    }
    if let Ok(url) = url::Url::parse(trimmed) {
        if url.scheme() == "file" {
            if let Ok(p) = url.to_file_path() {
                return Some(p.to_string_lossy().to_string());
            }
        }
    }
    Some(trimmed.to_string())
}

fn scan_args_for_file() -> Option<String> {
    for arg in std::env::args().skip(1) {
        if arg.starts_with("--") {
            continue;
        }
        if let Some(p) = extract_path_from_arg(&arg) {
            return Some(p);
        }
    }
    None
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("File not found: {path}"));
    }
    if !p.is_file() {
        return Err(format!("Not a file: {path}"));
    }
    std::fs::read_to_string(&p).map_err(|e| format!("Read failed: {e}"))
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| format!("mkdir failed: {e}"))?;
        }
    }
    std::fs::write(&p, content.as_bytes()).map_err(|e| format!("Write failed: {e}"))
}

#[tauri::command]
fn get_initial_file() -> Option<String> {
    INITIAL_FILE.lock().ok().and_then(|g| g.clone())
}

#[tauri::command]
fn frontend_ready(app: AppHandle) -> Result<(), String> {
    let initial = INITIAL_FILE.lock().ok().and_then(|g| g.clone());
    if let Some(path) = initial {
        let _ = app.emit("open-file", path);
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Cache CLI file argument before Tauri init
    if let Some(p) = scan_args_for_file() {
        if let Ok(mut g) = INITIAL_FILE.lock() {
            *g = Some(p);
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            get_initial_file,
            frontend_ready
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            // Single-instance-like behavior for Open With: when a new file is opened,
            // forward the path to the existing window via "open-file" event.
            // (Tauri's single-instance plugin handles this; we keep it minimal here.)
            // Listen to re-emit requests for second-instance behavior — minimal.
            // We simply remember the initial file; subsequent CLI opens would launch
            // a new process, which file managers avoid if the .desktop has
            // SingleMainWindow=true and DBusActivatable=false.
            //
            // To support "Open With" while the app is already running, we rely on
            // the file manager starting a new process; users can choose "Open in
            // existing window" via the file manager if it supports it. If the user
            // wants a single window, they can add SingleMainWindow=true later.
            let _ = handle;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
