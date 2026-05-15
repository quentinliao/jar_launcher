# JarBox 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个跨平台桌面应用，让普通用户通过拖拽 JAR + 双击启动的方式使用 Java 应用，无需手动配置环境。

**Architecture:** Tauri 2 应用，Rust 后端负责 JAR 解析、JDK 管理、进程启动；React + Tailwind 前端负责 UI 展示。通过 Tauri commands 桥接前后端。

**Tech Stack:** Tauri 2, Rust, React 18, TypeScript, Tailwind CSS 4, Vite, Lucide React

---

## Task 1: 初始化 Tauri 2 项目

**Files:**
- Create: 整个项目骨架（通过 `npm create tauri-app`）
- Modify: `package.json`, `src-tauri/Cargo.toml`

**Step 1: 用 create-tauri-app 创建项目**

```bash
cd /Users/liaozhankun/Workspace/Tools/jar_launcher
npm create tauri-app@latest -- --template react-ts --manager npm .
```

如果交互式提示，选择：
- Project name: `jarbox`
- Frontend: `React + TypeScript`
- Package manager: `npm`

如果命令不支持非交互模式，手动创建：
```bash
npm create tauri-app@latest jarbox-temp
# 然后把内容移到当前目录
```

**Step 2: 安装前端依赖**

```bash
npm install tailwindcss @tailwindcss/vite lucide-react react-router-dom
```

**Step 3: 安装 Tauri 插件依赖**

```bash
npm install @tauri-apps/plugin-shell @tauri-apps/plugin-fs @tauri-apps/plugin-dialog @tauri-apps/plugin-process
```

在 `src-tauri/Cargo.toml` 中添加：
```toml
[dependencies]
tauri-plugin-shell = "2"
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
tauri-plugin-process = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
zip = "2"
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["full"] }
semver = "1"
```

**Step 4: 配置 Tailwind CSS**

修改 `vite.config.ts`：
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
```

修改 `src/App.css`（或创建 `src/index.css`）：
```css
@import "tailwindcss";
```

**Step 5: 注册 Tauri 插件**

修改 `src-tauri/src/lib.rs`：
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 6: 配置 Tauri 能力权限**

修改 `src-tauri/capabilities/default.json`，添加 shell、fs、dialog 权限：
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "shell:allow-execute",
    "dialog:default",
    "fs:default",
    "fs:allow-read",
    "fs:allow-write",
    "fs:allow-exists",
    "fs:allow-mkdir",
    "fs:allow-copy-file",
    "fs:allow-rename",
    "fs:allow-remove",
    "process:default"
  ]
}
```

**Step 7: 验证项目能正常启动**

```bash
npm run tauri dev
```
Expected: 应用窗口正常打开，显示默认 React 页面。

**Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Tauri 2 project with React + TypeScript + Tailwind"
```

---

## Task 2: Rust 后端 - 数据模型与配置管理

**Files:**
- Create: `src-tauri/src/models.rs`
- Create: `src-tauri/src/config.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建数据模型 `src-tauri/src/models.rs`**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub apps: Vec<JarApp>,
    pub jdks: Vec<JdkInfo>,
    pub settings: Settings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JarApp {
    pub id: String,
    pub name: String,
    pub version: String,
    pub jar_path: String,
    pub jdk_id: Option<String>,
    pub jvm_args: Vec<String>,
    pub app_args: Vec<String>,
    pub icon_path: Option<String>,
    pub show_console: bool,
    pub added_at: String,
    pub running: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JdkInfo {
    pub id: String,
    pub version: String,
    pub major_version: u32,
    pub vendor: String,
    pub path: String,
    pub source: JdkSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JdkSource {
    System,
    Downloaded,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub default_jdk_policy: DefaultJdkPolicy,
    pub launch_behavior: LaunchBehavior,
    pub theme: Theme,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DefaultJdkPolicy {
    AutoMatch,
    AlwaysLatest,
    AlwaysAsk,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LaunchBehavior {
    Background,
    ShowConsole,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    System,
    Light,
    Dark,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            apps: Vec::new(),
            jdks: Vec::new(),
            settings: Settings {
                default_jdk_policy: DefaultJdkPolicy::AutoMatch,
                launch_behavior: LaunchBehavior::Background,
                theme: Theme::System,
            },
        }
    }
}
```

**Step 2: 创建配置管理 `src-tauri/src/config.rs`**

```rust
use std::fs;
use std::path::PathBuf;
use crate::models::AppConfig;

pub fn get_data_dir() -> PathBuf {
    let home = dirs::home_dir().expect("Cannot find home directory");
    home.join(".jarbox")
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

pub fn ensure_dirs() -> std::io::Result<()> {
    fs::create_dir_all(get_data_dir())?;
    fs::create_dir_all(get_apps_dir())?;
    fs::create_dir_all(get_jdks_dir())?;
    Ok(())
}

pub fn load_config() -> AppConfig {
    let path = get_config_path();
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        let config = AppConfig::default();
        save_config(&config).ok();
        config
    }
}

pub fn save_config(config: &AppConfig) -> std::io::Result<()> {
    ensure_dirs()?;
    let path = get_config_path();
    let content = serde_json::to_string_pretty(config)?;
    fs::write(path, content)
}
```

**Step 3: 在 Cargo.toml 中添加 `dirs` 依赖**

```toml
dirs = "6"
```

**Step 4: 修改 `src-tauri/src/lib.rs` 连接模块**

```rust
mod models;
mod config;

use config::ensure_dirs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|_app| {
            ensure_dirs().expect("Failed to create JarBox directories");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 5: 验证编译通过**

```bash
cd src-tauri && cargo check
```
Expected: 编译成功，无错误。

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add data models and config management"
```

---

## Task 3: Rust 后端 - JAR 解析器

**Files:**
- Create: `src-tauri/src/jar_parser.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 JAR 解析器 `src-tauri/src/jar_parser.rs`**

JAR 文件本质是 ZIP 文件，从中提取 `META-INF/MANIFEST.MF` 并解析。

```rust
use std::collections::HashMap;
use std::io::Read;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct JarManifest {
    pub title: Option<String>,
    pub version: Option<String>,
    pub main_class: Option<String>,
    pub build_jdk: Option<String>,
}

pub fn parse_jar_manifest(jar_path: &Path) -> Result<JarManifest, String> {
    let file = std::fs::File::open(jar_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    let manifest_str = match archive.by_name("META-INF/MANIFEST.MF") {
        Ok(mut file) => {
            let mut content = String::new();
            file.read_to_string(&mut content).map_err(|e| e.to_string())?;
            content
        }
        Err(_) => return Ok(JarManifest {
            title: None,
            version: None,
            main_class: None,
            build_jdk: None,
        }),
    };

    let attrs = parse_manifest_attributes(&manifest_str);

    Ok(JarManifest {
        title: attrs.get("Implementation-Title")
            .or_else(|| attrs.get("Bundle-Name"))
            .or_else(|| attrs.get("Specification-Title"))
            .cloned(),
        version: attrs.get("Implementation-Version")
            .or_else(|| attrs.get("Bundle-Version"))
            .or_else(|| attrs.get("Specification-Version"))
            .cloned(),
        main_class: attrs.get("Main-Class").cloned(),
        build_jdk: attrs.get("Build-Jdk")
            .or_else(|| attrs.get("Created-By"))
            .cloned(),
    })
}

/// 从文件名推导应用名称和版本
/// 例如 "myapp-2.1.0.jar" -> ("myapp", "2.1.0")
pub fn parse_name_from_filename(filename: &str) -> (String, Option<String>) {
    let name = filename.trim_end_matches(".jar");
    // 匹配末尾的版本号模式: -X.Y.Z 或 -X.Y.Z-suffix
    if let Some(pos) = name.rfind('-') {
        let potential_version = &name[pos + 1..];
        if potential_version.chars().next().map_or(false, |c| c.is_ascii_digit()) {
            return (name[..pos].to_string(), Some(potential_version.to_string()));
        }
    }
    (name.to_string(), None)
}

fn parse_manifest_attributes(manifest: &str) -> HashMap<String, String> {
    let mut attrs = HashMap::new();
    let mut continued_line = String::new();

    for line in manifest.lines() {
        if line.starts_with(' ') || line.starts_with('\t') {
            // 续行
            continued_line.push_str(line.trim());
        } else {
            if !continued_line.is_empty() {
                if let Some((key, value)) = continued_line.split_once(':') {
                    attrs.insert(key.trim().to_string(), value.trim().to_string());
                }
            }
            continued_line = line.to_string();
        }
    }

    if !continued_line.is_empty() {
        if let Some((key, value)) = continued_line.split_once(':') {
            attrs.insert(key.trim().to_string(), value.trim().to_string());
        }
    }

    attrs
}

/// 从 Build-Jdk 字符串推断 JDK 大版本号
/// 例如 "1.8.0_402" -> 8, "17.0.10" -> 17
pub fn infer_jdk_major_version(build_jdk: &str) -> Option<u32> {
    let version_str = build_jdk.split('-').next()?.trim();
    let parts: Vec<&str> = version_str.split('.').collect();
    if parts.len() >= 2 {
        let major: u32 = parts[0].parse().ok()?;
        if major == 1 && parts.len() >= 2 {
            // 旧版本号 1.8.x -> 8
            parts[1].parse().ok()
        } else {
            Some(major)
        }
    } else {
        None
    }
}
```

**Step 2: 在 `lib.rs` 中注册模块**

```rust
mod jar_parser;
```

**Step 3: 验证编译通过**

```bash
cd src-tauri && cargo check
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add JAR manifest parser"
```

---

## Task 4: Rust 后端 - JDK 发现与下载

**Files:**
- Create: `src-tauri/src/jdk_manager.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 JDK 管理器 `src-tauri/src/jdk_manager.rs`**

```rust
use crate::models::{JdkInfo, JdkSource};
use std::path::{Path, PathBuf};

/// 扫描系统已安装的 JDK
pub fn discover_system_jdks() -> Vec<JdkInfo> {
    let mut jdks = Vec::new();
    let search_paths = get_system_jdk_paths();

    for base_path in search_paths {
        if let Ok(entries) = std::fs::read_dir(&base_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(jdk) = probe_jdk_at(&path) {
                    jdks.push(jdk);
                }
            }
        }
    }

    jdks
}

/// 下载 JDK (Adoptium API)
pub async fn download_jdk(
    major_version: u32,
    vendor: &str,
    install_dir: &Path,
) -> Result<JdkInfo, String> {
    let (os, arch) = get_platform_info();
    let url = format!(
        "https://api.adoptium.net/v3/assets/latest/{}/hotspot?os={}&architecture={}&image_type=jdk&vendor={}",
        major_version, os, arch, vendor
    );

    let client = reqwest::Client::new();
    let response = client.get(&url)
        .send().await
        .map_err(|e| format!("Request failed: {}", e))?;

    let assets: Vec<serde_json::Value> = response.json().await
        .map_err(|e| format!("Parse failed: {}", e))?;

    let asset = assets.first().ok_or("No JDK found for this version/platform")?;
    let download_url = asset["binary"]["package"]["link"].as_str()
        .ok_or("No download URL found")?;
    let package_name = asset["binary"]["package"]["name"].as_str()
        .unwrap_or("jdk.tar.gz");

    // Download the file
    let response = client.get(download_url)
        .send().await
        .map_err(|e| format!("Download failed: {}", e))?;

    let file_path = install_dir.join(package_name);
    let bytes = response.bytes().await
        .map_err(|e| format!("Download failed: {}", e))?;
    std::fs::write(&file_path, &bytes)
        .map_err(|e| format!("Write failed: {}", e))?;

    // Extract
    let extract_dir = install_dir.join(format!("jdk-{}", major_version));
    extract_archive(&file_path, &extract_dir)?;

    // Clean up archive
    let _ = std::fs::remove_file(&file_path);

    // Find the actual JDK directory inside extracted folder
    let jdk_home = find_jdk_home_in(&extract_dir)?;

    // Detect version
    let release_file = jdk_home.join("release");
    let (version, major) = parse_release_file(&release_file, major_version);

    Ok(JdkInfo {
        id: format!("jdk-{}-{}", major, vendor.to_lowercase()),
        version,
        major_version: major,
        vendor: vendor.to_string(),
        path: jdk_home.to_string_lossy().to_string(),
        source: JdkSource::Downloaded,
    })
}

fn get_system_jdk_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let home = dirs::home_dir().unwrap_or_default();

    if cfg!(target_os = "macos") {
        paths.push(PathBuf::from("/Library/Java/JavaVirtualMachines"));
        paths.push(home.join(".sdkman/candidates/java"));
    } else if cfg!(target_os = "windows") {
        paths.push(PathBuf::from("C:\\Program Files\\Java"));
        paths.push(PathBuf::from("C:\\Program Files\\Eclipse Adoptium"));
        paths.push(PathBuf::from("C:\\Program Files\\Amazon Corretto"));
    } else if cfg!(target_os = "linux") {
        paths.push(PathBuf::from("/usr/lib/jvm"));
        paths.push(home.join(".sdkman/candidates/java"));
    }

    paths
}

fn probe_jdk_at(path: &Path) -> Option<JdkInfo> {
    // macOS: path/Contents/Home/bin/java
    // Linux/Windows: path/bin/java (or java.exe)
    let home = if cfg!(target_os = "macos") && path.join("Contents/Home").exists() {
        path.join("Contents/Home")
    } else {
        path.to_path_buf()
    };

    let java_bin = if cfg!(target_os = "windows") {
        home.join("bin/java.exe")
    } else {
        home.join("bin/java")
    };

    if !java_bin.exists() {
        return None;
    }

    let release_file = home.join("release");
    let dir_name = path.file_name()?.to_string_lossy().to_string();

    // Parse version from directory name
    let (version, major) = parse_jdk_dir_name(&dir_name)
        .unwrap_or_else(|| {
            if release_file.exists() {
                parse_release_file(&release_file, 0)
            } else {
                ("unknown".to_string(), 0)
            }
        });

    let vendor = detect_vendor(&dir_name);

    Some(JdkInfo {
        id: format!("jdk-{}-{}", major, vendor.to_lowercase()),
        version,
        major_version: major,
        vendor,
        path: home.to_string_lossy().to_string(),
        source: JdkSource::System,
    })
}

fn parse_jdk_dir_name(name: &str) -> Option<(String, u32)> {
    // Common patterns: jdk-17.0.10, jdk1.8.0_402, adoptopenjdk-17.jdk, etc.
    let name_lower = name.to_lowercase();

    // Try to find version pattern
    if let Some(version) = extract_version_from_string(&name_lower) {
        let major = infer_major(&version);
        return Some((version, major));
    }
    None
}

fn extract_version_from_string(s: &str) -> Option<String> {
    // Match patterns like 17.0.10, 1.8.0_402, 21.0.2
    let re = regex::Regex::new(r"(\d+\.\d+(?:\.\d+)?(?:_\d+)?)").ok()?;
    let cap = re.captures(s)?;
    Some(cap[1].to_string())
}

fn infer_major(version: &str) -> u32 {
    let parts: Vec<&str> = version.split('.').collect();
    if parts.len() >= 2 {
        let major: u32 = parts[0].parse().unwrap_or(0);
        if major == 1 {
            parts[1].parse().unwrap_or(0)
        } else {
            major
        }
    } else {
        0
    }
}

fn detect_vendor(name: &str) -> String {
    let name_lower = name.to_lowercase();
    if name_lower.contains("adoptium") || name_lower.contains("temurin") {
        "Adoptium".to_string()
    } else if name_lower.contains("corretto") {
        "Corretto".to_string()
    } else if name_lower.contains("graalvm") {
        "GraalVM".to_string()
    } else if name_lower.contains("zulu") {
        "Azul".to_string()
    } else if name_lower.contains("oracle") {
        "Oracle".to_string()
    } else {
        "OpenJDK".to_string()
    }
}

fn parse_release_file(path: &Path, fallback_major: u32) -> (String, u32) {
    let content = std::fs::read_to_string(path).unwrap_or_default();
    let version = content.lines()
        .find(|l| l.starts_with("JAVA_VERSION="))
        .and_then(|l| l.split('=').nth(1))
        .map(|v| v.trim_matches('"').to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let major = infer_major(&version).max(fallback_major);
    (version, major)
}

fn get_platform_info() -> (String, String) {
    let os = if cfg!(target_os = "macos") { "mac" }
        else if cfg!(target_os = "windows") { "windows" }
        else { "linux" };
    let arch = if cfg!(target_arch = "aarch64") { "aarch64" }
        else { "x64" };
    (os.to_string(), arch.to_string())
}

fn extract_archive(archive_path: &Path, dest: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    let file = std::fs::File::open(archive_path).map_err(|e| e.to_string())?;

    let archive_name = archive_path.to_string_lossy().to_string();
    if archive_name.ends_with(".zip") {
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        archive.extract(dest).map_err(|e| e.to_string())?;
    } else {
        // .tar.gz - use system tar
        let output = std::process::Command::new("tar")
            .args(["-xzf", &archive_path.to_string_lossy(), "-C", &dest.to_string_lossy()])
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            return Err(format!("tar extract failed: {}", String::from_utf8_lossy(&output.stderr)));
        }
    }
    Ok(())
}

fn find_jdk_home_in(dir: &Path) -> Result<PathBuf, String> {
    // Usually there's one subdirectory after extraction
    let entries: Vec<_> = std::fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .collect();

    if entries.len() == 1 && entries[0].path().is_dir() {
        Ok(entries[0].path())
    } else {
        Ok(dir.to_path_buf())
    }
}
```

**Step 2: 在 Cargo.toml 添加 `regex` 依赖**

```toml
regex = "1"
```

**Step 3: 在 `lib.rs` 注册模块**

```rust
mod jdk_manager;
```

**Step 4: 验证编译通过**

```bash
cd src-tauri && cargo check
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add JDK discovery and download"
```

---

## Task 5: Rust 后端 - Tauri Commands（前后端桥接）

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 commands 文件 `src-tauri/src/commands.rs`**

```rust
use crate::config::{self, get_apps_dir, get_jdks_dir};
use crate::jar_parser;
use crate::jdk_manager;
use crate::models::*;
use std::path::PathBuf;
use tauri::State;
use std::sync::Mutex;

pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub running_processes: Mutex<std::collections::HashMap<String, u32>>,
}

