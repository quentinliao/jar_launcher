import type { JarApp } from "../types";

interface AppCardProps {
  app: JarApp;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent, app: JarApp) => void;
}

export default function AppCard({
  app,
  onDoubleClick,
  onContextMenu,
}: AppCardProps) {
  return (
    <div
      className="group flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600"
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => onContextMenu(e, app)}
    >
      {/* Icon */}
      <div className="relative flex h-14 w-14 items-center justify-center rounded-lg bg-amber-100 text-3xl dark:bg-amber-900/40">
        ☕
        {/* Running indicator */}
        {app.running && (
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
          </span>
        )}
      </div>

      {/* Name */}
      <div className="w-full text-center">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {app.name}
        </p>
        {app.version && (
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            v{app.version}
          </p>
        )}
      </div>

      {/* Running label */}
      {app.running && (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
          运行中
        </span>
      )}
    </div>
  );
}
