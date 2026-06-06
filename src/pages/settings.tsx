import React, { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
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
  HiOutlineArrowRight 
} from "react-icons/hi";
import pkg from "../../package.json";

export default function SettingsPage() {
  const [downloadDir, setDownloadDir] = useState<string>("~/Downloads/s3-explorer");
  const [validateChecksums, setValidateChecksums] = useState<boolean>(true);
  const [ssoStartUrl, setSsoStartUrl] = useState<string>("");
  const [ssoRegion, setSsoRegion] = useState<string>("us-east-1");
  const [activeProfile, setActiveProfile] = useState<string>("Ninguno");
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
    const profileName = localStorage.getItem("aws_sso_role_name") || localStorage.getItem("aws_sso_profile") || "Ninguno";
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
      setSsoFeedback("Configuración de SSO guardada");
      setTimeout(() => setSsoFeedback(null), 3000);
    }, 1000);
  };

  const handleUnlink = async () => {
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
    setActiveProfile("Ninguno");
    setIsConnected(false);

    await saveSetting("sso_start_url", "");
    await saveSetting("sso_region", "us-east-1");

    setSsoFeedback("Conexión desvinculada exitosamente");
    setTimeout(() => setSsoFeedback(null), 3000);
  };

  const handleSyncProfiles = async () => {
    setIsSyncingProfile(true);
    const profileName = localStorage.getItem("aws_sso_role_name") || localStorage.getItem("aws_sso_profile") || "Ninguno";
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
    <div className="p-margin max-w-5xl mx-auto w-full animate-in fade-in duration-500 text-on-surface">
      <div className="mb-margin">
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-unit">Configuración</h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant">Gestiona las preferencias locales y conexiones de AWS.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-margin">
        {/* Preferences & Directory Section (Span 2) */}
        <div className="lg:col-span-2 space-y-margin">
          
          {/* Environmental Preferences Section */}
          <section className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
            <div className="bg-surface-variant px-margin py-3 border-b border-outline-variant">
              <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                <HiOutlineFolder className="w-6 h-6 text-on-surface" />
                Preferencias de Entorno
              </h3>
            </div>
            
            <div className="p-margin space-y-gutter">
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="download_dir">
                  Directorio de Descarga Principal
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
                    {isSavingDir ? "Guardando..." : "Explorar..."}
                  </button>
                </div>
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-1 opacity-75">
                  Los archivos descargados desde los buckets se guardarán aquí por defecto.
                </p>
              </div>

              <div className="border-t border-outline-variant pt-gutter flex items-center justify-between">
                <div>
                  <h4 className="font-body-md text-body-md text-on-surface">Validación de Checksums</h4>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    Verificar la integridad de los archivos tras la descarga (MD5/SHA256).
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
                  <h4 className="font-body-md text-body-md text-on-surface">Descargas Concurrentes</h4>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    Permitir transferencias múltiples para optimizar el ancho de banda.
                  </p>
                </div>
                <select 
                  value={`${maxConcurrentDownloads} hilos`}
                  onChange={(e) => {
                    const val = parseInt(e.target.value.split(" ")[0], 10);
                    if (!isNaN(val)) handleConcurrentChange(val);
                  }}
                  className="bg-surface border border-outline-variant text-on-surface font-label-sm text-label-sm rounded px-3 py-2 focus:border-primary focus:ring-0 focus:outline-none transition-colors w-24 cursor-pointer"
                >
                  <option>4 hilos</option>
                  <option>8 hilos</option>
                  <option>16 hilos</option>
                </select>
              </div>
            </div>
          </section>

          {/* AWS SSO Configuration Section */}
          <section className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
            <div className="bg-surface-variant px-margin py-3 border-b border-outline-variant flex justify-between items-center">
              <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                <HiOutlineKey className="w-6 h-6 text-on-surface" />
                Configuración AWS SSO
              </h3>
              <span className={`border text-label-sm font-label-sm px-2 py-1 rounded flex items-center gap-1 bg-surface border-outline-variant ${
                isConnected ? "text-primary" : "text-on-surface-variant opacity-75"
              }`}>
                <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-primary animate-pulse" : "bg-outline"}`}></span>
                {isConnected ? "Conectado" : "Desconectado"}
              </span>
            </div>

            <form onSubmit={handleSaveSsoSettings} className="p-margin space-y-gutter">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                <div className="flex flex-col gap-2">
                  <label className="font-label-md text-label-md text-on-surface-variant">SSO Start URL</label>
                  <input 
                    type="url"
                    value={ssoStartUrl}
                    onChange={(e) => setSsoStartUrl(e.target.value)}
                    placeholder="https://d-xxxxxxxxx.awsapps.com/start"
                    className="bg-surface border border-outline-variant text-on-surface font-label-sm text-label-sm rounded px-3 py-2 focus:border-primary focus:ring-0 focus:outline-none transition-colors w-full"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-label-md text-label-md text-on-surface-variant">Región SSO</label>
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
                <label className="font-label-md text-label-md text-on-surface-variant">Perfil Activo (Profile)</label>
                <div className="flex gap-2">
                  <input 
                    className="flex-1 bg-surface border border-outline-variant text-on-surface font-label-sm text-label-sm rounded px-3 py-2 focus:border-primary focus:ring-0 focus:outline-none transition-colors" 
                    readOnly 
                    type="text" 
                    value={activeProfile}
                  />
                  <button 
                    type="button"
                    onClick={handleSyncProfiles}
                    className="bg-surface hover:bg-surface-bright text-on-surface px-3 py-2 rounded font-label-md text-label-md border border-outline-variant transition-colors cursor-pointer flex items-center justify-center" 
                    title="Sincronizar perfiles"
                  >
                    <HiOutlineRefresh className={`text-[18px] ${isSyncingProfile ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {ssoFeedback && (
                <p className="font-label-sm text-label-sm text-primary animate-in fade-in duration-300">
                  {ssoFeedback}
                </p>
              )}

              <div className="mt-margin pt-gutter border-t border-outline-variant flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={handleUnlink}
                  className="bg-surface hover:bg-surface-bright text-on-surface px-4 py-2 rounded font-label-md text-label-md border border-outline-variant transition-colors cursor-pointer"
                >
                  Desvincular
                </button>
                <button 
                  type="submit"
                  className="bg-primary hover:bg-primary-container text-on-primary px-4 py-2 rounded font-label-md text-label-md border border-transparent transition-colors cursor-pointer"
                >
                  {isSavingSso ? "Guardando..." : "Guardar Cambios"}
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
                Actualizaciones
              </h3>
            </div>
            <div className="p-margin flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-surface-bright border border-outline-variant flex items-center justify-center mb-4">
                <HiOutlineCheckCircle className="w-8 h-8 text-tertiary" />
              </div>
              <h4 className="font-body-lg text-body-lg text-on-surface font-semibold mb-1">S3 Explorer v{pkg.version}</h4>
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-4">
                {isCheckingForUpdates ? "Buscando actualizaciones..." : "El sistema está al día. Última comprobación hace poco."}
              </p>
              <button 
                onClick={handleCheckForUpdates}
                disabled={isCheckingForUpdates}
                className="w-full bg-surface hover:bg-surface-bright text-on-surface px-4 py-2 rounded font-label-md text-label-md border border-outline-variant transition-colors cursor-pointer disabled:opacity-50"
              >
                Buscar Actualizaciones
              </button>
            </div>
            <div className="px-margin py-3 bg-surface-container-low border-t border-outline-variant flex justify-between items-center">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Canal de release</span>
              <select 
                value={releaseChannel}
                onChange={(e) => handleReleaseChannelChange(e.target.value)}
                className="bg-transparent border-none text-on-surface font-label-sm text-label-sm focus:ring-0 py-0 pr-6 cursor-pointer"
              >
                <option value="Estable">Estable</option>
                <option value="Beta">Beta</option>
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
                Documentación y Soporte
              </h4>
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-4">
                Consulta la guía técnica para configuraciones avanzadas de IAM y políticas de bucket.
              </p>
              <a 
                onClick={handleOpenDoc}
                className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:text-primary-container transition-colors cursor-pointer" 
                href="#"
              >
                Ver Documentación 
                <HiOutlineArrowRight className="w-[16px] h-[16px]" />
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
