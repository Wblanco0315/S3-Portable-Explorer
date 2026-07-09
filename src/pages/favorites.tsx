import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  HiOutlineFolder,
  HiOutlineLink,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlineTrash,
  HiOutlineFolderAdd,
  HiOutlineDuplicate,
  HiOutlineCheck,
  HiOutlineExternalLink,
  HiOutlineDownload,
  HiOutlineUpload,
  HiOutlineDatabase,
  HiOutlineSwitchHorizontal,
  HiOutlineCloudUpload,
  HiOutlineX,
  HiOutlineCloud,
  HiOutlineUsers,
  HiOutlineShare,
  HiOutlineClock,
} from "react-icons/hi";
import {
  addRoute,
  listRoutes,
  listFolders,
  Route,
  FavoriteFolder,
  addFolder,
  removeRoute,
  removeFolder,
  updateRouteFolder,
  updateFolderParent,
  exportFavorites,
  importFavorites,
  updateRouteProfile,
} from "../features/favorites/favoritesStore";
import { useRouteNavigator } from "../shared/hooks/useRouteNavigator";
import { useSupabaseStore } from "../features/supabase/supabaseStore";
import { supabase } from "../features/supabase/supabaseClient";
import { GenericTable, Column } from "../components/GenericTable";
import { Breadcrumb } from "../components/Breadcrumb";
import { MoveToModal } from "../components/MoveToModal";
import { useTranslation } from "react-i18next";
import { safeConfirm as confirm } from "../shared/utils/dialog";

type Item = (Route & { type: "route" }) | (FavoriteFolder & { type: "folder" });

