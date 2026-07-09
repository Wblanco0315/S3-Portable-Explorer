import { Outlet, useLocation, useNavigate } from "react-router-dom";
import LateralNavbar from "../../components/navbar/lateralNavbar";
import NavItem from "../../components/navbar/navItem";
import {
  HiOutlineChartBar,
  HiOutlineDatabase,
  HiOutlineCog,
  HiOutlineDownload,
  HiOutlineLink,
  HiOutlineSun,
  HiOutlineMoon,
  HiOutlineBell,
  HiOutlineCloud,
  HiOutlineUsers,
  HiOutlineX,
  HiOutlineCheck,
  HiOutlineTrash,
} from "react-icons/hi";
import Breadcrumbs from "../../components/navigation/Breadcrumbs";
import { useDownloadStore } from "../../features/downloads/downloadStore";
import { DownloadManager } from "../../features/downloads/downloadManager";
import { useTheme } from "../ThemeContext";
import pkg from "../../../package.json";
import UpdateNotifier from "../../components/updater/UpdateNotifier";
import { ConfirmModal } from "../../components/ConfirmModal";
import { useTranslation } from "react-i18next";
import { useLoadingStore } from "../../shared/hooks/useLoadingStore";
import { useSupabaseStore } from "../../features/supabase/supabaseStore";
import { useEffect, useState } from "react";

