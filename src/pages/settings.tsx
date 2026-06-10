import React, { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { safeConfirm as confirm } from "../shared/utils/dialog";
import { useDatabase } from "../shared/hooks/useDatabase";
import { useDownloadStore } from "../features/downloads/downloadStore";
import { isAwsAuthenticated, clearAwsCredentials } from "../features/aws/s3Client";
import { openUrl } from "@tauri-apps/plugin-opener";
import { 
  HiOutlineFolder, 
  HiOutlineKey, 
  HiOutlineRefresh, 
  HiOutlineCheckCircle, 
  HiOutlineDocumentText, 
  HiOutlineArrowRight,
  HiOutlineAdjustments
} from "react-icons/hi";
import pkg from "../../package.json";
import { useTranslation } from "react-i18next";
import { useTheme } from "../app/ThemeContext";

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [downloadDir, setDownloadDir] = useState<string>("~/Downloads/s3-explorer");
  const [validateChecksums, setValidateChecksums] = useState<boolean>(true);
  const [ssoStartUrl, setSsoStartUrl] = useState<string>("");
  const [ssoRegion, setSsoRegion] = useState<string>("us-east-1");
  const [activeProfile, setActiveProfile] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [releaseChannel, setReleaseChannel] = useState<string>("Estable");

  const [isSavingDir, setIsSavingDir] = useState(false);
  const [isSavingSso, setIsSavingSso] = useState(false);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const [ssoFeedback, setSsoFeedback] = useState<string | null>(null);

  const { getSetting, saveSetting } = useDatabase();
  const { maxConcurrentDownloads, setMaxConcurrent } = useDownloadStore();

  useEffect(() => {
    // Load existing settings
    getSetting("download_dir").then((val) => {
      if (val) setDownloadDir(val);
    });

    getSetting("validate_checksums").then((val) => {
      if (val === null) {
        setValidateChecksums(true);
      } else {
        setValidateChecksums(val === "true");
      }
    });

    getSetting("max_concurrent_downloads").then((val) => {
      if (val) {
        const count = parseInt(val, 10);
        if (!isNaN(count)) {
          setMaxConcurrent(count);
        }
      }
    });

    getSetting("sso_start_url").then((val) => {
      if (val) setSsoStartUrl(val);
    });

    getSetting("sso_region").then((val) => {
      if (val) setSsoRegion(val);
    });

    getSetting("release_channel").then((val) => {
      if (val) setReleaseChannel(val);
    });

    // Determine initial connection state & active profile
    const profileName = localStorage.getItem("aws_sso_role_name") || localStorage.getItem("aws_sso_profile") || "";
    setActiveProfile(profileName);
    setIsConnected(isAwsAuthenticated());
  }, []);

  const handleSelectFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    
    if (selected && typeof selected === 'string') {
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

  const handleSaveSsoSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSso(true);
    await saveSetting("sso_start_url", ssoStartUrl.trim());
    await saveSetting("sso_region", ssoRegion.trim() || "us-east-1");
    setTimeout(() => {
      setIsSavingSso(false);
      setSsoFeedback("settings.sso_saved_feedback");
      setTimeout(() => setSsoFeedback(null), 3000);
    }, 1000);
  };

  const handleUnlink = async () => {
    const confirmed = await confirm(
      t("settings.unlink_confirm"),
      { title: t("settings.title"), kind: "warning" }
    );
    if (!confirmed) {
      return;
    }
    clearAwsCredentials();
    localStorage.removeItem("aws_sso_profile");
    localStorage.removeItem("aws_sso_account_id");
    localStorage.removeItem("aws_sso_account_name");
    localStorage.removeItem("aws_sso_role_name");
    localStorage.removeItem("aws_credentials_expires_at");
    localStorage.removeItem("aws_auth_method");
    localStorage.removeItem("aws_sso_token");
    localStorage.removeItem("aws_sso_token_expires_at");

    setSsoStartUrl("");
    setSsoRegion("us-east-1");
    setActiveProfile("");
    setIsConnected(false);

    await saveSetting("sso_start_url", "");
    await saveSetting("sso_region", "us-east-1");

    setSsoFeedback("settings.unlink_feedback");
    setTimeout(() => setSsoFeedback(null), 3000);
  };

  const handleSyncProfiles = async () => {
    setIsSyncingProfile(true);
    const profileName = localStorage.getItem("aws_sso_role_name") || localStorage.getItem("aws_sso_profile") || "";
    setActiveProfile(profileName);
    setIsConnected(isAwsAuthenticated());
    setTimeout(() => setIsSyncingProfile(false), 1000);
  };

  const handleCheckForUpdates = () => {
    setIsCheckingForUpdates(true);
    window.dispatchEvent(new CustomEvent("tauri-check-update-manual"));
    setTimeout(() => setIsCheckingForUpdates(false), 2000);
  };

  const handleReleaseChannelChange = async (channel: string) => {
    setReleaseChannel(channel);
    await saveSetting("release_channel", channel);
  };

  const handleOpenDoc = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await openUrl("https://github.com/Wblanco0315/S3-Portable-Explorer");
    } catch (err) {
      console.error("Failed to open documentation link:", err);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-margin max-w-5xl mx-auto w-full animate-in fade-in duration-500 text-on-surface">
      <div className="mb-margin">
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-unit">{t("settings.title")}</h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant">{t("settings.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-margin">
        {/* Preferences & Directory Section (Span 2) */}
        <div className="lg:col-span-2 space-y-margin">
          
          {/* Environmental Preferences Section */}
          <section className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
            <div className="bg-surface-variant px-margin py-3 border-b border-outline-variant">
              <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                <HiOutlineFolder className="w-6 h-6 text-on-surface" />
                {t("settings.env_preferences")}
              </h3>
            </div>
            
            <div className="p-margin space-y-gutter">
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="download_dir">
                  {t("settings.download_dir_label")}
                </label>
                <div className="flex gap-2">
                  <input 
                    className="flex-1 bg-surface border border-outline-variant text-on-surface font-label-sm text-label-sm rounded px-3 py-2 focus:border-primary focus:ring-0 focus:outline-none transition-colors" 
                    id="download_dir" 
                    readOnly 
                    type="text" 
                    value={downloadDir}
                  />
                  <button 
                    onClick={handleSelectFolder}
                    className="bg-secondary-container hover:bg-surface-bright text-on-secondary-container px-4 py-2 rounded font-label-md text-label-md border border-outline-variant transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {isSavingDir ? t("settings.saving_btn") : t("settings.browse_btn")}
                  </button>
                </div>
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-1 opacity-75">
                  {t("settings.download_dir_desc")}
                </p>
              </div>

              <div className="border-t border-outline-variant pt-gutter flex items-center justify-between">
                <div>
                  <h4 className="font-body-md text-body-md text-on-surface">{t("settings.validate_checksums")}</h4>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    {t("settings.validate_checksums_desc")}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={validateChecksums}
                    onChange={(e) => handleToggleChecksums(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-surface-bright peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-surface after:border-outline-variant after:border after:rounded-full after:h-5 after:w-5 after:transition-all border border-outline-variant peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="border-t border-outline-variant pt-gutter flex items-center justify-between">
                <div>
                  <h4 className="font-body-md text-body-md text-on-surface">{t("settings.concurrent_downloads")}</h4>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    {t("settings.concurrent_downloads_desc")}
                  </p>
                </div>
                <select 
                  value={`${maxConcurrentDownloads} ${t("settings.threads")}`}
                  onChange={(e) => {
                    const val = parseInt(e.target.value.split(" ")[0], 10);
                    if (!isNaN(val)) handleConcurrentChange(val);
                  }}
                  className="bg-surface border border-outline-variant text-on-surface font-label-sm text-label-sm rounded px-3 py-2 focus:border-primary focus:ring-0 focus:outline-none transition-colors w-24 cursor-pointer"
                >
                  <option>{`4 ${t("settings.threads")}`}</option>
                  <option>{`8 ${t("settings.threads")}`}</option>
                  <option>{`16 ${t("settings.threads")}`}</option>
                </select>
              </div>
            </div>
          </section>

          {/* System Settings Section */}
          <section className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
            <div className="bg-surface-variant px-margin py-3 border-b border-outline-variant">
              <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                <HiOutlineAdjustments className="w-6 h-6 text-on-surface" />
                {t("settings.system_settings")}
              </h3>
            </div>
            
            <div className="p-margin space-y-gutter">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-body-md text-body-md text-on-surface">{t("settings.language_label")}</h4>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    {t("settings.language_desc")}
                  </p>
                </div>
                <select 
                  value={i18n.language?.startsWith("es") ? "es" : "en"}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  className="bg-surface border border-outline-variant text-on-surface font-label-sm text-label-sm rounded px-3 py-2 focus:border-primary focus:ring-0 focus:outline-none transition-colors w-32 cursor-pointer"
                >
                  <option value="en">{t("settings.languages.en")}</option>
                  <option value="es">{t("settings.languages.es")}</option>
                </select>
              </div>

              <div className="border-t border-outline-variant pt-gutter flex items-center justify-between">
                <div>
                  <h4 className="font-body-md text-body-md text-on-surface">{t("settings.theme_label")}</h4>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    {t("settings.theme_desc")}
                  </p>
                </div>
                <select 
                  value={theme}
                  onChange={(e) => {
                    const selected = e.target.value as "light" | "dark";
                    if (selected !== theme) {
                      toggleTheme();
                    }
                  }}
                  className="bg-surface border border-outline-variant text-on-surface font-label-sm text-label-sm rounded px-3 py-2 focus:border-primary focus:ring-0 focus:outline-none transition-colors w-32 cursor-pointer"
                >
                  <option value="light">{t("settings.themes.light")}</option>
                  <option value="dark">{t("settings.themes.dark")}</option>
                </select>
              </div>
            </div>
          </section>

          {/* AWS SSO Configuration Section */}
          <section className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
            <div className="bg-surface-variant px-margin py-3 border-b border-outline-variant flex justify-between items-center">
              <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                <HiOutlineKey className="w-6 h-6 text-on-surface" />
                {t("settings.aws_sso_config")}
              </h3>
              <span className={`border text-label-sm font-label-sm px-2 py-1 rounded flex items-center gap-1 bg-surface border-outline-variant ${
                isConnected ? "text-primary" : "text-on-surface-variant opacity-75"
              }`}>
                <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-primary animate-pulse" : "bg-outline"}`}></span>
                {isConnected ? t("settings.connected") : t("settings.disconnected")}
              </span>
            </div>

            <form onSubmit={handleSaveSsoSettings} className="p-margin space-y-gutter">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                <div className="flex flex-col gap-2">
                  <label className="font-label-md text-label-md text-on-surface-variant">{t("settings.sso_start_url")}</label>
                  <input 
                    type="url"
                    value={ssoStartUrl}
                    onChange={(e) => setSsoStartUrl(e.target.value)}
                    placeholder="https://d-xxxxxxxxx.awsapps.com/start"
                    className="bg-surface border border-outline-variant text-on-surface font-label-sm text-label-sm rounded px-3 py-2 focus:border-primary focus:ring-0 focus:outline-none transition-colors w-full"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-label-md text-label-md text-on-surface-variant">{t("settings.sso_region")}</label>
                  <select 
                    value={ssoRegion}
                    onChange={(e) => setSsoRegion(e.target.value)}
                    className="bg-surface border border-outline-variant text-on-surface font-label-sm text-label-sm rounded px-3 py-2 focus:border-primary focus:ring-0 focus:outline-none transition-colors w-full cursor-pointer"
                  >
                    <option value="us-east-1">us-east-1</option>
                    <option value="eu-west-1">eu-west-1</option>
                    <option value="ap-southeast-2">ap-southeast-2</option>
                    <option value="us-west-2">us-west-2</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <label className="font-label-md text-label-md text-on-surface-variant">{t("settings.active_profile")}</label>
                <div className="flex gap-2">
                  <input 
                    className="flex-1 bg-surface border border-outline-variant text-on-surface font-label-sm text-label-sm rounded px-3 py-2 focus:border-primary focus:ring-0 focus:outline-none transition-colors" 
                    readOnly 
                    type="text" 
                    value={activeProfile || t("settings.ninguno")}
                  />
                  <button 
                    type="button"
                    onClick={handleSyncProfiles}
                    className="bg-surface hover:bg-surface-bright text-on-surface px-3 py-2 rounded font-label-md text-label-md border border-outline-variant transition-colors cursor-pointer flex items-center justify-center" 
                    title={t("settings.sync_profiles_title")}
                  >
                    <HiOutlineRefresh className={`text-[18px] ${isSyncingProfile ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {ssoFeedback && (
                <p className="font-label-sm text-label-sm text-primary animate-in fade-in duration-300">
                  {t(ssoFeedback)}
                </p>
              )}

              <div className="mt-margin pt-gutter border-t border-outline-variant flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={handleUnlink}
                  className="bg-surface hover:bg-surface-bright text-on-surface px-4 py-2 rounded font-label-md text-label-md border border-outline-variant transition-colors cursor-pointer"
                >
                  {t("settings.unlink_btn")}
                </button>
                <button 
                  type="submit"
                  className="bg-primary hover:bg-primary-container text-on-primary px-4 py-2 rounded font-label-md text-label-md border border-transparent transition-colors cursor-pointer"
                >
                  {isSavingSso ? t("settings.saving_changes_btn") : t("settings.save_changes_btn")}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Updates & Info Sidebar (Span 1) */}
        <div className="space-y-margin">
          
          {/* Updates Card */}
          <section className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
            <div className="bg-surface-variant px-margin py-3 border-b border-outline-variant">
              <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                <HiOutlineRefresh className="w-6 h-6 text-on-surface" />
                {t("settings.updates")}
              </h3>
            </div>
            <div className="p-margin flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-surface-bright border border-outline-variant flex items-center justify-center mb-4">
                <HiOutlineCheckCircle className="w-8 h-8 text-tertiary" />
              </div>
              <h4 className="font-body-lg text-body-lg text-on-surface font-semibold mb-1">S3 Explorer v{pkg.version}</h4>
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-4">
                {isCheckingForUpdates ? t("settings.checking_updates") : t("settings.up_to_date")}
              </p>
              <button 
                onClick={handleCheckForUpdates}
                disabled={isCheckingForUpdates}
                className="w-full bg-surface hover:bg-surface-bright text-on-surface px-4 py-2 rounded font-label-md text-label-md border border-outline-variant transition-colors cursor-pointer disabled:opacity-50"
              >
                {t("settings.check_updates_btn")}
              </button>
            </div>
            <div className="px-margin py-3 bg-surface-container-low border-t border-outline-variant flex justify-between items-center">
              <span className="font-label-sm text-label-sm text-on-surface-variant">{t("settings.release_channel")}</span>
              <select 
                value={releaseChannel}
                onChange={(e) => handleReleaseChannelChange(e.target.value)}
                className="bg-transparent border-none text-on-surface font-label-sm text-label-sm focus:ring-0 py-0 pr-6 cursor-pointer"
              >
                <option value="Estable">{t("settings.stable")}</option>
                <option value="Beta">{t("settings.beta")}</option>
              </select>
            </div>
          </section>

          {/* Documentation & Support Card */}
          <section className="bg-surface-container border border-outline-variant rounded-lg p-margin relative overflow-hidden group">
            {/* Subtle decorative gradient to break up flat blocks slightly without violating matte rules too much (kept dark) */}
            <div className="absolute inset-0 bg-gradient-to-br from-surface-container to-surface-bright opacity-50 z-0 pointer-events-none"></div>
            <div className="relative z-10">
              <h4 className="font-body-md text-body-md text-on-surface font-semibold mb-2 flex items-center gap-2">
                <HiOutlineDocumentText className="w-[18px] h-[18px] text-on-surface" />
                {t("settings.doc_support")}
              </h4>
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-4">
                {t("settings.doc_desc")}
              </p>
              <a 
                onClick={handleOpenDoc}
                className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:text-primary-container transition-colors cursor-pointer" 
                href="#"
              >
                {t("settings.view_doc")}
                <HiOutlineArrowRight className="w-[16px] h-[16px]" />
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
