import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
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
  HiOutlinePencil,
  HiOutlineDotsVertical,
  HiOutlineColorSwatch,
  HiOutlineX,
} from "react-icons/hi";
import { FolderIcon } from "../components/FolderIcon";
import {
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
  renameRoute,
  renameFolder,
  updateFolderColor,
} from "../features/favorites/favoritesStore";
import { useRouteNavigator } from "../shared/hooks/useRouteNavigator";
import { GenericTable, Column } from "../components/GenericTable";
import { Breadcrumb } from "../components/Breadcrumb";
import { MoveToModal } from "../components/MoveToModal";
import { useTranslation } from "react-i18next";
import { safeConfirm as confirm } from "../shared/utils/dialog";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
  pointerWithin,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";

type Item = (Route & { type: "route" }) | (FavoriteFolder & { type: "folder" });

const dropAnimationConfig = {
  duration: 220,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
};

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
  const [newFolderColor, setNewFolderColor] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [moveItems, setMoveItems] = useState<Item[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [inlineRenamingId, setInlineRenamingId] = useState<string | null>(null);
  const [inlineRenamingName, setInlineRenamingName] = useState<string>("");
  const [inlineColorId, setInlineColorId] = useState<string | null>(null);
  const [pendingColor, setPendingColor] = useState<string | null | undefined>(undefined);

  const [draggedItem, setDraggedItem] = useState<Item | null>(null);
  const [movingRowId, setMovingRowId] = useState<string | null>(null);
  const [overlayItem, setOverlayItem] = useState<Item | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const isFolderDescendant = (ancestorId: number, targetId: number): boolean => {
    let currId: number | null = targetId;
    while (currId !== null) {
      const f = folders.find((x) => x.id === currId);
      if (!f) break;
      if (f.parent_id === ancestorId) return true;
      currId = f.parent_id ?? null;
    }
    return false;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const item = active.data.current as Item;
    if (item) {
      setDraggedItem(item);
      setOverlayItem(item);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);
    setTimeout(() => {
      setOverlayItem(null);
    }, 250);

    if (!over) return;

    const dragged = active.data.current as Item;
    if (!dragged) return;

    let targetFolderId: number | null = null;

    if (over.id === "breadcrumb-root") {
      targetFolderId = null;
    } else if (typeof over.id === "string" && over.id.startsWith("breadcrumb-folder-")) {
      targetFolderId = parseInt(over.id.replace("breadcrumb-folder-", ""));
    } else if (typeof over.id === "string" && over.id.startsWith("drop-folder-")) {
      // Over drop zone of a folder row
      targetFolderId = parseInt(over.id.replace("drop-folder-", ""));
    } else if (typeof over.id === "string" && over.id.startsWith("drop-route-")) {
      // Over a route row, which is disabled as a drop zone (so this shouldn't normally fire, but just in case, ignore)
      return;
    } else {
      return;
    }

    if (dragged.type === "folder" && dragged.id === targetFolderId) return;

    if (dragged.type === "folder" && targetFolderId !== null) {
      if (isFolderDescendant(dragged.id!, targetFolderId)) return;
    }

    const currentParentId =
      dragged.type === "folder"
        ? dragged.parent_id ?? null
        : dragged.folder_id ?? null;
    if (currentParentId === targetFolderId) return;

    // Trigger row slide-out animation
    const rowId = `${dragged.type}-${dragged.id}`;
    setMovingRowId(rowId);

    // Wait for the slide-out animation to complete (300ms) before updating DB and state
    setTimeout(async () => {
      try {
        if (dragged.type === "folder") {
          await updateFolderParent(dragged.id!, targetFolderId);
        } else {
          await updateRouteFolder(dragged.id!, targetFolderId);
        }
        await loadData(true);
      } catch (err) {
        console.error(err);
      } finally {
        setMovingRowId(null);
      }
    }, 300);
  };


  const loadData = async (silent?: boolean | any) => {
    const isSilent = silent === true;
    if (!isSilent) setIsLoading(true);
    try {
      const [favs, flds] = await Promise.all([listRoutes(), listFolders()]);
      setRoutes(favs);
      setFolders(flds);
    } catch (err) {
      console.error(err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const breadcrumbItems = useMemo(() => {
    const isValidDrop = (targetFolderId: number | null): boolean => {
      if (!draggedItem) return false;

      const currentParentId =
        draggedItem.type === "folder"
          ? draggedItem.parent_id ?? null
          : draggedItem.folder_id ?? null;
      if (currentParentId === targetFolderId) return false;

      if (draggedItem.type === "folder") {
        if (draggedItem.id === targetFolderId) return false;
        if (
          targetFolderId !== null &&
          isFolderDescendant(draggedItem.id!, targetFolderId)
        )
          return false;
      }

      return true;
    };

    return [
      {
        label: t("my_routes.title"),
        onClick: () => setCurrentFolderId(null),
        active: !currentFolderId,
        dndId: "breadcrumb-root",
        dndDisabled: !isValidDrop(null),
      },
      ...breadcrumbPath.map((f, idx) => ({
        label: f.name,
        onClick: () => setCurrentFolderId(f.id!),
        active: idx === breadcrumbPath.length - 1,
        dndId: `breadcrumb-folder-${f.id}`,
        dndDisabled: !isValidDrop(f.id!),
      })),
    ];
  }, [breadcrumbPath, currentFolderId, t, draggedItem, folders]);


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



  const handleInlineRenameSubmit = async (item: Item) => {
    const trimmed = inlineRenamingName.trim();
    if (!trimmed || trimmed === item.name) {
      setInlineRenamingId(null);
      return;
    }
    try {
      if (item.type === "folder") {
        await renameFolder(item.id!, trimmed);
      } else {
        await renameRoute(item.id!, trimmed);
      }
      await loadData(true);
    } catch (err) {
      console.error("Rename failed", err);
    } finally {
      setInlineRenamingId(null);
    }
  };

  const handleInlineColorChange = async (folderId: number, color: string | null) => {
    try {
      await updateFolderColor(folderId, color);
      await loadData(true);
    } catch (err) {
      console.error(err);
    }
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
        const itemId = `${item.type}-${item.id}`;
        const isRenaming = inlineRenamingId === itemId;
        const isColorEditing = inlineColorId === itemId && isFolder;

        // ── Inline Rename Mode ──
        if (isRenaming) {
          return (
            <div className="flex items-center gap-3 w-full" onClick={(e) => e.stopPropagation()}>
              <div className={`flex-shrink-0 ${isFolder ? "text-primary" : "text-secondary"}`}>
                {isFolder ? <FolderIcon size={20} color={(item as FavoriteFolder).color} /> : <HiOutlineLink size={20} />}
              </div>
              <input
                autoFocus
                value={inlineRenamingName}
                onChange={(e) => setInlineRenamingName(e.target.value)}
                className="px-2 py-1 bg-surface border border-primary rounded outline-none text-body-md text-on-surface font-semibold max-w-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInlineRenameSubmit(item);
                  if (e.key === "Escape") setInlineRenamingId(null);
                }}
                onBlur={() => setTimeout(() => handleInlineRenameSubmit(item), 150)}
              />
            </div>
          );
        }

        // ── Inline Color Editing Mode (folders only) ──
        if (isColorEditing) {
          const currentColor = (item as FavoriteFolder).color ?? null;
          const selectedColor = pendingColor !== undefined ? pendingColor : currentColor;

          return (
            <div className="flex items-center gap-3 w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex-shrink-0 text-primary">
                <FolderIcon size={20} color={selectedColor} />
              </div>
              <span className="font-semibold text-body-md text-on-surface truncate mr-1">{item.name}</span>
              <div className="flex items-center gap-1.5 bg-surface px-2 py-1 rounded border border-outline-variant/60 animate-in fade-in zoom-in-95 duration-150">
                {[
                  { value: null, class: "bg-primary border-primary", label: "Default" },
                  { value: "#5c6370", class: "bg-[#5c6370] border-[#5c6370]", label: "Grey" },
                  { value: "#6199a8", class: "bg-[#6199a8] border-[#6199a8]", label: "Teal" },
                  { value: "#e5c07b", class: "bg-[#e5c07b] border-[#e5c07b]", label: "Gold" },
                  { value: "#e06c75", class: "bg-[#e06c75] border-[#e06c75]", label: "Red" },
                  { value: "#98c379", class: "bg-[#98c379] border-[#98c379]", label: "Green" },
                  { value: "#c678dd", class: "bg-[#c678dd] border-[#c678dd]", label: "Violet" },
                ].map((col) => {
                  const isSelected = selectedColor === col.value;
                  return (
                    <button
                      key={col.label}
                      type="button"
                      onClick={() => setPendingColor(col.value)}
                      className={`w-4 h-4 rounded-full border transition-all hover:scale-125 cursor-pointer ${col.class}
                        ${isSelected ? "ring-2 ring-offset-2 ring-primary scale-110" : "opacity-80 hover:opacity-100"}`}
                      title={col.label}
                    />
                  );
                })}
                {/* Custom Color Rainbow Picker */}
                <label
                  className="relative w-4 h-4 rounded-full border border-outline-variant cursor-pointer flex items-center justify-center overflow-hidden bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 shadow-sm hover:scale-125 transition-transform"
                  title="Custom color"
                >
                  <input
                    type="color"
                    value={selectedColor || "#a6c9f8"}
                    onChange={(e) => setPendingColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  {selectedColor && !["#5c6370", "#6199a8", "#e5c07b", "#e06c75", "#98c379", "#c678dd"].includes(selectedColor) && (
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </label>

                {/* Confirm button */}
                <button
                  onClick={() => {
                    if (pendingColor !== undefined) {
                      handleInlineColorChange(item.id!, pendingColor);
                    }
                    setPendingColor(undefined);
                    setInlineColorId(null);
                  }}
                  className="ml-1 p-0.5 text-primary hover:text-on-surface hover:bg-primary/20 rounded transition-colors cursor-pointer"
                  title={t("my_routes.table.confirm_color", "Confirmar")}
                >
                  <HiOutlineCheck className="w-4 h-4" />
                </button>
                {/* Cancel button */}
                <button
                  onClick={() => {
                    setPendingColor(undefined);
                    setInlineColorId(null);
                  }}
                  className="p-0.5 text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-high rounded transition-colors cursor-pointer"
                  title={t("my_routes.cancel_btn")}
                >
                  <HiOutlineX className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        }

        // ── Default Mode ──
        return (
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 transition-transform group-hover:scale-105 ${isFolder ? "text-primary" : "text-secondary"}`}>
              {isFolder ? <FolderIcon size={20} color={(item as FavoriteFolder).color} /> : <HiOutlineLink size={20} />}
            </div>
            <div className="min-w-0">
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
      render: (item) =>
        item.type === "route" ? (
          <span className="px-1.5 py-0.5 bg-surface-container-high text-on-surface-variant rounded-sm text-label-sm font-mono border border-outline-variant uppercase tracking-wider">
            {(item as Route).profile}
          </span>
        ) : (
          <span className="text-on-surface-variant/30 font-mono text-label-sm">—</span>
        ),
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
      className: "text-right overflow-visible",
      render: (item) => {
        const id = `${item.type}-${item.id}`;
        const isMenuOpen = activeMenuId === id;
        
        return (
          <div className="relative flex justify-end" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setActiveMenuId(isMenuOpen ? null : id)}
              className="p-1.5 hover:bg-surface-container-highest rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              title={t("my_routes.table.actions_tooltip", "Más acciones")}
            >
              <HiOutlineDotsVertical className="w-4 h-4" />
            </button>
            {isMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setActiveMenuId(null)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-surface-container-highest border border-outline-variant rounded-md shadow-2xl z-50 py-1 text-body-md text-left animate-in fade-in slide-in-from-top-1.5 duration-100 ease-out">
                  {item.type === "route" && (
                    <>
                      <button
                        onClick={() => {
                          setActiveMenuId(null);
                          handleCopy(item.id!, `s3://${(item as Route).bucket}/${(item as Route).prefix}`);
                        }}
                        className="w-full px-4 py-2 hover:bg-surface-container flex items-center gap-2.5 text-on-surface text-left transition-colors cursor-pointer"
                      >
                        {copiedId === item.id ? (
                          <HiOutlineCheck className="w-4 h-4 text-primary" />
                        ) : (
                          <HiOutlineDuplicate className="w-4 h-4 text-on-surface-variant" />
                        )}
                        {t("my_routes.table.copy_uri_tooltip")}
                      </button>
                      <button
                        onClick={() => {
                          setActiveMenuId(null);
                          handleNavigate(item as Route);
                        }}
                        className="w-full px-4 py-2 hover:bg-surface-container flex items-center gap-2.5 text-on-surface text-left transition-colors cursor-pointer"
                      >
                        <HiOutlineExternalLink className="w-4 h-4 text-on-surface-variant" />
                        {t("my_routes.table.go_path_tooltip")}
                      </button>
                      <div className="border-t border-outline-variant/30 my-1" />
                    </>
                  )}
                  <button
                    onClick={() => {
                      setActiveMenuId(null);
                      setInlineRenamingId(id);
                      setInlineRenamingName(item.name);
                    }}
                    className="w-full px-4 py-2 hover:bg-surface-container flex items-center gap-2.5 text-on-surface text-left transition-colors cursor-pointer"
                  >
                    <HiOutlinePencil className="w-4 h-4 text-on-surface-variant" />
                    {t("my_routes.table.rename_tooltip")}
                  </button>
                  {item.type === "folder" && (
                    <button
                      onClick={() => {
                        setActiveMenuId(null);
                        setInlineColorId(id);
                      }}
                      className="w-full px-4 py-2 hover:bg-surface-container flex items-center gap-2.5 text-on-surface text-left transition-colors cursor-pointer"
                    >
                      <HiOutlineColorSwatch className="w-4 h-4 text-on-surface-variant" />
                      {t("my_routes.table.change_color_tooltip", "Cambiar color")}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setActiveMenuId(null);
                      setMoveItems([item]);
                    }}
                    className="w-full px-4 py-2 hover:bg-surface-container flex items-center gap-2.5 text-on-surface text-left transition-colors cursor-pointer"
                  >
                    <HiOutlineSwitchHorizontal className="w-4 h-4 text-on-surface-variant" />
                    {t("my_routes.table.move_tooltip")}
                  </button>
                  <div className="border-t border-outline-variant/30 my-1" />
                  <button
                    onClick={async () => {
                      setActiveMenuId(null);
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
                    className="w-full px-4 py-2 hover:bg-error-container/20 hover:text-error flex items-center gap-2.5 text-error/80 text-left transition-colors cursor-pointer"
                  >
                    <HiOutlineTrash className="w-4 h-4" />
                    {t("my_routes.table.delete_tooltip")}
                  </button>
                </div>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex-1 flex flex-col min-h-0 bg-surface p-6 animate-in fade-in duration-500 overflow-hidden">
        <div className="w-full flex-1 flex flex-col gap-6 min-h-0">
          <Breadcrumb
            onBackClick={handleBackClick}
            items={breadcrumbItems}
            isDraggingActive={draggedItem !== null}
            moveHereLabel={t("my_routes.table.move_here", "Mover aquí")}
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
              <button
                onClick={() => setIsAddingFolder(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary text-body-md font-medium rounded border border-transparent hover:bg-primary/95 transition-colors cursor-pointer"
              >
                <HiOutlineFolderAdd className="w-4 h-4" /> {t("my_routes.new_folder_btn")}
              </button>
            </div>
          </div>

          {/* Main Explorer Container */}
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
              <div className="px-4 py-3 bg-surface-container border-b border-outline-variant flex flex-col sm:flex-row sm:items-center gap-4 animate-in slide-in-from-top-4">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={t("my_routes.new_folder_placeholder")}
                  className="flex-1 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded outline-none focus:border-primary text-body-md text-on-surface"
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      addFolder(newFolderName, currentFolderId, newFolderColor).then(() => {
                        setNewFolderName("");
                        setNewFolderColor(null);
                        setIsAddingFolder(false);
                        loadData();
                      });
                    if (e.key === "Escape") {
                      setNewFolderColor(null);
                      setIsAddingFolder(false);
                    }
                  }}
                />

                {/* Color Selector */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider select-none mr-1">
                    Color:
                  </span>
                  <div className="flex items-center gap-1.5 bg-surface-container-lowest px-2 py-1 rounded border border-outline-variant/60">
                    {[
                      { value: null, class: "bg-primary border-primary", label: "Default" },
                      { value: "#5c6370", class: "bg-[#5c6370] border-[#5c6370]", label: "Grey" },
                      { value: "#6199a8", class: "bg-[#6199a8] border-[#6199a8]", label: "Teal" },
                      { value: "#e5c07b", class: "bg-[#e5c07b] border-[#e5c07b]", label: "Gold" },
                      { value: "#e06c75", class: "bg-[#e06c75] border-[#e06c75]", label: "Red" },
                      { value: "#98c379", class: "bg-[#98c379] border-[#98c379]", label: "Green" },
                      { value: "#c678dd", class: "bg-[#c678dd] border-[#c678dd]", label: "Violet" },
                    ].map((col) => {
                      const isSelected = newFolderColor === col.value;
                      return (
                        <button
                          key={col.label}
                          type="button"
                          onClick={() => setNewFolderColor(col.value)}
                          className={`w-4 h-4 rounded-full border transition-all hover:scale-110 cursor-pointer ${col.class}
                            ${isSelected ? "ring-2 ring-offset-2 ring-primary scale-110" : "opacity-80"}`}
                          title={col.label}
                        />
                      );
                    })}

                    {/* Custom Color Rainbow Picker */}
                    <label
                      className="relative w-4 h-4 rounded-full border border-outline-variant cursor-pointer flex items-center justify-center overflow-hidden bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 shadow-sm hover:scale-110 transition-transform"
                      title="Custom color"
                    >
                      <input
                        type="color"
                        value={newFolderColor || "#a6c9f8"}
                        onChange={(e) => setNewFolderColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      {newFolderColor && !["#5c6370", "#6199a8", "#e5c07b", "#e06c75", "#98c379", "#c678dd"].includes(newFolderColor) && (
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      )}
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() =>
                      addFolder(newFolderName, currentFolderId, newFolderColor).then(() => {
                        setNewFolderName("");
                        setNewFolderColor(null);
                        setIsAddingFolder(false);
                        loadData();
                      })
                    }
                    className="bg-primary text-on-primary px-4 py-1.5 rounded font-medium text-body-md hover:bg-primary/95 transition-colors cursor-pointer"
                  >
                    {t("my_routes.create_btn")}
                  </button>
                  <button
                    onClick={() => {
                      setNewFolderColor(null);
                      setIsAddingFolder(false);
                    }}
                    className="px-3 py-1.5 text-on-surface-variant font-medium hover:bg-surface-container-high rounded text-body-md transition-colors cursor-pointer"
                  >
                    {t("my_routes.cancel_btn")}
                  </button>
                </div>
              </div>
            )}            <GenericTable
              items={displayItems}
              columns={columns}
              isLoading={isLoading}
              rowKey={(item) => `${item.type}-${item.id}`}
              onRowClick={(item) =>
                item.type === "folder"
                  ? setCurrentFolderId(item.id!)
                  : handleNavigate(item as Route)
              }
              dndEnabled={true}
              draggedItem={draggedItem}
              movingRowId={movingRowId}
              moveHereLabel={t("my_routes.table.move_here", "Mover aquí")}
              isValidDropTarget={(drag, target) => {
                return (
                  target.type === "folder" &&
                  drag.id !== target.id &&
                  (drag.type !== "folder" || !isFolderDescendant(drag.id!, target.id!))
                );
              }}
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
        </div>

        {moveItems.length > 0 && (
          <MoveToModal
            moveItems={moveItems}
            folders={folders}
            onConfirm={handleMove}
            onClose={() => setMoveItems([])}
          />
        )}
      </div>

      <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={dropAnimationConfig}>
        {overlayItem ? (
          <div className="flex items-center gap-3 px-3.5 py-2 w-fit max-w-xs bg-surface-container-high/90 border border-primary/30 text-on-surface rounded shadow-2xl backdrop-blur-md opacity-95 select-none pointer-events-none z-[9999] transform scale-105 border-l-2 border-l-primary font-medium animate-in fade-in zoom-in-95 duration-150 ease-out">
            <div className={`flex-shrink-0 ${overlayItem.type === "folder" ? "text-primary" : "text-secondary"}`}>
              {overlayItem.type === "folder" ? <FolderIcon size={18} color={(overlayItem as FavoriteFolder).color} /> : <HiOutlineLink size={18} />}
            </div>
            <span className="font-semibold text-body-md truncate">{overlayItem.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
