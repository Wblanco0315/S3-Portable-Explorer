import { useState, useEffect, useRef } from "react";
import { HiOutlinePencil } from "react-icons/hi";
import { useTranslation } from "react-i18next";
import { FavoriteFolder, Route } from "../features/favorites/favoritesStore";

type Item = (Route & { type: "route" }) | (FavoriteFolder & { type: "folder" });

interface RenameModalProps {
  item: Item;
  onConfirm: (newName: string) => Promise<void>;
  onClose: () => void;
}

export function RenameModal({ item, onConfirm, onClose }: RenameModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(item.name);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) {
      setError(t("my_routes.rename_error_empty"));
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm(name.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs transition-all duration-300 ease-out">
      <div className="bg-surface-container border-2 border-outline-variant max-w-md w-full rounded-lg overflow-hidden shadow-2xl transition-all duration-300 ease-out scale-100 opacity-100">
        {/* Header */}
        <div className="px-6 py-4 bg-surface-variant border-b border-outline-variant flex items-center gap-3">
          <div className="p-2 bg-primary-container/20 border border-primary/30 text-primary rounded flex items-center justify-center shrink-0">
            <HiOutlinePencil className="w-5 h-5" />
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface font-bold truncate">
            {t("my_routes.rename_modal_title", { name: item.name })}
          </h3>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
              {t("my_routes.rename_modal_placeholder")}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              className="px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded outline-none focus:border-primary text-body-md text-on-surface w-full"
              disabled={isSubmitting}
            />
            {error && (
              <span className="text-error text-label-sm font-semibold animate-in fade-in duration-200">
                {error}
              </span>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-body-md font-medium text-on-surface bg-surface-container hover:bg-surface-container-high border border-outline-variant hover:border-outline rounded transition-all cursor-pointer"
              disabled={isSubmitting}
            >
              {t("my_routes.cancel_btn")}
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-body-md font-medium text-on-primary bg-primary hover:bg-primary/95 rounded border border-transparent transition-all cursor-pointer flex items-center justify-center"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("my_routes.rename_btn") + "..." : t("my_routes.rename_btn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
