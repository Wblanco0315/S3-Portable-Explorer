import { Outlet } from "react-router-dom";
import LateralNavbar from "../../components/navbar/lateralNavbar";
import NavItem from "../../components/navbar/navItem";
import {
  HiOutlineChartBar,
  HiOutlineDatabase,
  HiOutlineCog,
  HiOutlineDownload,
} from "react-icons/hi";
import Breadcrumbs from "../../components/navigation/Breadcrumbs";
import { useDownloadStore } from "../../features/downloads/downloadStore";
import { useState, useEffect } from "react";
import { HiOutlineLink, HiOutlineFolder } from "react-icons/hi";
import { listFolders, FavoriteFolder } from "../../features/favorites/favoritesStore";
import { DownloadManager } from "../../features/downloads/downloadManager";
import { useTheme } from "../ThemeContext";
import { HiOutlineSun, HiOutlineMoon } from "react-icons/hi";
import pkg from "../../../package.json";
import UpdateNotifier from "../../components/updater/UpdateNotifier";

export default function DefaultLayout() {
  const { theme, toggleTheme } = useTheme();
  const { tasks } = useDownloadStore();
  const activeDownloadsCount = tasks.filter(t => t.status === 'downloading' || t.status === 'queued').length;

  const [folders, setFolders] = useState<FavoriteFolder[]>([]);

  useEffect(() => {
    listFolders().then(setFolders);
  }, []);

  const buildFolderTree = (parentId: number | null = null): NavItem[] => {
    return folders
      .filter(f => f.parent_id === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(f => ({
        name: f.name,
        path: `/favorites?folder=${f.id}`,
        icon: HiOutlineFolder,
        isLink: true,
        children: buildFolderTree(f.id!)
      }));
  };

  const menuItems: NavItem[] = [
    { name: "Main Menu", path: "", isLink: false }, // Section header
    { name: "Dashboard", path: "/", icon: HiOutlineChartBar, isLink: true },
    {
      name: "Buckets",
      path: "/buckets",
      icon: HiOutlineDatabase,
      isLink: true,
    },
    {
      name: "Downloads",
      path: "/downloads",
      icon: HiOutlineDownload,
      isLink: true,
      badge: activeDownloadsCount > 0 ? activeDownloadsCount : undefined,
    },

    {
      name: "My Routes",
      path: "/favorites",
      icon: HiOutlineLink,
      isLink: true,
      children: buildFolderTree(null),
    },

    { name: "Other", path: "", isLink: false }, // Section header
    { name: "Settings", path: "/settings", icon: HiOutlineCog, isLink: true },
  ];

  const logo = (
    <span className="text-xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
      S3 Portable Explorer
    </span>
  );

  const footer = (
    <div className="flex items-center justify-center py-1 px-2">
      <span className="text-xs text-gray-400 dark:text-slate-500 font-semibold">
        version {pkg.version}
      </span>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 font-sans transition-colors duration-300">
      <DownloadManager />
      <UpdateNotifier />
      <LateralNavbar items={menuItems} logo={logo} footer={footer} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <Breadcrumbs />
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <HiOutlineSun size={20} /> : <HiOutlineMoon size={20} />}
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
