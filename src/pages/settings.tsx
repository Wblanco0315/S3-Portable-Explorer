import React, { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useDatabase } from "../shared/hooks/useDatabase";
import { HiOutlineFolderOpen, HiOutlineSave, HiOutlineShieldCheck, HiOutlineRefresh } from "react-icons/hi";
import pkg from "../../package.json";

export default function SettingsPage() {
  const [downloadDir, setDownloadDir] = useState<string>("");
  const [ssoStartUrl, setSsoStartUrl] = useState<string>("");
  const [ssoRegion, setSsoRegion] = useState<string>("us-east-1");
  const [isSavingDir, setIsSavingDir] = useState(false);
  const [isSavingSso, setIsSavingSso] = useState(false);
  const { getSetting, saveSetting } = useDatabase();

  useEffect(() => {
    // Load existing settings
    getSetting("download_dir").then((val) => {
      if (val) setDownloadDir(val);
    });
    getSetting("sso_start_url").then((val) => {
      if (val) setSsoStartUrl(val);
    });
    getSetting("sso_region").then((val) => {
      if (val) setSsoRegion(val);
    });
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

  const handleSaveSsoSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSso(true);
    await saveSetting("sso_start_url", ssoStartUrl.trim());
    await saveSetting("sso_region", ssoRegion.trim() || "us-east-1");
    setTimeout(() => setIsSavingSso(false), 1500);
  };

  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);

  const handleCheckForUpdates = () => {
    setIsCheckingForUpdates(true);
    window.dispatchEvent(new CustomEvent("tauri-check-update-manual"));
    setTimeout(() => setIsCheckingForUpdates(false), 2000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 bg-surface text-on-surface">
      <h1 className="text-headline-lg font-bold text-on-surface">Settings</h1>
      
      {/* Preferences Card */}
      <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
        <div className="px-6 py-4 bg-surface-container border-b border-outline-variant">
          <h2 className="text-headline-md font-semibold text-on-surface">Preferences</h2>
          <p className="text-body-md text-on-surface-variant">Manage your general application settings.</p>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-body-md font-medium text-on-surface mb-2">
              Default Download Directory
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded px-4 py-2 text-body-md text-on-surface truncate">
                {downloadDir || "No directory selected"}
              </div>
              <button
                onClick={handleSelectFolder}
                className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high font-medium text-body-md rounded transition-colors cursor-pointer"
              >
                <HiOutlineFolderOpen className="w-4 h-4" />
                Change Folder
              </button>
            </div>
            {isSavingDir && (
              <p className="mt-2 text-body-md text-tertiary font-medium">Saved successfully!</p>
            )}
          </div>
        </div>
      </div>

      {/* Corporate AWS SSO Configuration Card */}
      <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
        <div className="px-6 py-4 bg-surface-container border-b border-outline-variant flex items-center gap-2">
          <div className="text-primary">
            <HiOutlineShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-headline-md font-semibold text-on-surface">AWS SSO Corporativo (Nativo)</h2>
            <p className="text-body-md text-on-surface-variant">Configura la URL de inicio del SSO de tu empresa para la autenticación sin AWS CLI.</p>
          </div>
        </div>

        <form onSubmit={handleSaveSsoSettings} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-body-md font-medium text-on-surface mb-2">
                SSO Start URL
              </label>
              <input
                type="url"
                value={ssoStartUrl}
                onChange={(e) => setSsoStartUrl(e.target.value)}
                placeholder="https://d-xxxxxxxxx.awsapps.com/start"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded px-4 py-2 text-body-md text-on-surface focus:border-primary outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-body-md font-medium text-on-surface mb-2">
                SSO Region
              </label>
              <input
                type="text"
                value={ssoRegion}
                onChange={(e) => setSsoRegion(e.target.value)}
                placeholder="us-east-1"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded px-4 py-2 text-body-md text-on-surface focus:border-primary outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-outline-variant">
            <p className="text-label-sm text-on-surface-variant font-mono">
              * Estos parámetros se guardan de forma segura en la base de datos local y automatizan el login OIDC.
            </p>
            <button
              type="submit"
              disabled={isSavingSso}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary font-medium text-body-md rounded hover:bg-primary/95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <HiOutlineSave className="w-4 h-4" />
              {isSavingSso ? "Guardando..." : "Guardar Configuración SSO"}
            </button>
          </div>
          {isSavingSso && (
            <p className="text-body-md text-tertiary font-medium">¡Configuración SSO guardada exitosamente!</p>
          )}
        </form>
      </div>

      {/* System Update Card */}
      <div className="bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden">
        <div className="px-6 py-4 bg-surface-container border-b border-outline-variant flex items-center gap-2">
          <div className="text-primary">
            <HiOutlineRefresh className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-headline-md font-semibold text-on-surface">Updates</h2>
            <p className="text-body-md text-on-surface-variant">Check for system updates and install the latest features.</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-body-md font-medium text-on-surface">
                Current Version: <span className="font-semibold text-on-surface">v{pkg.version}</span>
              </p>
              <p className="text-label-sm text-on-surface-variant font-mono">
                Updates are cryptographically verified to ensure security.
              </p>
            </div>
            <button
              onClick={handleCheckForUpdates}
              disabled={isCheckingForUpdates}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary font-medium text-body-md rounded hover:bg-primary/95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <HiOutlineRefresh className={`w-4 h-4 ${isCheckingForUpdates ? 'animate-spin' : ''}`} />
              {isCheckingForUpdates ? "Checking..." : "Check for Updates"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

