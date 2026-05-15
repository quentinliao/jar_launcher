import { useState, useCallback } from "react";
import { Plus, Upload } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { JarApp, JdkInfo } from "../types";
import AppCard from "../components/AppCard";
import ContextMenu, { defaultAppMenuItems } from "../components/ContextMenu";
import EditAppDialog from "../components/EditAppDialog";
import VersionDialog from "../components/VersionDialog";

interface HomePageProps {
  apps: JarApp[];
  jdks: JdkInfo[];
  loading: boolean;
  addApp: (path: string) => Promise<JarApp | null>;
  removeApp: (appId: string) => Promise<void>;
  updateApp: (appId: string, updates: Record<string, unknown>) => Promise<JarApp | null>;
  updateJar: (appId: string, jarPath: string) => Promise<JarApp | null>;
  launchApp: (appId: string) => Promise<void>;
  openFileLocation: (path: string) => Promise<void>;
}

export default function HomePage({
  apps,
  jdks,
  loading,
  addApp,
  removeApp,
  updateApp,
  updateJar,
  launchApp,
  openFileLocation,
}: HomePageProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    app: JarApp;
  } | null>(null);
  const [editingApp, setEditingApp] = useState<JarApp | null>(null);
  const [versionDialog, setVersionDialog] = useState<{
    appId: string;
    oldVersion: string | null;
    newVersion: string | null;
    jarPath: string;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleAddByPicker = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "JAR 文件", extensions: ["jar"] }],
    });
    if (selected) {
      await addApp(selected);
    }
  }, [addApp]);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      const files = e.dataTransfer.files;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith(".jar")) {
          // In Tauri webview, file.path gives the absolute path
          const path = (file as File & { path?: string }).path;
          if (path) {
            await addApp(path);
          }
        }
      }
    },
    [addApp],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleUpdateJar = useCallback(
    async (app: JarApp) => {
      const selected = await open({
        multiple: false,
        filters: [{ name: "JAR 文件", extensions: ["jar"] }],
      });
      if (selected) {
        // Check for version downgrade
        const oldVersion = app.version;
        // Extract version from new jar filename as rough comparison
        const newFileName = selected.split("/").pop() ?? selected.split("\\").pop() ?? "";
        const versionMatch = newFileName.match(/(\d+\.\d+(?:\.\d+)?)/);
        const newVersion = versionMatch ? versionMatch[1] : null;

        if (
          oldVersion &&
          newVersion &&
          compareVersions(newVersion, oldVersion) < 0
        ) {
          setVersionDialog({
            appId: app.id,
            oldVersion,
            newVersion,
            jarPath: selected,
          });
        } else {
          await updateJar(app.id, selected);
        }
      }
    },
    [updateJar],
  );

  const handleConfirmVersionDowngrade = useCallback(async () => {
    if (versionDialog) {
      await updateJar(versionDialog.appId, versionDialog.jarPath);
      setVersionDialog(null);
    }
  }, [versionDialog, updateJar]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, app: JarApp) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, app });
    },
    [],
  );

  const handleSaveEdit = useCallback(
    async (appId: string, updates: Record<string, unknown>) => {
      await updateApp(appId, updates);
      setEditingApp(null);
    },
    [updateApp],
  );

  return (
    <div
      className="flex h-full flex-col overflow-auto bg-gray-50 dark:bg-gray-950"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          我的应用
        </h1>
        <button
          onClick={handleAddByPicker}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
        >
          <Plus size={16} />
          添加应用
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        {apps.length === 0 ? (
          /* Empty state / Drop zone */
          <div
            className={`flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${
              dragOver
                ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20"
                : "border-gray-300 dark:border-gray-600"
            }`}
          >
            <Upload
              size={48}
              className={`mb-4 ${dragOver ? "text-blue-500" : "text-gray-400"}`}
            />
            <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
              {dragOver ? "松开以添加应用" : "拖拽 JAR 文件到此处"}
            </p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              或点击上方按钮选择文件
            </p>
          </div>
        ) : (
          /* App grid */
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
            {apps.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                onDoubleClick={() => launchApp(app.id)}
                onContextMenu={handleContextMenu}
              />
            ))}

            {/* Add card */}
            <button
              onClick={handleAddByPicker}
              className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-transparent transition-colors hover:border-blue-400 hover:bg-blue-50 dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-blue-900/10"
            >
              <Plus size={24} className="text-gray-400" />
              <span className="text-sm text-gray-400">添加应用</span>
            </button>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={defaultAppMenuItems(
            () => launchApp(contextMenu.app.id),
            () => setEditingApp(contextMenu.app),
            () => openFileLocation(contextMenu.app.jar_path),
            () => handleUpdateJar(contextMenu.app),
            () => removeApp(contextMenu.app.id),
          )}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Edit Dialog */}
      {editingApp && (
        <EditAppDialog
          app={editingApp}
          jdks={jdks}
          onSave={handleSaveEdit}
          onClose={() => setEditingApp(null)}
        />
      )}

      {/* Version Downgrade Dialog */}
      {versionDialog && (
        <VersionDialog
          oldVersion={versionDialog.oldVersion}
          newVersion={versionDialog.newVersion}
          onConfirm={handleConfirmVersionDowngrade}
          onCancel={() => setVersionDialog(null)}
        />
      )}
    </div>
  );
}

/** Compare semver-like version strings. Returns -1, 0, or 1. */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}
