import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  HiOutlineRefresh,
  HiOutlineCheckCircle,
  HiOutlineDocumentText,
  HiOutlineArrowRight,
  HiOutlineSelector,
} from "react-icons/hi";
import { useDatabase } from "../../shared/hooks/useDatabase";
import pkg from "../../../package.json";

/** Update status card + release channel selector. Meant for the settings side column. */
export function UpdatesCard() {
  const { t } = useTranslation();
  const { getSetting, saveSetting } = useDatabase();

  const [releaseChannel, setReleaseChannel] = useState<string>("Estable");
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);

  useEffect(() => {
    getSetting("release_channel").then((val) => {
      if (val) setReleaseChannel(val);
    });
  }, []);

  const handleCheckForUpdates = () => {
    setIsCheckingForUpdates(true);
    window.dispatchEvent(new CustomEvent("tauri-check-update-manual"));
    setTimeout(() => setIsCheckingForUpdates(false), 2000);
  };

  const handleReleaseChannelChange = async (channel: string) => {
    setReleaseChannel(channel);
    await saveSetting("release_channel", channel);
  };

  return (
    <div className="gap-3 flex flex-col bg-surface-container-low border border-outline-variant rounded-xl p-6">
      <div className="flex gap-5">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary">
          <HiOutlineRefresh className="w-6 h-6" />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-bold text-on-surface text-sm">{t("settings.updates")}</h3>
          <p className="text-body-sm text-on-surface-variant">
            {isCheckingForUpdates ? t("settings.checking_updates") : t("settings.up_to_date")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg bg-surface-container-lowest border border-outline-variant px-3 py-3">
        <div className="w-10 h-10 rounded-full bg-surface-bright border border-outline-variant flex items-center justify-center shrink-0">
          <HiOutlineCheckCircle className="w-6 h-6 text-tertiary" />
        </div>
        <div className="flex flex-col">
          <span className="text-on-surface text-sm font-semibold">S3 Explorer</span>
          <span className="text-body-sm text-on-surface-variant">v{pkg.version}</span>
        </div>
      </div>

      <button
        onClick={handleCheckForUpdates}
        disabled={isCheckingForUpdates}
        className="w-full px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold rounded-lg border border-outline-variant transition-colors cursor-pointer text-sm disabled:opacity-50"
      >
        {t("settings.check_updates_btn")}
      </button>

      <div className="flex items-center justify-between pt-3 border-t border-outline-variant">
        <span className="text-body-sm text-on-surface-variant">{t("settings.release_channel")}</span>
        <div className="relative">
          <select
            value={releaseChannel}
            onChange={(e) => handleReleaseChannelChange(e.target.value)}
            className="bg-surface-container-lowest border border-outline-variant rounded-lg pl-3 pr-8 py-1.5 text-on-surface text-sm appearance-none cursor-pointer focus:ring-1 focus:ring-primary focus:border-primary"
          >
            <option value="Estable">{t("settings.stable")}</option>
            <option value="Beta">{t("settings.beta")}</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <HiOutlineSelector className="w-4 h-4 text-on-surface-variant" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Documentation & support links card. */
export function DocSupportCard() {
  const { t } = useTranslation();

  const handleOpenDoc = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await openUrl("https://github.com/Wblanco0315/S3-Portable-Explorer");
    } catch (err) {
      console.error("Failed to open documentation link:", err);
    }
  };

  return (
    <div className="gap-3 flex flex-col bg-surface-container-low border border-outline-variant rounded-xl p-6">
      <div className="flex gap-5">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary">
          <HiOutlineDocumentText className="w-6 h-6" />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-bold text-on-surface text-sm">{t("settings.doc_support")}</h3>
          <p className="text-body-sm text-on-surface-variant">{t("settings.doc_desc")}</p>
        </div>
      </div>
      <a
        onClick={handleOpenDoc}
        className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:text-primary-container transition-colors cursor-pointer mt-auto"
        href="#"
      >
        {t("settings.view_doc")}
        <HiOutlineArrowRight className="w-[16px] h-[16px]" />
      </a>
    </div>
  );
}

/** App version, update channel and documentation links. */
export default function AboutSettings() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <UpdatesCard />
      <DocSupportCard />
    </section>
  );
}
