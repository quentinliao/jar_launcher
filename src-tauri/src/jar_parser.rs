use std::collections::HashMap;
use std::io::Read;
use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JarManifest {
    pub title: Option<String>,
    pub version: Option<String>,
    pub main_class: Option<String>,
    pub build_jdk: Option<String>,
}

/// Parse a JAR manifest from a JAR file.
/// Opens the JAR as a ZIP archive, extracts META-INF/MANIFEST.MF,
/// and parses the key-value pairs (handling continuation lines starting with a space).
pub fn parse_jar_manifest(jar_path: &Path) -> Result<JarManifest, String> {
    let file = fs::File::open(jar_path)
        .map_err(|e| format!("Failed to open JAR file {:?}: {}", jar_path, e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read JAR as ZIP: {}", e))?;

    let manifest_content = {
        let mut manifest_file = archive
            .by_name("META-INF/MANIFEST.MF")
            .map_err(|e| format!("MANIFEST.MF not found in JAR: {}", e))?;
        let mut content = String::new();
        manifest_file
            .read_to_string(&mut content)
            .map_err(|e| format!("Failed to read MANIFEST.MF: {}", e))?;
        content
    };

    let entries = parse_manifest_entries(&manifest_content);

    let title = entries
        .get("Implementation-Title")
        .or_else(|| entries.get("Bundle-Name"))
        .cloned();

    let version = entries
        .get("Implementation-Version")
        .or_else(|| entries.get("Bundle-Version"))
        .cloned();

    let main_class = entries.get("Main-Class").cloned();

    let build_jdk = entries
        .get("Build-Jdk")
        .or_else(|| entries.get("Created-By"))
        .cloned();

    Ok(JarManifest {
        title,
        version,
        main_class,
        build_jdk,
    })
}

/// Parse MANIFEST.MF key-value pairs, handling continuation lines.
/// Continuation lines start with a single space character.
fn parse_manifest_entries(content: &str) -> HashMap<String, String> {
    let mut entries = HashMap::new();
    let mut current_key = String::new();
    let mut current_value = String::new();

    for line in content.lines() {
        if line.starts_with(' ') {
            // Continuation line
            current_value.push_str(line.trim_start());
        } else {
            // Save previous entry if exists
            if !current_key.is_empty() {
                entries.insert(current_key.clone(), current_value.trim().to_string());
            }
            // Parse new key: value
            if let Some(colon_pos) = line.find(':') {
                current_key = line[..colon_pos].trim().to_string();
                current_value = line[colon_pos + 1..].trim().to_string();
            } else {
                current_key.clear();
                current_value.clear();
            }
        }
    }

    // Save last entry
    if !current_key.is_empty() {
        entries.insert(current_key, current_value.trim().to_string());
    }

    entries
}

/// Parse app name and optional version from a JAR filename.
/// e.g., "myapp-2.1.0.jar" -> ("myapp", Some("2.1.0"))
/// e.g., "myapp.jar" -> ("myapp", None)
pub fn parse_name_from_filename(filename: &str) -> (String, Option<String>) {
    // Remove .jar extension (case-insensitive)
    let name = if filename.to_lowercase().ends_with(".jar") {
        &filename[..filename.len() - 4]
    } else {
        filename
    };

    // Try to find a version pattern at the end: -X.Y.Z or -X.Y.Z-suffix
    // Regex: capture name before last dash-followed-by-digit, and version after it
    let re = regex::Regex::new(r"^(.+?)-(\d+(?:\.\d+)*(?:[-.]\w+)*)$").unwrap();
    if let Some(caps) = re.captures(name) {
        let app_name = caps.get(1).unwrap().as_str().to_string();
        let version = Some(caps.get(2).unwrap().as_str().to_string());
        return (app_name, version);
    }

    (name.to_string(), None)
}

/// Infer the major JDK version from a build JDK string.
/// e.g., "1.8.0_402" -> 8, "17.0.10" -> 17, "11.0.22" -> 11
#[allow(dead_code)]
pub fn infer_jdk_major_version(build_jdk: &str) -> Option<u32> {
    let version_str = build_jdk.trim();

    // Handle "1.X.y" format (Java 8 and earlier)
    if version_str.starts_with("1.") {
        let parts: Vec<&str> = version_str.split('.').collect();
        if parts.len() >= 2 {
            return parts[1].parse::<u32>().ok();
        }
    }

    // Handle "X.y.z" format (Java 9+)
    let parts: Vec<&str> = version_str.split('.').collect();
    if !parts.is_empty() {
        // Take the first numeric part
        let major = parts[0].parse::<u32>().ok();
        if major.is_some() {
            return major;
        }
    }

    None
}

use std::fs;
