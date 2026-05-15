use std::fs;
use std::path::{Path, PathBuf};

use crate::models::{JdkInfo, JdkSource};

/// Discover JDKs installed on the system by scanning platform-specific directories.
pub fn discover_system_jdks() -> Vec<JdkInfo> {
    let mut jdks = Vec::new();
    let scan_dirs = get_system_jdk_dirs();

    for scan_dir in scan_dirs {
        if !scan_dir.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(&scan_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let jdk_home = resolve_jdk_home(&path);
                if let Some(home) = jdk_home {
                    if is_valid_jdk(&home) {
                        if let Some(info) = probe_jdk(&home) {
                            // Avoid duplicates by path
                            if !jdks.iter().any(|j: &JdkInfo| j.path == info.path) {
                                jdks.push(info);
                            }
                        }
                    }
                }
            }
        }
    }

    jdks
}

/// Get platform-specific directories to scan for JDKs.
fn get_system_jdk_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    #[cfg(target_os = "macos")]
    {
        dirs.push(PathBuf::from("/Library/Java/JavaVirtualMachines"));
        if let Some(home) = dirs::home_dir() {
            dirs.push(home.join(".sdkman/candidates/java"));
        }
    }

    #[cfg(target_os = "windows")]
    {
        dirs.push(PathBuf::from("C:\\Program Files\\Java"));
        dirs.push(PathBuf::from("C:\\Program Files\\Eclipse Adoptium"));
        dirs.push(PathBuf::from("C:\\Program Files\\AdoptOpenJDK"));
        dirs.push(PathBuf::from("C:\\Program Files\\Zulu"));
    }

    #[cfg(target_os = "linux")]
    {
        dirs.push(PathBuf::from("/usr/lib/jvm"));
        if let Some(home) = dirs::home_dir() {
            dirs.push(home.join(".sdkman/candidates/java"));
        }
    }

    dirs
}

/// On macOS, the JDK home is at <path>/Contents/Home. On other platforms, the path is the home itself.
fn resolve_jdk_home(path: &Path) -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let contents_home = path.join("Contents/Home");
        if contents_home.exists() {
            return Some(contents_home);
        }
    }

    if path.exists() {
        Some(path.to_path_buf())
    } else {
        None
    }
}

/// Check if a directory is a valid JDK by looking for the java binary.
fn is_valid_jdk(home: &Path) -> bool {
    let java_bin = get_java_binary_path(home);
    java_bin.exists()
}

/// Get the path to the java binary for a given JDK home.
fn get_java_binary_path(home: &Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        home.join("bin/java.exe")
    }
    #[cfg(not(target_os = "windows"))]
    {
        home.join("bin/java")
    }
}

/// Probe a JDK directory to extract version info and create a JdkInfo.
fn probe_jdk(home: &Path) -> Option<JdkInfo> {
    // Try reading the release file for version info
    let (version, major_version) = read_version_from_release_file(home)
        .or_else(|| parse_version_from_dir_name(home))
        .unwrap_or_else(|| ("Unknown".to_string(), 0));

    let vendor = guess_vendor_from_path(home);
    let supports_javafx = detect_javafx_support(home);

    Some(JdkInfo {
        id: uuid::Uuid::new_v4().to_string(),
        version,
        major_version,
        vendor,
        path: home.to_string_lossy().to_string(),
        source: JdkSource::System,
        supports_javafx,
    })
}

/// Detect if a JDK bundles JavaFX by checking for javafx modules/jars.
fn detect_javafx_support(home: &Path) -> bool {
    // JDK 9+: check for jmods/javafx.base.jmod
    if home.join("jmods/javafx.base.jmod").exists() {
        return true;
    }
    // JDK 11+ with bundled JavaFX: lib/javafx.base.jar
    if home.join("lib/javafx.base.jar").exists() {
        return true;
    }
    // JDK 8: jre/lib/ext/jfxrt.jar (Oracle JDK) or jre/lib/javafx.properties
    if home.join("jre/lib/ext/jfxrt.jar").exists() {
        return true;
    }
    if home.join("jre/lib/javafx.properties").exists() {
        return true;
    }
    false
}

