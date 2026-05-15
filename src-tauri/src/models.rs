use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub apps: Vec<JarApp>,
    pub jdks: Vec<JdkInfo>,
    pub settings: Settings,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            apps: Vec::new(),
            jdks: Vec::new(),
            settings: Settings::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JarApp {
    pub id: String,
    pub name: String,
    pub version: Option<String>,
    pub jar_path: String,
    pub jdk_id: Option<String>,
    pub jvm_args: Vec<String>,
    pub app_args: Vec<String>,
    pub icon_path: Option<String>,
    pub show_console: bool,
    pub added_at: String,
    #[serde(skip)]
    #[allow(dead_code)]
    pub running: Option<u32>,
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

impl Default for Settings {
    fn default() -> Self {
        Self {
            default_jdk_policy: DefaultJdkPolicy::AutoMatch,
            launch_behavior: LaunchBehavior::Background,
            theme: Theme::System,
        }
    }
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
#[serde(rename_all = "kebab-case")]
pub enum Theme {
    System,
    Light,
    Dark,
}
