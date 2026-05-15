import { useState, useCallback, useEffect } from "react";
import { Plus, Upload, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { JarApp, JdkInfo } from "../types";
import AppCard from "../components/AppCard";
import ContextMenu, { defaultAppMenuItems } from "../components/ContextMenu";
import EditAppDialog from "../components/EditAppDialog";
import VersionDialog from "../components/VersionDialog";

interface HomePageProps {
  apps: JarApp[];
  jdks: JdkInfo[];
  loading: boolean;
  launchError: { appName: string; message: string } | null;
  addApp: (path: string) => Promise<JarApp | null>;
  removeApp: (appId: string) => Promise<void>;
  updateApp: (appId: string, updates: Record<string, unknown>) => Promise<JarApp | null>;
  updateJar: (appId: string, jarPath: string) => Promise<JarApp | null>;
  launchApp: (appId: string) => Promise<void>;
  openFileLocation: (path: string) => Promise<void>;
  clearLaunchError: () => void;
}

export default function HomePage({
  apps,
  jdks,
  loading,
  launchError,
  addApp,
  removeApp,
  updateApp,
  updateJar,
  launchApp,
  openFileLocation,
  clearLaunchError,
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

  // Use Tauri native drag-drop events instead of HTML5 Drag API
  // HTML5 Drag API doesn't expose file paths in WKWebView (macOS)
  useEffect(() => {
    const unlisten = getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setDragOver(true);
      } else if (event.payload.type === "drop") {
        setDragOver(false);
        const paths: string[] = event.payload.paths;
        for (const path of paths) {
          if (path.endsWith(".jar")) {
            addApp(path);
          }
        }
      } else if (event.payload.type === "leave") {
        setDragOver(false);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [addApp]);

  const handleAddByPicker = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "JAR 文件", extensions: ["jar"] }],
    });
    if (selected) {
      await addApp(selected);
    }
  }, [addApp]);

  const handleUpdateJar = useCallback(
    async (app: JarApp) => {
      const selected = await open({
        multiple: false,
        filters: [{ name: "JAR 文件", extensions: ["jar"] }],
      });
      if (selected) {
        const oldVersion = app.version;
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
    <div className="flex h-full flex-col overflow-auto bg-gray-50 dark:bg-gray-950">
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

      {/* Drop overlay - shown when files are dragged over */}
      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-blue-400 bg-white/90 px-12 py-8 text-center dark:bg-gray-800/90">
            <Upload size={48} className="mx-auto mb-4 text-blue-500" />
            <p className="text-lg font-medium text-blue-600 dark:text-blue-400">
              松开以添加 JAR 应用
            </p>
          </div>
        </div>
      )}

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

      {/* Launch Error Dialog */}
      {launchError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
                应用启动失败
              </h2>
              <button
                onClick={clearLaunchError}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              {launchError.appName}
            </p>
            <pre className="max-h-60 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
              {launchError.message}
            </pre>
            <div className="mt-4 flex justify-end">
              <button
                onClick={clearLaunchError}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
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