/// Try to read JAVA_VERSION from the release file in the JDK home.
fn read_version_from_release_file(home: &Path) -> Option<(String, u32)> {
    let release_file = home.join("release");
    if !release_file.exists() {
        return None;
    }

    let content = fs::read_to_string(&release_file).ok()?;

    for line in content.lines() {
        if line.starts_with("JAVA_VERSION=") {
            // JAVA_VERSION="17.0.10"
            let value = line
                .trim_start_matches("JAVA_VERSION=")
                .trim_matches('"')
                .trim();
            let major = parse_major_from_version_string(value);
            return Some((value.to_string(), major));
        }
    }

    None
}

/// Parse major version from a version string like "17.0.10" or "1.8.0_402".
fn parse_major_from_version_string(version: &str) -> u32 {
    if version.starts_with("1.") {
        // Java 8 style: 1.8.0_402
        version
            .split('.')
            .nth(1)
            .and_then(|s| s.split('_').next())
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0)
    } else {
        // Java 9+ style: 17.0.10
        version
            .split('.')
            .next()
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0)
    }
}

/// Try to parse JDK version from the directory name.
fn parse_version_from_dir_name(home: &Path) -> Option<(String, u32)> {
    let dir_name = home.file_name()?.to_string_lossy();

    // macOS: jdk-17.0.10.jdk or 1.8.0_402.jdk
    // Linux: java-17-openjdk-amd64
    // Try to find a version pattern
    let re = regex::Regex::new(r"(\d+(?:\.\d+)*)").ok()?;

    if let Some(caps) = re.captures(&dir_name) {
        let version = caps.get(1)?.as_str().to_string();
        let major = parse_major_from_version_string(&version);
        return Some((version, major));
    }

    None
}

/// Try to guess the JDK vendor from the path.
fn guess_vendor_from_path(home: &Path) -> String {
    let path_str = home.to_string_lossy().to_lowercase();

    if path_str.contains("eclipse") || path_str.contains("adoptium") || path_str.contains("adoptopenjdk") {
        "Eclipse Adoptium".to_string()
    } else if path_str.contains("corretto") || path_str.contains("amazon") {
        "Amazon Corretto".to_string()
    } else if path_str.contains("zulu") || path_str.contains("azul") {
        "Azul Zulu".to_string()
    } else if path_str.contains("graalvm") {
        "GraalVM".to_string()
    } else if path_str.contains("openjdk") {
        "OpenJDK".to_string()
    } else if path_str.contains("oracle") || path_str.contains("javavirtualmachines") {
        "Oracle".to_string()
    } else if path_str.contains("temurin") {
        "Eclipse Temurin".to_string()
    } else if path_str.contains("microsoft") {
        "Microsoft".to_string()
    } else {
        "Unknown".to_string()
    }
}

