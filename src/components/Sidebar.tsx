import { Coffee, Cpu, Settings } from "lucide-react";
import type { Page } from "../types";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; icon: typeof Coffee; label: string }[] = [
  { page: "home", icon: Coffee, label: "应用" },
  { page: "jdk", icon: Cpu, label: "JDK" },
  { page: "settings", icon: Settings, label: "设置" },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="flex h-screen w-14 flex-col items-center border-r border-gray-200 bg-white py-4 dark:border-gray-700 dark:bg-gray-900">
      {/* Logo */}
      <div className="mb-6 flex h-10 w-10 items-center justify-center text-2xl">
        ☕
      </div>

      {/* Nav Items */}
      <nav className="flex flex-1 flex-col items-center gap-2">
        {navItems.map(({ page, icon: Icon, label }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            title={label}
            className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
              currentPage === page
                ? "bg-blue-500 text-white"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            }`}
          >
            <Icon size={20} />
          </button>
        ))}
      </nav>
    </aside>
  );
}
