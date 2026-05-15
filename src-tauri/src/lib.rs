mod commands;
mod config;
mod jar_parser;
mod jdk_manager;
mod models;

use commands::AppState;
use std::collections::HashMap;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|_app| {
            config::ensure_dirs().expect("Failed to create JarBox directories");
            Ok(())
        })
        .manage(AppState {
            config: Mutex::new(config::load_config().unwrap_or_default()),
            running_processes: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::add_jar,
            commands::update_jar,
            commands::remove_app,
            commands::update_app,
            commands::discover_jdks,
            commands::download_and_install_jdk,
            commands::remove_jdk,
            commands::launch_app,
            commands::open_file_location,
            commands::update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
