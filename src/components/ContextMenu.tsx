import { useEffect, useRef } from "react";
import { Play, Pencil, FolderOpen, RefreshCw, Trash2 } from "lucide-react";

export interface ContextMenuItem {
  label: string;
  icon?: typeof Play;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 40 - 20);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={i}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            disabled={item.disabled}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
              item.danger
                ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                : item.disabled
                  ? "cursor-not-allowed text-gray-400 dark:text-gray-600"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {Icon && <Icon size={14} />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Predefined menu item factories for convenience
export const defaultAppMenuItems = (
  onLaunch: () => void,
  onEdit: () => void,
  onOpenFile: () => void,
  onUpdateJar: () => void,
  onDelete: () => void,
): ContextMenuItem[] => [
  { label: "启动", icon: Play, onClick: onLaunch },
  { label: "编辑", icon: Pencil, onClick: onEdit },
  { label: "打开文件位置", icon: FolderOpen, onClick: onOpenFile },
  { label: "更新 JAR", icon: RefreshCw, onClick: onUpdateJar },
  { label: "删除", icon: Trash2, onClick: onDelete, danger: true },
];
