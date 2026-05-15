import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { JarApp, JdkInfo } from "../types";

interface EditAppDialogProps {
  app: JarApp;
  jdks: JdkInfo[];
  onSave: (appId: string, updates: Record<string, unknown>) => void;
  onClose: () => void;
}

export default function EditAppDialog({
  app,
  jdks,
  onSave,
  onClose,
}: EditAppDialogProps) {
  const [name, setName] = useState(app.name);
  const [jdkId, setJdkId] = useState<string>(app.jdk_id ?? "");
  const [jvmArgs, setJvmArgs] = useState(app.jvm_args.join(" "));
  const [appArgs, setAppArgs] = useState(app.app_args.join(" "));
  const [showConsole, setShowConsole] = useState(app.show_console);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSave = () => {
    const updates: Record<string, unknown> = {
      name,
      jdk_id: jdkId || null,
      jvm_args: jvmArgs
        .split(/\s+/)
        .filter(Boolean),
      app_args: appArgs
        .split(/\s+/)
        .filter(Boolean),
      show_console: showConsole,
    };
    onSave(app.id, updates);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            编辑应用
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* App Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              应用名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Version (read-only) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              版本
            </label>
            <input
              type="text"
              value={app.version ?? "未知"}
              readOnly
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-400"
            />
          </div>

          {/* JDK Selector */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              JDK
            </label>
            <select
              value={jdkId}
              onChange={(e) => setJdkId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">自动匹配</option>
              {jdks.map((jdk) => (
                <option key={jdk.id} value={jdk.id}>
                  {jdk.version} ({jdk.vendor}) - {jdk.path}
                </option>
              ))}
            </select>
          </div>

          {/* JVM Args */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              JVM 参数
            </label>
            <input
              type="text"
              value={jvmArgs}
              onChange={(e) => setJvmArgs(e.target.value)}
              placeholder="-Xmx512m -Xms256m"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          {/* App Args */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              应用参数
            </label>
            <input
              type="text"
              value={appArgs}
              onChange={(e) => setAppArgs(e.target.value)}
              placeholder="--server.port=8080"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          {/* Show Console */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showConsole}
              onChange={(e) => setShowConsole(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              显示控制台
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
