import { useState, useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { 
  HiOutlineRefresh as IconRefresh, 
  HiOutlineCloudDownload as IconDownload, 
  HiOutlineCheckCircle as IconCheck, 
  HiOutlineX as IconX,
  HiOutlineInformationCircle as IconInfo
} from "react-icons/hi";
import { useTranslation } from "react-i18next";
import pkg from "../../../package.json";

export default function UpdateNotifier() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "downloading" | "error" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [messageToast, setMessageToast] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);

  const checkForUpdates = async (manual = false) => {
    const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;
    if (!isTauri) {
      if (manual) {
        setMessageToast({ text: "El actualizador solo funciona dentro de la aplicación de escritorio.", type: "info" });
        setTimeout(() => setMessageToast(null), 4000);
      }
      return;
    }

    if (manual) {
      setStatus("checking");
      setMessageToast({ text: t("updater.checking"), type: "info" });
    }

    try {
      const update = await check();
      
      if (update) {
        setUpdateInfo(update);
        setIsOpen(true);
        setStatus("idle");
        setMessageToast(null);
      } else {
        setStatus("idle");
        if (manual) {
          setMessageToast({ text: t("updater.up_to_date_toast"), type: "success" });
          setTimeout(() => setMessageToast(null), 4000);
        }
      }
    } catch (err: any) {
      console.error("Failed to check for updates:", err);
      setStatus("error");
      setErrorMsg(err.message || String(err));
      if (manual) {
        setMessageToast({ text: t("updater.failed_check"), type: "error" });
        setTimeout(() => setMessageToast(null), 4000);
      }
    }
  };

  useEffect(() => {
    // Check automatically on mount after a small delay to not block load
    const timer = setTimeout(() => {
      checkForUpdates(false);
    }, 3000);

    // Listen for manual trigger from settings page
    const handleManualCheck = () => {
      checkForUpdates(true);
    };

    window.addEventListener("tauri-check-update-manual", handleManualCheck);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("tauri-check-update-manual", handleManualCheck);
    };
  }, []);

  const handleDownloadAndInstall = async () => {
    if (!updateInfo) return;
    setStatus("downloading");
    setProgress(0);
    setDownloadedBytes(0);
    setTotalBytes(0);

    try {
      let currentDownloaded = 0;
      await updateInfo.downloadAndInstall((event: any) => {
        switch (event.event) {
          case "Started":
            if (event.data.contentLength) {
              setTotalBytes(event.data.contentLength);
            }
            break;
          case "Progress":
            currentDownloaded += event.data.chunkLength;
            setDownloadedBytes(currentDownloaded);
            if (totalBytes > 0) {
              setProgress(Math.round((currentDownloaded / totalBytes) * 100));
            } else {
              // Fallback incremental progress if contentLength wasn't set
              setProgress((prev) => Math.min(prev + 2, 98));
            }
            break;
          case "Finished":
            setProgress(100);
            break;
        }
      });

      setStatus("done");
      setMessageToast({ text: t("updater.success_installed"), type: "success" });
      
      // Small pause to let user see success, then relaunch
      setTimeout(async () => {
        try {
          await relaunch();
        } catch (relaunchErr) {
          console.error("Failed to relaunch application:", relaunchErr);
          // Fallback if relaunch fails, guide user to manual relaunch
          alert("Application updated. Please restart manually to apply changes.");
          setIsOpen(false);
          setStatus("idle");
        }
      }, 1500);

    } catch (err: any) {
      console.error("Installation failed:", err);
      setStatus("error");
      
      const rawError = err.message || String(err);
      let friendlyError = rawError;
      
      // Check for common permission issues on Windows
      if (
        rawError.toLowerCase().includes("access") || 
        rawError.toLowerCase().includes("permission") || 
        rawError.toLowerCase().includes("denied") ||
        rawError.toLowerCase().includes("privilege")
      ) {
        friendlyError = t("updater.permission_error_desc");
      }
      
      setErrorMsg(friendlyError);
      setMessageToast({ text: t("updater.install_failed"), type: "error" });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = 2;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  return (
    <>
      {/* Toast Notification for manual checks / success */}
      {messageToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md transition-all ${
            messageToast.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              : messageToast.type === "error"
              ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
              : "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-400"
          }`}>
            {messageToast.type === "success" && <IconCheck className="w-5 h-5 flex-shrink-0 animate-bounce" />}
            {messageToast.type === "error" && <IconInfo className="w-5 h-5 flex-shrink-0" />}
            {messageToast.type === "info" && <IconRefresh className="w-5 h-5 flex-shrink-0 animate-spin" />}
            <span className="text-sm font-semibold">{messageToast.text}</span>
            {messageToast.type !== "info" && (
              <button onClick={() => setMessageToast(null)} className="ml-2 hover:opacity-75 cursor-pointer">
                <IconX className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Updater Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-300"
            onClick={() => status !== "downloading" && status !== "done" && setIsOpen(false)}
          />

          {/* Modal Container */}
          <div className="bg-white dark:bg-slate-900/95 border border-gray-200/60 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-md backdrop-blur-md transform transition-all animate-in zoom-in-95 duration-200 z-10">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <IconDownload className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-slate-50">{t("updater.title")}</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{t("updater.subtitle")}</p>
                </div>
              </div>
              {status !== "downloading" && status !== "done" && (
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1.5 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                >
                  <IconX className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Version Comparison */}
              <div className="flex items-center justify-around bg-gray-50/50 dark:bg-slate-950/30 border border-gray-100 dark:border-slate-800/40 rounded-xl p-3">
                <div className="text-center">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">{t("updater.current_version")}</p>
                  <p className="text-sm font-black text-gray-600 dark:text-slate-400">v{pkg.version}</p>
                </div>
                <div className="w-8 h-px bg-gray-200 dark:bg-slate-800" />
                <div className="text-center">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-indigo-500">{t("updater.available_version")}</p>
                  <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">v{updateInfo?.version}</p>
                </div>
              </div>

              {/* Release Notes */}
              {updateInfo?.body && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                    <IconInfo className="w-4 h-4" /> {t("updater.release_notes")}
                  </p>
                  <div className="max-h-36 overflow-y-auto bg-gray-50/50 dark:bg-slate-950/50 border border-gray-100 dark:border-slate-800/60 rounded-xl p-3.5 text-xs text-gray-600 dark:text-slate-300 font-sans leading-relaxed shadow-inner">
                    {updateInfo.body}
                  </div>
                </div>
              )}

              {/* Progress and status message */}
              {status === "downloading" && (
                <div className="space-y-2 pt-2 animate-in fade-in-0 duration-300">
                  <div className="w-full bg-gray-100 dark:bg-slate-950 h-2.5 rounded-full overflow-hidden border border-gray-200/20 dark:border-slate-800 shadow-inner">
                    <div 
                      className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-300 bg-gradient-to-r from-indigo-600 to-violet-600" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 dark:text-slate-400">
                    <span className="animate-pulse">{t("updater.downloading")}</span>
                    <span>{progress}% {totalBytes > 0 && `(${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)})`}</span>
                  </div>
                </div>
              )}

              {status === "done" && (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm pt-2 animate-in fade-in-0 duration-300 justify-center">
                  <IconCheck className="w-5 h-5 animate-bounce" />
                  <span>{t("updater.complete")}</span>
                </div>
              )}

              {status === "error" && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 text-xs text-red-600 dark:text-red-400 font-medium">
                  <p className="font-bold flex items-center gap-1"><IconInfo className="w-4 h-4" /> {t("updater.error_title")}</p>
                  <p className="mt-1 opacity-90">{errorMsg}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            {status !== "downloading" && status !== "done" && (
              <div className="p-6 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-slate-950/20">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-350 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  {t("updater.later_btn")}
                </button>
                <button
                  onClick={handleDownloadAndInstall}
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow-indigo-500/10 hover:shadow-lg transition-all cursor-pointer"
                >
                  <IconDownload className="w-4 h-4" />
                  {t("updater.update_btn")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
