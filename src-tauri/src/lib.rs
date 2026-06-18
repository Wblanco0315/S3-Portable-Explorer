// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::fs::OpenOptions;
use std::io::{Seek, SeekFrom, Write};
use std::sync::{Mutex, OnceLock};

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

static FILE_WRITE_MUTEX: Mutex<()> = Mutex::new(());
static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .tcp_keepalive(Some(std::time::Duration::from_secs(60)))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn download_chunk(
    url: String,
    save_path: String,
    start_byte: u64,
    end_byte: u64,
) -> Result<u64, String> {
    // 1. Send HTTP request with Range header using the global shared keepalive client
    let client = get_http_client();
    let res = client
        .get(&url)
        .header("Range", format!("bytes={}-{}", start_byte, end_byte))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("HTTP status error: {}", res.status()));
    }

    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    let len = bytes.len() as u64;

    // 2. Lock and write to file at specific offset
    let join_result = tauri::async_runtime::spawn_blocking(move || {
        let _lock = FILE_WRITE_MUTEX.lock().unwrap();
        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .open(&save_path)
            .map_err(|e| format!("Failed to open file: {}", e))?;

        file.seek(SeekFrom::Start(start_byte))
            .map_err(|e| format!("Failed to seek file: {}", e))?;

        file.write_all(&bytes)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        Ok::<u64, String>(len)
    })
    .await;

    match join_result {
        Ok(inner_res) => inner_res,
        Err(e) => Err(format!("Thread join error: {}", e)),
    }
}


use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create_initial_tables",
        sql: "
                CREATE TABLE IF NOT EXISTS settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT UNIQUE NOT NULL,
                    value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS recent_routes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    path TEXT NOT NULL,
                    visited_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS favorite_routes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    path TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS download_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_name TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            ",
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:s3explorer_data.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Clean up orphaned SQLite WAL/SHM files left by a crash.
            // A stale SHM file tricks SQLite into thinking another process holds
            // a lock, which causes SQLITE_READONLY (code 8) on every subsequent launch.
            if let Ok(data_dir) = app.path().app_data_dir() {
                let wal = data_dir.join("s3explorer_data.db-wal");
                let shm = data_dir.join("s3explorer_data.db-shm");
                // Remove stale WAL/SHM files left by a crash. At process startup
                // no other instance holds the database, so these files are orphaned.
                // Leaving them causes SQLITE_READONLY on the next open.
                if shm.exists() {
                    let _ = std::fs::remove_file(&shm);
                    let _ = std::fs::remove_file(&wal);
                }
            }

            let quit_i = MenuItemBuilder::new("Salir").id("quit").build(app)?;
            let show_i = MenuItemBuilder::new("Mostrar").id("show").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show_i, &quit_i])
                .build()?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false);

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button, button_state, .. } = event {
                        if button == MouseButton::Left && button_state == MouseButtonState::Up {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let is_visible = window.is_visible().unwrap_or(false);
                                if is_visible {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                #[cfg(not(dev))]
                {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![greet, download_chunk])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