export default function FavoritesPage() {
  const { navigateToRoute } = useRouteNavigator();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const currentFolderId = searchParams.get("folder")
    ? parseInt(searchParams.get("folder")!)
    : null;

  const setCurrentFolderId = (id: number | null) => {
    if (id === null) {
      setSearchParams({});
    } else {
      setSearchParams({ folder: id.toString() });
    }
  };

  const handleBackClick = () => {
    if (currentFolderId !== null) {
      if (breadcrumbPath.length <= 1) {
        setCurrentFolderId(null);
      } else {
        const parent = breadcrumbPath[breadcrumbPath.length - 2];
        setCurrentFolderId(parent.id ?? null);
      }
    } else {
      if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
        navigate(-1);
      } else {
        navigate("/");
      }
    }
  };

  const [routes, setRoutes] = useState<Route[]>([]);
  const [folders, setFolders] = useState<FavoriteFolder[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [moveItems, setMoveItems] = useState<Item[]>([]);

  // Cloud Sync states
  const isOnline = useSupabaseStore((state) => state.isOnline);
  const cloudCredentials = useSupabaseStore((state) => state.credentials);
  const createCloudRoute = useSupabaseStore((state) => state.createRoute);
  const fetchCloudRoutes = useSupabaseStore((state) => state.fetchRoutes);

  const [showSyncModal, setShowSyncModal] = useState(false);
  const [selectedCredId, setSelectedCredId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncSelection, setSyncSelection] = useState<Record<number, boolean>>({});

  // Unified cloud sync and sharing states
  const groups = useSupabaseStore((state) => state.groups);
  const profile = useSupabaseStore((state) => state.profile);
  const cloudRoutes = useSupabaseStore((state) => state.routes);
  const shareRouteWithGroup = useSupabaseStore((state) => state.shareRouteWithGroup);
  const unshareRouteWithGroup = useSupabaseStore((state) => state.unshareRouteWithGroup);
  const accessRequests = useSupabaseStore((state) => state.accessRequests);
  const createAccessRequest = useSupabaseStore((state) => state.createAccessRequest);

  const [syncTab, setSyncTab] = useState<'upload' | 'download'>('upload');
  const [downloadSelection, setDownloadSelection] = useState<Record<string, boolean>>({});
  const [shareTargetItem, setShareTargetItem] = useState<Route | null>(null);
  const [activeRoutePermissions, setActiveRoutePermissions] = useState<string[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  // Tab, local profiles, and active request countdown states
  const [activeTab, setActiveTab] = useState<'local' | 'cloud'>('local');
  const [localProfiles, setLocalProfiles] = useState<string[]>([]);
  const [activeWaitingRequest, setActiveWaitingRequest] = useState<any>(null);
  const [waitingCountdown, setWaitingCountdown] = useState(600);

  // Initialize selection when local routes load
  useEffect(() => {
    const sel: Record<number, boolean> = {};
    routes.forEach((r) => {
      if (r.id) sel[r.id] = true;
    });
    setSyncSelection(sel);
  }, [routes]);

  const openSyncModal = async () => {
    setShowSyncModal(true);
    setSyncing(true);
    try {
      await fetchCloudRoutes();
      const cRoutes = useSupabaseStore.getState().routes;
      const localRoutes = routes;

      // Filter cloud routes that don't exist locally
      const toDownload = cRoutes.filter(
        cr => !localRoutes.some(lr => lr.bucket === cr.bucket && lr.prefix === cr.prefix)
      );

      const dSel: Record<string, boolean> = {};
      toDownload.forEach(cr => {
        dSel[cr.id] = true;
      });
      setDownloadSelection(dSel);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadFromCloud = async () => {
    setSyncing(true);
    try {
      const cRoutes = useSupabaseStore.getState().routes;
      const routesToDownload = cRoutes.filter(cr => downloadSelection[cr.id]);

      let count = 0;
      for (const cr of routesToDownload) {
        await addRoute({
          name: cr.name,
          bucket: cr.bucket,
          prefix: cr.prefix,
          profile: "cloud-route",
          folder_id: null
        });
        count++;
      }
      alert(`Descarga exitosa: Se bajaron ${count} rutas de la nube a tus favoritos locales.`);
      setShowSyncModal(false);
      await loadData();
    } catch (err: any) {
      console.error("Failed to download cloud routes", err);
      alert(`Error al bajar rutas: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const openShareModal = async (route: Route) => {
    setShareTargetItem(route);
    setLoadingPermissions(true);
    try {
      await fetchCloudRoutes();
      const cRoutes = useSupabaseStore.getState().routes;
      let cloudRoute = cRoutes.find(r => r.bucket === route.bucket && r.prefix === route.prefix);

      if (!cloudRoute) {
        const region = localStorage.getItem("aws_region") || "us-east-1";
        cloudRoute = await createCloudRoute(
          route.name,
          route.bucket,
          route.prefix,
          region,
          null
        );
      }

      if (cloudRoute) {
        const { supabase } = await import("../features/supabase/supabaseClient");
        const { data: perms } = await supabase
          .from("route_permissions")
          .select("group_id")
          .eq("route_id", cloudRoute.id);
        
        const activeIds = perms ? perms.map((p: any) => p.group_id).filter(Boolean) : [];
        setActiveRoutePermissions(activeIds);
      }
    } catch (err) {
      console.error("Failed to load route permissions", err);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handleSyncToCloud = async () => {
    setSyncing(true);
    try {
      const routesToSync = routes.filter((r) => r.id && syncSelection[r.id]);
      const credId = selectedCredId === "" ? null : selectedCredId;

      let count = 0;
      for (const r of routesToSync) {
        const region = "us-east-1"; 
        const success = await createCloudRoute(r.name, r.bucket, r.prefix, region, credId);
        if (success) count++;
      }
      alert(`Sincronización exitosa: Se subieron ${count} rutas a la nube.`);
      setShowSyncModal(false);
      await fetchCloudRoutes();
    } catch (err: any) {
      console.error("Cloud sync failed", err);
      alert(`Error en la sincronización: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [favs, flds] = await Promise.all([listRoutes(), listFolders()]);
      setRoutes(favs);
      setFolders(flds);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (isOnline) {
      fetchCloudRoutes();
      useSupabaseStore.getState().fetchGroups();
    }
    const isTauriEnv = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;
    if (isTauriEnv) {
      import("../features/aws/awsCli").then(({ listAwsProfiles }) => {
        listAwsProfiles().then(setLocalProfiles).catch(console.error);
      });
    }
  }, [isOnline]);

  // Realtime & Polling listener for active waiting request approval inside favorites page
  useEffect(() => {
    if (!activeWaitingRequest) return;

    console.log("[Favorites] Listening to request status:", activeWaitingRequest.id);

    const handleRequestUpdated = async (status: string, routeId: string, requestId: string) => {
      if (status === "approved") {
        const { data: routeDetails } = await supabase
          .from("routes")
          .select("*, aws_credentials(*)")
          .eq("id", routeId)
          .single();

        if (routeDetails && routeDetails.aws_credentials) {
          const c = routeDetails.aws_credentials;
          const { setAwsCredentials } = await import("../features/aws/s3Client");
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

    // Realtime Postgres update listener
    const subscription = supabase
      .channel(`fav_waiting_request_${activeWaitingRequest.id}`)
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
          console.log("[Favorites] Waiting request updated in DB via Realtime:", updated);
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
          console.log("[Favorites] Polling fetched updated status:", data.status);
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

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  const displayItems = useMemo<Item[]>(() => {
    const fl = folders
      .filter(
        (f) =>
          f.parent_id === currentFolderId &&
          f.name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .map((f) => ({ ...f, type: "folder" as const }));
    const rt = routes
      .filter(
        (r) =>
          r.folder_id === currentFolderId &&
          r.name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .map((r) => ({ ...r, type: "route" as const }));
    return [...fl, ...rt];
  }, [folders, routes, currentFolderId, searchTerm]);

  const breadcrumbPath = useMemo(() => {
    const path: FavoriteFolder[] = [];
    let currId = currentFolderId;
    while (currId) {
      const f = folders.find((x) => x.id === currId);
      if (f) {
        path.unshift(f);
        currId = f.parent_id ?? null;
      } else break;
    }
    return path;
  }, [folders, currentFolderId]);

  const handleMove = async (targetFolderId: number | null) => {
    if (moveItems.length === 0) return;
    for (const item of moveItems) {
      if (item.type === "folder") {
        await updateFolderParent(item.id!, targetFolderId);
      } else {
        await updateRouteFolder(item.id!, targetFolderId);
      }
    }
    setSelectedIds(new Set());
    await loadData();
  };

  const toggleSelection = (cid: string | number) => {
    const next = new Set(selectedIds);
    if (next.has(cid.toString())) next.delete(cid.toString());
    else next.add(cid.toString());
    setSelectedIds(next);
  };

  const handleNavigate = navigateToRoute;

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = async () => {
    try {
      const success = await exportFavorites();
      if (success) {
        alert(t("my_routes.export_success"));
      }
    } catch (err: any) {
      console.error("Export failed", err);
      alert(t("my_routes.export_error", { error: err.message }));
    }
  };

  const handleImport = async () => {
    try {
      const success = await importFavorites();
      if (success) {
        alert(t("my_routes.import_success"));
        await loadData();
      }
    } catch (err: any) {
      console.error("Import failed", err);
      alert(t("my_routes.import_error", { error: err.message }));
    }
  };

  const columns: Column<Item>[] = [
    {
      key: "name",
      header: t("my_routes.table.name_col"),
      render: (item) => {
        const isFolder = item.type === "folder";
        const isSynced = item.type === "route" && cloudRoutes.some(cr => cr.bucket === item.bucket && cr.prefix === item.prefix);
        return (
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 transition-transform group-hover:scale-105 ${isFolder ? "text-primary" : "text-secondary"}`}>
              {isFolder ? <HiOutlineFolder size={20} /> : <HiOutlineLink size={20} />}
            </div>
            <div className="min-w-0 flex items-center gap-2">
              {isFolder ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentFolderId(item.id!); }}
                  className="font-semibold text-left hover:underline truncate transition-colors text-body-md text-on-surface"
                >
                  {item.name}
                </button>
              ) : (
                <span
                  onClick={(e) => { e.stopPropagation(); handleNavigate(item as Route); }}
                  className="font-semibold text-primary hover:underline cursor-pointer truncate text-body-md"
                >
                  {item.name}
                </span>
              )}
              {isSynced && (
                <HiOutlineCloud 
                  className="text-primary shrink-0 w-4 h-4 animate-fade-in animate-pulse" 
                  title="Sincronizado en la nube" 
                />
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "type",
      header: t("my_routes.table.type_col"),
      className:
        "text-on-surface-variant font-medium text-label-sm uppercase tracking-wider",
      render: (item) => (item.type === "folder" ? t("my_routes.table.folder_type") : t("my_routes.table.route_type")),
    },
    {
      key: "profile",
      header: t("my_routes.table.profile_col"),
      render: (item) => {
        if (item.type !== "route") {
          return <span className="text-on-surface-variant/30 font-mono text-label-sm">—</span>;
        }
        const route = item as Route;
        return (
          <select
            value={route.profile || "default"}
            onChange={async (e) => {
              const newProfile = e.target.value;
              await updateRouteProfile(route.id!, newProfile);
              await loadData();
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface border border-outline-variant rounded py-0.5 px-2 text-label-sm font-mono text-on-surface focus:outline-none focus:border-primary uppercase tracking-wider cursor-pointer hover:bg-surface-container transition-colors max-w-[150px] truncate"
          >
            <option value="default">default</option>
            <option value="cloud-route">cloud-route (Nube)</option>
            {localProfiles.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: "path",
      header: t("my_routes.table.path_col"),
      className: "font-mono text-label-sm text-on-surface-variant max-w-xs truncate",
      render: (item) =>
        item.type === "route" ? (
          `s3://${(item as Route).bucket}/${(item as Route).prefix}`
        ) : (
          <span className="text-on-surface-variant/30 font-mono text-label-sm">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (item) => {
        const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
        return (
          <div
            className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {item.type === "route" && (
              <>
                {isOnline && isAdmin && (
                  <button
                    onClick={() => openShareModal(item as Route)}
                    className="p-1.5 bg-surface-container border border-outline-variant text-primary hover:bg-primary/20 rounded transition-colors cursor-pointer"
                    title="Configurar acceso a grupos en la nube"
                  >
                    <HiOutlineShare className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() =>
                    handleCopy(
                      item.id!,
                      `s3://${(item as Route).bucket}/${(item as Route).prefix}`,
                    )
                  }
                  className="p-1.5 bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors cursor-pointer"
                  title={t("my_routes.table.copy_uri_tooltip")}
                >
                  {copiedId === item.id ? (
                    <HiOutlineCheck className="w-4 h-4 text-primary" />
                  ) : (
                    <HiOutlineDuplicate className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => handleNavigate(item as Route)}
                  className="p-1.5 bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors cursor-pointer"
                  title={t("my_routes.table.go_path_tooltip")}
                >
                  <HiOutlineExternalLink className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setMoveItems([item]); }}
              className="p-1.5 bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors cursor-pointer"
              title={t("my_routes.table.move_tooltip")}
            >
              <HiOutlineSwitchHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={async () => {
                const msg = item.type === "folder"
                  ? t("my_routes.delete_folder_confirm", { name: item.name })
                  : t("my_routes.delete_route_confirm", { name: item.name });
                const confirmed = await confirm(msg, { title: t("my_routes.title"), kind: "warning" });
                if (confirmed) {
                  if (item.type === "folder") {
                    removeFolder(item.id!).then(loadData);
                  } else {
                    removeRoute(item.id!).then(loadData);
                  }
                }
              }}
              className="p-1.5 bg-surface-container border border-outline-variant text-error/80 hover:text-error hover:bg-error-container/20 rounded transition-colors cursor-pointer"
              title={t("my_routes.table.delete_tooltip")}
            >
              <HiOutlineTrash className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  const cloudColumns: Column<any>[] = [
    {
      key: "name",
      header: t("my_routes.table.name_col"),
      render: (item) => (
        <span className="font-semibold text-on-surface text-body-md">{item.name}</span>
      ),
    },
    {
      key: "path",
      header: t("my_routes.table.path_col"),
      className: "font-mono text-label-sm text-primary",
      render: (item) => `s3://${item.bucket}/${item.prefix}`,
    },
    {
      key: "creator",
      header: "Creado por",
      className: "text-body-sm text-on-surface-variant",
      render: (item) => {
        const creator = item.profiles;
        if (!creator) return item.created_by;
        return `${creator.first_name} ${creator.last_name}`.trim() || creator.email;
      },
    },
    {
      key: "status_actions",
      header: "Acceso / Acciones",
      className: "text-right",
      render: (item) => {
        const isDownloaded = routes.some(lr => lr.bucket === item.bucket && lr.prefix === item.prefix);
        const req = accessRequests.find(r => r.route_id === item.id && r.user_id === profile?.id);
        const hasAccess = !!item.aws_credentials;

        const handleRequest = async () => {
          const created = await createAccessRequest(item.id);
          if (created) {
            setActiveWaitingRequest(created);
            setWaitingCountdown(600);
          }
        };

        const handleImport = async () => {
          await addRoute({
            name: item.name,
            bucket: item.bucket,
            prefix: item.prefix,
            profile: "cloud-route",
            folder_id: null,
          });
          alert("Importado a favoritos locales con éxito!");
          await loadData();
        };

        return (
          <div className="flex items-center justify-end gap-2 animate-fade-in" onClick={e => e.stopPropagation()}>
            {/* Download/Import Status */}
            {isDownloaded ? (
              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-[10px] font-bold rounded-sm uppercase tracking-wider">
                Importado
              </span>
            ) : (
              <button
                onClick={handleImport}
                className="py-1 px-3 bg-surface-container border border-outline-variant text-on-surface text-label-sm font-semibold rounded hover:bg-surface-container-high transition-colors cursor-pointer"
                title="Importar a mis favoritos locales"
              >
                Importar
              </button>
            )}

            {/* Access Request Status */}
            {hasAccess ? (
              <button
                onClick={() => handleNavigate({
                  name: item.name,
                  bucket: item.bucket,
                  prefix: item.prefix,
                  profile: "cloud-route"
                })}
                className="py-1 px-3 bg-tertiary text-on-tertiary text-label-sm font-bold rounded hover:brightness-105 transition-all cursor-pointer flex items-center gap-1"
              >
                <HiOutlineExternalLink size={14} /> Abrir
              </button>
            ) : req && req.status === "pending" ? (
              <button
                onClick={() => {
                  setActiveWaitingRequest(req);
                  setWaitingCountdown(600);
                }}
                className="py-1 px-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 text-label-sm font-bold rounded hover:bg-yellow-500/20 transition-all cursor-pointer flex items-center gap-1.5 animate-pulse"
              >
                <HiOutlineClock size={14} /> Pendiente
              </button>
            ) : (
              <button
                onClick={handleRequest}
                className="py-1 px-3 bg-primary text-on-primary text-label-sm font-bold rounded hover:brightness-105 transition-all cursor-pointer flex items-center gap-1"
              >
                Pedir Acceso
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface p-6 animate-in fade-in duration-500 overflow-hidden">
      <div className="w-full flex-1 flex flex-col gap-6 min-h-0">
        <Breadcrumb
          onBackClick={handleBackClick}
          items={[
            {
              label: t("my_routes.title"),
              onClick: () => setCurrentFolderId(null),
              active: !currentFolderId,
            },
            ...breadcrumbPath.map((f, idx) => ({
              label: f.name,
              onClick: () => setCurrentFolderId(f.id!),
              active: idx === breadcrumbPath.length - 1,
            })),
          ]}
        />

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-surface-container-high text-primary border border-outline-variant rounded flex items-center justify-center">
              <HiOutlineLink className="w-5 h-5" />
            </div>
            <h1 className="text-headline-lg font-bold text-on-surface">{t("my_routes.title")}</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 bg-surface-container border border-outline-variant text-on-surface rounded hover:bg-surface-container-high transition-colors cursor-pointer"
              title={t("buckets.refresh")}
            >
              <HiOutlineRefresh className="w-4 h-4" />
            </button>
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface text-body-md font-medium rounded hover:bg-surface-container-high transition-colors cursor-pointer"
              title={t("my_routes.import_tooltip")}
            >
              <HiOutlineUpload className="w-4 h-4 text-on-surface-variant" /> {t("my_routes.import_btn")}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface text-body-md font-medium rounded hover:bg-surface-container-high transition-colors cursor-pointer"
              title={t("my_routes.export_tooltip")}
            >
              <HiOutlineDownload className="w-4 h-4 text-on-surface-variant" /> {t("my_routes.export_btn")}
            </button>
            {isOnline && (
              <button
                onClick={openSyncModal}
                className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-primary text-primary text-body-md font-medium rounded hover:bg-primary/10 transition-colors cursor-pointer font-semibold"
                title="Sincronizar tus rutas con la nube (subir o bajar cambios)"
              >
                <HiOutlineCloud className="w-4 h-4" /> Sincronizar Nube
              </button>
            )}
            <button
              onClick={() => setIsAddingFolder(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary text-body-md font-medium rounded border border-transparent hover:bg-primary/95 transition-colors cursor-pointer"
            >
              <HiOutlineFolderAdd className="w-4 h-4" /> {t("my_routes.new_folder_btn")}
            </button>
          </div>
        </div>
        {/* Tab Selection (only if online) */}
        {isOnline && (
          <div className="flex border-b border-outline-variant/30 gap-6 shrink-0 mt-2">
            <button
              onClick={() => setActiveTab('local')}
              className={`pb-2.5 text-body-md font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'local' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Mis Favoritos (Locales)
            </button>
            <button
              onClick={() => setActiveTab('cloud')}
              className={`pb-2.5 text-body-md font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'cloud' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Rutas de la Nube (Compartidas)
            </button>
          </div>
        )}

        {activeTab === 'local' ? (
          /* Main Explorer Container */
          <div className="flex-1 min-h-0 bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-surface-container border-b border-outline-variant flex items-center justify-between gap-4 flex-wrap shrink-0">
              <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                <div className="relative w-full max-w-md">
                  <HiOutlineSearch
                    className="absolute left-3 top-2.5 text-on-surface-variant"
                    size={16}
                  />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t("my_routes.search_placeholder")}
                    className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded focus:border-primary transition-all outline-none text-body-md text-on-surface"
                  />
                </div>
                {searchTerm.trim().toLowerCase().startsWith("s3://") && (
                  <button
                    onClick={() => {
                      let cleanUrl = searchTerm.trim().slice(5);
                      const slashIndex = cleanUrl.indexOf("/");
                      let bucket = "";
                      let prefix = "";
                      if (slashIndex === -1) {
                        bucket = cleanUrl;
                      } else {
                        bucket = cleanUrl.slice(0, slashIndex);
                        prefix = cleanUrl.slice(slashIndex + 1);
                      }
                      if (bucket) {
                        try {
                          bucket = decodeURIComponent(bucket);
                          prefix = decodeURIComponent(prefix);
                        } catch (e) {}
                        navigate(`/buckets/${bucket}?prefix=${encodeURIComponent(prefix)}`);
                        setSearchTerm("");
                      }
                    }}
                    className="flex items-center gap-1.5 text-primary text-label-sm font-semibold bg-primary-container/20 px-3 py-1.5 rounded border border-primary-container/30 hover:bg-primary/20 transition-all uppercase tracking-wider cursor-pointer animate-in slide-in-from-left-2"
                  >
                    <HiOutlineDatabase size={14} /> {t("my_routes.go_to_s3_btn")}
                  </button>
                )}
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                    <span className="text-label-sm font-semibold text-primary bg-primary-container/20 px-2 py-0.5 rounded-sm border border-primary-container/30 uppercase">
                      {t("my_routes.selected_items", { count: selectedIds.size })}
                    </span>
                    <button
                      onClick={() => {
                        const selected = displayItems.filter(item => selectedIds.has(`${item.type}-${item.id}`));
                        setMoveItems(selected);
                      }}
                      className="flex items-center gap-1.5 text-primary text-label-sm font-semibold bg-primary-container/20 px-3 py-1.5 rounded border border-primary-container/30 hover:bg-primary-container/35 transition-colors uppercase tracking-wider cursor-pointer"
                      title={t("my_routes.move_btn")}
                    >
                      <HiOutlineSwitchHorizontal size={14} /> {t("my_routes.move_btn")}
                    </button>
                    <button
                      onClick={async () => {
                        const confirmed = await confirm(
                          t("my_routes.delete_confirm", { count: selectedIds.size }),
                          { title: t("my_routes.title"), kind: "warning" }
                        );
                        if (!confirmed) return;
                        for (const cid of selectedIds) {
                          const [type, id] = cid.split("-");
                          if (type === "folder") await removeFolder(parseInt(id));
                          else await removeRoute(parseInt(id));
                        }
                        setSelectedIds(new Set());
                        loadData();
                      }}
                      className="flex items-center gap-1.5 text-error text-label-sm font-semibold bg-error-container/20 px-3 py-1.5 rounded border border-error-container/30 hover:bg-error-container/30 transition-colors uppercase tracking-wider cursor-pointer"
                      title={t("my_routes.delete_btn")}
                    >
                      <HiOutlineTrash size={14} /> {t("my_routes.delete_btn")}
                    </button>
                  </div>
                )}
              </div>
              <div className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                {t("my_routes.items_count", { count: displayItems.length })}
              </div>
            </div>

            {isAddingFolder && (
              <div className="px-4 py-3 bg-surface-container border-b border-outline-variant flex items-center gap-3 animate-in slide-in-from-top-4">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={t("my_routes.new_folder_placeholder")}
                  className="flex-1 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded outline-none focus:border-primary text-body-md text-on-surface"
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      addFolder(newFolderName, currentFolderId).then(() => {
                        setNewFolderName("");
                        setIsAddingFolder(false);
                        loadData();
                      });
                    if (e.key === "Escape") setIsAddingFolder(false);
                  }}
                />
                <button
                  onClick={() =>
                    addFolder(newFolderName, currentFolderId).then(() => {
                      setNewFolderName("");
                      setIsAddingFolder(false);
                      loadData();
                    })
                  }
                  className="bg-primary text-on-primary px-4 py-1.5 rounded font-medium text-body-md hover:bg-primary/95 transition-colors cursor-pointer"
                >
                  {t("my_routes.create_btn")}
                </button>
                <button
                  onClick={() => setIsAddingFolder(false)}
                  className="px-3 py-1.5 text-on-surface-variant font-medium hover:bg-surface-container-high rounded text-body-md transition-colors cursor-pointer"
                >
                  {t("my_routes.cancel_btn")}
                </button>
              </div>
            )}

            <GenericTable
              items={displayItems}
              columns={columns}
              isLoading={isLoading}
              rowKey={(item) => `${item.type}-${item.id}`}
              onRowClick={(item) =>
                item.type === "folder"
                  ? setCurrentFolderId(item.id!)
                  : handleNavigate(item as Route)
              }
              selectedIds={selectedIds}
              onToggleSelection={toggleSelection}
              onSelectAll={() => {
                if (selectedIds.size === displayItems.length)
                  setSelectedIds(new Set());
                else
                  setSelectedIds(
                    new Set(displayItems.map((i) => `${i.type}-${i.id}`)),
                  );
              }}
              isAllSelected={
                displayItems.length > 0 &&
                selectedIds.size === displayItems.length
              }
              emptyMessage={t("my_routes.empty_message")}
            />
          </div>
        ) : (
          /* Cloud Routes Explorer Container */
          <div className="flex-1 min-h-0 bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden flex flex-col animate-in fade-in duration-300">
            <div className="px-4 py-3 bg-surface-container border-b border-outline-variant flex items-center justify-between gap-4 flex-wrap shrink-0">
              <span className="text-body-sm font-semibold text-on-surface-variant">
                Colección de rutas S3 compartidas en la nube a través de grupos de acceso.
              </span>
              <button
                onClick={async () => {
                  setSyncing(true);
                  await fetchCloudRoutes();
                  setSyncing(false);
                }}
                className="p-2 bg-surface-container border border-outline-variant text-on-surface rounded hover:bg-surface-container-high transition-colors cursor-pointer"
                title={t("buckets.refresh")}
              >
                <HiOutlineRefresh className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <GenericTable
              items={cloudRoutes}
              columns={cloudColumns}
              isLoading={syncing}
              rowKey={(item) => item.id}
              emptyMessage="No hay rutas disponibles en la nube."
            />
          </div>
        )}
      </div>

      {moveItems.length > 0 && (
        <MoveToModal
          moveItems={moveItems}
          folders={folders}
          onConfirm={handleMove}
          onClose={() => setMoveItems([])}
        />
      )}

      {/* Cloud Sync Modal (Upload & Download Tabs) */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
          <div className="bg-surface-container border border-outline-variant max-w-lg w-full p-6 rounded-md shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <h3 className="text-body-lg font-bold text-on-surface flex items-center gap-2">
                <HiOutlineCloud className="text-primary" />
                Sincronizar con la Nube
              </h3>
              <button 
                onClick={() => setShowSyncModal(false)} 
                className="text-on-surface-variant hover:text-on-surface cursor-pointer p-1 rounded-md hover:bg-surface-variant"
              >
                <HiOutlineX size={18} />
              </button>
            </div>

            {/* Sync Tabs */}
            <div className="flex border-b border-outline-variant/30 gap-4 shrink-0">
              <button
                onClick={() => setSyncTab('upload')}
                className={`pb-2 text-body-sm font-semibold border-b-2 transition-all cursor-pointer ${syncTab === 'upload' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
              >
                Subir Cambios (Local → Nube)
              </button>
              <button
                onClick={() => setSyncTab('download')}
                className={`pb-2 text-body-sm font-semibold border-b-2 transition-all cursor-pointer ${syncTab === 'download' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
              >
                Bajar Cambios (Nube → Local)
              </button>
            </div>

            {syncTab === 'upload' ? (
              <div className="flex flex-col gap-3">
                <p className="text-body-sm text-on-surface-variant">
                  Sincroniza tus rutas locales subiéndolas a la nube de Supabase.
                </p>
                <div>
                  <label className="text-label-sm text-on-surface-variant font-medium block mb-1">
                    Credencial AWS a Asociar (Opcional)
                  </label>
                  <select
                    className="w-full bg-surface border border-outline-variant rounded-md py-1.5 px-3 text-body-sm text-on-surface focus:border-primary focus:outline-none"
                    value={selectedCredId}
                    onChange={(e) => setSelectedCredId(e.target.value)}
                  >
                    <option value="">-- Sin credenciales fijas (Usar locales activas) --</option>
                    {cloudCredentials.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.region})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-on-surface-variant mt-1 font-sans">
                    Nota: Los administradores pueden dejar esto vacío para sincronizar y asociar automáticamente sus credenciales locales activas.
                  </p>
                </div>

                <div className="border border-outline-variant/30 rounded-md max-h-[180px] overflow-y-auto p-3 flex flex-col gap-2 font-mono text-label-sm">
                  <span className="text-label-sm text-on-surface-variant font-bold font-sans uppercase tracking-wider mb-1">
                    Seleccionar Rutas locales a subir ({routes.length})
                  </span>
                  {routes.length === 0 ? (
                    <span className="text-body-sm text-on-surface-variant italic py-2">No hay rutas locales para subir.</span>
                  ) : (
                    routes.map((r) => {
                      if (!r.id) return null;
                      return (
                        <label key={r.id} className="flex items-center gap-2 text-on-surface cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={!!syncSelection[r.id]}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setSyncSelection(prev => ({ ...prev, [r.id!]: val }));
                            }}
                            className="rounded border-outline-variant text-primary focus:ring-primary"
                          />
                          <span className="truncate">{r.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowSyncModal(false)}
                    className="py-1.5 px-4 bg-surface-container border border-outline text-on-surface text-label-sm rounded-sm hover:bg-surface-variant cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSyncToCloud}
                    disabled={syncing || !routes.some(r => r.id && syncSelection[r.id])}
                    className="py-1.5 px-5 bg-primary text-on-primary text-label-sm rounded-sm hover:brightness-105 cursor-pointer font-semibold disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {syncing ? (
                      <div className="w-4 h-4 border-2 border-on-primary/20 border-t-on-primary rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <HiOutlineCheck size={14} />
                        Subir Cambios
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-body-sm text-on-surface-variant">
                  Descarga rutas compartidas en la nube para agregarlas a tus favoritos locales.
                </p>

                <div className="border border-outline-variant/30 rounded-md max-h-[220px] overflow-y-auto p-3 flex flex-col gap-2 font-mono text-label-sm">
                  <span className="text-label-sm text-on-surface-variant font-bold font-sans uppercase tracking-wider mb-1">
                    Rutas en la nube disponibles
                  </span>
                  {cloudRoutes.filter(
                    cr => !routes.some(lr => lr.bucket === cr.bucket && lr.prefix === cr.prefix)
                  ).length === 0 ? (
                    <span className="text-body-sm text-on-surface-variant italic py-4 text-center font-sans">
                      No hay rutas nuevas en la nube para descargar.
                    </span>
                  ) : (
                    cloudRoutes
                      .filter(cr => !routes.some(lr => lr.bucket === cr.bucket && lr.prefix === cr.prefix))
                      .map((cr) => (
                        <label key={cr.id} className="flex items-center gap-2 text-on-surface cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={!!downloadSelection[cr.id]}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setDownloadSelection(prev => ({ ...prev, [cr.id]: val }));
                            }}
                            className="rounded border-outline-variant text-primary focus:ring-primary"
                          />
                          <span className="truncate font-sans font-semibold text-on-surface">{cr.name}</span>
                          <span className="text-[10px] text-primary truncate max-w-[150px]">s3://{cr.bucket}/{cr.prefix}</span>
                        </label>
                      ))
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowSyncModal(false)}
                    className="py-1.5 px-4 bg-surface-container border border-outline text-on-surface text-label-sm rounded-sm hover:bg-surface-variant cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDownloadFromCloud}
                    disabled={syncing || !Object.values(downloadSelection).some(Boolean)}
                    className="py-1.5 px-5 bg-primary text-on-primary text-label-sm rounded-sm hover:brightness-105 cursor-pointer font-semibold disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {syncing ? (
                      <div className="w-4 h-4 border-2 border-on-primary/20 border-t-on-primary rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <HiOutlineCheck size={14} />
                        Bajar Cambios
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Group Access Configuration Modal */}
      {shareTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
          <div className="bg-surface-container border border-outline-variant max-w-md w-full p-6 rounded-md shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <h3 className="text-body-lg font-bold text-on-surface flex items-center gap-2">
                <HiOutlineUsers className="text-primary" />
                Configurar Acceso a Grupos
              </h3>
              <button 
                onClick={() => setShareTargetItem(null)} 
                className="text-on-surface-variant hover:text-on-surface cursor-pointer p-1 rounded-md hover:bg-surface-variant"
              >
                <HiOutlineX size={18} />
              </button>
            </div>

            <p className="text-body-sm text-on-surface-variant leading-relaxed">
              Define qué grupos tienen permisos para usar la ruta <strong className="text-on-surface">s3://{shareTargetItem.bucket}/{shareTargetItem.prefix}</strong> y sus credenciales en la nube.
            </p>

            {loadingPermissions ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <span className="text-body-sm text-on-surface-variant font-medium">Cargando grupos y permisos...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <span className="text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">
                  Grupos Disponibles ({groups.length})
                </span>
                
                {groups.length === 0 ? (
                  <p className="text-body-sm text-on-surface-variant italic py-4 text-center">
                    No tienes grupos de acceso creados en la nube.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {groups.map((group) => {
                      const isChecked = activeRoutePermissions.includes(group.id);
                      return (
                        <label 
                          key={group.id} 
                          className="flex items-center justify-between p-3 bg-surface-container-low border border-outline-variant rounded-md cursor-pointer hover:bg-surface-container transition-colors"
                        >
                          <div className="flex flex-col">
                            <span className="text-body-sm font-semibold text-on-surface">{group.name}</span>
                            <span className="text-[10px] text-on-surface-variant font-mono">
                              Propietario: {group.owner?.email || group.owner_id}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={async (e) => {
                              const checked = e.target.checked;
                              const cRoutes = useSupabaseStore.getState().routes;
                              const cloudRoute = cRoutes.find(r => r.bucket === shareTargetItem.bucket && r.prefix === shareTargetItem.prefix);
                              if (!cloudRoute) return;

                              if (checked) {
                                await shareRouteWithGroup(cloudRoute.id, group.id);
                                setActiveRoutePermissions(prev => [...prev, group.id]);
                              } else {
                                await unshareRouteWithGroup(cloudRoute.id, group.id);
                                setActiveRoutePermissions(prev => prev.filter(id => id !== group.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-2 border-t border-outline-variant/30 pt-3">
              <button
                type="button"
                onClick={() => setShareTargetItem(null)}
                className="py-1.5 px-6 bg-primary text-on-primary text-label-sm font-semibold rounded-sm hover:brightness-105 cursor-pointer"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: WAITING ADMIN APPROVAL */}
      {activeWaitingRequest && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-200">
          <div className="bg-surface-container border border-outline-variant max-w-sm w-full p-6 rounded-md shadow-2xl flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary relative">
              <HiOutlineClock className="animate-pulse" size={24} />
            </div>
            
            <div>
              <h3 className="text-body-lg font-bold text-on-surface">
                {activeWaitingRequest.status === "pending"
                  ? "Esperando Aprobación..."
                  : activeWaitingRequest.status === "rejected"
                  ? "Solicitud Rechazada"
                  : "Solicitud Expirada"}
              </h3>
              <p className="text-body-sm text-on-surface-variant mt-2">
                {activeWaitingRequest.status === "pending"
                  ? "Tu solicitud ha sido enviada. Esperando a que un administrador la apruebe."
                  : activeWaitingRequest.status === "rejected"
                  ? "Tu solicitud de acceso ha sido rechazada por el administrador."
                  : "Tu solicitud de acceso ha expirado."}
              </p>
            </div>

            {activeWaitingRequest.status === "pending" && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Expira en:
                </span>
                <span className="text-headline-md font-mono font-bold text-primary">
                  {formatTime(waitingCountdown)}
                </span>
              </div>
            )}

            <button
              onClick={() => setActiveWaitingRequest(null)}
              className="py-1.5 px-6 bg-surface-container-high border border-outline text-on-surface text-label-sm font-semibold rounded-sm hover:bg-surface-variant active:scale-[0.98] transition-all cursor-pointer"
            >
              {activeWaitingRequest.status === "pending" ? "Cancelar" : "Cerrar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
