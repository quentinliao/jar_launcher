use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;

use tauri::State;

use crate::config;
use crate::jar_parser;
use crate::jdk_manager;
use crate::models::{AppConfig, JarApp, JdkInfo, Settings};

pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub running_processes: Mutex<HashMap<String, u32>>,
}

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> Result<AppConfig, String> {
    let config = state.config.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(config.clone())
}

#[tauri::command]
pub fn add_jar(path: String, state: State<'_, AppState>) -> Result<JarApp, String> {
    let src_path = PathBuf::from(&path);
    if !src_path.exists() {
        return Err(format!("JAR file not found: {}", path));
    }

    let filename = src_path
        .file_name()
        .ok_or("Invalid file path")?
        .to_string_lossy()
        .to_string();

    // Parse manifest
    let manifest = jar_parser::parse_jar_manifest(&src_path).ok();
    let (parsed_name, parsed_version) = jar_parser::parse_name_from_filename(&filename);

    // Determine name and version: manifest takes priority, fallback to filename parsing
    let name = manifest
        .as_ref()
        .and_then(|m| m.title.clone())
        .unwrap_or(parsed_name);
    let version = manifest
        .as_ref()
        .and_then(|m| m.version.clone())
        .or(parsed_version);

    // Create app directory and copy JAR
    let app_id = uuid::Uuid::new_v4().to_string();
    let app_dir = config::get_apps_dir().join(&app_id);
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app directory: {}", e))?;

    let dest_path = app_dir.join(&filename);
    fs::copy(&src_path, &dest_path)
        .map_err(|e| format!("Failed to copy JAR file: {}", e))?;

    let jar_app = JarApp {
        id: app_id.clone(),
        name,
        version,
        jar_path: dest_path.to_string_lossy().to_string(),
        jdk_id: None,
        jvm_args: Vec::new(),
        app_args: Vec::new(),
        icon_path: None,
        show_console: false,
        added_at: chrono::Utc::now().to_rfc3339(),
        running: None,
    };

    // Save to config
    let mut cfg = state.config.lock().map_err(|e| format!("Lock error: {}", e))?;
    cfg.apps.push(jar_app.clone());
    config::save_config(&cfg)?;

    Ok(jar_app)
}

#[tauri::command]
pub fn update_jar(
    app_id: String,
    jar_path: String,
    state: State<'_, AppState>,
) -> Result<JarApp, String> {
    let src_path = PathBuf::from(&jar_path);
    if !src_path.exists() {
        return Err(format!("JAR file not found: {}", jar_path));
    }

    let filename = src_path
        .file_name()
        .ok_or("Invalid file path")?
        .to_string_lossy()
        .to_string();

    // Parse manifest of new JAR
    let manifest = jar_parser::parse_jar_manifest(&src_path).ok();
    let (_parsed_name, parsed_version) = jar_parser::parse_name_from_filename(&filename);

    let new_version = manifest
        .as_ref()
        .and_then(|m| m.version.clone())
        .or(parsed_version);

    let mut cfg = state.config.lock().map_err(|e| format!("Lock error: {}", e))?;

    let app = cfg
        .apps
        .iter_mut()
        .find(|a| a.id == app_id)
        .ok_or("App not found")?;

    // Remove old JAR file
    let old_jar_path = PathBuf::from(&app.jar_path);
    if old_jar_path.exists() {
        let _ = fs::remove_file(&old_jar_path);
    }

    // Copy new JAR to app directory
    let default_apps_dir = config::get_apps_dir();
    let app_dir = old_jar_path.parent().unwrap_or(&default_apps_dir);
    let dest_path = app_dir.join(&filename);
    fs::copy(&src_path, &dest_path)
        .map_err(|e| format!("Failed to copy JAR file: {}", e))?;

    // Update app info
    app.jar_path = dest_path.to_string_lossy().to_string();
    if let Some(v) = new_version {
        app.version = Some(v);
    }

    let updated = app.clone();
    config::save_config(&cfg)?;

    Ok(updated)
}

