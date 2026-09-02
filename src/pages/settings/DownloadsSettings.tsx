import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import {
  HiOutlineCheckCircle,
  HiOutlineCloudDownload,
  HiOutlineDownload,
  HiOutlineFolderOpen,
  HiOutlineInformationCircle,
  HiOutlineRefresh,
  HiOutlineSelector,
} from "react-icons/hi";
import { useDatabase } from "../../shared/hooks/useDatabase";
import { useDownloadStore, UNLIMITED_RETRIES } from "../../features/downloads/downloadStore";
import SectionHeader from "./SectionHeader";

/** Download-related preferences: destination folder, checksums, concurrency, retries. */
export default function DownloadsSettings() {
  const { t } = useTranslation();
  const { getSetting, saveSetting } = useDatabase();
  const { maxConcurrentDownloads, setMaxConcurrent, maxRetries, setMaxRetries } = useDownloadStore();

  const [downloadDir, setDownloadDir] = useState<string>("~/Downloads/s3-explorer");
  const [validateChecksums, setValidateChecksums] = useState<boolean>(true);
  const [isSavingDir, setIsSavingDir] = useState(false);

  useEffect(() => {
    getSetting("download_dir").then((val) => {
      if (val) setDownloadDir(val);
    });

    getSetting("validate_checksums").then((val) => {
      setValidateChecksums(val === null ? true : val === "true");
    });

    getSetting("max_concurrent_downloads").then((val) => {
      if (val) {
        const count = parseInt(val, 10);
        if (!isNaN(count)) setMaxConcurrent(count);
      }
    });

    getSetting("max_download_retries").then((val) => {
      if (val) {
        const count = parseInt(val, 10);
        if (!isNaN(count)) setMaxRetries(count);
      }
    });
  }, []);

  const handleSelectFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      setDownloadDir(selected);
      setIsSavingDir(true);
      await saveSetting("download_dir", selected);
      setTimeout(() => setIsSavingDir(false), 1500);
    }
  };

  const handleToggleChecksums = async (checked: boolean) => {
    setValidateChecksums(checked);
    await saveSetting("validate_checksums", String(checked));
  };

  const handleConcurrentChange = async (count: number) => {
    setMaxConcurrent(count);
    await saveSetting("max_concurrent_downloads", String(count));
  };

  const handleRetriesChange = async (count: number) => {
    setMaxRetries(count);
    await saveSetting("max_download_retries", String(count));
  };

  return (
    <div className="w-full flex flex-col h-full">
      {/* Page Header Content */}
      <div className="p-margin border-b border-outline-variant bg-surface-container-low shrink-0">
        <SectionHeader icon={<HiOutlineDownload className="w-6 h-6" />} title={t("settings.downloads_header_title")} />
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* 2-Column Layout Container */}
        <div className="grid grid-cols-12">
          {/* Left Column (Wider - 8 columns) */}
          <div className="col-span-12 lg:col-span-8 p-6 gap-6">
            <div className="space-y-6">
              {/* Primary Download Directory */}
              <section className="gap-3 flex flex-col bg-surface-container-low border border-outline-variant rounded-xl p-6 ">
                <div className="flex gap-5">
                  <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                    <HiOutlineFolderOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-headline-md text-on-surface text-base font-semibold">{t("settings.download_dir_label")}</h2>
                    <p className="text-body-sm text-on-surface-variant">{t("settings.download_dir_desc")}</p>
                  </div>
                </div>
                <div className="flex gap-5 w-full">
                  <input
                    type="text"
                    readOnly
                    value={downloadDir}
                    className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-on-surface text-sm font-sans focus:outline-none select-all truncate"
                  />
                  <button
                    onClick={handleSelectFolder}
                    className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold rounded-lg border border-outline-variant transition-colors cursor-pointer text-sm whitespace-nowrap"
                  >
                    {isSavingDir ? t("settings.saving_btn") : t("settings.browse_btn")}
                  </button>
                </div>
              </section>

              {/* Checksums Validation */}
              <section>
                <div className="flex items-center justify-between p-6  bg-surface-container-low border border-outline-variant rounded-xl">
                  <div className="flex gap-5">
                    <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                      <HiOutlineCheckCircle className="w-10 h-6" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <h3 className="font-bold text-on-surface text-sm">{t("settings.validate_checksums")}</h3>
                      <p className="text-body-sm text-on-surface-variant">{t("settings.validate_checksums_desc")}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={validateChecksums}
                      onChange={(e) => handleToggleChecksums(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-outline-variant/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </section>

              {/* Selects: Concurrent Downloads and Retries */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6 ">
                {/* Concurrent Downloads */}
                <div className="gap-3 flex flex-col bg-surface-container-low border border-outline-variant rounded-xl p-6 ">
                  <div className="flex gap-5">
                    <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                      <HiOutlineCloudDownload className="w-10 h-6 " />
                    </div>
                    <div className="flex flex-col gap-2">
                      <h3 className="font-bold text-on-surface text-sm">{t("settings.concurrent_downloads")}</h3>
                      <p className="text-body-sm text-on-surface-variant">{t("settings.concurrent_downloads_desc")}</p>
                    </div>
                  </div>
                  <div className="relative">
                    <select
                      value={maxConcurrentDownloads}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) handleConcurrentChange(val);
                      }}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 pr-10 text-on-surface text-sm appearance-none cursor-pointer focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      <option value="4">{`4 ${t("settings.threads")}`}</option>
                      <option value="8">{`8 ${t("settings.threads")}`}</option>
                      <option value="16">{`16 ${t("settings.threads")}`}</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <HiOutlineSelector className="w-5 h-5 text-on-surface-variant" />
                    </div>
                  </div>
                </div>

                {/* Automatic Retries */}
                <div className="gap-3 flex flex-col bg-surface-container-low border border-outline-variant rounded-xl p-6 ">
                  <div className="flex gap-5">
                    <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                      <HiOutlineRefresh className="w-10 h-6" />
                    </div>

                    <div className="flex flex-col gap-2">
                      <h3 className="font-bold text-on-surface text-sm">{t("settings.download_retries")}</h3>
                      <p className="text-body-sm text-on-surface-variant">{t("settings.download_retries_desc")}</p>
                    </div>
                  </div>
                  <div className="relative">
                    <select
                      value={String(maxRetries)}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) handleRetriesChange(val);
                      }}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 pr-10 text-on-surface text-sm appearance-none cursor-pointer focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      <option value="0">{`0 ${t("settings.retries")}`}</option>
                      <option value="3">{`3 ${t("settings.retries")}`}</option>
                      <option value="5">{`5 ${t("settings.retries")}`}</option>
                      <option value="10">{`10 ${t("settings.retries")}`}</option>
                      <option value={String(UNLIMITED_RETRIES)}>{t("settings.unlimited")}</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <HiOutlineSelector className="w-5 h-5 text-on-surface-variant" />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* Right Column (Narrower - 4 columns) */}
          <aside className="col-span-12 lg:col-span-4 p-margin">
            <div className="space-y-xl">
              <div className="p-6 bg-surface-container-low border border-outline-variant rounded-xl">
                <div className="flex items-center gap-3 text-on-surface">
                  <HiOutlineInformationCircle className="w-5 h-5 text-primary" />
                  <span className="font-bold text-sm">{t("settings.tip_title")}</span>
                </div>
                <p className="text-body-sm text-on-surface-variant leading-relaxed">
                  {t("settings.tip_desc")}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

