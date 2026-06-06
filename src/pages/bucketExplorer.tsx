import { useState, useMemo, useEffect } from "react";
import {
  useParams,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  HiOutlineLogout,
  HiOutlineStar,
  HiOutlineRefresh,
  HiOutlineFolder,
  HiOutlinePhotograph,
  HiOutlineCode,
  HiOutlineDocument,
  HiOutlineDocumentText,
  HiOutlineDownload,
  HiOutlineShare,
  HiOutlineClock,
  HiOutlineSearch,
} from "react-icons/hi";
import { HiStar } from "react-icons/hi";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  listBucketObjects,
  isAwsAuthenticated,
  setAwsCredentials,
  clearAwsCredentials,
  generatePresignedUrl,
  startS3Download,
  uploadS3File,
  getCurrentActiveProfile,
  getAwsAccountDisplayName,
} from "../features/aws/s3Client";
import {
  addRoute,
  listRoutes,
  listFolders,
  FavoriteFolder,
  removeRoute,
} from "../features/favorites/favoritesStore";
import { getLocalSSOCredentials } from "../features/aws/awsCli";
import { useDownloadStore } from "../features/downloads/downloadStore";
import { useDatabase } from "../shared/hooks/useDatabase";

// Atomic Components
import { FavoriteModal } from "../features/explorer/components/FavoriteModal";
import { UploadStatus } from "../features/explorer/components/UploadStatus";
import { ShareModal } from "../features/explorer/components/ShareModal";
import { S3Object, SortKey, SortConfig } from "../features/explorer/types";
import { GenericTable, Column } from "../components/GenericTable";
import { Breadcrumb } from "../components/Breadcrumb";

const formatSize = (bytes?: number): string => {
  if (bytes === undefined || bytes === 0) return "-";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const inferType = (key: string): string => {
  const ext = key.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext || ""))
    return "image";
  if (
    [
      "ts",
      "tsx",
      "js",
      "jsx",
      "py",
      "rs",
      "go",
      "html",
      "css",
      "json",
    ].includes(ext || "")
  )
    return "code";
  return "document";
};

const getIconForType = (type: string) => {
  switch (type) {
    case "folder":
      return <HiOutlineFolder className="text-primary" size={22} />;
    case "image":
      return <HiOutlinePhotograph className="text-tertiary" size={22} />;
    case "code":
      return <HiOutlineCode className="text-secondary" size={22} />;
    case "document":
      return <HiOutlineDocumentText className="text-on-surface-variant" size={22} />;
    default:
      return <HiOutlineDocument className="text-on-surface-variant/70" size={22} />;
  }
};

