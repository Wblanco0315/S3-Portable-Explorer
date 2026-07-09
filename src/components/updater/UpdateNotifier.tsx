import { useState, useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  HiOutlineRefresh as IconRefresh,
  HiOutlineCloudDownload as IconDownload,
  HiOutlineCheckCircle as IconCheck,
  HiOutlineX as IconX,
  HiOutlineInformationCircle as IconInfo,
  HiOutlineArrowRight as IconArrowRight
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
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-outline-variant bg-surface-container text-on-surface shadow-2xl backdrop-blur-md transition-all">
            {messageToast.type === "success" && <IconCheck className="w-5 h-5 flex-shrink-0 text-primary animate-bounce" />}
            {messageToast.type === "error" && <IconInfo className="w-5 h-5 flex-shrink-0 text-error" />}
            {messageToast.type === "info" && <IconRefresh className="w-5 h-5 flex-shrink-0 text-primary animate-spin" />}
            <span className="font-body-sm text-body-sm font-semibold">{messageToast.text}</span>
            {messageToast.type !== "info" && (
              <button onClick={() => setMessageToast(null)} className="ml-2 hover:text-primary text-on-surface-variant cursor-pointer transition-colors">
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
          <div className="bg-surface-container border-2 border-outline-variant rounded-lg overflow-hidden w-full max-w-md backdrop-blur-md transform transition-all animate-in zoom-in-95 duration-200 relative z-10">

            {/* Absolute close button */}
            {status !== "downloading" && status !== "done" && (
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1.5 hover:bg-surface-container-high rounded cursor-pointer transition-colors border border-transparent z-20"
              >
                <IconX className="w-5 h-5" />
              </button>
            )}

            {/* Centered Header */}
            <div className="p-8 pb-4 text-center border-b border-outline-variant bg-surface-variant">
              <div className="w-16 h-16 bg-primary-container/20 border border-primary/30 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <IconDownload className="w-8 h-8" />
              </div>
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold mb-1">
                {t("updater.title")}
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {t("updater.subtitle")}
              </p>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Version Comparison */}
              <div className="flex justify-center items-center gap-6 bg-surface-container-low border border-outline-variant p-3 rounded-lg">
                <div className="text-center">
                  <span className="block font-label-sm text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">
                    {t("updater.current_version")}
                  </span>
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    v{pkg.version}
                  </span>
                </div>
                <div className="text-on-surface-variant">
                  <IconArrowRight className="w-4 h-4" />
                </div>
                <div className="text-center">
                  <span className="block font-label-sm text-label-sm font-bold text-primary uppercase tracking-wider">
                    {t("updater.available_version")}
                  </span>
                  <span className="font-label-md text-label-md text-primary font-bold">
                    v{updateInfo?.version}
                  </span>
                </div>
              </div>

              {/* Release Notes */}
              {updateInfo?.body && (
                <div className="space-y-1">
                  <p className="font-body-sm text-body-sm font-semibold text-on-surface-variant flex items-center gap-1.5">
                    <IconInfo className="w-4 h-4 text-primary" /> {t("updater.release_notes")}
                  </p>
                  <div className="max-h-36 overflow-y-auto bg-surface-container-low border border-outline-variant rounded-lg p-3 text-body-sm text-on-surface font-sans leading-relaxed">
                    {updateInfo.body}
                  </div>
                </div>
              )}

              {/* Progress and status message */}
              {status === "downloading" && (
                <div className="space-y-2 pt-2 animate-in fade-in-0 duration-300">
                  <div className="w-full bg-surface-container-low h-2.5 rounded-full overflow-hidden border border-outline-variant">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center font-label-sm text-label-sm text-on-surface-variant">
                    <span className="animate-pulse">{t("updater.downloading")}</span>
                    <span>{progress}% {totalBytes > 0 && `(${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)})`}</span>
                  </div>
                </div>
              )}

              {status === "done" && (
                <div className="flex items-center gap-2 text-primary font-semibold text-body-sm pt-2 animate-in fade-in-0 duration-300 justify-center">
                  <IconCheck className="w-5 h-5 animate-bounce" />
                  <span>{t("updater.complete")}</span>
                </div>
              )}

              {status === "error" && (
                <div className="bg-error-container/10 border border-error/20 rounded-lg p-3.5 text-body-sm text-error font-medium">
                  <p className="font-bold flex items-center gap-1"><IconInfo className="w-4 h-4" /> {t("updater.error_title")}</p>
                  <p className="mt-1 opacity-90">{errorMsg}</p>
                </div>
              )}
            </div>

            {/* Footer (Stacked Buttons) */}
            {status !== "downloading" && status !== "done" && (
              <div className="px-6 pb-6 flex flex-col gap-3 bg-surface-container">
                <button
                  onClick={handleDownloadAndInstall}
                  className="w-full bg-primary hover:bg-primary/95 text-on-primary px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <IconDownload className="w-4 h-4" />
                  {t("updater.update_btn")}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant hover:border-outline px-6 py-3 rounded-lg font-medium transition-colors cursor-pointer"
                >
                  {t("updater.later_btn")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
