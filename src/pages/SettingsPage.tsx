import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "../types";

interface SettingsPageProps {
  settings: Settings;
  onSettingsChanged: (settings: Settings) => void;
}

export default function SettingsPage({
  settings,
  onSettingsChanged,
}: SettingsPageProps) {
  const [theme, setTheme] = useState(settings.theme);
  const [jdkPolicy, setJdkPolicy] = useState(settings.default_jdk_policy);
  const [launchBehavior, setLaunchBehavior] = useState(
    settings.launch_behavior,
  );

  const updateSetting = async (
    key: string,
    value: string,
    setter: (v: never) => void,
  ) => {
    setter(value as never);
    try {
      const updated = await invoke<Settings>("update_settings", {
        settings: { [key]: value },
      });
      onSettingsChanged(updated);
    } catch (e) {
      console.error("Failed to update settings:", e);
    }
  };

  const themeOptions: { value: Settings["theme"]; label: string }[] = [
    { value: "system", label: "跟随系统" },
    { value: "light", label: "浅色" },
    { value: "dark", label: "深色" },
  ];

  return (
    <div className="flex h-full flex-col overflow-auto bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          设置
        </h1>
      </div>

      <div className="flex-1 space-y-6 p-6">
        {/* Theme */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">
            外观
          </h2>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            选择应用主题
          </p>

          <div className="flex gap-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  updateSetting("theme", opt.value, setTheme as (v: never) => void)
                }
                className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                  theme === opt.value
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* JDK Policy */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">
            默认 JDK 策略
          </h2>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            当应用未指定 JDK 时使用的策略
          </p>

          <select
            value={jdkPolicy}
            onChange={(e) =>
              updateSetting(
                "default_jdk_policy",
                e.target.value,
                setJdkPolicy as (v: never) => void,
              )
            }
            className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="auto-match">自动匹配（选择最新版本）</option>
            <option value="always-latest">始终使用最新</option>
            <option value="always-ask">每次询问</option>
          </select>
        </section>

        {/* Launch Behavior */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">
            启动行为
          </h2>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            应用启动时的默认行为
          </p>

          <select
            value={launchBehavior}
            onChange={(e) =>
              updateSetting(
                "launch_behavior",
                e.target.value,
                setLaunchBehavior as (v: never) => void,
              )
            }
            className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="background">后台运行</option>
            <option value="show-console">显示控制台</option>
          </select>
        </section>

        {/* About */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">
            关于
          </h2>
          <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
            <p>JarBox v0.1.0</p>
            <p>基于 Tauri 2 + React 构建</p>
            <p>JAR 应用启动器</p>
          </div>
        </section>
      </div>
    </div>
  );
}
