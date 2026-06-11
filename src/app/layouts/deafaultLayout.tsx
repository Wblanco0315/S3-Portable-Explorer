import { Outlet, useLocation } from "react-router-dom";
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
import { ConfirmModal } from "../../components/ConfirmModal";
import { useTranslation } from "react-i18next";
import { useLoadingStore } from "../../shared/hooks/useLoadingStore";

export default function DefaultLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { tasks } = useDownloadStore();
  const activeDownloadsCount = tasks.filter(t => t.status === 'downloading' || t.status === 'queued').length;
  const { isLoading, message } = useLoadingStore();

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
    { name: t("menu.main_menu"), path: "", isLink: false }, // Section header
    { name: t("menu.dashboard"), path: "/", icon: HiOutlineChartBar, isLink: true },
    {
      name: t("menu.buckets"),
      path: "/buckets",
      icon: HiOutlineDatabase,
      isLink: true,
    },
    {
      name: t("menu.downloads"),
      path: "/downloads",
      icon: HiOutlineDownload,
      isLink: true,
      badge: activeDownloadsCount > 0 ? activeDownloadsCount : undefined,
    },

    {
      name: t("menu.my_routes"),
      path: "/favorites",
      icon: HiOutlineLink,
      isLink: true,
      children: buildFolderTree(null),
    },

    { name: t("menu.other"), path: "", isLink: false }, // Section header
    { name: t("menu.settings"), path: "/settings", icon: HiOutlineCog, isLink: true },
  ];

  const logo = (
    <span className="text-xl font-geist font-bold text-primary">
      S3 Portable Explorer
    </span>
  );

  const footer = (
    <div className="flex items-center justify-center py-1 px-2">
      <span className="text-label-sm text-on-surface-variant font-medium">
        version {pkg.version}
      </span>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-surface text-on-surface font-inter transition-colors duration-300">
      <DownloadManager />
      <UpdateNotifier />
      <LateralNavbar items={menuItems} logo={logo} footer={footer} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-surface-container-low border-b border-outline-variant flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <Breadcrumbs />
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <HiOutlineSun size={20} /> : <HiOutlineMoon size={20} />}
            </button>
            <button className="p-2 text-on-surface-variant hover:text-on-surface cursor-pointer">
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

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div key={location.pathname} className="flex-1 flex flex-col min-h-0 overflow-hidden route-transition">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Global loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-xs transition-all duration-300">
          <div className="bg-surface-container border border-outline-variant p-8 rounded-lg flex flex-col items-center gap-4 max-w-xs w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-3 border-primary/20 animate-pulse"></div>
              <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-primary border-r-primary animate-spin"></div>
            </div>
            <div className="flex flex-col items-center gap-1 mt-2">
              <span className="text-on-surface font-bold text-center text-body-md tracking-tight">
                {message || t("buckets.steps.loading_creds")}
              </span>
              <span className="text-primary font-semibold font-mono text-label-sm uppercase tracking-widest mt-0.5 animate-pulse">
                {t("buckets.handshake_sts_status")}
              </span>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal />
    </div>
  );
}
