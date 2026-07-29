import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  HiOutlineKey,
  HiOutlineRefresh,
  HiOutlineGlobeAlt,
  HiOutlineUserCircle,
  HiOutlineSelector,
  HiOutlineStatusOnline,
  HiOutlineInformationCircle,
} from "react-icons/hi";
import { safeConfirm as confirm } from "../../shared/utils/dialog";
import { useDatabase } from "../../shared/hooks/useDatabase";
import { isAwsAuthenticated, clearAwsCredentials } from "../../features/aws/s3Client";
import SectionHeader from "./SectionHeader";

/** AWS SSO connection configuration and profile management. */
export default function AwsSettings() {
  const { t } = useTranslation();
  const { getSetting, saveSetting } = useDatabase();

  const [ssoStartUrl, setSsoStartUrl] = useState<string>("");
  const [ssoRegion, setSsoRegion] = useState<string>("us-east-1");
  const [activeProfile, setActiveProfile] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSavingSso, setIsSavingSso] = useState(false);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const [ssoFeedback, setSsoFeedback] = useState<string | null>(null);

  useEffect(() => {
    getSetting("sso_start_url").then((val) => {
      if (val) setSsoStartUrl(val);
    });

    getSetting("sso_region").then((val) => {
      if (val) setSsoRegion(val);
    });

    const profileName = localStorage.getItem("aws_sso_role_name") || localStorage.getItem("aws_sso_profile") || "";
    setActiveProfile(profileName);
    setIsConnected(isAwsAuthenticated());
  }, []);

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
    const confirmed = await confirm(t("settings.unlink_confirm"), {
      title: t("settings.title"),
      kind: "warning",
    });
    if (!confirmed) return;

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

  return (
    <div className="w-full flex flex-col h-full">
      {/* Page Header Content */}
      <div className="p-margin border-b border-outline-variant bg-surface-container-low flex items-center justify-between shrink-0">
        <SectionHeader icon={<HiOutlineKey className="w-6 h-6" />} title={t("settings.aws_sso_config")} />
        <span
          className={`border text-label-sm font-label-sm px-2 py-1 rounded flex items-center gap-1 bg-surface border-outline-variant ${
            isConnected ? "text-primary" : "text-on-surface-variant opacity-75"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-primary animate-pulse" : "bg-outline"}`}></span>
          {isConnected ? t("settings.connected") : t("settings.disconnected")}
        </span>
      </div>

      <form onSubmit={handleSaveSsoSettings} className="flex-1 min-h-0 overflow-y-auto">
        {/* 2-Column Layout Container */}
        <div className="grid grid-cols-12">
          {/* Left Column (Wider - 8 columns) */}
          <div className="col-span-12 lg:col-span-8 p-6 gap-6">
            <div className="space-y-6">
              {/* SSO Connection */}
              <section className="gap-3 flex flex-col bg-surface-container-low border border-outline-variant rounded-xl p-6">
                <div className="flex gap-5">
                  <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                    <HiOutlineGlobeAlt className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="font-bold text-on-surface text-sm">{t("settings.sso_connection")}</h3>
                    <p className="text-body-sm text-on-surface-variant">{t("settings.sso_connection_desc")}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="font-label-md text-label-md text-on-surface-variant">{t("settings.sso_start_url")}</label>
                    <input
                      type="url"
                      value={ssoStartUrl}
                      onChange={(e) => setSsoStartUrl(e.target.value)}
                      placeholder="https://d-xxxxxxxxx.awsapps.com/start"
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-label-md text-label-md text-on-surface-variant">{t("settings.sso_region")}</label>
                    <div className="relative">
                      <select
                        value={ssoRegion}
                        onChange={(e) => setSsoRegion(e.target.value)}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 pr-10 text-on-surface text-sm appearance-none cursor-pointer focus:ring-1 focus:ring-primary focus:border-primary"
                      >
                        <option value="us-east-1">us-east-1</option>
                        <option value="eu-west-1">eu-west-1</option>
                        <option value="ap-southeast-2">ap-southeast-2</option>
                        <option value="us-west-2">us-west-2</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <HiOutlineSelector className="w-5 h-5 text-on-surface-variant" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Active Profile */}
              <section className="gap-3 flex flex-col bg-surface-container-low border border-outline-variant rounded-xl p-6">
                <div className="flex gap-5">
                  <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                    <HiOutlineUserCircle className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="font-bold text-on-surface text-sm">{t("settings.active_profile")}</h3>
                    <p className="text-body-sm text-on-surface-variant">{t("settings.active_profile_desc")}</p>
                  </div>
                </div>
                <div className="flex gap-5 w-full">
                  <input
                    className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-on-surface text-sm focus:outline-none truncate"
                    readOnly
                    type="text"
                    value={activeProfile || t("settings.ninguno")}
                  />
                  <button
                    type="button"
                    onClick={handleSyncProfiles}
                    className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold rounded-lg border border-outline-variant transition-colors cursor-pointer flex items-center justify-center"
                    title={t("settings.sync_profiles_title")}
                  >
                    <HiOutlineRefresh className={`text-[18px] ${isSyncingProfile ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </section>

              {ssoFeedback && (
                <p className="font-label-sm text-label-sm text-primary animate-in fade-in duration-300">{t(ssoFeedback)}</p>
              )}

              {/* Actions */}
              <div className="pt-gutter border-t border-outline-variant flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleUnlink}
                  className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold rounded-lg border border-outline-variant transition-colors cursor-pointer text-sm"
                >
                  {t("settings.unlink_btn")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg border border-transparent transition-colors cursor-pointer text-sm"
                >
                  {isSavingSso ? t("settings.saving_changes_btn") : t("settings.save_changes_btn")}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column (Narrower - 4 columns) */}
          <aside className="col-span-12 lg:col-span-4 p-margin">
            <div className="space-y-xl">
              {/* Connection status */}
              <div className="p-6 bg-surface-container-low border border-outline-variant rounded-xl">
                <div className="flex items-center gap-3 text-on-surface">
                  <HiOutlineStatusOnline className={`w-5 h-5 ${isConnected ? "text-primary" : "text-on-surface-variant"}`} />
                  <span className="font-bold text-sm">{t("settings.connection_status")}</span>
                </div>
                <p className="text-body-sm text-on-surface-variant leading-relaxed mt-2">
                  {isConnected ? t("settings.connected_desc") : t("settings.disconnected_desc")}
                </p>
              </div>

              {/* Tip */}
              <div className="p-6 bg-surface-container-low border border-outline-variant rounded-xl">
                <div className="flex items-center gap-3 text-on-surface">
                  <HiOutlineInformationCircle className="w-5 h-5 text-primary" />
                  <span className="font-bold text-sm">{t("settings.tip_title")}</span>
                </div>
                <p className="text-body-sm text-on-surface-variant leading-relaxed mt-2">
                  {t("settings.aws_tip_desc")}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
