import React, { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useDatabase } from "../shared/hooks/useDatabase";
import { HiOutlineFolderOpen, HiOutlineSave, HiOutlineShieldCheck } from "react-icons/hi";

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

  return (
    <div className="p-8 max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      
      {/* Preferences Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Preferences</h2>
          <p className="text-sm text-gray-500">Manage your general application settings.</p>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Download Directory
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-600 truncate">
                {downloadDir || "No directory selected"}
              </div>
              <button
                onClick={handleSelectFolder}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium text-sm rounded-lg transition-colors border border-indigo-100 cursor-pointer"
              >
                <HiOutlineFolderOpen className="w-5 h-5" />
                Change Folder
              </button>
            </div>
            {isSavingDir && (
              <p className="mt-2 text-sm text-green-600 font-medium">Saved successfully!</p>
            )}
          </div>
        </div>
      </div>

      {/* Corporate AWS SSO Configuration Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center gap-2">
          <div className="text-indigo-600">
            <HiOutlineShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">AWS SSO Corporativo (Nativo)</h2>
            <p className="text-sm text-gray-500">Configura la URL de inicio del SSO de tu empresa para la autenticación sin AWS CLI.</p>
          </div>
        </div>

        <form onSubmit={handleSaveSsoSettings} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SSO Start URL
              </label>
              <input
                type="url"
                value={ssoStartUrl}
                onChange={(e) => setSsoStartUrl(e.target.value)}
                placeholder="https://d-xxxxxxxxx.awsapps.com/start"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SSO Region
              </label>
              <input
                type="text"
                value={ssoRegion}
                onChange={(e) => setSsoRegion(e.target.value)}
                placeholder="us-east-1"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              * Estos parámetros se guardan de forma segura en la base de datos local y automatizan el login OIDC.
            </p>
            <button
              type="submit"
              disabled={isSavingSso}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <HiOutlineSave className="w-5 h-5" />
              {isSavingSso ? "Guardando..." : "Guardar Configuración SSO"}
            </button>
          </div>
          {isSavingSso && (
            <p className="text-sm text-green-600 font-medium animate-pulse">¡Configuración SSO guardada exitosamente!</p>
          )}
        </form>
      </div>
    </div>
  );
}