#[tauri::command]
pub fn get_config(state: State<AppState>) -> Result<AppConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn add_jar(path: String, state: State<AppState>) -> Result<JarApp, String> {
    let src_path = PathBuf::from(&path);
    if !src_path.exists() {
        return Err("File not found".to_string());
    }

    let filename = src_path.file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy()
        .to_string();

    // Parse manifest
    let manifest = jar_parser::parse_jar_manifest(&src_path)?;
    let (name_from_file, version_from_file) = jar_parser::parse_name_from_filename(&filename);

    let name = manifest.title.unwrap_or(name_from_file);
    let version = manifest.version.or(version_from_file).unwrap_or_default();

    // Copy to apps dir
    let id = uuid::Uuid::new_v4().to_string();
    let app_dir = get_apps_dir().join(&id);
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let dest_path = app_dir.join(&filename);
    std::fs::copy(&src_path, &dest_path).map_err(|e| e.to_string())?;

    let app = JarApp {
        id: id.clone(),
        name,
        version,
        jar_path: dest_path.to_string_lossy().to_string(),
        jdk_id: None,
        jvm_args: Vec::new(),
        app_args: Vec::new(),
        icon_path: None,
        show_console: false,
        added_at: chrono::Utc::now().to_rfc3339(),
        running: Some(false),
    };

    // Save to config
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.apps.push(app.clone());
    config::save_config(&config)?;

    Ok(app)
}

