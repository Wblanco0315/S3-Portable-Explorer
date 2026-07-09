import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  HiOutlineKey,
  HiOutlineServer,
  HiOutlineLockClosed,
  HiOutlineUser,
  HiOutlineMail,
  HiOutlineFolderAdd,
  HiOutlineTrash,
  HiOutlineShare,
  HiOutlineExternalLink,
  HiOutlineClock,
  HiOutlineX,
} from "react-icons/hi";
import { useSupabaseStore, CloudRoute } from "../features/supabase/supabaseStore";
import { setAwsCredentials } from "../features/aws/s3Client";
import { supabase } from "../features/supabase/supabaseClient";

export default function CloudRoutesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Supabase state
  const isOnline = useSupabaseStore((state) => state.isOnline);
  const profile = useSupabaseStore((state) => state.profile);
  const routes = useSupabaseStore((state) => state.routes);
  const credentials = useSupabaseStore((state) => state.credentials);
  const groups = useSupabaseStore((state) => state.groups);
  const isLoading = useSupabaseStore((state) => state.isLoading);
  const error = useSupabaseStore((state) => state.error);

  // Actions
  const signIn = useSupabaseStore((state) => state.signIn);
  const signUp = useSupabaseStore((state) => state.signUp);
  const signOut = useSupabaseStore((state) => state.signOut);
  const resetPassword = useSupabaseStore((state) => state.resetPassword);
  const createRoute = useSupabaseStore((state) => state.createRoute);
  const deleteRoute = useSupabaseStore((state) => state.deleteRoute);
  const createCredentials = useSupabaseStore((state) => state.createCredentials);
  const deleteCredentials = useSupabaseStore((state) => state.deleteCredentials);
  const createAccessRequest = useSupabaseStore((state) => state.createAccessRequest);
  const shareRouteWithGroup = useSupabaseStore((state) => state.shareRouteWithGroup);
  const shareRouteWithAll = useSupabaseStore((state) => state.shareRouteWithAll);
  const fetchRoutes = useSupabaseStore((state) => state.fetchRoutes);

  // Local UI state
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot_password'>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form: Add route
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [newRouteName, setNewRouteName] = useState("");
  const [newRouteBucket, setNewRouteBucket] = useState("");
  const [newRoutePrefix, setNewRoutePrefix] = useState("");
  const [newRouteRegion, setNewRouteRegion] = useState("us-east-1");
  const [newRouteCredId, setNewRouteCredId] = useState("");

  // Form: Credentials management
  const [showManageCreds, setShowManageCreds] = useState(false);
  const [newCredName, setNewCredName] = useState("");
  const [newCredAccessKey, setNewCredAccessKey] = useState("");
  const [newCredSecretKey, setNewCredSecretKey] = useState("");
  const [newCredToken, setNewCredToken] = useState("");
  const [newCredRegion, setNewCredRegion] = useState("us-east-1");

  // Form: Share Route
  const [shareTargetRoute, setShareTargetRoute] = useState<CloudRoute | null>(null);
  const [shareTargetGroupId, setShareTargetGroupId] = useState("");

  // Waiting access request session state
  const [activeWaitingRequest, setActiveWaitingRequest] = useState<any>(null);
  const [waitingCountdown, setWaitingCountdown] = useState(600); // 10 minutes in seconds

  useEffect(() => {
    if (error) setAuthErr(error);
  }, [error]);

  // Realtime listener for active waiting request approval
  useEffect(() => {
    if (!activeWaitingRequest) return;

    console.log("[CloudRoutes] Listening to request status:", activeWaitingRequest.id);

    const handleRequestUpdated = async (status: string, routeId: string, requestId: string) => {
      if (status === "approved") {
        const { data: routeDetails } = await supabase
          .from("routes")
          .select("*, aws_credentials(*)")
          .eq("id", routeId)
          .single();

        if (routeDetails && routeDetails.aws_credentials) {
          const c = routeDetails.aws_credentials;
          setAwsCredentials(
            c.access_key_id,
            c.secret_access_key,
            c.session_token || undefined,
            c.region
          );
          localStorage.setItem("aws_auth_method", "cloud-route");
          localStorage.setItem("cloud_route_name", routeDetails.name);
          localStorage.setItem("active_access_request_id", requestId);
          
          setActiveWaitingRequest(null);
          navigate(`/buckets/${routeDetails.bucket}?prefix=${encodeURIComponent(routeDetails.prefix)}`);
        }
      } else if (status === "rejected" || status === "expired") {
        setActiveWaitingRequest((prev: any) => {
          if (prev && prev.status !== status) {
            return { ...prev, status };
          }
          return prev;
        });
      }
    };

    const subscription = supabase
      .channel(`waiting_request_${activeWaitingRequest.id}`)
      .on(
        "postgres_changes",
        { 
          event: "UPDATE", 
          schema: "public", 
          table: "access_requests",
          filter: `id=eq.${activeWaitingRequest.id}`
        },
        async (payload) => {
          const updated = payload.new as any;
          console.log("[CloudRoutes] Waiting request updated in DB via Realtime:", updated);
          await handleRequestUpdated(updated.status, updated.route_id, updated.id);
        }
      )
      .subscribe();

    // Polling fallback every 3 seconds
    const pollInterval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("access_requests")
          .select("status, route_id, id")
          .eq("id", activeWaitingRequest.id)
          .single();
        if (data && data.status !== "pending") {
          console.log("[CloudRoutes] Polling fetched updated status:", data.status);
          await handleRequestUpdated(data.status, data.route_id, data.id);
        }
      } catch (err) {
        console.error("Error polling request status:", err);
      }
    }, 3000);

    // Timer countdown
    const timer = setInterval(() => {
      setWaitingCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setActiveWaitingRequest((prevReq: any) => {
            if (prevReq && prevReq.status === "pending") {
              // Expire local state
              return { ...prevReq, status: "expired" };
            }
            return prevReq;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      supabase.removeChannel(subscription);
      clearInterval(timer);
      clearInterval(pollInterval);
    };
  }, [activeWaitingRequest]);

  // Auth Submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErr(null);
    setSuccessMsg(null);
    try {
      if (authMode === "register") {
        if (!firstName.trim() || !lastName.trim()) {
          setAuthErr("First name and Last name are required.");
          return;
        }
        await signUp(email, password, firstName, lastName);
        setAuthMode("login");
        setSuccessMsg("Registration successful. Please verify your email or sign in.");
      } else if (authMode === "login") {
        await signIn(email, password);
      } else if (authMode === "forgot_password") {
        if (!email.trim()) {
          setAuthErr("Email address is required.");
          return;
        }
        await resetPassword(email);
        setSuccessMsg("Enlace de recuperación enviado. Revisa tu correo.");
      }
    } catch (err: any) {
      setAuthErr(err.message || "Authentication failed.");
    }
  };

  // Click Route Navigation or Access Request
  const handleRouteClick = async (route: CloudRoute) => {
    // 1. If user has access credentials loaded in route object, navigate directly
    if (route.aws_credentials) {
      const c = route.aws_credentials;
      setAwsCredentials(
        c.access_key_id,
        c.secret_access_key,
        c.session_token || undefined,
        c.region
      );
      localStorage.setItem("aws_auth_method", "cloud-route");
      localStorage.setItem("cloud_route_name", route.name);
      navigate(`/buckets/${route.bucket}?prefix=${encodeURIComponent(route.prefix)}`);
      return;
    }

    // 2. Otherwise, user needs authorization, request access
    const req = await createAccessRequest(route.id);
    if (req) {
      setActiveWaitingRequest(req);
      setWaitingCountdown(600); // Reset timer to 10 mins
    }
  };

  // Add Route Submit
  const handleAddRouteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const credId = newRouteCredId === "" ? null : newRouteCredId;
    const data = await createRoute(
      newRouteName,
      newRouteBucket,
      newRoutePrefix,
      newRouteRegion,
      credId
    );
    if (data) {
      setShowAddRoute(false);
      setNewRouteName("");
      setNewRouteBucket("");
      setNewRoutePrefix("");
      setNewRouteCredId("");
    }
  };

  // Save Credentials Submit
  const handleAddCredsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createCredentials(
      newCredName,
      newCredAccessKey,
      newCredSecretKey,
      newCredToken,
      newCredRegion
    );
    setNewCredName("");
    setNewCredAccessKey("");
    setNewCredSecretKey("");
    setNewCredToken("");
  };

  // Share Route Submit
  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareTargetRoute) return;

    if (shareTargetGroupId === "all") {
      await shareRouteWithAll(shareTargetRoute.id);
    } else if (shareTargetGroupId) {
      await shareRouteWithGroup(shareTargetRoute.id, shareTargetGroupId);
    }
    
    setShareTargetRoute(null);
    setShareTargetGroupId("");
    await fetchRoutes();
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  // RENDER OFFLINE AUTHENTICATION CARD
  if (!isOnline) {
    const isReg = authMode === "register";
    const isForgot = authMode === "forgot_password";

    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-surface-container-lowest">
        <div className="max-w-md w-full bg-surface-container border border-outline-variant rounded-lg p-8 shadow-xl animate-in fade-in duration-200">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-3">
              <HiOutlineServer size={24} />
            </div>
            <h2 className="text-headline-md font-bold text-on-surface">
              {isReg 
                ? t("cloud.register_title", "Crear Cuenta Cloud") 
                : isForgot 
                ? "Restablecer Contraseña" 
                : t("cloud.login_title", "Conectarse a la Nube")}
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              {isReg
                ? "Regístrate para guardar rutas y coordinar accesos de grupo."
                : isForgot
                ? "Ingresa tu correo para recibir un enlace de recuperación."
                : "Conéctate para acceder a tus rutas guardadas y compartidas."}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
            {isReg && (
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-label-sm text-on-surface-variant font-medium block mb-1">
                    {t("cloud.first_name")}
                  </label>
                  <div className="relative">
                    <HiOutlineUser className="absolute left-3 top-2.5 text-outline-variant" size={16} />
                    <input
                      type="text"
                      className="w-full bg-surface border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-md py-2 pl-9 pr-4 text-body-sm text-on-surface transition-colors"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-label-sm text-on-surface-variant font-medium block mb-1">
                    {t("cloud.last_name")}
                  </label>
                  <div className="relative">
                    <HiOutlineUser className="absolute left-3 top-2.5 text-outline-variant" size={16} />
                    <input
                      type="text"
                      className="w-full bg-surface border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-md py-2 pl-9 pr-4 text-body-sm text-on-surface transition-colors"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-label-sm text-on-surface-variant font-medium block mb-1">
                {t("cloud.email")}
              </label>
              <div className="relative">
                <HiOutlineMail className="absolute left-3 top-2.5 text-outline-variant" size={16} />
                <input
                  type="email"
                  className="w-full bg-surface border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-md py-2 pl-9 pr-4 text-body-sm text-on-surface transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {!isForgot && (
              <div>
                <label className="text-label-sm text-on-surface-variant font-medium block mb-1">
                  {t("cloud.password")}
                </label>
                <div className="relative">
                  <HiOutlineLockClosed className="absolute left-3 top-2.5 text-outline-variant" size={16} />
                  <input
                    type="password"
                    className="w-full bg-surface border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-md py-2 pl-9 pr-4 text-body-sm text-on-surface transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {authErr && (
              <div className="bg-error-container text-on-error-container p-3 rounded-md text-body-sm border border-error/25">
                {authErr}
              </div>
            )}

            {successMsg && (
              <div className="bg-tertiary-container text-on-tertiary-container p-3 rounded-md text-body-sm border border-tertiary/25">
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-on-primary font-semibold py-2 rounded-md hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-on-primary/20 border-t-on-primary rounded-full animate-spin"></div>
              ) : isReg ? (
                t("cloud.register")
              ) : isForgot ? (
                "Enviar Enlace"
              ) : (
                t("cloud.login")
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3 border-t border-outline-variant/30 pt-4 text-center">
            {authMode === "login" && (
              <button
                onClick={() => {
                  setAuthMode("forgot_password");
                  setAuthErr(null);
                  setSuccessMsg(null);
                }}
                className="text-body-sm text-outline hover:text-on-surface-variant cursor-pointer transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}

            <button
              onClick={() => {
                if (authMode === "login") {
                  setAuthMode("register");
                } else {
                  setAuthMode("login");
                }
                setAuthErr(null);
                setSuccessMsg(null);
              }}
              className="text-body-sm text-primary hover:underline cursor-pointer font-medium"
            >
              {isReg 
                ? t("cloud.have_account") 
                : isForgot 
                ? "Volver a Iniciar Sesión" 
                : t("cloud.need_account")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ONLINE CLOUD ROUTES VIEW
  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-surface-container-lowest gap-6 select-none">
      <div className="flex items-center justify-between border-b border-outline-variant/30 pb-4">
        <div>
          <h1 className="text-headline-md font-bold text-on-surface font-geist flex items-center gap-2">
            <HiOutlineServer className="text-primary" />
            {t("cloud.title")}
          </h1>
          <p className="text-body-sm text-on-surface-variant mt-0.5">
            Colección de rutas S3 compartidas en la nube a través de grupos de acceso autorizados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {profile?.role !== "user" && (
            <>
              <button
                onClick={() => setShowManageCreds(true)}
                className="py-1.5 px-3 bg-surface-container border border-outline text-on-surface text-label-sm font-semibold rounded-sm hover:bg-surface-variant transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <HiOutlineKey size={14} />
                {t("cloud.manage_creds")}
              </button>
              <button
                onClick={() => setShowAddRoute(true)}
                className="py-1.5 px-3 bg-primary text-on-primary text-label-sm font-semibold rounded-sm hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <HiOutlineFolderAdd size={14} />
                {t("cloud.add_route")}
              </button>
            </>
          )}
          <button
            onClick={signOut}
            className="py-1.5 px-3 bg-surface-container border border-error/50 text-error text-label-sm font-semibold rounded-sm hover:bg-error-container/20 transition-colors cursor-pointer"
          >
            {t("cloud.logout")}
          </button>
        </div>
      </div>

      {/* ROUTES TABLE */}
      <div className="bg-surface-container border border-outline-variant rounded-md overflow-hidden">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface-container-high border-b border-outline-variant text-label-sm text-on-surface-variant font-mono">
              <th className="p-4">{t("cloud.route_name")}</th>
              <th className="p-4">Ruta S3</th>
              <th className="p-4">Creado por</th>
              <th className="p-4 flex justify-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {routes.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-on-surface-variant text-body-sm font-medium">
                  No hay rutas en la nube disponibles.
                </td>
              </tr>
            ) : (
              routes.map((rt) => {
                const isOwner = rt.created_by === profile?.id;
                const requestor = rt.profiles;
                const creatorName = requestor 
                  ? `${requestor.first_name} ${requestor.last_name}`.trim() || requestor.email 
                  : rt.created_by;

                return (
                  <tr key={rt.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low transition-colors">
                    <td className="p-4 font-semibold text-on-surface text-body-sm">{rt.name}</td>
                    <td className="p-4 font-mono text-label-sm text-primary">
                      s3://{rt.bucket}/{rt.prefix}
                    </td>
                    <td className="p-4 text-body-sm text-on-surface-variant">{creatorName}</td>
                    <td className="p-4 flex items-center justify-end gap-2">
                      {profile?.role !== "user" && isOwner && (
                        <>
                          <button
                            onClick={() => setShareTargetRoute(rt)}
                            className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-variant rounded-md transition-colors cursor-pointer"
                            title="Compartir ruta"
                          >
                            <HiOutlineShare size={16} />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm("¿Estás seguro de que deseas eliminar esta ruta de la nube?")) {
                                await deleteRoute(rt.id);
                              }
                            }}
                            className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-md transition-colors cursor-pointer"
                            title="Eliminar ruta"
                          >
                            <HiOutlineTrash size={16} />
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => handleRouteClick(rt)}
                        className={`py-1 px-3 rounded-sm text-label-sm font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                          rt.aws_credentials 
                            ? "bg-tertiary text-on-tertiary hover:brightness-105 active:scale-[0.98]"
                            : "bg-primary text-on-primary hover:brightness-105 active:scale-[0.98]"
                        }`}
                      >
                        <HiOutlineExternalLink size={14} />
                        {rt.aws_credentials ? t("cloud.go_to_route") : t("cloud.request_access")}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL: WAITING ADMIN APPROVAL */}
      {/* ---------------------------------------------------- */}
      {activeWaitingRequest && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="bg-surface-container border border-outline-variant max-w-sm w-full p-6 rounded-md shadow-2xl flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary relative">
              <HiOutlineClock className="animate-pulse" size={24} />
            </div>
            
            <div>
              <h3 className="text-body-lg font-bold text-on-surface">
                {activeWaitingRequest.status === "pending"
                  ? t("cloud.waiting_approval")
                  : activeWaitingRequest.status === "rejected"
                  ? "Solicitud Rechazada"
                  : "Solicitud Expirada"}
              </h3>
              <p className="text-body-sm text-on-surface-variant mt-2">
                {activeWaitingRequest.status === "pending"
                  ? t("cloud.request_sent")
                  : activeWaitingRequest.status === "rejected"
                  ? t("cloud.request_rejected")
                  : t("cloud.request_expired")}
              </p>
            </div>

            {activeWaitingRequest.status === "pending" && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                  {t("cloud.expires_in")}
                </span>
                <span className="text-headline-md font-mono font-bold text-primary">
                  {formatTime(waitingCountdown)}
                </span>
              </div>
            )}

            <button
              onClick={() => setActiveWaitingRequest(null)}
              className="py-1.5 px-6 bg-surface-container-high border border-outline text-on-surface text-label-sm font-semibold rounded-sm hover:bg-surface-variant active:scale-[0.98] transition-all cursor-pointer animate-in fade-in duration-200"
            >
              {activeWaitingRequest.status === "pending" ? t("cloud.cancel") : "Cerrar"}
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: ADD ROUTE */}
      {/* ---------------------------------------------------- */}
      {showAddRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <form onSubmit={handleAddRouteSubmit} className="bg-surface-container border border-outline-variant max-w-md w-full p-6 rounded-md shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <h3 className="text-body-lg font-bold text-on-surface">{t("cloud.add_route")}</h3>
              <button type="button" onClick={() => setShowAddRoute(false)} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
                <HiOutlineX size={18} />
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-label-sm text-on-surface-variant font-medium block mb-1">{t("cloud.route_name")}</label>
                <input
                  type="text"
                  required
                  className="w-full bg-surface border border-outline-variant rounded-md py-1.5 px-3 text-body-sm text-on-surface focus:border-primary"
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-2">
                  <label className="text-label-sm text-on-surface-variant font-medium block mb-1">{t("cloud.bucket_name")}</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-surface border border-outline-variant rounded-md py-1.5 px-3 text-body-sm text-on-surface focus:border-primary"
                    value={newRouteBucket}
                    onChange={(e) => setNewRouteBucket(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-label-sm text-on-surface-variant font-medium block mb-1">{t("cloud.region")}</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-surface border border-outline-variant rounded-md py-1.5 px-3 text-body-sm text-on-surface focus:border-primary"
                    value={newRouteRegion}
                    onChange={(e) => setNewRouteRegion(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-label-sm text-on-surface-variant font-medium block mb-1">{t("cloud.prefix")}</label>
                <input
                  type="text"
                  className="w-full bg-surface border border-outline-variant rounded-md py-1.5 px-3 text-body-sm text-on-surface focus:border-primary"
                  value={newRoutePrefix}
                  onChange={(e) => setNewRoutePrefix(e.target.value)}
                />
              </div>

              <div>
                <label className="text-label-sm text-on-surface-variant font-medium block mb-1">{t("cloud.credentials")}</label>
                <select
                  className="w-full bg-surface border border-outline-variant rounded-md py-1.5 px-3 text-body-sm text-on-surface focus:border-primary"
                  value={newRouteCredId}
                  onChange={(e) => setNewRouteCredId(e.target.value)}
                >
                  <option value="">{t("cloud.no_credentials")}</option>
                  {credentials.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.region})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowAddRoute(false)}
                className="py-1.5 px-4 bg-surface-container border border-outline text-on-surface text-label-sm rounded-sm hover:bg-surface-variant cursor-pointer"
              >
                {t("cloud.cancel")}
              </button>
              <button
                type="submit"
                className="py-1.5 px-5 bg-primary text-on-primary text-label-sm rounded-sm hover:brightness-105 cursor-pointer font-semibold"
              >
                {t("cloud.save")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: MANAGE CREDENTIALS */}
      {/* ---------------------------------------------------- */}
      {showManageCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
          <div className="bg-surface-container border border-outline-variant max-w-2xl w-full p-6 rounded-md shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <h3 className="text-body-lg font-bold text-on-surface flex items-center gap-2">
                <HiOutlineKey className="text-primary" />
                {t("cloud.manage_creds")}
              </h3>
              <button onClick={() => setShowManageCreds(false)} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
                <HiOutlineX size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Credentials List */}
              <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
                <span className="text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">
                  Credenciales Guardadas
                </span>
                {credentials.length === 0 ? (
                  <p className="text-body-sm text-on-surface-variant italic p-4 text-center">
                    No tienes credenciales guardadas en la nube.
                  </p>
                ) : (
                  credentials.map((c) => (
                    <div key={c.id} className="bg-surface-container-low border border-outline-variant p-3 rounded-md flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-body-sm font-semibold text-on-surface">{c.name}</span>
                        <span className="text-label-sm text-on-surface-variant font-mono truncate max-w-[180px]">{c.access_key_id}</span>
                      </div>
                      <button
                        onClick={async () => {
                          if (confirm(`¿Eliminar credencial ${c.name}?`)) {
                            await deleteCredentials(c.id);
                          }
                        }}
                        className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-md transition-colors cursor-pointer"
                      >
                        <HiOutlineTrash size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add Credential Form */}
              <form onSubmit={handleAddCredsSubmit} className="flex flex-col gap-3 border-l border-outline-variant/30 pl-6">
                <span className="text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">
                  {t("cloud.add_creds")}
                </span>
                
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="text-[10px] text-on-surface-variant font-medium block mb-0.5">{t("cloud.creds_name")}</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: AWS Production"
                      className="w-full bg-surface border border-outline-variant rounded-md py-1 px-2.5 text-body-sm text-on-surface focus:border-primary"
                      value={newCredName}
                      onChange={(e) => setNewCredName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-on-surface-variant font-medium block mb-0.5">{t("cloud.access_key")}</label>
                    <input
                      type="text"
                      required
                      className="w-full bg-surface border border-outline-variant rounded-md py-1 px-2.5 text-body-sm text-on-surface focus:border-primary font-mono"
                      value={newCredAccessKey}
                      onChange={(e) => setNewCredAccessKey(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-on-surface-variant font-medium block mb-0.5">{t("cloud.secret_key")}</label>
                    <input
                      type="password"
                      required
                      className="w-full bg-surface border border-outline-variant rounded-md py-1 px-2.5 text-body-sm text-on-surface focus:border-primary font-mono"
                      value={newCredSecretKey}
                      onChange={(e) => setNewCredSecretKey(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-on-surface-variant font-medium block mb-0.5">Region</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-surface border border-outline-variant rounded-md py-1 px-2.5 text-body-sm text-on-surface focus:border-primary"
                        value={newCredRegion}
                        onChange={(e) => setNewCredRegion(e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-on-surface-variant font-medium block mb-0.5">Token (Opt)</label>
                      <input
                        type="text"
                        className="w-full bg-surface border border-outline-variant rounded-md py-1 px-2.5 text-body-sm text-on-surface focus:border-primary"
                        value={newCredToken}
                        onChange={(e) => setNewCredToken(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="py-1.5 px-4 bg-primary text-on-primary text-label-sm font-semibold rounded-sm hover:brightness-105 transition-all self-end cursor-pointer mt-2"
                >
                  Guardar Credencial
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: SHARE ROUTE */}
      {/* ---------------------------------------------------- */}
      {shareTargetRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
          <form onSubmit={handleShareSubmit} className="bg-surface-container border border-outline-variant max-w-sm w-full p-6 rounded-md shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <h3 className="text-body-lg font-bold text-on-surface">Compartir Ruta</h3>
              <button type="button" onClick={() => setShareTargetRoute(null)} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
                <HiOutlineX size={18} />
              </button>
            </div>

            <p className="text-body-sm text-on-surface-variant">
              Comparte la ruta <strong className="text-on-surface">{shareTargetRoute.name}</strong> con tus grupos o de forma general.
            </p>

            <div className="flex flex-col gap-2">
              <label className="text-label-sm text-on-surface-variant font-medium block">Destino de la Compartición</label>
              <select
                required
                className="w-full bg-surface border border-outline-variant rounded-md py-1.5 px-3 text-body-sm text-on-surface focus:border-primary"
                value={shareTargetGroupId}
                onChange={(e) => setShareTargetGroupId(e.target.value)}
              >
                <option value="">-- Selecciona una opción --</option>
                <option value="all">Público (Todos los usuarios autenticados)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    Grupo: {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShareTargetRoute(null)}
                className="py-1.5 px-4 bg-surface-container border border-outline text-on-surface text-label-sm rounded-sm hover:bg-surface-variant cursor-pointer"
              >
                {t("cloud.cancel")}
              </button>
              <button
                type="submit"
                disabled={!shareTargetGroupId}
                className="py-1.5 px-5 bg-primary text-on-primary text-label-sm rounded-sm hover:brightness-105 cursor-pointer font-semibold disabled:opacity-50"
              >
                Compartir
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
