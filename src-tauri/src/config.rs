use std::fs;
use std::path::PathBuf;

use crate::models::AppConfig;

pub fn get_data_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Could not determine home directory")
        .join(".jarbox")
}

pub fn get_apps_dir() -> PathBuf {
    get_data_dir().join("apps")
}

pub fn get_jdks_dir() -> PathBuf {
    get_data_dir().join("jdks")
}

pub fn get_config_path() -> PathBuf {
    get_data_dir().join("config.json")
}

pub fn ensure_dirs() -> Result<(), String> {
    let dirs_to_create = [get_data_dir(), get_apps_dir(), get_jdks_dir()];
    for dir in &dirs_to_create {
        fs::create_dir_all(dir).map_err(|e| format!("Failed to create directory {:?}: {}", dir, e))?;
    }
    Ok(())
}

pub fn load_config() -> Result<AppConfig, String> {
    let config_path = get_config_path();
    if config_path.exists() {
        let content =
            fs::read_to_string(&config_path).map_err(|e| format!("Failed to read config: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))
    } else {
        Ok(AppConfig::default())
    }
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    ensure_dirs()?;
    let config_path = get_config_path();
    let content =
        serde_json::to_string_pretty(config).map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config: {}", e))
}
