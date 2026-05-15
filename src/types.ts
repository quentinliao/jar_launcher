export interface JarApp {
  id: string;
  name: string;
  version: string | null;
  jar_path: string;
  jdk_id: string | null;
  jvm_args: string[];
  app_args: string[];
  icon_path: string | null;
  show_console: boolean;
  added_at: string;
  running?: number | null;
}

export interface JdkInfo {
  id: string;
  version: string;
  major_version: number;
  vendor: string;
  path: string;
  source: "system" | "downloaded" | "manual";
  supports_javafx: boolean;
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

export type Page = "home" | "jdk" | "settings";
