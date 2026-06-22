import { useState, useEffect, useMemo } from "react";
import {
  HiOutlineFolder,
  HiOutlineFolderOpen,
  HiOutlineX,
  HiChevronRight,
  HiChevronDown,
} from "react-icons/hi";
import { FavoriteFolder, Route } from "../features/favorites/favoritesStore";
import { useTranslation } from "react-i18next";

type Item = (Route & { type: "route" }) | (FavoriteFolder & { type: "folder" });

interface MoveToModalProps {
  moveItems: Item[];
  folders: FavoriteFolder[];
  onConfirm: (targetFolderId: number | null) => Promise<void>;
  onClose: () => void;
}

interface TreeNode extends FavoriteFolder {
  children: TreeNode[];
}

function buildTree(folders: FavoriteFolder[], parentId: number | null): TreeNode[] {
  return folders
    .filter((f) => (f.parent_id ?? null) === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => ({ ...f, children: buildTree(folders, f.id ?? null) }));
}

interface FolderRowProps {
  node: TreeNode;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  movedFolderIds: Set<number>;
  descendantFolderIds: Set<number>;
}

function FolderRow({
  node,
  depth,
  selectedId,
  onSelect,
  expandedIds,
  onToggle,
  movedFolderIds,
  descendantFolderIds,
}: FolderRowProps) {
  const id = node.id!;
  const isSelected = selectedId === id;
  const isExpanded = expandedIds.has(id);
  const hasChildren = node.children.length > 0;

  const isMoved = movedFolderIds.has(id);
  const isDescendant = descendantFolderIds.has(id);
  const hasError = isMoved || isDescendant;

  return (
    <div>
      <button
        onClick={() => onSelect(id)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-colors text-body-sm group border border-transparent
          ${isSelected
            ? hasError
              ? "bg-red-500/20 border-red-500 text-red-400 font-medium"
              : "bg-primary text-on-primary"
            : hasError
              ? "text-red-400 hover:bg-red-500/10 cursor-pointer"
              : "hover:bg-surface-container-high text-on-surface cursor-pointer"
          }
        `}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <span
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center transition-colors cursor-pointer"
          onClick={(e) => {
            if (!hasChildren) return;
            e.stopPropagation();
            onToggle(id);
          }}
        >
          {hasChildren ? (
            isExpanded ? <HiChevronDown className="w-3 h-3" /> : <HiChevronRight className="w-3 h-3" />
          ) : (
            <span className="w-3 h-3" />
          )}
        </span>
        <span className="flex-shrink-0">
          {isSelected || isExpanded ? (
            <HiOutlineFolderOpen className={`w-4 h-4 ${hasError ? "text-red-400" : ""}`} />
          ) : (
            <HiOutlineFolder className={`w-4 h-4 ${hasError ? "text-red-400" : ""}`} />
          )}
        </span>
        <span className="truncate flex-1">{node.name}</span>
        {isMoved && (
          <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded border border-red-500/30 uppercase tracking-wider font-semibold">
            Mover
          </span>
        )}
      </button>

      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggle={onToggle}
              movedFolderIds={movedFolderIds}
              descendantFolderIds={descendantFolderIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MoveToModal({
  moveItems,
  folders,
  onConfirm,
  onClose,
}: MoveToModalProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [isMoving, setIsMoving] = useState(false);

  const tree = buildTree(folders, null);

  // Set the initial selectedId based on the current parent of the moved item(s)
  // If there's only 1 item, default to its parent. If there are multiple, default to null.
  useEffect(() => {
    if (moveItems.length === 1) {
      const item = moveItems[0];
      const parentId = item.type === "folder" ? item.parent_id ?? null : item.folder_id ?? null;
      setSelectedId(parentId);
    } else {
      setSelectedId(null);
    }
  }, [moveItems]);

  const isSameLocation = useMemo(() => {
    return moveItems.every((item) => {
      const parentId = item.type === "folder" ? item.parent_id ?? null : item.folder_id ?? null;
      return selectedId === parentId;
    });
  }, [moveItems, selectedId]);

  // Compute set of moved folder IDs to check for self-move
  const movedFolderIds = useMemo(() => {
    return new Set<number>(
      moveItems.filter((i) => i.type === "folder").map((i) => i.id!)
    );
  }, [moveItems]);

  // Compute set of descendant folder IDs to check for descendant-move
  const descendantFolderIds = useMemo(() => {
    const ids = new Set<number>();
    const checkDescendants = (ancestorId: number) => {
      folders.forEach((f) => {
        if (f.parent_id === ancestorId) {
          ids.add(f.id!);
          checkDescendants(f.id!);
        }
      });
    };
    movedFolderIds.forEach((id) => {
      checkDescendants(id);
    });
    return ids;
  }, [folders, movedFolderIds]);

  const hasSelfError = selectedId !== null && movedFolderIds.has(selectedId);
  const hasDescendantError = selectedId !== null && descendantFolderIds.has(selectedId);
  const hasValidationError = hasSelfError || hasDescendantError;

  const errorMessage = useMemo(() => {
    if (hasSelfError) {
      return t("my_routes.move_error_self");
    }
    if (hasDescendantError) {
      return t("my_routes.move_error_descendant");
    }
    return null;
  }, [hasSelfError, hasDescendantError, t]);

  const onToggle = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isRootSelected = selectedId === null;

  const handleConfirm = async () => {
    if (isSameLocation || hasValidationError) return;
    setIsMoving(true);
    try {
      await onConfirm(selectedId);
      onClose();
    } finally {
      setIsMoving(false);
    }
  };

  const modalTitle = moveItems.length === 1
    ? t("my_routes.move_modal_title", { name: moveItems[0].name })
    : t("my_routes.move_modal_title_multiple", { count: moveItems.length });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-outline-variant rounded-lg shadow-2xl w-full max-w-sm mx-4 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant bg-surface-container">
          <h2 className="text-body-md font-semibold text-on-surface truncate pr-2">
            {modalTitle}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors cursor-pointer flex-shrink-0"
          >
            <HiOutlineX className="w-4 h-4" />
          </button>
        </div>

        {/* Folder tree */}
        <div className="overflow-y-auto max-h-72 p-2">
          {/* Root option */}
          <button
            onClick={() => setSelectedId(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-colors text-body-sm border border-transparent
              ${isRootSelected
                ? "bg-primary text-on-primary font-medium"
                : "hover:bg-surface-container-high text-on-surface cursor-pointer"
              }
            `}
          >
            <span className="w-4 h-4 flex-shrink-0" />
            <HiOutlineFolder className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{t("my_routes.move_modal_root")}</span>
          </button>

          {tree.map((node) => (
            <FolderRow
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              onSelect={setSelectedId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              movedFolderIds={movedFolderIds}
              descendantFolderIds={descendantFolderIds}
            />
          ))}
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mx-4 my-2 p-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded text-body-sm flex items-start gap-2 animate-in fade-in duration-200">
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-outline-variant bg-surface-container">
          {isSameLocation && !hasValidationError && (
            <span className="text-label-sm text-on-surface-variant italic">
              {t("my_routes.move_modal_current")}
            </span>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-body-md font-medium text-on-surface-variant hover:bg-surface-container-high rounded transition-colors cursor-pointer"
            >
              {t("my_routes.move_modal_cancel")}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSameLocation || isMoving || hasValidationError}
              className="px-4 py-1.5 text-body-md font-medium bg-primary text-on-primary rounded hover:bg-primary/95 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isMoving ? "..." : t("my_routes.move_modal_confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
