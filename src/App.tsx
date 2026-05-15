import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, Page, Settings } from "./types";
import Sidebar from "./components/Sidebar";
import HomePage from "./pages/HomePage";
import JdkPage from "./pages/JdkPage";
import SettingsPage from "./pages/SettingsPage";
import { useApps } from "./hooks/useApps";
import { useJdks } from "./hooks/useJdks";
import "./App.css";

function App() {
  const [page, setPage] = useState<Page>("home");
  const [settings, setSettings] = useState<Settings>({
    default_jdk_policy: "auto-match",
    launch_behavior: "background",
    theme: "system",
  });
  const [initialized, setInitialized] = useState(false);

  // Load initial config
  useEffect(() => {
    (async () => {
      try {
        const config = await invoke<AppConfig>("get_config");
        setSettings(config.settings);
        setInitialized(true);
      } catch (e) {
        console.error("Failed to load config:", e);
        setInitialized(true);
      }
    })();
  }, []);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "dark") {
      root.classList.add("dark");
    } else if (settings.theme === "light") {
      root.classList.remove("dark");
    } else {
      // System preference
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      const handler = (e: MediaQueryListEvent) => {
        if (e.matches) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [settings.theme]);

  // We need to lazily initialize hooks after config is loaded.
  // Use wrapper components that only render after initialization.
  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <p className="text-2xl">☕</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            加载中...
          </p>
        </div>
      </div>
    );
  }

  return <AppShell page={page} onNavigate={setPage} settings={settings} onSettingsChanged={setSettings} />;
}

function AppShell({
  page,
  onNavigate,
  settings,
  onSettingsChanged,
}: {
  page: Page;
  onNavigate: (p: Page) => void;
  settings: Settings;
  onSettingsChanged: (s: Settings) => void;
}) {
  const appsHook = useApps([]);
  const jdksHook = useJdks([]);

  // Load initial data on mount
  useEffect(() => {
    appsHook.refreshApps();
    jdksHook.refreshJdks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
      <Sidebar currentPage={page} onNavigate={onNavigate} />
      <main className="flex-1 overflow-hidden">
        {page === "home" && (
          <HomePage
            apps={appsHook.apps}
            jdks={jdksHook.jdks}
            loading={appsHook.loading}
            addApp={appsHook.addApp}
            removeApp={appsHook.removeApp}
            updateApp={appsHook.updateApp}
            updateJar={appsHook.updateJar}
            launchApp={appsHook.launchApp}
            openFileLocation={appsHook.openFileLocation}
          />
        )}
        {page === "jdk" && (
          <JdkPage
            jdks={jdksHook.jdks}
            loading={jdksHook.loading}
            discoverJdks={jdksHook.discoverJdks}
            downloadAndInstallJdk={jdksHook.downloadAndInstallJdk}
            removeJdk={jdksHook.removeJdk}
          />
        )}
        {page === "settings" && (
          <SettingsPage
            settings={settings}
            onSettingsChanged={onSettingsChanged}
          />
        )}
      </main>
    </div>
  );
}

export default App;