export default function DefaultLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { tasks } = useDownloadStore();
  const activeDownloadsCount = tasks.filter(t => t.status === 'downloading' || t.status === 'queued').length;
  const { isLoading, message } = useLoadingStore();

  // Supabase hooks
  const initSupabase = useSupabaseStore((state) => state.init);
  const isOnline = useSupabaseStore((state) => state.isOnline);
  const profile = useSupabaseStore((state) => state.profile);
  const accessRequests = useSupabaseStore((state) => state.accessRequests);
  const approveRequest = useSupabaseStore((state) => state.approveAccessRequest);
  const rejectRequest = useSupabaseStore((state) => state.rejectAccessRequest);

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    initSupabase();
  }, []);

  // Compute active notifications
  // For admins: pending requests from other users
  // For normal users: requests they sent that are approved or rejected recently
  const pendingRequests = accessRequests.filter(req => {
    const isPending = req.status === "pending";
    const notExpired = new Date(req.expires_at).getTime() > Date.now();
    const isIncoming = profile?.role !== "user" ? req.user_id !== profile?.id : false;
    const isOutgoing = profile?.role === "user" ? req.user_id === profile?.id : false;
    
    return isPending && notExpired && (profile?.role !== "user" ? isIncoming : isOutgoing);
  });

  const resolvedRequests = accessRequests.filter(req => {
    const isResolved = req.status === "approved" || req.status === "rejected";
    const isOutgoing = req.user_id === profile?.id;
    return isResolved && isOutgoing;
  });

  // Notification dismissal state
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("dismissed_notifications") || "[]");
    } catch {
      return [];
    }
  });

  const dismissNotification = (id: string) => {
    const next = [...dismissedNotifications, id];
    setDismissedNotifications(next);
    localStorage.setItem("dismissed_notifications", JSON.stringify(next));
  };

  const activeNotifications = [...pendingRequests, ...resolvedRequests].filter(
    (req) => !dismissedNotifications.includes(req.id)
  );

  const badgeCount = activeNotifications.length;

  // Build dynamic menu items
  const menuItems: NavItem[] = [
    { name: t("menu.main_menu"), path: "", isLink: false },
    { name: t("menu.dashboard"), path: "/", icon: HiOutlineChartBar, isLink: true },
  ];

  // In online mode for normal user, completely hide S3 direct connections form page
  const hideLocalBuckets = isOnline && profile?.role === 'user';
  if (!hideLocalBuckets) {
    menuItems.push({
      name: isOnline ? t("menu.cloud_aws_connections", "AWS Connections") : t("menu.buckets"),
      path: "/buckets",
      icon: HiOutlineDatabase,
      isLink: true,
    });
  }

  menuItems.push({
    name: t("menu.downloads"),
    path: "/downloads",
    icon: HiOutlineDownload,
    isLink: true,
    badge: activeDownloadsCount > 0 ? activeDownloadsCount : undefined,
  });

  menuItems.push({
    name: t("menu.my_routes"),
    path: "/favorites",
    icon: HiOutlineLink,
    isLink: true,
  });

  // Online mode shows Cloud integration options
  if (isOnline) {
    menuItems.push({ name: t("menu.cloud"), path: "", isLink: false });
    menuItems.push({
      name: t("menu.cloud_groups"),
      path: "/cloud-groups",
      icon: HiOutlineUsers,
      isLink: true,
    });
  }

  menuItems.push(
    { name: t("menu.other"), path: "", isLink: false },
    { name: t("menu.settings"), path: "/settings", icon: HiOutlineCog, isLink: true }
  );

  const logo = (
    <span className="text-xl font-geist font-bold text-primary">
      S3 Portable Explorer
    </span>
  );

  const signOutSupabase = useSupabaseStore((state) => state.signOut);

  const footer = (
    <div className="flex flex-col gap-3 py-1">
      {isOnline && profile ? (
        <div className="flex flex-col gap-2 p-2 bg-surface-container-high rounded border border-outline-variant/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-label-md font-bold font-mono uppercase shrink-0">
              {profile.first_name[0] || "?"}{profile.last_name[0] || ""}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-body-sm font-semibold text-on-surface truncate">
                {profile.first_name} {profile.last_name}
              </div>
              <div className="text-[10px] text-on-surface-variant truncate">
                {profile.email}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-outline-variant/30">
            <span className="text-[9px] font-mono text-primary font-bold uppercase tracking-wider">
              {profile.role}
            </span>
            <button
              onClick={async () => {
                await signOutSupabase();
                navigate("/");
              }}
              className="text-[10px] text-error hover:underline flex items-center gap-1 cursor-pointer font-semibold"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => navigate("/cloud-routes")}
          className="w-full py-1.5 px-3 bg-surface-container border border-outline-variant text-on-surface text-label-sm font-semibold rounded-sm hover:bg-surface-container-high hover:text-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer font-medium"
        >
          <HiOutlineCloud size={14} />
          Conectarse a la Nube
        </button>
      )}
      <div className="text-center">
        <span className="text-label-sm text-on-surface-variant font-medium">
          version {pkg.version}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-surface text-on-surface font-inter transition-colors duration-300 relative overflow-hidden">
      <DownloadManager />
      <UpdateNotifier />
      <LateralNavbar items={menuItems} logo={logo} footer={footer} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-surface-container-low border-b border-outline-variant flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <Breadcrumbs />
            {isOnline && (
              <span className="px-2 py-0.5 rounded-full text-label-sm bg-primary-container text-on-primary-container font-mono font-medium uppercase tracking-wider">
                {t("cloud.status_online", "Online")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <HiOutlineSun size={20} /> : <HiOutlineMoon size={20} />}
            </button>
            
            {/* Bell Notifications Button */}
            <button 
              onClick={() => setIsDrawerOpen(true)}
              className="relative p-2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
              title={t("cloud.notifications.title", "Notifications")}
            >
              <HiOutlineBell size={20} />
              {badgeCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-error text-on-error rounded-full flex items-center justify-center text-[9px] font-bold font-mono animate-pulse">
                  {badgeCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div key={location.pathname} className="flex-1 flex flex-col min-h-0 overflow-hidden route-transition">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Notifications Drawer Backdrop */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in duration-200"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Notifications Drawer */}
      <div 
        className={`fixed right-0 top-0 h-full w-96 z-50 bg-surface-container border-l border-outline-variant shadow-2xl flex flex-col transition-transform duration-300 ease-in-out transform ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-16 border-b border-outline-variant flex items-center justify-between px-6 bg-surface-container-high">
          <h3 className="text-body-lg font-bold text-on-surface flex items-center gap-2">
            <HiOutlineBell className="text-primary" size={20} />
            {t("cloud.notifications.title", "Notifications")}
          </h3>
          <button 
            onClick={() => setIsDrawerOpen(false)}
            className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-md transition-colors cursor-pointer"
          >
            <HiOutlineX size={18} />
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-3">
          {activeNotifications.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-on-surface-variant gap-2">
              <HiOutlineBell size={32} className="opacity-40" />
              <p className="text-body-md font-medium">
                {t("cloud.notifications.no_notifications", "No pending notifications.")}
              </p>
            </div>
          ) : (
            activeNotifications.map((req) => {
              const routeName = req.routes?.name || "Ruta";
              const userEmail = req.profiles?.email || "Usuario";
              const userName = req.profiles 
                ? `${req.profiles.first_name} ${req.profiles.last_name}`.trim() || userEmail 
                : userEmail;
              
              const isExpired = new Date(req.expires_at).getTime() < Date.now();
              const isIncoming = req.user_id !== profile?.id;

              return (
                <div 
                  key={req.id} 
                  className="bg-surface-container-low border border-outline-variant p-4 rounded-md flex flex-col gap-3 animate-in slide-in-from-right duration-200 relative group/notif"
                >
                  {/* Dismiss Button */}
                  <button
                    onClick={() => dismissNotification(req.id)}
                    className="absolute top-2 right-2 p-1 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded transition-colors cursor-pointer"
                    title="Eliminar notificación"
                  >
                    <HiOutlineTrash size={14} />
                  </button>

                  <div className="flex flex-col pr-6">
                    <span className="text-label-sm font-semibold text-primary font-mono uppercase tracking-wider mb-1">
                      {isIncoming ? "Solicitud Recibida" : "Estado de Solicitud"}
                    </span>
                    <p className="text-body-sm text-on-surface">
                      {isIncoming ? (
                        <>
                          <strong className="text-on-surface font-semibold">{userName}</strong> solicita acceso para entrar a la ruta <strong className="text-on-surface font-semibold">{routeName}</strong>.
                        </>
                      ) : (
                        <>
                          Tu solicitud de acceso para entrar a la ruta <strong className="text-on-surface font-semibold">{routeName}</strong> ha sido{" "}
                          <strong className={req.status === "approved" ? "text-tertiary" : "text-error"}>
                            {req.status === "approved" ? "Aprobada" : "Rechazada"}
                          </strong>.
                        </>
                      )}
                    </p>
                  </div>

                  {isIncoming && req.status === "pending" && !isExpired && (
                    <div className="flex items-center gap-2 mt-1">
                      <button 
                        onClick={async () => {
                          await approveRequest(req.id);
                        }}
                        className="flex-1 py-1.5 px-3 bg-primary text-on-primary text-label-sm font-semibold rounded-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <HiOutlineCheck size={14} />
                        {t("cloud.notifications.approve_btn", "Approve")}
                      </button>
                      <button 
                        onClick={async () => {
                          await rejectRequest(req.id);
                        }}
                        className="flex-1 py-1.5 px-3 bg-surface-container-high border border-outline text-on-surface text-label-sm font-semibold rounded-sm hover:bg-surface-variant active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <HiOutlineX size={14} />
                        {t("cloud.notifications.reject_btn", "Reject")}
                      </button>
                    </div>
                  )}

                  {req.status === "pending" && !isExpired && (
                    <span className="text-[10px] font-mono text-on-surface-variant self-end">
                      Expira en: {new Date(req.expires_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
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