#[tauri::command]
pub fn update_jar(app_id: String, jar_path: String, state: State<AppState>) -> Result<JarApp, String> {
    let src_path = PathBuf::from(&jar_path);
    let manifest = jar_parser::parse_jar_manifest(&src_path)?;
    let filename = src_path.file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy()
        .to_string();
    let (_, version_from_file) = jar_parser::parse_name_from_filename(&filename);
    let new_version = manifest.version.or(version_from_file).unwrap_or_default();

    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    let app = config.apps.iter_mut()
        .find(|a| a.id == app_id)
        .ok_or("App not found")?;

    // Remove old jar
    let old_dir = PathBuf::from(&app.jar_path).parent()
        .ok_or("Invalid path")?.to_path_buf();
    let _ = std::fs::remove_dir_all(&old_dir);

    // Copy new jar
    let new_dir = get_apps_dir().join(&app_id);
    std::fs::create_dir_all(&new_dir).map_err(|e| e.to_string())?;
    let dest = new_dir.join(&filename);
    std::fs::copy(&src_path, &dest).map_err(|e| e.to_string())?;

    app.version = new_version;
    app.jar_path = dest.to_string_lossy().to_string();
    let updated = app.clone();

    config::save_config(&config)?;
    Ok(updated)
}

#[tauri::command]
pub fn remove_app(app_id: String, state: State<AppState>) -> Result<(), String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    let app_dir = get_apps_dir().join(&app_id);
    let _ = std::fs::remove_dir_all(&app_dir);
    config.apps.retain(|a| a.id != app_id);
    config::save_config(&config)
}