export default function BucketExplorerPage() {
  const { bucketName } = useParams();
  const navigate = useNavigate();
  const { logAction } = useDatabase();
  const [searchParams, setSearchParams] = useSearchParams();

  // Explorer State
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ssoNeedsLogin, setSsoNeedsLogin] = useState(false);
  const [expiredProfile, setExpiredProfile] = useState<string | null>(null);
  const [currentPrefix, setCurrentPrefix] = useState(
    searchParams.get("prefix") || "",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "name",
    direction: "asc",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Favorites states
  const [isFavorite, setIsFavorite] = useState(false);
  const [showFavoriteModal, setShowFavoriteModal] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [availableFolders, setAvailableFolders] = useState<FavoriteFolder[]>(
    [],
  );
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);

  // Feedback states
  const [, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Share modal states
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [itemToShare, setItemToShare] = useState<S3Object | null>(null);

  const downloadTasks = useDownloadStore((state) => state.tasks);

  // Sync currentPrefix with searchParams
  useEffect(() => {
    const prefix = searchParams.get("prefix") || "";
    if (prefix !== currentPrefix) {
      setCurrentPrefix(prefix);
    }
  }, [searchParams]);

  const updatePrefix = (newPrefix: string) => {
    setCurrentPrefix(newPrefix);
    if (newPrefix) {
      setSearchParams({ prefix: newPrefix });
    } else {
      setSearchParams({});
    }
  };

  const fetchObjects = async () => {
    if (!bucketName) return;
    setIsLoading(true);
    setError(null);
    setSsoNeedsLogin(false);
    setExpiredProfile(null);
    try {
      const data = await listBucketObjects(bucketName, currentPrefix);

      const foldersMapped: S3Object[] = data.folders.map((f) => {
        const fullPrefix = f.Prefix || "";
        const parts = fullPrefix.split("/").filter(Boolean);
        const name = parts[parts.length - 1] + "/";
        return {
          id: fullPrefix,
          name: name,
          type: "folder",
          date: "-",
          size: "-",
          rawSize: 0,
          storageClass: "-",
        };
      });

      const filesMapped: S3Object[] = data.files.map((f) => ({
        id: f.Key || "",
        name: (f.Key || "").split("/").pop() || "",
        type: inferType(f.Key || ""),
        date: f.LastModified?.toISOString() || "-",
        size: formatSize(f.Size),
        rawSize: f.Size || 0,
        storageClass: f.StorageClass || "Standard",
      }));

      setObjects([...foldersMapped, ...filesMapped]);
    } catch (err: any) {
      console.error("Failed to fetch bucket objects:", err);
      const errMsg = err.message || "Unknown error occurred while fetching objects.";
      setError(errMsg);
      if (
        errMsg.toLowerCase().includes("expired") ||
        errMsg.toLowerCase().includes("refresh failed") ||
        errMsg.toLowerCase().includes("login first")
      ) {
        setSsoNeedsLogin(true);
        setExpiredProfile(getCurrentActiveProfile() || "default");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkIsFavorite = async () => {
    if (!bucketName) return;
    try {
      const routes = await listRoutes();
      const normalizePrefix = (p: string) => p.replace(/^\/+|\/+$/g, "");
      const exists = routes.some(
        (f) =>
          f.bucket === bucketName &&
          normalizePrefix(f.prefix) === normalizePrefix(currentPrefix),
      );
      setIsFavorite(exists);
    } catch (err) {
      console.error("Failed to check routes", err);
    }
  };

  const handleToggleFavorite = async () => {
    if (!bucketName) return;

    if (isFavorite) {
      // Remove from favorites
      try {
        const routes = await listRoutes();
        const normalizePrefix = (p: string) => p.replace(/^\/+|\/+$/g, "");
        const match = routes.find(
          (f) =>
            f.bucket === bucketName &&
            normalizePrefix(f.prefix) === normalizePrefix(currentPrefix),
        );
        if (match && match.id) {
          await removeRoute(match.id);
          setIsFavorite(false);
        }
      } catch (err) {
        console.error("Failed to remove from favorites", err);
        alert("Error removing from favorites");
      }
    } else {
      await loadFolders();
      setShowFavoriteModal(true);
    }
  };

  const loadFolders = async () => {
    try {
      const flds = await listFolders();
      setAvailableFolders(flds);
    } catch (err) {
      console.error("Failed to load folders", err);
    }
  };

  useEffect(() => {
    const initExplorer = async () => {
      if (!isAwsAuthenticated()) {
        navigate("/buckets", { replace: true });
        return;
      }

      // Check if we need to swap profiles based on the favorite route
      try {
        const routes = await listRoutes();
        const currentRoute = routes.find(
          (r) => r.bucket === bucketName && (currentPrefix.startsWith(r.prefix) || r.prefix === ""),
        );

        if (currentRoute && currentRoute.profile !== getCurrentActiveProfile()) {
          console.log(`Swapping profile to: ${currentRoute.profile}`);
          setIsLoading(true);
          const creds = await getLocalSSOCredentials(currentRoute.profile);
          setAwsCredentials(
            creds.accessKeyId,
            creds.secretAccessKey,
            creds.sessionToken,
            localStorage.getItem("aws_region") || "us-east-1",
          );
          localStorage.setItem("aws_sso_profile", currentRoute.profile);
        }
      } catch (err: any) {
        console.error("Auto-profile swap failed", err);
        const errMsg = err.message || "Auto-profile swap failed";
        setError(errMsg);
        if (
          errMsg.toLowerCase().includes("expired") ||
          errMsg.toLowerCase().includes("refresh failed") ||
          errMsg.toLowerCase().includes("login first")
        ) {
          setSsoNeedsLogin(true);
          const routes = await listRoutes();
          const currentRoute = routes.find(
            (r) => r.bucket === bucketName && (currentPrefix.startsWith(r.prefix) || r.prefix === ""),
          );
          setExpiredProfile(currentRoute?.profile || getCurrentActiveProfile() || "default");
        }
        setIsLoading(false);
        return;
      }

      await fetchObjects();
      await checkIsFavorite();
      await loadFolders();
      
      // Log visit action
      logAction("visit", `Visited s3://${bucketName}/${currentPrefix}`);
    };

    initExplorer();
  }, [bucketName, currentPrefix, navigate]);

  const handleAddFavorite = async () => {
    if (!bucketName || !favoriteName.trim()) return;
    setIsSavingFavorite(true);
    try {
      const currentProfile =
        localStorage.getItem("aws_sso_profile") || "default";
      await addRoute({
        name: favoriteName.trim(),
        bucket: bucketName,
        prefix: currentPrefix,
        profile: currentProfile,
        folder_id: selectedFolderId,
      });
      setIsFavorite(true);
      setShowFavoriteModal(false);
      setFavoriteName("");
      setSelectedFolderId(null);

      // Log favorite action
      logAction("favorite", `Marked s3://${bucketName}/${currentPrefix} as favorite '${favoriteName.trim()}'`);
    } catch (err: any) {
      console.error("Failed to add favorite", err);
      alert("Error saving favorite: " + err.message);
    } finally {
      setIsSavingFavorite(false);
    }
  };

  const handleShare = (object: S3Object) => {
    setItemToShare(object);
    setIsShareModalOpen(true);
  };

  const handleGenerateSharedLink = async (expiresIn: number) => {
    if (!bucketName || !itemToShare) throw new Error("No object selected");
    return await generatePresignedUrl(bucketName, itemToShare.id, expiresIn);
  };

  const handleDownload = async (object: S3Object) => {
    try {
      await startS3Download(bucketName!, object.id, object.name);
    } catch (err: any) {
      alert("Error starting download: " + err.message);
    }
  };

  const handleUpload = async () => {
    if (!bucketName) return;
    try {
      const selected = await open({
        multiple: true,
        title: "Select files to upload",
      });
      if (!selected) return;
      const files = Array.isArray(selected) ? selected : [selected];
      setIsUploading(true);
      let uploadedCount = 0;
      for (const filePath of files) {
        const fileName = filePath.split(/[\\/]/).pop() || "unknown";
        setUploadStatus(
          `Uploading ${fileName}... (${uploadedCount + 1}/${files.length})`,
        );
        const fileData = await readFile(filePath);
        const s3Key = currentPrefix + fileName;
        await uploadS3File(bucketName, s3Key, fileData);
        uploadedCount++;
      }
      setUploadStatus(`Successfully uploaded ${uploadedCount} file(s)`);
      setTimeout(() => setUploadStatus(null), 3000);
      fetchObjects();
    } catch (err: any) {
      console.error("Upload failed", err);
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const currentFiles = useMemo(() => {
    let filtered = objects.filter((file) => {
      const matchesSearch = file.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "all" || file.type === typeFilter;
      return matchesSearch && matchesType;
    });

    filtered.sort((a, b) => {
      let valA: any = a[sortConfig.key];
      let valB: any = b[sortConfig.key];

      if (sortConfig.key === "size") {
        valA = a.rawSize;
        valB = b.rawSize;
      }

      if (sortConfig.key === "name") {
        if (a.type === "folder" && b.type !== "folder") return -1;
        if (a.type !== "folder" && b.type === "folder") return 1;
      }

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [objects, searchTerm, typeFilter, sortConfig]);

  const isAllSelected =
    currentFiles.length > 0 && selectedIds.size === currentFiles.length;

  const toggleSelection = (id: string | number) => {
    const next = new Set(selectedIds);
    if (next.has(id.toString())) next.delete(id.toString());
    else next.add(id.toString());
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (isAllSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(currentFiles.map((f) => f.id)));
  };

  const handleLogout = () => {
    clearAwsCredentials();
    localStorage.removeItem("aws_sso_profile");
    localStorage.removeItem("aws_region");
    localStorage.removeItem("aws_auth_method");
    navigate("/buckets", { replace: true });
  };

  const columns: Column<S3Object>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (obj) => {
        const downloadTask = downloadTasks.find(
          (t) =>
            t.key === obj.id &&
            (t.status === "downloading" || t.status === "queued"),
        );
        return (
          <div className="flex items-center gap-3">
            <div className="group-hover:scale-105 transition-transform flex items-center">
              {getIconForType(obj.type)}
            </div>
            <div className="flex flex-col min-w-0">
              <span
                className={`font-bold truncate text-body-md ${obj.type === "folder" ? "text-primary hover:underline" : "text-on-surface"}`}
              >
                {obj.name}
              </span>
              {downloadTask && (
                <div className="flex items-center gap-1.5 mt-0.5 animate-in slide-in-from-top-1">
                  {downloadTask.status === "downloading" ? (
                    <>
                      <div className="w-16 h-1 bg-surface-container rounded-sm overflow-hidden border border-outline-variant/30">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${downloadTask.progress}%` }}
                        />
                      </div>
                      <span className="text-label-sm text-primary font-mono font-medium">
                        {Math.round(downloadTask.progress)}%
                      </span>
                    </>
                  ) : (
                    <div className="flex items-center gap-1 text-label-sm text-on-surface-variant font-mono uppercase tracking-wider">
                      <HiOutlineClock className="w-3 h-3" /> Queued
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      className:
        "text-on-surface-variant font-medium text-label-sm uppercase tracking-wider font-mono",
    },
    {
      key: "date",
      header: "Last Modified",
      sortable: true,
      className: "text-on-surface-variant text-body-md",
      render: (obj) =>
        obj.date !== "-" ? new Date(obj.date).toLocaleString() : "-",
    },
    {
      key: "size",
      header: "Size",
      sortable: true,
      className: "text-on-surface-variant text-body-md",
    },
    {
      key: "storageClass",
      header: "Storage Class",
      render: (obj) =>
        obj.storageClass !== "-" ? (
          <span className="px-1.5 py-0.5 bg-surface-container-high text-on-surface-variant font-medium text-label-sm rounded-sm uppercase border border-outline-variant tracking-wider font-mono">
            {obj.storageClass}
          </span>
        ) : (
          "-"
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (obj) => {
        const isDownloading = downloadTasks.some(
          (t) =>
            t.key === obj.id &&
            (t.status === "downloading" || t.status === "queued"),
        );
        return (
          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {obj.type !== "folder" && !isDownloading && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(obj);
                  }}
                  className="p-1 text-on-surface-variant hover:text-primary hover:bg-surface-container-highest rounded border border-transparent transition-all cursor-pointer"
                  title="Download"
                >
                  <HiOutlineDownload size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare(obj);
                  }}
                  className="p-1 text-on-surface-variant hover:text-primary hover:bg-surface-container-highest rounded border border-transparent transition-all cursor-pointer"
                  title="Share"
                >
                  <HiOutlineShare size={16} />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface p-4 md:p-6 font-inter text-on-surface overflow-hidden transition-colors duration-300">
      <div className="w-full mx-auto flex-1 flex flex-col min-h-0">
        <Breadcrumb
          items={[
            { label: getAwsAccountDisplayName(), path: "/buckets" },
            { label: "Buckets", path: "/buckets" },
            {
              label: bucketName || "Bucket",
              onClick: () => updatePrefix(""),
              active: !currentPrefix,
            },
            ...currentPrefix
              .split("/")
              .filter(Boolean)
              .map((part, idx, arr) => ({
                label: part,
                onClick: () =>
                  updatePrefix(arr.slice(0, idx + 1).join("/") + "/"),
                active: idx === arr.length - 1,
              })),
          ]}
        />

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-headline-lg font-bold text-on-surface tracking-tight flex items-center gap-2">
              <div className="p-1.5 bg-surface-container-high text-primary border border-outline-variant rounded">
                <HiOutlineFolder size={20} />
              </div>
              {currentPrefix.split("/").filter(Boolean).pop() || bucketName}
            </h1>
            <button
              onClick={handleToggleFavorite}
              className={`p-1.5 rounded transition-all cursor-pointer ${isFavorite ? "text-amber-400 bg-surface-container border border-amber-500/20" : "text-on-surface-variant bg-surface-container border border-outline-variant hover:text-amber-500 hover:bg-surface-container-high"}`}
              title={isFavorite ? "Remove from My Routes" : "Add to My Routes"}
            >
              {isFavorite ? <HiStar size={20} /> : <HiOutlineStar size={20} />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchObjects}
              className="p-2 bg-surface-container border border-outline-variant text-on-surface rounded hover:bg-surface-container-high transition-all cursor-pointer"
              title="Refresh"
            >
              <HiOutlineRefresh
                size={16}
                className={isLoading ? "animate-spin" : ""}
              />
            </button>
            <button
              onClick={handleUpload}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary text-body-md font-medium rounded hover:bg-primary/95 transition-all border border-transparent cursor-pointer"
            >
              Upload Files
            </button>
            <button
              onClick={handleLogout}
              className="p-2 bg-error-container/20 text-error rounded hover:bg-error-container/30 border border-error/20 transition-all cursor-pointer"
              title="Sign out"
            >
              <HiOutlineLogout size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error-container text-on-error-container border border-error/20 rounded text-body-md font-medium animate-in slide-in-from-top-2">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <span className="font-bold text-body-md leading-relaxed">{error}</span>
                {!ssoNeedsLogin && (
                  <button
                    onClick={fetchObjects}
                    className="px-3 py-1.5 bg-error-container/50 hover:bg-error-container/80 text-on-error-container font-mono text-label-sm rounded transition-all cursor-pointer uppercase tracking-wider"
                  >
                    Retry
                  </button>
                )}
              </div>
              
              {ssoNeedsLogin && (
                <div className="mt-2 p-3 bg-surface-container border border-outline-variant rounded flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-in fade-in duration-300">
                  <div className="flex-1">
                    <h4 className="text-label-sm font-bold text-primary uppercase tracking-wider font-mono">
                      SSO Session Expired
                    </h4>
                    <p className="text-label-sm text-on-surface-variant font-medium mt-0.5 font-sans leading-relaxed">
                      The active token for AWS profile '{expiredProfile}' has expired. Click below to re-authenticate in your browser.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={async () => {
                      setIsLoading(true);
                      setError(null);
                      try {
                        const { triggerSSOLogin } = await import("../features/aws/awsCli");
                        await triggerSSOLogin(expiredProfile || "default");
                        setSsoNeedsLogin(false);
                        setExpiredProfile(null);
                        
                        // Re-authenticate locally
                        const creds = await getLocalSSOCredentials(expiredProfile || "default");
                        setAwsCredentials(
                          creds.accessKeyId,
                          creds.secretAccessKey,
                          creds.sessionToken,
                          localStorage.getItem("aws_region") || "us-east-1",
                        );
                        localStorage.setItem("aws_sso_profile", expiredProfile || "default");
                        
                        // Retry fetching objects
                        await fetchObjects();
                      } catch (err: any) {
                        setError(err.message || "Failed to trigger SSO login");
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/95 text-on-primary font-medium rounded transition-all text-body-md whitespace-nowrap cursor-pointer"
                  >
                    Log in to AWS SSO
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant flex items-center justify-between gap-4 flex-wrap shrink-0">
            <div className="flex items-center gap-4 flex-1 min-w-[300px]">
              <div className="relative w-full max-w-md">
                <HiOutlineSearch
                  className="absolute left-3 top-3 text-on-surface-variant"
                  size={16}
                />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter objects by name..."
                  className="w-full pl-9 pr-4 py-2 bg-surface-container border border-outline-variant rounded text-body-md text-on-surface focus:outline-none focus:border-primary transition-all outline-none font-mono"
                />
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                  <span className="text-label-sm font-medium text-primary bg-surface-container-high px-2 py-0.5 rounded-sm border border-outline-variant uppercase">
                    {selectedIds.size} selected
                  </span>
                  <button
                    onClick={() => {
                      Array.from(selectedIds).forEach((id) => {
                        const obj = objects.find((o) => o.id === id);
                        if (obj && obj.type !== "folder") handleDownload(obj);
                      });
                      setSelectedIds(new Set());
                    }}
                    className="flex items-center gap-1.5 text-primary text-label-sm font-medium bg-surface-container-high px-3 py-1 rounded border border-outline-variant hover:bg-surface-container-highest transition-colors uppercase tracking-wider font-mono cursor-pointer"
                  >
                    <HiOutlineDownload size={14} /> Download
                  </button>
                </div>
              )}
            </div>
            <div className="text-label-sm font-medium text-on-surface-variant font-mono uppercase tracking-wider">
              {currentFiles.length} items
            </div>
          </div>

          <GenericTable
            items={currentFiles}
            columns={columns}
            isLoading={isLoading}
            rowKey={(obj) => obj.id}
            onRowClick={(obj) =>
              obj.type === "folder"
                ? updatePrefix(obj.id)
                : toggleSelection(obj.id)
            }
            selectedIds={selectedIds}
            onToggleSelection={toggleSelection}
            onSelectAll={handleSelectAll}
            isAllSelected={isAllSelected}
            sortConfig={sortConfig as any}
            onSort={handleSort as any}
            emptyMessage="This folder is empty"
          />
        </div>

        <UploadStatus status={uploadStatus} />

        <FavoriteModal
          isOpen={showFavoriteModal}
          onClose={() => setShowFavoriteModal(false)}
          onSave={handleAddFavorite}
          name={favoriteName}
          onNameChange={setFavoriteName}
          folders={availableFolders}
          selectedFolderId={selectedFolderId}
          onFolderChange={setSelectedFolderId}
          isSaving={isSavingFavorite}
        />

        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => {
            setIsShareModalOpen(false);
            setItemToShare(null);
          }}
          object={itemToShare}
          onGenerate={handleGenerateSharedLink}
        />
      </div>
    </div>
  );
}