#[tauri::command]
pub fn remove_app(app_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut cfg = state.config.lock().map_err(|e| format!("Lock error: {}", e))?;

    let app_index = cfg
        .apps
        .iter()
        .position(|a| a.id == app_id)
        .ok_or("App not found")?;

    let app = &cfg.apps[app_index];

    // Remove app directory
    let jar_path = PathBuf::from(&app.jar_path);
    if let Some(app_dir) = jar_path.parent() {
        let _ = fs::remove_dir_all(app_dir);
    }

    cfg.apps.remove(app_index);
    config::save_config(&cfg)?;

    // Also clean up any running process tracking
    let mut processes = state
        .running_processes
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    processes.remove(&app_id);

    Ok(())
}

#[tauri::command]
pub fn update_app(
    app_id: String,
    updates: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<JarApp, String> {
    let mut cfg = state.config.lock().map_err(|e| format!("Lock error: {}", e))?;

    let app = cfg
        .apps
        .iter_mut()
        .find(|a| a.id == app_id)
        .ok_or("App not found")?;

    if let Some(name) = updates.get("name").and_then(|v| v.as_str()) {
        app.name = name.to_string();
    }
    if let Some(version) = updates.get("version") {
        app.version = version.as_str().map(|s| s.to_string());
    }
    if let Some(jdk_id) = updates.get("jdk_id") {
        app.jdk_id = jdk_id.as_str().map(|s| s.to_string());
    }
    if let Some(jvm_args) = updates.get("jvm_args").and_then(|v| v.as_array()) {
        app.jvm_args = jvm_args
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect();
    }
    if let Some(app_args) = updates.get("app_args").and_then(|v| v.as_array()) {
        app.app_args = app_args
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect();
    }
    if let Some(icon_path) = updates.get("icon_path") {
        app.icon_path = icon_path.as_str().map(|s| s.to_string());
    }
    if let Some(show_console) = updates.get("show_console").and_then(|v| v.as_bool()) {
        app.show_console = show_console;
    }

    let updated = app.clone();
    config::save_config(&cfg)?;

    Ok(updated)
}

#[tauri::command]
pub async fn discover_jdks(state: State<'_, AppState>) -> Result<Vec<JdkInfo>, String> {
    let system_jdks = jdk_manager::discover_system_jdks();

    let mut cfg = state.config.lock().map_err(|e| format!("Lock error: {}", e))?;

    // Merge with existing JDKs - avoid duplicates by path
    let existing_paths: Vec<String> = cfg.jdks.iter().map(|j| j.path.clone()).collect();

    for jdk in &system_jdks {
        if !existing_paths.contains(&jdk.path) {
            cfg.jdks.push(jdk.clone());
        }
    }

    let result = cfg.jdks.clone();
    config::save_config(&cfg)?;

    Ok(result)
}

#[tauri::command]
pub async fn download_and_install_jdk(
    major_version: u32,
    vendor: String,
    state: State<'_, AppState>,
) -> Result<JdkInfo, String> {
    let install_dir = config::get_jdks_dir().join(format!("jdk-{}", major_version));

    let jdk = jdk_manager::download_jdk(major_version, &vendor, &install_dir).await?;

    let mut cfg = state.config.lock().map_err(|e| format!("Lock error: {}", e))?;
    cfg.jdks.push(jdk.clone());
    config::save_config(&cfg)?;

    Ok(jdk)
}

#[tauri::command]
pub fn remove_jdk(jdk_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut cfg = state.config.lock().map_err(|e| format!("Lock error: {}", e))?;

    let jdk_index = cfg
        .jdks
        .iter()
        .position(|j| j.id == jdk_id)
        .ok_or("JDK not found")?;

    let jdk = &cfg.jdks[jdk_index];

    // Delete files only if it was downloaded by us
    if matches!(jdk.source, crate::models::JdkSource::Downloaded) {
        let jdk_path = PathBuf::from(&jdk.path);
        if jdk_path.exists() {
            let _ = fs::remove_dir_all(&jdk_path);
        }
        // Also try to remove the parent install directory if it's now empty
        if let Some(parent) = jdk_path.parent() {
            let _ = fs::remove_dir(parent);
        }
    }

    // Remove any app references to this JDK
    for app in &mut cfg.apps {
        if app.jdk_id.as_deref() == Some(&jdk_id) {
            app.jdk_id = None;
        }
    }

    cfg.jdks.remove(jdk_index);
    config::save_config(&cfg)?;

    Ok(())
}

#[tauri::command]
pub fn launch_app(app_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let cfg = state.config.lock().map_err(|e| format!("Lock error: {}", e))?;

    let app = cfg
        .apps
        .iter()
        .find(|a| a.id == app_id)
        .ok_or("App not found")?;

    // Find JDK to use
    let jdk = if let Some(jdk_id) = &app.jdk_id {
        cfg.jdks
            .iter()
            .find(|j| &j.id == jdk_id)
            .ok_or("Configured JDK not found")?
            .clone()
    } else {
        // Auto-select: find the latest JDK
        cfg.jdks
            .iter()
            .max_by_key(|j| j.major_version)
            .ok_or("No JDK available. Please add a JDK first.")?
            .clone()
    };

    let java_bin = if cfg!(target_os = "windows") {
        PathBuf::from(&jdk.path).join("bin/java.exe")
    } else {
        PathBuf::from(&jdk.path).join("bin/java")
    };

    if !java_bin.exists() {
        return Err(format!("Java binary not found at {:?}", java_bin));
    }

    // Build command
    let mut cmd = Command::new(&java_bin);

    // Add JVM args
    for arg in &app.jvm_args {
        cmd.arg(arg);
    }

    // Add JAR path
    cmd.arg("-jar");
    cmd.arg(&app.jar_path);

    // Add app args
    for arg in &app.app_args {
        cmd.arg(arg);
    }

    // Configure stdout/stderr based on show_console
    if !app.show_console {
        cmd.stdout(std::process::Stdio::null());
        cmd.stderr(std::process::Stdio::null());
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to launch application: {}", e))?;

    let pid = child.id();

    // Store PID
    drop(cfg); // Release config lock before acquiring process lock
    let mut processes = state
        .running_processes
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    processes.insert(app_id, pid);

    Ok(())
}

#[tauri::command]
pub fn open_file_location(path: String) -> Result<(), String> {
    let path = PathBuf::from(&path);
    let parent = if path.is_dir() {
        path.clone()
    } else {
        path.parent()
            .ok_or("Cannot determine parent directory")?
            .to_path_buf()
    };

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&parent)
            .spawn()
            .map_err(|e| format!("Failed to open file location: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&parent)
            .spawn()
            .map_err(|e| format!("Failed to open file location: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&parent)
            .spawn()
            .map_err(|e| format!("Failed to open file location: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn update_settings(
    settings: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<Settings, String> {
    let mut cfg = state.config.lock().map_err(|e| format!("Lock error: {}", e))?;

    if let Some(theme) = settings.get("theme").and_then(|v| v.as_str()) {
        cfg.settings.theme = match theme {
            "light" => crate::models::Theme::Light,
            "dark" => crate::models::Theme::Dark,
            _ => crate::models::Theme::System,
        };
    }

    if let Some(policy) = settings
        .get("default_jdk_policy")
        .and_then(|v| v.as_str())
    {
        cfg.settings.default_jdk_policy = match policy {
            "always-latest" => crate::models::DefaultJdkPolicy::AlwaysLatest,
            "always-ask" => crate::models::DefaultJdkPolicy::AlwaysAsk,
            _ => crate::models::DefaultJdkPolicy::AutoMatch,
        };
    }

    if let Some(behavior) = settings
        .get("launch_behavior")
        .and_then(|v| v.as_str())
    {
        cfg.settings.launch_behavior = match behavior {
            "show-console" => crate::models::LaunchBehavior::ShowConsole,
            _ => crate::models::LaunchBehavior::Background,
        };
    }

    let updated = cfg.settings.clone();
    config::save_config(&cfg)?;

    Ok(updated)
}
