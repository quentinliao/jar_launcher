import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { JdkInfo, AppConfig } from "../types";

export function useJdks(initialJdks: JdkInfo[]) {
  const [jdks, setJdks] = useState<JdkInfo[]>(initialJdks);
  const [loading, setLoading] = useState(false);

  const refreshJdks = useCallback(async () => {
    try {
      const config = await invoke<AppConfig>("get_config");
      setJdks(config.jdks);
    } catch (e) {
      console.error("Failed to refresh JDKs:", e);
    }
  }, []);

  const discoverJdks = useCallback(async () => {
    setLoading(true);
    try {
      const discovered = await invoke<JdkInfo[]>("discover_jdks");
      setJdks(discovered);
      return discovered;
    } catch (e) {
      console.error("Failed to discover JDKs:", e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadAndInstallJdk = useCallback(
    async (majorVersion: number, vendor: string): Promise<JdkInfo | null> => {
      setLoading(true);
      try {
        const jdk = await invoke<JdkInfo>("download_and_install_jdk", {
          majorVersion,
          vendor,
        });
        setJdks((prev) => [...prev, jdk]);
        return jdk;
      } catch (e) {
        console.error("Failed to download JDK:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const removeJdk = useCallback(async (jdkId: string) => {
    setLoading(true);
    try {
      await invoke("remove_jdk", { jdkId });
      setJdks((prev) => prev.filter((j) => j.id !== jdkId));
    } catch (e) {
      console.error("Failed to remove JDK:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    jdks,
    loading,
    refreshJdks,
    discoverJdks,
    downloadAndInstallJdk,
    removeJdk,
  };
}
