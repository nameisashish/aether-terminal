// ==========================================
// Aether Terminal — PTY Manager (Rust)
// Manages pseudoterminal sessions for each
// terminal tab. Spawns native shell, handles
// I/O streaming, and resize events.
// ==========================================

use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

/// Represents a single PTY session
struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

/// Global state managing all active PTY sessions
pub struct PtyManager {
    sessions: Mutex<HashMap<String, PtySession>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

/// Data sent from frontend to create a PTY
#[derive(Debug, Deserialize)]
pub struct CreatePtyRequest {
    pub rows: u16,
    pub cols: u16,
    pub cwd: Option<String>,
}

/// Response when PTY is created
#[derive(Debug, Serialize, Clone)]
pub struct PtyCreatedResponse {
    pub id: String,
}

/// Data for writing to a PTY
#[derive(Debug, Deserialize)]
pub struct WritePtyRequest {
    pub id: String,
    pub data: String,
}

/// Data for resizing a PTY
#[derive(Debug, Deserialize)]
pub struct ResizePtyRequest {
    pub id: String,
    pub rows: u16,
    pub cols: u16,
}

/// Creates a new PTY session, spawning the user's default shell.
/// Returns a unique session ID. Output is streamed via Tauri events.
#[tauri::command]
pub fn create_pty(
    app: AppHandle,
    state: tauri::State<'_, Arc<PtyManager>>,
    request: CreatePtyRequest,
) -> Result<PtyCreatedResponse, String> {
    let pty_system = native_pty_system();
    let id = Uuid::new_v4().to_string();

    // Configure PTY size
    let size = PtySize {
        rows: request.rows,
        cols: request.cols,
        pixel_width: 0,
        pixel_height: 0,
    };

    // Open a new PTY pair (master + child)
    let pair = pty_system
        .openpty(size)
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Determine the user's default shell
    let shell = get_default_shell();

    // Build the command to spawn the shell
    let mut cmd = CommandBuilder::new(&shell);
    cmd.arg("-l"); // Login shell for proper profile loading

    // Set working directory if provided
    if let Some(ref cwd) = request.cwd {
        cmd.cwd(cwd);
    }

    // Set essential environment variables
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("LANG", "en_US.UTF-8");

    // Spawn the shell process in the child PTY
    let _child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Drop the slave side — we only communicate via master
    drop(pair.slave);

    // Get writer handle for sending data to PTY
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

    // Get reader handle for receiving PTY output
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to get PTY reader: {}", e))?;

    let session_id = id.clone();

    // Store the session
    {
        let mut sessions = state.sessions.lock();
        sessions.insert(
            id.clone(),
            PtySession {
                master: pair.master,
                writer,
            },
        );
    }

    // Spawn a thread to continuously read PTY output and emit events
    let event_id = session_id.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    // PTY closed — notify frontend
                    let _ = app.emit(&format!("pty-exit-{}", event_id), ());
                    break;
                }
                Ok(n) => {
                    // Convert bytes to string (lossy for non-UTF8 binary output)
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app.emit(&format!("pty-output-{}", event_id), data);
                }
                Err(e) => {
                    log::error!("PTY read error for {}: {}", event_id, e);
                    let _ = app.emit(&format!("pty-exit-{}", event_id), ());
                    break;
                }
            }
        }
    });

    Ok(PtyCreatedResponse { id: session_id })
}

/// Writes data (keystrokes) from xterm.js to the PTY
#[tauri::command]
pub fn write_pty(
    state: tauri::State<'_, Arc<PtyManager>>,
    request: WritePtyRequest,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock();
    if let Some(session) = sessions.get_mut(&request.id) {
        session
            .writer
            .write_all(request.data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
        session
            .writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;
        Ok(())
    } else {
        Err(format!("PTY session not found: {}", request.id))
    }
}

/// Resizes a PTY session (when the terminal window changes size)
#[tauri::command]
pub fn resize_pty(
    state: tauri::State<'_, Arc<PtyManager>>,
    request: ResizePtyRequest,
) -> Result<(), String> {
    let sessions = state.sessions.lock();
    if let Some(session) = sessions.get(&request.id) {
        session
            .master
            .resize(PtySize {
                rows: request.rows,
                cols: request.cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;
        Ok(())
    } else {
        Err(format!("PTY session not found: {}", request.id))
    }
}

/// Destroys a PTY session (when tab is closed)
#[tauri::command]
pub fn destroy_pty(state: tauri::State<'_, Arc<PtyManager>>, id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock();
    if sessions.remove(&id).is_some() {
        log::info!("PTY session destroyed: {}", id);
        Ok(())
    } else {
        Err(format!("PTY session not found: {}", id))
    }
}

/// Returns the user's default shell
fn get_default_shell() -> String {
    if cfg!(target_os = "windows") {
        std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    }
}

/// Returns the user's home directory (cross-platform)
#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory".to_string())
}