#[tauri::command]
pub fn update_app(app_id: String, updates: serde_json::Value, state: State<AppState>) -> Result<JarApp, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    let app = config.apps.iter_mut()
        .find(|a| a.id == app_id)
        .ok_or("App not found")?;

    if let Some(name) = updates.get("name").and_then(|v| v.as_str()) {
        app.name = name.to_string();
    }
    if let Some(jdk_id) = updates.get("jdkId") {
        app.jdk_id = if jdk_id.is_null() { None } else { Some(jdk_id.as_str().unwrap_or("").to_string()) };
    }
    if let Some(args) = updates.get("jvmArgs").and_then(|v| v.as_array()) {
        app.jvm_args = args.iter().filter_map(|v| v.as_str().map(String::from)).collect();
    }
    if let Some(args) = updates.get("appArgs").and_then(|v| v.as_array()) {
        app.app_args = args.iter().filter_map(|v| v.as_str().map(String::from)).collect();
    }
    if let Some(show) = updates.get("showConsole").and_then(|v| v.as_bool()) {
        app.show_console = show;
    }

    let updated = app.clone();
    config::save_config(&config)?;
    Ok(updated)
}

#[tauri::command]
pub async fn discover_jdks(state: State<'_, AppState>) -> Result<Vec<JdkInfo>, String> {
    let system_jdks = jdk_manager::discover_system_jdks();
    let mut config = state.config.lock().map_err(|e| e.to_string())?;

    // Merge: keep downloaded/manual, add discovered system JDKs
    let existing_ids: Vec<String> = config.jdks.iter().map(|j| j.id.clone()).collect();
    for jdk in system_jdks {
        if !existing_ids.contains(&jdk.id) {
            config.jdks.push(jdk);
        }
    }

    let result = config.jdks.clone();
    config::save_config(&config)?;
    Ok(result)
}

#[tauri::command]
pub async fn download_and_install_jdk(
    major_version: u32,
    vendor: String,
    state: State<'_, AppState>,
) -> Result<JdkInfo, String> {
    let install_dir = get_jdks_dir();
    let jdk = jdk_manager::download_jdk(major_version, &vendor, &install_dir).await?;

    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.jdks.push(jdk.clone());
    config::save_config(&config)?;

    Ok(jdk)
}

#[tauri::command]
pub fn remove_jdk(jdk_id: String, state: State<AppState>) -> Result<(), String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    if let Some(jdk) = config.jdks.iter().find(|j| j.id == jdk_id).cloned() {
        if matches!(jdk.source, JdkSource::Downloaded) {
            let _ = std::fs::remove_dir_all(&jdk.path);
        }
    }
    config.jdks.retain(|j| j.id != jdk_id);
    config::save_config(&config)
}

#[tauri::command]
pub fn launch_app(app_id: String, state: State<AppState>) -> Result<(), String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let app = config.apps.iter()
        .find(|a| a.id == app_id)
        .ok_or("App not found")?;

    // Find JDK
    let jdk = match &app.jdk_id {
        Some(jdk_id) => config.jdks.iter().find(|j| &j.id == jdk_id),
        None => auto_match_jdk(app, &config.jdks),
    }.ok_or("No suitable JDK found. Please install or configure a JDK.")?;

    let java_bin = if cfg!(target_os = "windows") {
        PathBuf::from(&jdk.path).join("bin/java.exe")
    } else {
        PathBuf::from(&jdk.path).join("bin/java")
    };

    let mut cmd = std::process::Command::new(&java_bin);
    cmd.args(&app.jvm_args);
    cmd.arg("-jar");
    cmd.arg(&app.jar_path);
    cmd.args(&app.app_args);

    if app.show_console {
        cmd.stdin(std::process::Stdio::inherit());
        cmd.stdout(std::process::Stdio::inherit());
        cmd.stderr(std::process::Stdio::inherit());
    } else {
        cmd.stdin(std::process::Stdio::null());
        cmd.stdout(std::process::Stdio::null());
        cmd.stderr(std::process::Stdio::null());
    }

    let child = cmd.spawn().map_err(|e| format!("Failed to launch: {}", e))?;
    let pid = child.id();

    drop(config); // Release config lock

    let mut processes = state.running_processes.lock().map_err(|e| e.to_string())?;
    processes.insert(app_id, pid);

    Ok(())
}