/// Download and install a JDK using the Adoptium API.
pub async fn download_jdk(
    major_version: u32,
    vendor: &str,
    install_dir: &Path,
) -> Result<JdkInfo, String> {
    let os = get_os_name();
    let arch = get_arch_name();

    let url = format!(
        "https://api.adoptium.net/v3/assets/latest/{}/hotspot?os={}&architecture={}&image_type=jdk&vendor={}",
        major_version, os, arch, vendor
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to query Adoptium API: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Adoptium API returned status: {}",
            response.status()
        ));
    }

    let assets: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Adoptium response: {}", e))?;

    // Find the first asset with a binary package
    let binary = assets
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|asset| asset.get("binary"))
        .and_then(|b| b.get("package"))
        .and_then(|p| p.get("link"))
        .and_then(|l| l.as_str())
        .ok_or("No download link found in Adoptium response")?;

    let pkg_name = assets
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|asset| asset.get("binary"))
        .and_then(|b| b.get("package"))
        .and_then(|p| p.get("name"))
        .and_then(|n| n.as_str())
        .unwrap_or("jdk.tar.gz");

    // Download the archive
    let download_response = client
        .get(binary)
        .send()
        .await
        .map_err(|e| format!("Failed to download JDK: {}", e))?;

    let archive_bytes = download_response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read JDK download: {}", e))?;

    // Create install directory
    fs::create_dir_all(install_dir)
        .map_err(|e| format!("Failed to create install dir: {}", e))?;

    // Save and extract archive
    let archive_path = install_dir.join(pkg_name);
    fs::write(&archive_path, &archive_bytes)
        .map_err(|e| format!("Failed to save JDK archive: {}", e))?;

    // Extract based on file extension
    let extract_dir = install_dir.join(format!("jdk-{}", major_version));
    extract_archive(&archive_path, &extract_dir)?;

    // Find the actual JDK home inside the extracted directory
    let jdk_home = find_extracted_jdk_home(&extract_dir);

    // Read version from release file
    let (version, major) = read_version_from_release_file(&jdk_home)
        .unwrap_or_else(|| (major_version.to_string(), major_version));

    let supports_javafx = detect_javafx_support(&jdk_home);

    // Clean up archive file
    let _ = fs::remove_file(&archive_path);

    Ok(JdkInfo {
        id: uuid::Uuid::new_v4().to_string(),
        version,
        major_version: major,
        vendor: vendor.to_string(),
        path: jdk_home.to_string_lossy().to_string(),
        source: JdkSource::Downloaded,
        supports_javafx,
    })
}

fn get_os_name() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "mac"
    }
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
    #[cfg(target_os = "linux")]
    {
        "linux"
    }
}

fn get_arch_name() -> &'static str {
    #[cfg(target_arch = "x86_64")]
    {
        "x64"
    }
    #[cfg(target_arch = "aarch64")]
    {
        "aarch64"
    }
    #[cfg(target_arch = "x86")]
    {
        "x32"
    }
}

fn extract_archive(archive_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let extension = archive_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    match extension {
        "gz" => {
            // .tar.gz
            fs::create_dir_all(dest_dir)
                .map_err(|e| format!("Failed to create extract dir: {}", e))?;
            let output = std::process::Command::new("tar")
                .arg("-xzf")
                .arg(archive_path)
                .arg("-C")
                .arg(dest_dir)
                .output()
                .map_err(|e| format!("Failed to run tar: {}", e))?;

            if !output.status.success() {
                return Err(format!(
                    "tar extraction failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                ));
            }
        }
        "zip" => {
            fs::create_dir_all(dest_dir)
                .map_err(|e| format!("Failed to create extract dir: {}", e))?;
            let file = fs::File::open(archive_path)
                .map_err(|e| format!("Failed to open archive: {}", e))?;
            let mut archive = zip::ZipArchive::new(file)
                .map_err(|e| format!("Failed to read ZIP archive: {}", e))?;
            archive
                .extract(dest_dir)
                .map_err(|e| format!("Failed to extract ZIP: {}", e))?;
        }
        _ => {
            return Err(format!("Unsupported archive format: {}", extension));
        }
    }

    Ok(())
}

/// After extraction, the JDK home might be nested inside a subdirectory.
/// Find the actual JDK home by looking for bin/java.
fn find_extracted_jdk_home(extract_dir: &Path) -> PathBuf {
    if is_valid_jdk(extract_dir) {
        return extract_dir.to_path_buf();
    }

    // Look for a single subdirectory
    if let Ok(entries) = fs::read_dir(extract_dir) {
        let subdirs: Vec<PathBuf> = entries
            .flatten()
            .filter(|e| e.path().is_dir())
            .map(|e| e.path())
            .collect();

        if subdirs.len() == 1 {
            let subdir = &subdirs[0];
            if is_valid_jdk(subdir) {
                return subdir.clone();
            }
        }

        // Check all subdirectories
        for subdir in subdirs {
            if is_valid_jdk(&subdir) {
                return subdir;
            }
        }
    }

    extract_dir.to_path_buf()
}
