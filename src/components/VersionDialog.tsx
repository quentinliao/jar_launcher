import { AlertTriangle, X } from "lucide-react";

interface VersionDialogProps {
  oldVersion: string | null;
  newVersion: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function VersionDialog({
  oldVersion,
  newVersion,
  onConfirm,
  onCancel,
}: VersionDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-500">
            <AlertTriangle size={20} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              版本降级确认
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          检测到版本降级：
        </p>
        <div className="mb-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="text-red-500 line-through">{oldVersion ?? "未知"}</span>
            {" → "}
            <span className="text-green-500">{newVersion ?? "未知"}</span>
          </p>
        </div>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          确定要继续更新吗？
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-600"
          >
            确认更新
          </button>
        </div>
      </div>
    </div>
  );
}