#[tauri::command]
pub fn open_file_location(path: String) -> Result<(), String> {
    let path = PathBuf::from(&path);
    let parent = path.parent().ok_or("Invalid path")?;

    if cfg!(target_os = "macos") {
        std::process::Command::new("open").arg(parent).spawn()
            .map_err(|e| e.to_string())?;
    } else if cfg!(target_os = "windows") {
        std::process::Command::new("explorer").arg(parent).spawn()
            .map_err(|e| e.to_string())?;
    } else {
        std::process::Command::new("xdg-open").arg(parent).spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn auto_match_jdk(app: &JarApp, jdks: &[JdkInfo]) -> Option<&JdkInfo> {
    // Try to match based on build JDK info
    // For now, prefer latest JDK
    jdks.iter().max_by_key(|j| j.major_version)
}

#[tauri::command]
pub fn update_settings(settings: serde_json::Value, state: State<AppState>) -> Result<(), String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    if let Some(theme) = settings.get("theme").and_then(|v| v.as_str()) {
        config.settings.theme = match theme {
            "light" => Theme::Light,
            "dark" => Theme::Dark,
            _ => Theme::System,
        };
    }
    config::save_config(&config)
}
```

**Step 2: 添加 `chrono` 依赖到 Cargo.toml**

```toml
chrono = "0.4"
```

**Step 3: 更新 `lib.rs` 注册命令和状态**

```rust
mod commands;

use commands::AppState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = config::load_config();
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(AppState {
            config: Mutex::new(config),
            running_processes: Mutex::new(std::collections::HashMap::new()),
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
        .setup(|_app| {
            config::ensure_dirs().expect("Failed to create JarBox directories");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 4: 验证编译通过**

```bash
cd src-tauri && cargo check
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add Tauri commands for frontend-backend bridge"
```

---

## Task 6: 前端 - 基础布局与路由

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/pages/HomePage.tsx`
- Create: `src/pages/JdkPage.tsx`
- Create: `src/pages/SettingsPage.tsx`
- Create: `src/components/Sidebar.tsx`
- Modify: `src/index.css`

**Step 1: 创建入口文件和路由**

`src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx`:
```tsx
import { useState } from "react";
import HomePage from "./pages/HomePage";
import JdkPage from "./pages/JdkPage";
import SettingsPage from "./pages/SettingsPage";
import Sidebar from "./components/Sidebar";

export type Page = "home" | "jdk" | "settings";

function App() {
  const [page, setPage] = useState<Page>("home");

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar currentPage={page} onNavigate={setPage} />
      <main className="flex-1 overflow-auto">
        {page === "home" && <HomePage />}
        {page === "jdk" && <JdkPage />}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

export default App;
```

**Step 2: 创建 Sidebar 组件**

`src/components/Sidebar.tsx`:
```tsx
import { Coffee, Cpu, Settings } from "lucide-react";
import type { Page } from "../App";

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; icon: React.ReactNode; label: string }[] = [
  { page: "home", icon: <Coffee size={20} />, label: "应用" },
  { page: "jdk", icon: <Cpu size={20} />, label: "JDK" },
  { page: "settings", icon: <Settings size={20} />, label: "设置" },
];

export default function Sidebar({ currentPage, onNavigate }: Props) {
  return (
    <aside className="w-16 flex flex-col items-center py-4 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="mb-6 text-2xl">☕</div>
      <nav className="flex flex-col gap-2 flex-1">
        {navItems.map(({ page, icon, label }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            title={label}
            className={`p-3 rounded-lg transition-colors ${
              currentPage === page
                ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400"
                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            {icon}
          </button>
        ))}
      </nav>
    </aside>
  );
}
```

**Step 3: 创建占位页面**

`src/pages/HomePage.tsx`:
```tsx
export default function HomePage() {
  return <div className="p-6"><h1 className="text-xl font-bold">应用列表</h1></div>;
}
```

`src/pages/JdkPage.tsx`:
```tsx
export default function JdkPage() {
  return <div className="p-6"><h1 className="text-xl font-bold">JDK 管理</h1></div>;
}
```

`src/pages/SettingsPage.tsx`:
```tsx
export default function SettingsPage() {
  return <div className="p-6"><h1 className="text-xl font-bold">设置</h1></div>;
}
```

**Step 4: 验证前端渲染**

```bash
npm run tauri dev
```
Expected: 窗口显示侧边栏和"应用列表"占位页面，导航切换正常。

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add frontend layout with sidebar navigation"
```

---

## Task 7: 前端 - 主页应用列表与拖拽

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Create: `src/components/AppCard.tsx`
- Create: `src/components/ContextMenu.tsx`
- Create: `src/hooks/useApps.ts`

**Step 1: 创建 hooks/useApps.ts**

```tsx
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { JarApp, AppConfig } from "../types";

export function useApps() {
  const [apps, setApps] = useState<JarApp[]>([]);

  const load = useCallback(async () => {
    const config: AppConfig = await invoke("get_config");
    setApps(config.apps);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addApp = async (path: string) => {
    const app: JarApp = await invoke("add_jar", { path });
    setApps(prev => [...prev, app]);
    return app;
  };

  const removeApp = async (id: string) => {
    await invoke("remove_app", { appId: id });
    setApps(prev => prev.filter(a => a.id !== id));
  };

  const updateApp = async (id: string, updates: Record<string, unknown>) => {
    const updated: JarApp = await invoke("update_app", { appId: id, updates });
    setApps(prev => prev.map(a => a.id === id ? updated : a));
  };

  const launchApp = async (id: string) => {
    await invoke("launch_app", { appId: id });
    setApps(prev => prev.map(a => a.id === id ? { ...a, running: true } : a));
  };

  const updateJar = async (appId: string, jarPath: string) => {
    const updated: JarApp = await invoke("update_jar", { appId, jarPath });
    setApps(prev => prev.map(a => a.id === appId ? updated : a));
    return updated;
  };

  return { apps, load, addApp, removeApp, updateApp, launchApp, updateJar };
}
```

**Step 2: 创建 `src/types.ts`**

```tsx
export interface JarApp {
  id: string;
  name: string;
  version: string;
  jar_path: string;
  jdk_id: string | null;
  jvm_args: string[];
  app_args: string[];
  icon_path: string | null;
  show_console: boolean;
  added_at: string;
  running?: boolean;
}

export interface JdkInfo {
  id: string;
  version: string;
  major_version: number;
  vendor: string;
  path: string;
  source: "system" | "downloaded" | "manual";
}

export interface AppConfig {
  apps: JarApp[];
  jdks: JdkInfo[];
  settings: Settings;
}

export interface Settings {
  default_jdk_policy: "auto-match" | "always-latest" | "always-ask";
  launch_behavior: "background" | "show-console";
  theme: "system" | "light" | "dark";
}
```

**Step 3: 创建 AppCard 组件**

`src/components/AppCard.tsx`:
```tsx
import { Play } from "lucide-react";
import type { JarApp } from "../types";

interface Props {
  app: JarApp;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export default function AppCard({ app, onDoubleClick, onContextMenu }: Props) {
  return (
    <div
      className="flex flex-col items-center p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer select-none"
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div className="w-12 h-12 mb-2 flex items-center justify-center text-3xl rounded-lg bg-amber-50 dark:bg-amber-900/30">
        ☕
      </div>
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-full">
        {app.name}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        v{app.version || "?"}
      </span>
      {app.running && (
        <span className="mt-1 text-xs text-green-500 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          运行中
        </span>
      )}
    </div>
  );
}
```

**Step 4: 创建 ContextMenu 组件**

`src/components/ContextMenu.tsx`:
```tsx
import { useEffect, useRef } from "react";
import { Play, Pencil, FolderOpen, RefreshCw, Trash2 } from "lucide-react";

interface Props {
  x: number;
  y: number;
  onLaunch: () => void;
  onEdit: () => void;
  onOpenLocation: () => void;
  onUpdateJar: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function ContextMenu({ x, y, onLaunch, onEdit, onOpenLocation, onUpdateJar, onDelete, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const items = [
    { icon: <Play size={14} />, label: "启动", action: onLaunch },
    { icon: <Pencil size={14} />, label: "编辑", action: onEdit },
    { icon: <FolderOpen size={14} />, label: "打开文件位置", action: onOpenLocation },
    { icon: <RefreshCw size={14} />, label: "更新 JAR", action: onUpdateJar },
    { icon: <Trash2 size={14} />, label: "删除", action: onDelete, danger: true },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={item.action}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
            (item as any).danger ? "text-red-500" : "text-gray-700 dark:text-gray-300"
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 5: 更新 HomePage**

`src/pages/HomePage.tsx`:
```tsx
import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { Plus } from "lucide-react";
import AppCard from "../components/AppCard";
import ContextMenu from "../components/ContextMenu";
import { useApps } from "../hooks/useApps";
import type { JarApp } from "../types";

export default function HomePage() {
  const { apps, addApp, removeApp, launchApp, updateJar } = useApps();
  const [menu, setMenu] = useState<{ x: number; y: number; app: JarApp } | null>(null);
  const [editingApp, setEditingApp] = useState<JarApp | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Drag & drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.name.endsWith(".jar")) {
        await addApp(file.path);
      }
    }
  }, [addApp]);

  // File picker
  const handleAdd = async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "JAR", extensions: ["jar"] }],
    });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      for (const p of paths) {
        await addApp(p);
      }
    }
  };

  const handleOpenLocation = async (app: JarApp) => {
    await invoke("open_file_location", { path: app.jar_path });
  };

  return (
    <div
      className="p-6 h-full flex flex-col"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">我的应用</h1>
      </div>

      <div className="flex-1 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4 content-start">
        {apps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            onDoubleClick={() => launchApp(app.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY, app });
            }}
          />
        ))}

        <button
          onClick={handleAdd}
          className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-400 transition-colors"
        >
          <Plus size={24} />
          <span className="text-sm mt-1">添加应用</span>
        </button>
      </div>

      {dragOver && (
        <div className="fixed inset-0 bg-blue-500/10 border-4 border-dashed border-blue-400 z-40 flex items-center justify-center pointer-events-none">
          <p className="text-blue-600 text-lg font-medium">释放以添加 JAR 应用</p>
        </div>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onLaunch={() => { launchApp(menu.app.id); setMenu(null); }}
          onEdit={() => { setEditingApp(menu.app); setMenu(null); }}
          onOpenLocation={() => { handleOpenLocation(menu.app); setMenu(null); }}
          onUpdateJar={() => { /* TODO: file picker for update */ setMenu(null); }}
          onDelete={async () => { await removeApp(menu.app.id); setMenu(null); }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
```

**Step 6: 验证 UI 渲染**

```bash
npm run tauri dev
```

**Step 7: Commit**

```bash
git add .
git commit -m "feat: add home page with app cards, drag-drop, context menu"
```

---

## Task 8: 前端 - 编辑应用对话框

**Files:**
- Create: `src/components/EditAppDialog.tsx`
- Modify: `src/pages/HomePage.tsx`

**Step 1: 创建 EditAppDialog 组件**

`src/components/EditAppDialog.tsx`:
```tsx
import { useState } from "react";
import { X } from "lucide-react";
import type { JarApp, JdkInfo } from "../types";

interface Props {
  app: JarApp;
  jdks: JdkInfo[];
  onSave: (id: string, updates: Record<string, unknown>) => void;
  onClose: () => void;
}

export default function EditAppDialog({ app, jdks, onSave, onClose }: Props) {
  const [name, setName] = useState(app.name);
  const [jdkId, setJdkId] = useState(app.jdk_id || "");
  const [jvmArgs, setJvmArgs] = useState(app.jvm_args.join(" "));
  const [appArgs, setAppArgs] = useState(app.app_args.join(" "));
  const [showConsole, setShowConsole] = useState(app.show_console);

  const handleSave = () => {
    onSave(app.id, {
      name,
      jdkId: jdkId || null,
      jvmArgs: jvmArgs.split(/\s+/).filter(Boolean),
      appArgs: appArgs.split(/\s+/).filter(Boolean),
      showConsole,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[480px] max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">编辑应用</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">应用名称</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">版本</label>
            <input value={app.version} readOnly className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">使用 JDK</label>
            <select value={jdkId} onChange={e => setJdkId(e.target.value)} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
              <option value="">自动匹配</option>
              {jdks.map(j => (
                <option key={j.id} value={j.id}>Java {j.major_version} ({j.vendor}) - {j.version}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">JVM 参数</label>
            <input value={jvmArgs} onChange={e => setJvmArgs(e.target.value)} placeholder="-Xmx512m -Dfile.encoding=UTF-8" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">应用参数</label>
            <input value={appArgs} onChange={e => setAppArgs(e.target.value)} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={showConsole} onChange={e => setShowConsole(e.target.checked)} className="rounded" />
            启动时显示控制台输出
          </label>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-400">取消</button>
          <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600">保存</button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: 在 HomePage 中集成编辑对话框**

在 HomePage 中导入并使用 EditAppDialog，当 editingApp 不为 null 时显示。

**Step 3: 验证并 Commit**

```bash
git add .
git commit -m "feat: add app edit dialog"
```

---

## Task 9: 前端 - JDK 管理页面

**Files:**
- Modify: `src/pages/JdkPage.tsx`
- Create: `src/hooks/useJdks.ts`

**Step 1: 创建 hooks/useJdks.ts**

```tsx
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { JdkInfo, AppConfig } from "../types";

export function useJdks() {
  const [jdks, setJdks] = useState<JdkInfo[]>([]);

  const load = useCallback(async () => {
    const config: AppConfig = await invoke("get_config");
    setJdks(config.jdks);
  }, []);

  useEffect(() => { load(); }, [load]);

  const discover = async () => {
    const result: JdkInfo[] = await invoke("discover_jdks");
    setJdks(result);
  };

  const download = async (majorVersion: number, vendor: string) => {
    const jdk: JdkInfo = await invoke("download_and_install_jdk", { majorVersion, vendor });
    setJdks(prev => [...prev, jdk]);
  };

  const remove = async (jdkId: string) => {
    await invoke("remove_jdk", { jdkId });
    setJdks(prev => prev.filter(j => j.id !== jdkId));
  };

  return { jdks, discover, download, remove };
}
```

**Step 2: 更新 JdkPage**

包含已安装 JDK 列表、发现按钮、下载区域（选择版本和发行版、下载进度）。

**Step 3: 验证并 Commit**

```bash
git add .
git commit -m "feat: add JDK management page"
```

---

## Task 10: 前端 - 设置页面

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

**Step 1: 实现设置页面**

主题切换、默认 JDK 策略、启动行为设置。调用 `update_settings` 命令保存。

**Step 2: 验证并 Commit**

```bash
git add .
git commit -m "feat: add settings page"
```

---

## Task 11: 集成测试与优化

**Step 1: 端到端测试**

1. 启动应用 `npm run tauri dev`
2. 拖入一个真实 JAR 文件，验证自动解析
3. 双击启动，验证进程启动
4. 右键编辑，修改 JDK 绑定和参数
5. JDK 页面发现系统 JDK
6. 设置页面切换主题

**Step 2: 错误处理完善**

- 无 JDK 时友好提示
- JAR 解析失败的回退
- 网络下载失败的重试提示

**Step 3: Final Commit**

```bash
git add .
git commit -m "feat: integration testing and polish"
```
