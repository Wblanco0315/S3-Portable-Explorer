import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  HiOutlineDatabase,
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
  getAwsAccountDisplayName,
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
  const [ssoAuthStep, setSsoAuthStep] = useState<'select_method' | 'idle' | 'authorizing' | 'select_account' | 'select_role' | 'loading_credentials'>('select_method');
  const [ssoUserCode, setSsoUserCode] = useState<string | null>(null);
  const [ssoVerificationUrl, setSsoVerificationUrl] = useState<string | null>(null);
  const [ssoStatusMessage, setSsoStatusMessage] = useState("");
  const [ssoAccounts, setSsoAccounts] = useState<any[]>([]);
  const [ssoRoles, setSsoRoles] = useState<any[]>([]);
  const [ssoSelectedAccount, setSsoSelectedAccount] = useState<any | null>(null);
  const [ssoSelectedRole, setSsoSelectedRole] = useState<any | null>(null);
  const [ssoToken, setSsoToken] = useState<string | null>(null);
  const [isEditingSsoConfig, setIsEditingSsoConfig] = useState(false);

  const [accountSearchTerm, setAccountSearchTerm] = useState("");

  const filteredSsoAccounts = useMemo(() => {
    return ssoAccounts.filter((acc: any) =>
      (acc.accountName || "").toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      (acc.accountId || "").toLowerCase().includes(accountSearchTerm.toLowerCase())
    );
  }, [ssoAccounts, accountSearchTerm]);



  const ssoCancelledRef = useRef(false);

  const hasValidSsoToken = () => {
    const storedToken = localStorage.getItem("aws_sso_token");
    const expiresAtStr = localStorage.getItem("aws_sso_token_expires_at");
    if (!storedToken || !expiresAtStr) return false;
    const expiresAt = parseInt(expiresAtStr, 10);
    return !isNaN(expiresAt) && expiresAt > Date.now();
  };

  const handleClearSsoSession = () => {
    localStorage.removeItem("aws_sso_token");
    localStorage.removeItem("aws_sso_token_expires_at");
    localStorage.removeItem("aws_sso_account_id");
    localStorage.removeItem("aws_sso_account_name");
    localStorage.removeItem("aws_sso_role_name");
    localStorage.removeItem("aws_credentials_expires_at");
    localStorage.removeItem("aws_auth_method");
    setSsoToken(null);
    setSsoAccounts([]);
    setSsoRoles([]);
    setSsoSelectedAccount(null);
    setSsoSelectedRole(null);
    setError("");
    setSsoAuthStep('idle');
  };

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

  const restoreNativeSsoSession = async () => {
    const storedToken = localStorage.getItem("aws_sso_token");
    const expiresAtStr = localStorage.getItem("aws_sso_token_expires_at");
    const targetRegion = localStorage.getItem("aws_region") || ssoRegion || "us-east-1";

    if (!storedToken || !expiresAtStr) {
      return false;
    }

    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || expiresAt < Date.now()) {
      // Token expired, clear it
      localStorage.removeItem("aws_sso_token");
      localStorage.removeItem("aws_sso_token_expires_at");
      return false;
    }

    setIsLoading(true);
    setError("");
    setSsoToken(storedToken);
    setActiveTab("native_sso");

    try {
      const { getRoleCredentials, listAwsAccounts } = await import("../features/aws/awsSsoOidc");

      const storedAccountId = localStorage.getItem("aws_sso_account_id");
      const storedAccountName = localStorage.getItem("aws_sso_account_name");
      const storedRoleName = localStorage.getItem("aws_sso_role_name");

      if (storedAccountId && storedRoleName) {
        setSsoStatusMessage("Restaurando credenciales de rol AWS...");
        setSsoAuthStep('loading_credentials');

        try {
          const creds = await getRoleCredentials(
            storedToken,
            storedAccountId,
            storedRoleName,
            targetRegion
          );

          setAwsCredentials(creds.accessKeyId, creds.secretAccessKey, creds.sessionToken, targetRegion);

          setSsoSelectedAccount({ accountId: storedAccountId, accountName: storedAccountName || storedAccountId });
          setSsoSelectedRole({ roleName: storedRoleName });

          const bucketList = await getBuckets();
          setBuckets(bucketList);
          setIsAuthenticated(true);
          setIsLoading(false);
          return true;
        } catch (credErr: any) {
          console.warn("Could not auto-login to saved role. Falling back to account list.", credErr);
        }
      }

      // If no stored role/account or auto-login failed, fall back to account list
      setSsoStatusMessage("Obteniendo cuentas de AWS habilitadas...");
      setSsoAuthStep('select_account');
      const accountsList = await listAwsAccounts(storedToken, targetRegion);
      setSsoAccounts(accountsList);

      if (accountsList.length === 0) {
        throw new Error("No tienes cuentas de AWS vinculadas a tu perfil de SSO.");
      }
      setIsLoading(false);
      return true;
    } catch (err: any) {
      console.error("Failed to restore SSO session:", err);
      setError(err.message || "No se pudo restaurar la sesión de SSO.");
      setSsoAuthStep('idle');
      setIsLoading(false);
      return false;
    }
  };

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

      const storedToken = localStorage.getItem("aws_sso_token");
      const expiresAtStr = localStorage.getItem("aws_sso_token_expires_at");
      const hasToken = storedToken && expiresAtStr && parseInt(expiresAtStr, 10) > Date.now();

      if (hasToken && !isAwsAuthenticated()) {
        restoreNativeSsoSession();
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

  const handleStartNativeSso = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ssoStartUrl) {
      setError("Por favor configura un Start URL corporativo en Ajustes o en el formulario.");
      return;
    }

    setIsLoading(true);
    setError("");
    ssoCancelledRef.current = false;

    // Check if we already have a valid token to bypass browser authentication
    const storedToken = localStorage.getItem("aws_sso_token");
    const expiresAtStr = localStorage.getItem("aws_sso_token_expires_at");
    const targetRegion = localStorage.getItem("aws_region") || ssoRegion || "us-east-1";

    if (storedToken && expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      if (!isNaN(expiresAt) && expiresAt > Date.now()) {
        setSsoToken(storedToken);
        setSsoAuthStep('select_account');
        setSsoStatusMessage("Obteniendo cuentas de AWS habilitadas...");

        try {
          const { listAwsAccounts } = await import("../features/aws/awsSsoOidc");
          const accountsList = await listAwsAccounts(storedToken, targetRegion);
          setSsoAccounts(accountsList);

          if (accountsList.length === 0) {
            throw new Error("No tienes cuentas de AWS vinculadas a tu perfil corporativo de SSO.");
          }
          setIsLoading(false);
          return;
        } catch (err: any) {
          console.warn("Stored SSO token failed, falling back to new flow", err);
          // fall through to start new flow
        }
      }
    }

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
      const tokenData = await pollForOidcToken(
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

      const token = tokenData.accessToken;
      const expiresAt = Date.now() + tokenData.expiresIn * 1000;

      localStorage.setItem("aws_sso_token", token);
      localStorage.setItem("aws_sso_token_expires_at", expiresAt.toString());

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
      localStorage.setItem("aws_sso_account_id", ssoSelectedAccount.accountId);
      localStorage.setItem("aws_sso_account_name", ssoSelectedAccount.accountName || "");
      localStorage.setItem("aws_sso_role_name", role.roleName);

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
    setSsoAuthStep('select_method');
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
  const handleLogout = async () => {
    clearAwsCredentials();
    setIsAuthenticated(false);
    setBuckets([]);
    localStorage.removeItem("aws_sso_profile");
    localStorage.removeItem("aws_sso_account_id");
    localStorage.removeItem("aws_sso_account_name");
    localStorage.removeItem("aws_sso_role_name");
    localStorage.removeItem("aws_credentials_expires_at");

    // Check if we have a valid SSO token to show accounts list
    const storedToken = localStorage.getItem("aws_sso_token");
    const expiresAtStr = localStorage.getItem("aws_sso_token_expires_at");
    const targetRegion = localStorage.getItem("aws_region") || ssoRegion || "us-east-1";

    if (storedToken && expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      if (!isNaN(expiresAt) && expiresAt > Date.now()) {
        // We have a valid SSO token, show the accounts list directly!
        setIsLoading(true);
        setError("");
        setSsoToken(storedToken);
        setActiveTab("native_sso");
        setSsoAuthStep('select_account');
        setSsoStatusMessage("Obteniendo cuentas de AWS habilitadas...");
        try {
          const { listAwsAccounts } = await import("../features/aws/awsSsoOidc");
          const accountsList = await listAwsAccounts(storedToken, targetRegion);
          setSsoAccounts(accountsList);
          setIsLoading(false);
          return;
        } catch (err: any) {
          console.error("Failed to list accounts on logout:", err);
          setError(err.message || "No se pudieron cargar las cuentas de AWS.");
        }
      }
    }

    // If no valid token or error listing accounts, reset fully to idle
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
          <div className="text-primary group-hover:scale-105 transition-transform">
            <HiOutlineDatabase size={22} />
          </div>
          <span className="text-primary font-bold hover:underline text-body-md">
            {bucket.Name}
          </span>
        </div>
      ),
    },
    {
      key: "CreationDate",
      header: "Creation date",
      sortable: true,
      className: "text-on-surface-variant font-medium text-body-md",
      render: (bucket) =>
        bucket.CreationDate
          ? new Date(bucket.CreationDate).toLocaleString()
          : "-",
    },
    {
      key: "Region",
      header: "AWS Region",
      render: () => (
        <span className="px-1.5 py-0.5 bg-surface-container-high text-on-surface-variant font-medium text-label-sm rounded-sm uppercase border border-outline-variant tracking-wider font-mono">
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
          <div className="p-1 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container-highest transition-colors">
            <HiOutlineChevronRight size={18} />
          </div>
        </div>
      ),
    },
  ];

  // RENDERING UNAUTHENTICATED LOGIN CARDS
  if (!isAuthenticated) {
    return (
      <div className="h-full w-full flex flex-col bg-surface p-4 md:p-8 transition-colors duration-300">
        <div className="w-full mx-auto flex-1 bg-surface-container-low rounded-lg border border-outline-variant overflow-hidden transition-all duration-300 flex flex-col min-h-[600px]">

          {/* Wizard Progress Header */}
          <div className="border-b border-outline-variant bg-surface-container-low px-6 py-4 shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-surface-container-high text-primary flex items-center justify-center border border-outline-variant">
                  {activeTab === 'native_sso' ? (
                    <HiOutlineShieldCheck className="w-5.5 h-5.5" />
                  ) : (
                    <HiOutlineKey className="w-5.5 h-5.5" />
                  )}
                </div>
                <div>
                  <h2 className="text-headline-md font-bold text-on-surface tracking-tight">
                    {activeTab === 'native_sso' ? "AWS Enterprise SSO" : "AWS Access Local"}
                  </h2>
                  <p className="text-body-md text-on-surface-variant">
                    {ssoAuthStep === 'select_method'
                      ? "Selecciona un método de conexión"
                      : ssoAuthStep === 'idle'
                        ? "Configura las credenciales de acceso"
                        : ssoAuthStep === 'authorizing'
                          ? "Autoriza la sesión en tu navegador"
                          : ssoAuthStep === 'select_account'
                            ? "Elige una cuenta de AWS"
                            : ssoAuthStep === 'select_role'
                              ? "Selecciona tu rol de IAM"
                              : "Cargando credenciales de AWS"}
                  </p>
                </div>
              </div>

              {/* Dynamic Steps Indicators */}
              <div className="flex items-center space-x-2 md:space-x-3">
                {activeTab === 'native_sso' ? (
                  <>
                    {/* Step 1: Connect */}
                    <div className="flex items-center gap-2">
                      <span className={`w-8 h-8 rounded-sm font-bold text-label-md font-mono flex items-center justify-center transition-all ${ssoAuthStep === 'select_method' || ssoAuthStep === 'idle' || ssoAuthStep === 'authorizing'
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant border border-outline-variant'
                        }`}>
                        1
                      </span>
                      <span className={`text-body-md font-bold hidden sm:inline ${ssoAuthStep === 'select_method' || ssoAuthStep === 'idle' || ssoAuthStep === 'authorizing'
                        ? 'text-on-surface'
                        : 'text-on-surface-variant font-medium'
                        }`}>
                        Conectar
                      </span>
                    </div>
                    <div className="w-6 h-0.5 bg-outline-variant"></div>

                    {/* Step 2: Account */}
                    <div className={`flex items-center gap-2 ${ssoAuthStep === 'select_account' || ssoAuthStep === 'select_role' || ssoAuthStep === 'loading_credentials'
                      ? ''
                      : 'opacity-50'
                      }`}>
                      <span className={`w-8 h-8 rounded-sm font-bold text-label-md font-mono flex items-center justify-center transition-all ${ssoAuthStep === 'select_account'
                        ? 'bg-primary text-on-primary'
                        : ssoAuthStep === 'select_role' || ssoAuthStep === 'loading_credentials'
                          ? 'bg-surface-container-high text-on-surface-variant border border-outline-variant'
                          : 'bg-surface-container-low text-on-surface-variant border border-outline-variant'
                        }`}>
                        2
                      </span>
                      <span className={`text-body-md font-bold hidden sm:inline ${ssoAuthStep === 'select_account'
                        ? 'text-on-surface'
                        : 'text-on-surface-variant'
                        }`}>
                        Cuentas
                      </span>
                    </div>
                    <div className="w-6 h-0.5 bg-outline-variant"></div>

                    {/* Step 3: Role */}
                    <div className={`flex items-center gap-2 ${ssoAuthStep === 'select_role' || ssoAuthStep === 'loading_credentials'
                      ? ''
                      : 'opacity-50'
                      }`}>
                      <span className={`w-8 h-8 rounded-sm font-bold text-label-md font-mono flex items-center justify-center transition-all ${ssoAuthStep === 'select_role' || ssoAuthStep === 'loading_credentials'
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-low text-on-surface-variant border border-outline-variant'
                        }`}>
                        3
                      </span>
                      <span className={`text-body-md font-bold hidden sm:inline ${ssoAuthStep === 'select_role' || ssoAuthStep === 'loading_credentials'
                        ? 'text-on-surface'
                        : 'text-on-surface-variant'
                        }`}>
                        Roles
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Local profile steps */}
                    <div className="flex items-center gap-2">
                      <span className={`w-8 h-8 rounded-sm font-bold text-label-md font-mono flex items-center justify-center transition-all ${ssoAuthStep === 'select_method' || ssoAuthStep === 'idle'
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant border border-outline-variant'
                        }`}>
                        1
                      </span>
                      <span className={`text-body-md font-bold hidden sm:inline ${ssoAuthStep === 'select_method' || ssoAuthStep === 'idle'
                        ? 'text-on-surface'
                        : 'text-on-surface-variant font-medium'
                        }`}>
                        Conectar
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Wizard Main Content Area */}
          <div className="flex-1 h-auto p-6 sm:p-8 flex flex-col justify-center bg-surface">
            {error && (
              <div className="mb-6 p-4 bg-error-container text-on-error-container border border-error/20 rounded text-body-md font-medium animate-in shake duration-500">
                {error}
              </div>
            )}

            {/* STEP 1: SELECT METHOD */}
            {ssoAuthStep === 'select_method' && (
              <div className="space-y-6 max-w-5xl mx-auto w-full py-4 animate-in fade-in duration-300">
                <div className="text-center space-y-2 mb-6">
                  <h3 className="text-headline-lg font-bold text-on-surface">Método de Autenticación</h3>
                  <p className="text-body-md text-on-surface-variant">Selecciona cómo deseas autenticarte con tu cuenta de AWS.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Card A: Local AWS Profile */}
                  <div
                    onClick={() => {
                      setActiveTab('profile');
                      setSsoAuthStep('idle');
                      setError("");
                    }}
                    className={`border p-6 rounded-lg cursor-pointer transition-all duration-200 flex flex-col items-center text-center space-y-4 group ${activeTab === 'profile'
                      ? 'border-primary bg-surface-container-high ring-1 ring-primary/20'
                      : 'border-outline-variant bg-surface-container-low hover:border-outline hover:bg-surface-container'
                      }`}
                  >
                    <div className={`w-14 h-14 rounded flex items-center justify-center border transition-transform duration-300 ${activeTab === 'profile'
                      ? 'bg-surface-container-highest text-primary border-primary'
                      : 'bg-surface-container text-on-surface-variant border-outline-variant'
                      }`}>
                      <HiOutlineKey className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-bold text-headline-md text-on-surface">Local AWS Profile</h4>
                      <p className="text-body-md text-on-surface-variant leading-relaxed max-w-xs">
                        Autentícate usando los archivos de credenciales locales del sistema (.aws/credentials).
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-sm text-label-sm font-mono font-medium uppercase tracking-wider ${activeTab === 'profile'
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container text-on-surface-variant border border-outline-variant'
                      }`}>
                      Direct Connect
                    </span>
                  </div>

                  {/* Card B: Corporate SSO */}
                  <div
                    onClick={() => {
                      setActiveTab('native_sso');
                      setSsoAuthStep('idle');
                      setError("");
                    }}
                    className={`border p-6 rounded-lg cursor-pointer transition-all duration-200 flex flex-col items-center text-center space-y-4 group ${activeTab === 'native_sso'
                      ? 'border-primary bg-surface-container-high ring-1 ring-primary/20'
                      : 'border-outline-variant bg-surface-container-low hover:border-outline hover:bg-surface-container'
                      }`}
                  >
                    <div className={`w-14 h-14 rounded flex items-center justify-center border transition-transform duration-300 ${activeTab === 'native_sso'
                      ? 'bg-surface-container-highest text-primary border-primary'
                      : 'bg-surface-container text-on-surface-variant border-outline-variant'
                      }`}>
                      <HiOutlineShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-bold text-headline-md text-on-surface">Corporate SSO (Nativo)</h4>
                      <p className="text-body-md text-on-surface-variant leading-relaxed max-w-xs">
                        Inicia sesión de forma nativa a través del portal de AWS IAM Identity Center corporativo.
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-sm text-label-sm font-mono font-medium uppercase tracking-wider ${activeTab === 'native_sso'
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container text-on-surface-variant border border-outline-variant'
                      }`}>
                      Enterprise Identity
                    </span>
                  </div>
                </div>
              </div>
            )}
            {/* STEP 2: IDLE (CONNECTION FORM) */}
            {ssoAuthStep === 'idle' && (
              <div className="space-y-6 max-w-lg mx-auto w-full py-4 animate-in fade-in duration-300">
                {activeTab === 'profile' ? (
                  // Local Profile Configuration Form
                  <form onSubmit={handleProfileLogin} className="space-y-4">
                    <div className="text-center space-y-2 mb-4">
                      <h3 className="text-headline-md font-bold text-on-surface">Configurar Perfil AWS</h3>
                      <p className="text-body-md text-on-surface-variant">Selecciona el perfil local y la región para explorar.</p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-label-sm uppercase tracking-wider text-on-surface-variant font-mono">AWS Profile</label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingProfile(true);
                            setProfile("");
                            setSsoNeedsConfig(false);
                          }}
                          className="text-label-sm font-bold text-primary uppercase tracking-wider hover:underline flex items-center gap-1 cursor-pointer font-mono"
                        >
                          + Nuevo
                        </button>
                      </div>

                      {!isCreatingProfile ? (
                        <select
                          value={profile}
                          onChange={(e) => {
                            setProfile(e.target.value);
                            setSsoNeedsConfig(false);
                          }}
                          className="w-full px-3 py-2 rounded border border-outline-variant bg-surface-container text-body-md text-on-surface focus:outline-none focus:border-primary transition-all font-mono"
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
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={profile}
                            onChange={(e) => {
                              setProfile(e.target.value);
                              setSsoNeedsConfig(false);
                            }}
                            placeholder="Nombre del perfil"
                            className="flex-1 px-3 py-2 rounded border border-outline-variant bg-surface-container text-body-md text-on-surface focus:outline-none focus:border-primary transition-all font-mono"
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
                                setError(`Consola abierta. Configura '${profile}' y conéctate.`);
                                setIsCreatingProfile(false);
                                if (!availableProfiles.includes(profile)) {
                                  setAvailableProfiles([...availableProfiles, profile]);
                                }
                              } catch (err: any) {
                                setError(err.message);
                              }
                            }}
                            className="px-4 py-2 bg-primary hover:bg-primary/95 text-on-primary text-label-sm font-bold rounded cursor-pointer transition-colors"
                          >
                            Configurar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingProfile(false);
                              setProfile(availableProfiles.length > 0 ? availableProfiles[0] : "default");
                            }}
                            className="px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant text-label-sm font-bold rounded cursor-pointer transition-colors border border-outline-variant"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-label-sm uppercase tracking-wider text-on-surface-variant font-mono">AWS Region</label>
                      <input
                        type="text"
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        placeholder="us-east-1"
                        className="w-full px-3 py-2 rounded border border-outline-variant bg-surface-container text-body-md text-on-surface focus:outline-none focus:border-primary transition-all font-mono"
                        required
                      />
                    </div>

                    {ssoNeedsConfig && (
                      <div className="p-4 bg-surface-container border border-outline-variant rounded animate-in slide-in-from-top-2">
                        <p className="text-body-md text-primary font-bold">
                          SSO no está configurado para '${profile}'
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { openTerminalForSSO } = await import("../features/aws/awsCli");
                              await openTerminalForSSO(profile);
                              setSsoNeedsConfig(false);
                              setError("Configura SSO en la consola y presiona Conectar.");
                            } catch (err: any) {
                              setError(err.message);
                            }
                          }}
                          className="mt-2.5 w-full py-2 bg-primary text-on-primary text-label-sm font-bold rounded hover:bg-primary/95 transition-all cursor-pointer"
                        >
                          Configurar SSO en consola
                        </button>
                      </div>
                    )}

                    {ssoNeedsLogin && (
                      <div className="p-4 bg-surface-container border border-outline-variant rounded animate-in slide-in-from-top-2">
                        <p className="text-body-md text-primary font-bold">
                          Sesión SSO Expirada
                        </p>
                        <p className="text-body-md text-on-surface-variant mt-1.5 font-medium leading-relaxed font-sans">
                          La sesión ha expirado. Haz clic abajo para re-autenticarte en el navegador.
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
                              setError("Sesión SSO iniciada. Conectando...");
                              await handleProfileLogin();
                            } catch (err: any) {
                              setError(err.message || "Error al iniciar sesión SSO");
                            } finally {
                              setIsLoading(false);
                            }
                          }}
                          className="mt-2.5 w-full py-2 bg-primary text-on-primary text-label-sm font-bold rounded hover:bg-primary/95 transition-all cursor-pointer"
                        >
                          Iniciar Sesión en AWS SSO
                        </button>
                      </div>
                    )}
                  </form>
                ) : (
                  // Native SSO Configuration Form
                  <div className="space-y-4">
                    {ssoStartUrl && !isEditingSsoConfig ? (
                      <div className="space-y-4">
                        <div className="text-center space-y-2 mb-4">
                          <h3 className="text-headline-md font-bold text-on-surface">Conexión SSO Corporativa</h3>
                          <p className="text-body-md text-on-surface-variant">Utiliza la URL de inicio configurada a continuación.</p>
                        </div>

                        <div className="p-4 bg-surface-container border border-outline-variant rounded-lg">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-label-sm uppercase font-bold tracking-widest text-on-surface-variant font-mono">Configuración SSO Activa</span>
                            <button
                              type="button"
                              onClick={() => setIsEditingSsoConfig(true)}
                              className="px-2.5 py-1 text-label-sm font-mono text-primary bg-surface-container-high border border-outline-variant hover:bg-surface-container-highest rounded transition-all cursor-pointer"
                            >
                              Editar
                            </button>
                          </div>
                          <div className="space-y-2">
                            <div className="text-body-md font-semibold text-on-surface break-all font-mono">
                              <span className="text-on-surface-variant font-medium mr-1.5 font-sans">Start URL:</span>
                              {ssoStartUrl}
                            </div>
                            <div className="text-body-md font-semibold text-on-surface-variant uppercase tracking-wide font-mono">
                              <span className="text-on-surface-variant font-medium mr-1.5 normal-case font-sans">Región:</span>
                              {ssoRegion || "us-east-1"}
                            </div>
                          </div>
                        </div>

                        {hasValidSsoToken() && (
                          <div className="flex items-center justify-between p-4 bg-surface-container border border-outline-variant rounded-lg">
                            <div className="flex items-center gap-2.5 text-primary">
                              <HiOutlineShieldCheck className="w-5 h-5 shrink-0" />
                              <span className="text-body-md font-bold">Sesión SSO Activa</span>
                            </div>
                            <button
                              type="button"
                              onClick={handleClearSsoSession}
                              className="px-3 py-1.5 text-label-sm font-mono text-error bg-surface-container-high border border-outline-variant hover:bg-surface-container-highest rounded transition-all cursor-pointer"
                            >
                              Cerrar Sesión SSO
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-center space-y-2 mb-4">
                          <h3 className="text-headline-md font-bold text-on-surface">Configurar SSO</h3>
                          <p className="text-body-md text-on-surface-variant">Ingresa la URL del portal corporativo de Identity Center.</p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-label-sm uppercase tracking-wider text-on-surface-variant font-mono">SSO Start URL</label>
                          <input
                            type="url"
                            value={ssoStartUrl}
                            onChange={(e) => setSsoStartUrl(e.target.value)}
                            placeholder="https://d-xxxxxxxxx.awsapps.com/start"
                            className="w-full px-3 py-2 rounded border border-outline-variant bg-surface-container text-body-md text-on-surface focus:outline-none focus:border-primary transition-all font-mono"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-label-sm uppercase tracking-wider text-on-surface-variant font-mono">SSO Portal Region</label>
                          <input
                            type="text"
                            value={ssoRegion}
                            onChange={(e) => setSsoRegion(e.target.value)}
                            placeholder="us-east-1"
                            className="w-full px-3 py-2 rounded border border-outline-variant bg-surface-container text-body-md text-on-surface focus:outline-none focus:border-primary transition-all font-mono"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STEP AUTHORIZING */}
            {ssoAuthStep === 'authorizing' && (
              <div className="space-y-4 text-center animate-in fade-in duration-300 max-w-md mx-auto w-full py-4">
                <div className="p-4 bg-surface-container border border-outline-variant rounded-lg">
                  <p className="text-body-lg font-bold text-on-surface">
                    Hemos abierto el navegador de tu empresa para autorizar el inicio de sesión.
                  </p>
                  <p className="text-body-md text-on-surface-variant mt-2">
                    Si la página no abrió automáticamente, ingresa de manera manual a:
                  </p>
                  <a
                    href={ssoVerificationUrl || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-body-md text-primary font-bold underline mt-2 block truncate max-w-xs mx-auto font-mono"
                  >
                    {ssoVerificationUrl}
                  </a>
                </div>

                <div className="bg-surface-container-low p-4 rounded-lg border border-outline-variant relative overflow-hidden">
                  <span className="text-label-sm uppercase font-bold tracking-widest text-on-surface-variant block mb-1.5 font-mono">
                    Código de Validación
                  </span>
                  <span className="text-3xl font-mono font-bold tracking-widest text-tertiary block selection:bg-tertiary/20">
                    {ssoUserCode}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-body-md font-medium text-on-surface-variant animate-pulse">
                    {ssoStatusMessage || "Esperando aprobación..."}
                  </span>
                </div>
              </div>
            )}

            {/* STEP 3: SELECT ACCOUNT */}
            {ssoAuthStep === 'select_account' && (
              <div className="space-y-4 flex-grow max-w-5xl mx-auto w-full py-4 animate-in fade-in duration-300">
                <div>
                  <h3 className="text-headline-md font-bold text-on-surface flex items-center gap-2">
                    <HiOutlineOfficeBuilding className="w-5 h-5 text-primary" />
                    Cuentas AWS Disponibles
                  </h3>
                  <p className="text-body-md text-on-surface-variant mt-1">
                    Selecciona el inquilino corporativo de AWS al que deseas acceder en esta sesión.
                  </p>
                </div>

                {/* Filter / Search */}
                <div className="relative max-w-md">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-on-surface-variant">
                    <HiOutlineSearch className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={accountSearchTerm}
                    onChange={(e) => setAccountSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre o ID de cuenta..."
                    className="w-full pl-9 pr-4 py-2 bg-surface-container border border-outline-variant rounded text-body-md text-on-surface focus:outline-none focus:border-primary transition-all font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredSsoAccounts.map((acc) => (
                    <button
                      key={acc.accountId}
                      type="button"
                      onClick={() => {
                        setAccountSearchTerm("");
                        handleSelectAccount(acc);
                      }}
                      className="w-full text-left p-4 bg-surface-container hover:bg-surface-container-high border border-outline-variant hover:border-outline rounded transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div>
                        <span className="block font-bold text-body-md text-on-surface group-hover:text-primary transition-colors">
                          {acc.accountName}
                        </span>
                        <span className="block text-label-sm font-medium text-on-surface-variant font-mono mt-1">
                          ID: {acc.accountId}
                        </span>
                      </div>
                      <HiOutlineChevronRight className="w-5 h-5 text-on-surface-variant group-hover:text-primary transition-colors" />
                    </button>
                  ))}

                  {filteredSsoAccounts.length === 0 && (
                    <div className="col-span-full py-8 text-center text-body-md text-on-surface-variant">
                      No se encontraron cuentas vinculadas.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-label-sm text-on-surface-variant pt-2 border-t border-outline-variant/30 font-mono">
                  <span>Mostrando {filteredSsoAccounts.length} de {ssoAccounts.length} cuentas</span>
                </div>
              </div>
            )}

            {/* STEP 4: SELECT ROLE */}
            {ssoAuthStep === 'select_role' && (
              <div className="space-y-4 flex-grow max-w-5xl mx-auto w-full py-4 animate-in fade-in duration-300">
                <div className="bg-surface-container border border-outline-variant rounded-lg p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded bg-surface-container-high border border-outline-variant text-primary flex items-center justify-center font-bold text-body-md font-mono">
                      {ssoSelectedAccount?.accountName?.substring(0, 2).toUpperCase() || "AW"}
                    </div>
                    <div>
                      <h4 className="font-bold text-body-md text-on-surface">
                        {ssoSelectedAccount?.accountName}
                      </h4>
                      <p className="text-label-sm text-on-surface-variant font-mono mt-0.5">
                        ID: {ssoSelectedAccount?.accountId}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-headline-md font-bold text-on-surface flex items-center gap-2">
                      <HiOutlineShieldCheck className="w-5 h-5 text-primary" />
                      Selecciona tu Rol de IAM
                    </h3>
                    <p className="text-body-md text-on-surface-variant mt-1">
                      Elige la identidad autorizada con políticas de confianza para el explorer.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                    {ssoRoles.map((role) => (
                      <button
                        key={role.roleName}
                        type="button"
                        onClick={() => handleSelectRole(role)}
                        className="w-full text-left p-4 bg-surface-container hover:bg-surface-container-high border border-outline-variant hover:border-outline rounded transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <div>
                          <span className="block font-bold text-body-md text-on-surface group-hover:text-primary transition-colors">
                            {role.roleName}
                          </span>
                        </div>
                        <HiOutlineChevronRight className="w-5 h-5 text-on-surface-variant group-hover:text-primary transition-colors" />
                      </button>
                    ))}
                  </div>

                  <div className="p-3 bg-surface-container border border-outline-variant rounded flex items-start gap-3">
                    <HiOutlineShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-body-md text-on-surface-variant leading-normal font-sans">
                      Al seleccionar este rol se iniciará un apretón de manos (handshake) con AWS Security Token Service (STS) para generar credenciales temporales.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP LOADING CREDENTIALS */}
            {ssoAuthStep === 'loading_credentials' && (
              <div className="space-y-4 text-center py-8 animate-in fade-in duration-300 max-w-md mx-auto w-full">
                <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <h3 className="text-headline-md font-bold text-on-surface">
                  Obteniendo credenciales de AWS...
                </h3>
                <p className="text-body-md text-on-surface-variant leading-relaxed max-w-xs mx-auto">
                  Generando llaves temporales y tokens de sesión para el rol {ssoSelectedRole?.roleName}.
                </p>
              </div>
            )}
          </div>

          {/* Wizard Card Footer Controls */}
          <div className="border-t border-outline-variant bg-surface-container-low px-6 py-4 flex items-center justify-between shrink-0">
            {/* Back Button */}
            <button
              type="button"
              disabled={isLoading || ssoAuthStep === 'select_method'}
              onClick={() => {
                if (ssoAuthStep === 'idle') {
                  setSsoAuthStep('select_method');
                } else if (ssoAuthStep === 'select_account') {
                  setSsoAuthStep('idle');
                } else if (ssoAuthStep === 'select_role') {
                  setSsoAuthStep('select_account');
                  setSsoRoles([]);
                }
              }}
              className={`px-4 py-2 rounded border border-outline-variant text-body-md font-medium text-on-surface bg-surface-container hover:bg-surface-container-high transition-all flex items-center gap-2 cursor-pointer ${isLoading || ssoAuthStep === 'select_method'
                ? 'opacity-40 cursor-not-allowed pointer-events-none'
                : 'cursor-pointer active:scale-95'
                }`}
            >
              <HiOutlineChevronLeft className="w-4.5 h-4.5" />
              Atrás
            </button>

            {/* Cancel Button */}
            {ssoAuthStep !== 'select_method' && (
              <button
                type="button"
                onClick={handleCancelSso}
                className="px-4 py-2 rounded bg-error-container hover:bg-error-container/90 text-on-error-container border border-error/20 text-body-md font-medium transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <HiOutlineX className="w-4 h-4" />
                Cancelar
              </button>
            )}

            {/* Next / Connect Action Button */}
            {ssoAuthStep === 'idle' ? (
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  if (activeTab === 'profile') {
                    handleProfileLogin();
                  } else {
                    handleStartNativeSso();
                  }
                }}
                className="px-5 py-2 bg-primary hover:bg-primary/95 text-on-primary text-body-md font-medium rounded transition-all flex items-center gap-2 cursor-pointer active:scale-95 border border-transparent"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Conectar
                    <HiOutlineChevronRight className="w-4.5 h-4.5" />
                  </>
                )}
              </button>
            ) : ssoAuthStep === 'select_method' ? (
              <button
                type="button"
                onClick={() => setSsoAuthStep('idle')}
                className="px-5 py-2 bg-primary hover:bg-primary/95 text-on-primary text-body-md font-medium rounded transition-all flex items-center gap-2 cursor-pointer active:scale-95 border border-transparent"
              >
                Siguiente
                <HiOutlineChevronRight className="w-4.5 h-4.5" />
              </button>
            ) : (
              <div /> // Spacer
            )}
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex-1 flex flex-col bg-surface p-4 md:p-6 font-inter text-on-surface transition-colors duration-300">
      <div className="h-full w-full mx-auto flex flex-col min-h-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
          <div>
            <Breadcrumb
              items={[
                { label: getAwsAccountDisplayName(), path: "/" },
                { label: "Buckets", active: true },
              ]}
            />
            <h1 className="text-headline-lg font-bold text-on-surface tracking-tight flex items-center gap-2">
              <div className="p-1.5 bg-surface-container-high text-primary border border-outline-variant rounded">
                <HiOutlineDatabase size={20} />
              </div>
              Buckets
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {localStorage.getItem("aws_auth_method") === "sso-native" && (
              <button
                onClick={async () => {
                  const storedToken = localStorage.getItem("aws_sso_token");
                  const targetRegion = localStorage.getItem("aws_region") || ssoRegion || "us-east-1";
                  if (storedToken) {
                    setIsLoading(true);
                    setError("");
                    setSsoToken(storedToken);
                    setActiveTab("native_sso");
                    setSsoAuthStep('select_account');
                    setSsoStatusMessage("Obteniendo cuentas de AWS habilitadas...");
                    setIsAuthenticated(false);
                    try {
                      const { listAwsAccounts } = await import("../features/aws/awsSsoOidc");
                      const accountsList = await listAwsAccounts(storedToken, targetRegion);
                      setSsoAccounts(accountsList);
                    } catch (err: any) {
                      console.error("Failed to switch account:", err);
                      setError(err.message || "Error al obtener las cuentas de AWS.");
                      setSsoAuthStep('idle');
                    } finally {
                      setIsLoading(false);
                    }
                  } else {
                    setError("No hay sesión SSO activa.");
                  }
                }}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant text-primary font-medium text-body-md rounded hover:bg-surface-container-high transition-all cursor-pointer"
                title="Cambiar Cuenta o Rol"
              >
                <HiOutlineOfficeBuilding className="w-5 h-5" />
                Cambiar Cuenta/Rol
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface font-medium text-body-md rounded hover:bg-surface-container-high transition-all cursor-pointer disabled:opacity-50"
              title="Refresh buckets list"
            >
              <HiOutlineRefresh
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-error-container/20 border border-error/20 text-error font-medium text-body-md rounded hover:bg-error-container/30 transition-all cursor-pointer"
              title="Sign out"
            >
              Sign out
              <HiOutlineLogout className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error-container text-on-error-container border border-error/20 rounded text-body-md font-medium animate-in slide-in-from-top-2">
            {error}
          </div>
        )}

        {/* Main Explorer Container */}
        <div className="bg-surface-container border border-outline-variant rounded-lg flex flex-col flex-1 min-h-0 overflow-hidden">

          {/* Toolbar */}
          <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between gap-4 shrink-0">
            <div className="relative w-full max-w-md">
              <HiOutlineSearch
                className="absolute left-3 top-3 text-on-surface-variant"
                size={16}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Find buckets by name..."
                className="w-full pl-9 pr-4 py-2 bg-surface-container border border-outline-variant rounded text-body-md text-on-surface focus:outline-none focus:border-primary transition-all outline-none font-mono"
                aria-label="Search buckets"
              />
            </div>
            <div className="text-label-sm font-medium text-on-surface-variant font-mono uppercase tracking-wider">
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
            emptyIcon={<HiOutlineDatabase size={22} />}
          />
        </div>
      </div>
    </div>
  );
}
