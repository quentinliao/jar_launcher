import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { JarApp, AppConfig } from "../types";

export function useApps(initialApps: JarApp[]) {
  const [apps, setApps] = useState<JarApp[]>(initialApps);
  const [loading, setLoading] = useState(false);

  const refreshApps = useCallback(async () => {
    try {
      const config = await invoke<AppConfig>("get_config");
      setApps(config.apps);
    } catch (e) {
      console.error("Failed to refresh apps:", e);
    }
  }, []);

  const addApp = useCallback(
    async (path: string): Promise<JarApp | null> => {
      setLoading(true);
      try {
        const app = await invoke<JarApp>("add_jar", { path });
        setApps((prev) => [...prev, app]);
        return app;
      } catch (e) {
        console.error("Failed to add JAR:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const removeApp = useCallback(async (appId: string) => {
    setLoading(true);
    try {
      await invoke("remove_app", { appId });
      setApps((prev) => prev.filter((a) => a.id !== appId));
    } catch (e) {
      console.error("Failed to remove app:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateApp = useCallback(
    async (appId: string, updates: Record<string, unknown>): Promise<JarApp | null> => {
      setLoading(true);
      try {
        const updated = await invoke<JarApp>("update_app", {
          appId,
          updates,
        });
        setApps((prev) => prev.map((a) => (a.id === appId ? updated : a)));
        return updated;
      } catch (e) {
        console.error("Failed to update app:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const updateJar = useCallback(
    async (appId: string, jarPath: string): Promise<JarApp | null> => {
      setLoading(true);
      try {
        const updated = await invoke<JarApp>("update_jar", {
          appId,
          jarPath,
        });
        setApps((prev) => prev.map((a) => (a.id === appId ? updated : a)));
        return updated;
      } catch (e) {
        console.error("Failed to update JAR:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const launchApp = useCallback(async (appId: string) => {
    try {
      await invoke("launch_app", { appId });
      setApps((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, running: 1 } : a)),
      );
    } catch (e) {
      console.error("Failed to launch app:", e);
      throw e;
    }
  }, []);

  const openFileLocation = useCallback(async (path: string) => {
    try {
      await invoke("open_file_location", { path });
    } catch (e) {
      console.error("Failed to open file location:", e);
    }
  }, []);

  return {
    apps,
    loading,
    refreshApps,
    addApp,
    removeApp,
    updateApp,
    updateJar,
    launchApp,
    openFileLocation,
  };
}
