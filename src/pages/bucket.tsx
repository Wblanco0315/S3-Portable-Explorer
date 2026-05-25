import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  HiOutlineDatabase,
  HiOutlineLogin,
  HiOutlineKey,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlineChevronRight,
  HiOutlineLogout,
  HiOutlineShieldCheck,
  HiOutlineOfficeBuilding,
  HiOutlineChevronLeft,
  HiOutlineX,
} from "react-icons/hi";
import {
  setAwsCredentials,
  clearAwsCredentials,
  getBuckets,
  isAwsAuthenticated,
} from "../features/aws/s3Client";
import { getLocalSSOCredentials } from "../features/aws/awsCli";
import { GenericTable, Column } from "../components/GenericTable";
import { Breadcrumb } from "../components/Breadcrumb";
import { useDatabase } from "../shared/hooks/useDatabase";

export default function BucketPage() {
  const navigate = useNavigate();
  const { getSetting, saveSetting } = useDatabase();

  // Basic States
  const [isAuthenticated, setIsAuthenticated] = useState(isAwsAuthenticated());
  const [buckets, setBuckets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Tab Control: 'profile' (CLI profile) or 'native_sso'
  const [activeTab, setActiveTab] = useState<'profile' | 'native_sso'>('profile');

  // CLI Profile states
  const [ssoNeedsConfig, setSsoNeedsConfig] = useState(false);
  const [ssoNeedsLogin, setSsoNeedsLogin] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState<string[]>([]);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [profile, setProfile] = useState(
    localStorage.getItem("aws_sso_profile") || "default"
  );
  const [region, setRegion] = useState(
    localStorage.getItem("aws_region") || "us-east-1"
  );

  // Native SSO states
  const [ssoStartUrl, setSsoStartUrl] = useState("");
  const [ssoRegion, setSsoRegion] = useState("us-east-1");
  const [ssoAuthStep, setSsoAuthStep] = useState<'idle' | 'authorizing' | 'select_account' | 'select_role' | 'loading_credentials'>('idle');
  const [ssoUserCode, setSsoUserCode] = useState<string | null>(null);
  const [ssoVerificationUrl, setSsoVerificationUrl] = useState<string | null>(null);
  const [ssoStatusMessage, setSsoStatusMessage] = useState("");
  const [ssoAccounts, setSsoAccounts] = useState<any[]>([]);
  const [ssoRoles, setSsoRoles] = useState<any[]>([]);
  const [ssoSelectedAccount, setSsoSelectedAccount] = useState<any | null>(null);
  const [ssoSelectedRole, setSsoSelectedRole] = useState<any | null>(null);
  const [ssoToken, setSsoToken] = useState<string | null>(null);

  const ssoCancelledRef = useRef(false);

  // Search & Sort states
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "Name", direction: "asc" });

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const currentBuckets = useMemo(() => {
    let filtered = buckets.filter((b) =>
      b.Name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let valA: any = a[sortConfig.key];
      let valB: any = b[sortConfig.key];

      if (sortConfig.key === "CreationDate") {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      } else {
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [buckets, searchTerm, sortConfig]);

  // Mount effects
  useEffect(() => {
    // 1. Fetch CLI profiles (if any exist)
    import("../features/aws/awsCli").then(({ listAwsProfiles }) => {
      listAwsProfiles().then((profiles) => {
        if (profiles.length > 0) {
          setAvailableProfiles(profiles);
          const activeStoredProfile = localStorage.getItem("aws_sso_profile") || "default";
          if (profiles.includes(activeStoredProfile)) {
            setProfile(activeStoredProfile);
          } else if (profiles.includes("default")) {
            setProfile("default");
          } else {
            setProfile(profiles[0]);
          }
        }
      });
    });

    // 2. Fetch corporate settings from DB
    getSetting("sso_start_url").then((val) => {
      if (val) {
        setSsoStartUrl(val);
        // If settings exist, default tab to native SSO as it's the premium flow
        setActiveTab('native_sso');
      }
    });
    getSetting("sso_region").then((val) => {
      if (val) setSsoRegion(val);
    });

    // 3. Fetch buckets if already authenticated
    if (isAuthenticated && buckets.length === 0) {
      handleRefresh();
    }
  }, []);

  // Automatic SSO connect on refresh if using local CLI SSO profile
  useEffect(() => {
    const activeStoredProfile = localStorage.getItem("aws_sso_profile");
    const authMethod = localStorage.getItem("aws_auth_method");
    if (
      !isAuthenticated &&
      authMethod === "sso" &&
      activeStoredProfile
    ) {
      setTimeout(() => {
        handleProfileLogin(undefined, activeStoredProfile);
      }, 50);
    }
  }, []);

  // CLI Profile Connect
  const handleProfileLogin = async (e?: React.FormEvent, loginProfile?: string) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError("");
    setSsoNeedsConfig(false);
    setSsoNeedsLogin(false);

    const targetProfile = loginProfile || profile || localStorage.getItem("aws_sso_profile") || "default";
    try {
      const creds = await getLocalSSOCredentials(targetProfile);
      setAwsCredentials(
        creds.accessKeyId,
        creds.secretAccessKey,
        creds.sessionToken,
        region
      );

      localStorage.setItem("aws_sso_profile", targetProfile);
      localStorage.setItem("aws_region", region);
      localStorage.setItem("aws_auth_method", "sso");

      setProfile(targetProfile);

      const bucketList = await getBuckets();
      setBuckets(bucketList);
      setIsAuthenticated(true);

      const pendingRedirect = sessionStorage.getItem("redirect_after_login");
      if (pendingRedirect) {
        sessionStorage.removeItem("redirect_after_login");
        navigate(pendingRedirect);
      }
    } catch (err: any) {
      const errorMsg = err.message || "Failed to authenticate or fetch buckets";
      if (errorMsg.includes("Missing the following required SSO configuration values")) {
        setSsoNeedsConfig(true);
        setError("SSO is not configured for this profile.");
      } else if (
        errorMsg.toLowerCase().includes("expired") ||
        errorMsg.toLowerCase().includes("refresh failed") ||
        errorMsg.toLowerCase().includes("login first")
      ) {
        setSsoNeedsLogin(true);
        setError("Your SSO token has expired. You need to log in again.");
      } else {
        setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // NATIVE SSO FLOW IMPLEMENTATIONS

  const handleStartNativeSso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ssoStartUrl) {
      setError("Por favor configura un Start URL corporativo en Ajustes o en el formulario.");
      return;
    }

    setIsLoading(true);
    setError("");
    ssoCancelledRef.current = false;
    setSsoAuthStep('authorizing');
    setSsoStatusMessage("Registrando aplicación corporativa con AWS OIDC...");

    try {
      const { startSsoOidcFlow, pollForOidcToken, listAwsAccounts } = await import("../features/aws/awsSsoOidc");

      // Start Device Flow
      const auth = await startSsoOidcFlow(ssoStartUrl.trim(), ssoRegion.trim() || "us-east-1");

      if (ssoCancelledRef.current) return;

      setSsoUserCode(auth.userCode);
      setSsoVerificationUrl(auth.verificationUriComplete);

      // Open dynamic browser via Tauri opener
      try {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(auth.verificationUriComplete);
        setSsoStatusMessage("¡Navegador abierto! Confirma el código para iniciar sesión.");
      } catch (openErr) {
        console.warn("Navegador no abierto automáticamente", openErr);
        setSsoStatusMessage("Por favor ingresa al enlace abajo y digita el código de confirmación.");
      }

      // Poll OIDC access token
      const token = await pollForOidcToken(
        auth.clientId,
        auth.clientSecret,
        auth.deviceCode,
        auth.interval,
        ssoRegion.trim() || "us-east-1",
        (msg) => {
          if (!ssoCancelledRef.current) {
            setSsoStatusMessage(msg);
          }
        }
      );

      if (ssoCancelledRef.current) return;

      setSsoToken(token);
      setSsoAuthStep('select_account');
      setSsoStatusMessage("Obteniendo cuentas de AWS habilitadas...");

      // Fetch accounts
      const accountsList = await listAwsAccounts(token, ssoRegion.trim() || "us-east-1");
      setSsoAccounts(accountsList);

      if (accountsList.length === 0) {
        throw new Error("No tienes cuentas de AWS vinculadas a tu perfil corporativo de SSO.");
      }
    } catch (err: any) {
      console.error(err);
      if (!ssoCancelledRef.current) {
        setError(err.message || "Fallo en el inicio de sesión nativo de SSO.");
        setSsoAuthStep('idle');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAccount = async (account: any) => {
    setSsoSelectedAccount(account);
    setSsoAuthStep('select_role');
    setIsLoading(true);
    setError("");

    try {
      const { listAwsAccountRoles } = await import("../features/aws/awsSsoOidc");
      const rolesList = await listAwsAccountRoles(ssoToken!, account.accountId, ssoRegion.trim() || "us-east-1");
      setSsoRoles(rolesList);

      if (rolesList.length === 0) {
        throw new Error(`Tu usuario no tiene roles habilitados en la cuenta ${account.accountName}.`);
      }
    } catch (err: any) {
      setError(err.message || "Error cargando roles de la cuenta.");
      setSsoAuthStep('select_account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRole = async (role: any) => {
    setSsoSelectedRole(role);
    setSsoAuthStep('loading_credentials');
    setIsLoading(true);
    setError("");

    try {
      const { getRoleCredentials } = await import("../features/aws/awsSsoOidc");
      const creds = await getRoleCredentials(
        ssoToken!,
        ssoSelectedAccount.accountId,
        role.roleName,
        ssoRegion.trim() || "us-east-1"
      );

      // Save keys in memory client
      setAwsCredentials(
        creds.accessKeyId,
        creds.secretAccessKey,
        creds.sessionToken,
        ssoRegion.trim() || "us-east-1"
      );

      // Save persistent profile configs
      localStorage.setItem("aws_sso_profile", `sso-native-${ssoSelectedAccount.accountId}`);
      localStorage.setItem("aws_region", ssoRegion.trim() || "us-east-1");
      localStorage.setItem("aws_auth_method", "sso-native");

      // Save persistent SSO settings to SQLite
      await saveSetting("sso_start_url", ssoStartUrl.trim());
      await saveSetting("sso_region", ssoRegion.trim() || "us-east-1");

      // Fetch buckets!
      const bucketList = await getBuckets();
      setBuckets(bucketList);
      setIsAuthenticated(true);

      const pendingRedirect = sessionStorage.getItem("redirect_after_login");
      if (pendingRedirect) {
        sessionStorage.removeItem("redirect_after_login");
        navigate(pendingRedirect);
      }
    } catch (err: any) {
      setError(err.message || "Error obteniendo credenciales del rol.");
      setSsoAuthStep('select_role');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSso = () => {
    ssoCancelledRef.current = true;
    setSsoAuthStep('idle');
    setSsoUserCode(null);
    setSsoVerificationUrl(null);
    setSsoAccounts([]);
    setSsoRoles([]);
    setSsoSelectedAccount(null);
    setSsoSelectedRole(null);
    setSsoToken(null);
    setIsLoading(false);
    setError("");
  };

  // Log out S3 Session
  const handleLogout = () => {
    clearAwsCredentials();
    setIsAuthenticated(false);
    setBuckets([]);
    localStorage.removeItem("aws_sso_profile");
    localStorage.removeItem("aws_region");
    localStorage.removeItem("aws_auth_method");
    handleCancelSso();
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const bucketList = await getBuckets();
      setBuckets(bucketList);
    } catch (err: any) {
      setError(err.message || "Failed to fetch buckets");
    } finally {
      setIsLoading(false);
    }
  };

  const columns: Column<any>[] = [
    {
      key: "Name",
      header: "Name",
      sortable: true,
      render: (bucket) => (
        <div className="flex items-center gap-3">
          <div className="text-indigo-500 group-hover:scale-110 transition-transform">
            <HiOutlineDatabase size={22} />
          </div>
          <span className="text-indigo-600 font-bold group-hover:underline text-sm">
            {bucket.Name}
          </span>
        </div>
      ),
    },
    {
      key: "CreationDate",
      header: "Creation date",
      sortable: true,
      className: "text-gray-500 font-medium text-xs",
      render: (bucket) =>
        bucket.CreationDate
          ? new Date(bucket.CreationDate).toLocaleString()
          : "-",
    },
    {
      key: "Region",
      header: "AWS Region",
      render: () => (
        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 font-bold text-[9px] rounded-md uppercase border border-gray-200 tracking-wider">
          {region || ssoRegion || "us-east-1"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: () => (
        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="p-1 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100">
            <HiOutlineChevronRight size={18} />
          </div>
        </div>
      ),
    },
  ];

  // RENDERING UNAUTHENTICATED LOGIN CARDS
  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 dark:bg-slate-950 p-6 transition-colors duration-300">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-xl dark:shadow-slate-900/20 border border-gray-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-300">

          {/* Header */}
          <div className="p-8 text-center bg-gradient-to-b from-gray-50 to-white dark:from-slate-800/50 dark:to-slate-900 border-b border-gray-100 dark:border-slate-800">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center mx-auto mb-4 rotate-3 shadow-sm border border-indigo-200/50 dark:border-indigo-500/20">
              <HiOutlineKey className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 tracking-tight">
              AWS Access
            </h1>
            <p className="text-gray-500 dark:text-slate-400 mt-1.5 text-sm font-medium">
              Conexión para explorar buckets de S3
            </p>
          </div>

          {/* TABS CONTROL (Shown only when ssoAuthStep is idle, to let user switch connection modes) */}
          {ssoAuthStep === 'idle' && (
            <div className="flex border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('profile');
                  setError("");
                }}
                className={`flex-1 py-4 text-center font-bold text-xs border-b-2 transition-all uppercase tracking-wider cursor-pointer ${activeTab === 'profile'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
                  }`}
              >
                Local AWS Profile
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('native_sso');
                  setError("");
                }}
                className={`flex-1 py-4 text-center font-bold text-xs border-b-2 transition-all uppercase tracking-wider cursor-pointer ${activeTab === 'native_sso'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
                  }`}
              >
                Corporate SSO (Nativo)
              </button>
            </div>
          )}

          {/* Content Body */}
          <div className="p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-500/20 rounded-2xl text-sm font-semibold animate-in shake duration-500">
                {error}
              </div>
            )}

            {/* TAB 1: AWS CLI LOCAL PROFILES */}
            {activeTab === 'profile' && ssoAuthStep === 'idle' && (
              <form onSubmit={handleProfileLogin} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2 ml-1">
                    AWS Profile
                  </label>

                  {!isCreatingProfile ? (
                    <div className="flex gap-3">
                      <select
                        value={profile}
                        onChange={(e) => {
                          setProfile(e.target.value);
                          setSsoNeedsConfig(false);
                        }}
                        className="flex-1 px-5 py-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-medium text-gray-900 dark:text-slate-100"
                      >
                        {availableProfiles.length === 0 && (
                          <option value="default">default</option>
                        )}
                        {availableProfiles.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingProfile(true);
                          setProfile("");
                          setSsoNeedsConfig(false);
                        }}
                        className="px-6 py-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-bold rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap cursor-pointer"
                      >
                        New
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={profile}
                        onChange={(e) => {
                          setProfile(e.target.value);
                          setSsoNeedsConfig(false);
                        }}
                        placeholder="Profile name"
                        className="flex-1 px-5 py-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-medium text-gray-900 dark:text-slate-100"
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!profile) return;
                          try {
                            const { openTerminalForSSO } = await import("../features/aws/awsCli");
                            await openTerminalForSSO(profile);
                            setError(`Terminal opened. Configure '${profile}' and click Connect.`);
                            setIsCreatingProfile(false);
                            if (!availableProfiles.includes(profile)) {
                              setAvailableProfiles([...availableProfiles, profile]);
                            }
                          } catch (err: any) {
                            setError(err.message);
                          }
                        }}
                        className="px-6 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200/20 whitespace-nowrap cursor-pointer"
                      >
                        Config
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingProfile(false);
                          setProfile(availableProfiles.length > 0 ? availableProfiles[0] : "default");
                        }}
                        className="px-4 py-4 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {ssoNeedsConfig && (
                    <div className="mt-5 p-5 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-2xl animate-in slide-in-from-top-2">
                      <p className="text-sm text-orange-800 dark:text-orange-300 font-bold">
                        SSO not configured for '{profile}'
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const { openTerminalForSSO } = await import("../features/aws/awsCli");
                            await openTerminalForSSO(profile);
                            setSsoNeedsConfig(false);
                            setError("Configure SSO in terminal then click Connect.");
                          } catch (err: any) {
                            setError(err.message);
                          }
                        }}
                        className="mt-3 w-full py-2.5 bg-orange-600 text-white text-xs font-bold rounded-xl hover:bg-orange-700 transition-all shadow-md shadow-orange-100/20 cursor-pointer"
                      >
                        Configure SSO in Terminal
                      </button>
                    </div>
                  )}

                  {ssoNeedsLogin && (
                    <div className="mt-5 p-5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl animate-in slide-in-from-top-2">
                      <p className="text-sm text-amber-800 dark:text-amber-300 font-bold">
                        SSO Session Expired
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium leading-relaxed font-sans">
                        Your AWS SSO session has expired or is invalid. Click below to log in via your browser.
                      </p>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={async () => {
                          setIsLoading(true);
                          setError("");
                          try {
                            const { triggerSSOLogin } = await import("../features/aws/awsCli");
                            await triggerSSOLogin(profile);
                            setSsoNeedsLogin(false);
                            setError("SSO login completed. Connecting...");
                            await handleProfileLogin();
                          } catch (err: any) {
                            setError(err.message || "Failed to trigger SSO login");
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        className="mt-3 w-full py-2.5 bg-amber-600 dark:bg-amber-500/80 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-all shadow-md shadow-amber-100/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        Log in to AWS SSO
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2 ml-1">
                    AWS Region
                  </label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="us-east-1"
                    className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-medium text-gray-900 dark:text-slate-100"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <HiOutlineLogin className="w-6 h-6" />
                      Connect to AWS
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB 2: CORPORATE SSO NATIVE OIDC FLOW */}
            {activeTab === 'native_sso' && (
              <div className="space-y-6">

                {/* STEP IDLE: Form Inputs */}
                {ssoAuthStep === 'idle' && (
                  <form onSubmit={handleStartNativeSso} className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2 ml-1">
                        SSO Start URL Corporativa
                      </label>
                      <input
                        type="url"
                        value={ssoStartUrl}
                        onChange={(e) => setSsoStartUrl(e.target.value)}
                        placeholder="https://d-xxxxxxxxx.awsapps.com/start"
                        className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-medium text-gray-900 dark:text-slate-100"
                        required
                      />
                      <p className="text-[10px] text-gray-400 mt-1.5 ml-1">
                        * Solicita esta dirección al administrador de AWS de tu empresa. Puedes configurarla por defecto en la sección de <Link to="/settings" className="text-indigo-500 underline font-bold">Ajustes</Link>.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-2 ml-1">
                        SSO Región
                      </label>
                      <input
                        type="text"
                        value={ssoRegion}
                        onChange={(e) => setSsoRegion(e.target.value)}
                        placeholder="us-east-1"
                        className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none font-medium text-gray-900 dark:text-slate-100"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2 py-5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none cursor-pointer font-sans"
                    >
                      {isLoading ? (
                        <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <HiOutlineShieldCheck className="w-6 h-6" />
                          Iniciar Sesión Corporativo
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* STEP AUTHORIZING: Verification Code Display & Polling Indicator */}
                {ssoAuthStep === 'authorizing' && (
                  <div className="space-y-6 text-center animate-in fade-in duration-300">
                    <div className="p-5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl">
                      <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                        Hemos abierto el navegador de tu empresa para autorizar el inicio de sesión.
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 font-medium">
                        Si la página no abrió automáticamente, ingresa de manera manual a:
                      </p>
                      <a
                        href={ssoVerificationUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-bold underline mt-1.5 block truncate max-w-xs mx-auto font-mono"
                      >
                        {ssoVerificationUrl}
                      </a>
                    </div>

                    <div className="bg-slate-900 dark:bg-slate-950 p-6 rounded-2xl border border-slate-800 relative overflow-hidden shadow-inner">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block mb-1.5">
                        Código de Validación
                      </span>
                      <span className="text-3xl font-mono font-black tracking-widest text-emerald-400 block selection:bg-emerald-500/30">
                        {ssoUserCode}
                      </span>
                    </div>

                    <div className="flex items-center justify-center gap-3">
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
                        {ssoStatusMessage || "Esperando aprobación..."}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCancelSso}
                      className="w-full py-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-2xl font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <HiOutlineX className="w-5 h-5" />
                      Cancelar Conexión
                    </button>
                  </div>
                )}

                {/* STEP SELECT ACCOUNT: Accounts Listing */}
                {ssoAuthStep === 'select_account' && (
                  <div className="space-y-5 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                      <HiOutlineOfficeBuilding className="text-indigo-600 w-5 h-5" />
                      <h3 className="text-base font-bold text-gray-800 dark:text-slate-200">
                        Selecciona tu Cuenta AWS
                      </h3>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {ssoAccounts.map((acc) => (
                        <button
                          key={acc.accountId}
                          type="button"
                          onClick={() => handleSelectAccount(acc)}
                          className="w-full text-left p-4 bg-gray-50 hover:bg-indigo-50/50 dark:bg-slate-800/40 dark:hover:bg-indigo-950/20 border border-gray-200 hover:border-indigo-300/50 dark:border-slate-700 dark:hover:border-indigo-500/20 rounded-2xl transition-all flex items-center justify-between group cursor-pointer"
                        >
                          <div>
                            <span className="block font-bold text-sm text-gray-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {acc.accountName}
                            </span>
                            <span className="block text-xs font-semibold text-gray-400 dark:text-slate-500 font-mono mt-0.5">
                              ID: {acc.accountId}
                            </span>
                          </div>
                          <HiOutlineChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleCancelSso}
                      className="w-full py-4 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    >
                      Volver al Inicio
                    </button>
                  </div>
                )}

                {/* STEP SELECT ROLE: Roles Listing */}
                {ssoAuthStep === 'select_role' && (
                  <div className="space-y-5 animate-in fade-in duration-300">
                    <div className="pb-2 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HiOutlineShieldCheck className="text-indigo-600 w-5 h-5" />
                        <h3 className="text-base font-bold text-gray-800 dark:text-slate-200">
                          Selecciona tu Rol de IAM
                        </h3>
                      </div>
                      <span className="text-[10px] font-extrabold text-gray-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                        {ssoSelectedAccount?.accountName}
                      </span>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {ssoRoles.map((role) => (
                        <button
                          key={role.roleName}
                          type="button"
                          onClick={() => handleSelectRole(role)}
                          className="w-full text-left p-4 bg-gray-50 hover:bg-indigo-50/50 dark:bg-slate-800/40 dark:hover:bg-indigo-950/20 border border-gray-200 hover:border-indigo-300/50 dark:border-slate-700 dark:hover:border-indigo-500/20 rounded-2xl transition-all flex items-center justify-between group cursor-pointer"
                        >
                          <div>
                            <span className="block font-bold text-sm text-gray-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {role.roleName}
                            </span>
                          </div>
                          <HiOutlineChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSsoAuthStep('select_account');
                          setSsoRoles([]);
                        }}
                        className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <HiOutlineChevronLeft className="w-4 h-4" />
                        Atrás
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelSso}
                        className="flex-1 py-4 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-2xl font-bold transition-all cursor-pointer border border-transparent dark:border-red-500/10"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP LOADING CREDENTIALS: Spin indicator */}
                {ssoAuthStep === 'loading_credentials' && (
                  <div className="space-y-5 text-center py-6 animate-in fade-in duration-300">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <h3 className="text-base font-bold text-gray-800 dark:text-slate-200">
                      Obteniendo credenciales de AWS...
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed max-w-xs mx-auto font-medium">
                      Generando llaves temporales y tokens de sesión para el rol {ssoSelectedRole?.roleName}.
                    </p>
                  </div>
                )}

              </div>
            )}
          </div>

        </div>
      </div>
    );
  }

  // RENDERING AUTHENTICATED S3 BUCKET VIEWS (Main Screen)
  return (
    <div className="h-full w-full flex-1 flex flex-col bg-gray-50 dark:bg-slate-950 p-4 md:p-8 font-sans text-gray-900 dark:text-slate-100 transition-colors duration-300">
      <div className="h-full w-full mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <Breadcrumb
              items={[
                { label: "Amazon S3", path: "/" },
                { label: "Buckets", active: true },
              ]}
            />
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
              <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200/50 dark:border-indigo-500/20">
                <HiOutlineDatabase size={20} />
              </div>
              Buckets
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 font-bold rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Refresh buckets list"
            >
              <HiOutlineRefresh
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold rounded-2xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-all active:scale-95 border border-red-100 dark:border-red-500/20 cursor-pointer"
              title="Sign out"
            >
              Sign out
              <HiOutlineLogout className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-500/20 rounded-2xl text-sm font-bold animate-in slide-in-from-top-2">
            {error}
          </div>
        )}

        {/* Main Explorer Container */}
        <div className="h-max bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-slate-950/40 flex flex-col overflow-hidden">

          {/* Toolbar */}
          <div className="px-5 py-4 bg-white dark:bg-slate-900 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="relative w-full max-w-md">
              <HiOutlineSearch
                className="absolute left-3.5 top-2.5 text-gray-400 dark:text-slate-500"
                size={18}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Find buckets by name..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all outline-none font-medium text-xs text-gray-900 dark:text-slate-100"
                aria-label="Search buckets"
              />
            </div>
            <div className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
              {currentBuckets.length} / {buckets.length} Buckets
            </div>
          </div>

          <GenericTable
            items={currentBuckets}
            columns={columns}
            isLoading={isLoading}
            rowKey={(b) => b.Name}
            onRowClick={(b) => navigate(`/buckets/${b.Name}`)}
            sortConfig={sortConfig}
            onSort={handleSort}
            emptyMessage="No buckets found"
            emptyIcon={<HiOutlineDatabase size={24} />}
          />
        </div>
      </div>
    </div>
  );
}
