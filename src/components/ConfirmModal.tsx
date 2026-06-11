import { HiOutlineExclamation } from "react-icons/hi";
import { useConfirmStore } from "../shared/hooks/useConfirmStore";
import { useTranslation } from "react-i18next";

export function ConfirmModal() {
  const { isOpen, title, message, confirm, cancel } = useConfirmStore();
  const { t } = useTranslation();

  return (
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs transition-all duration-300 ease-out
        ${isOpen ? "opacity-100 visible pointer-events-auto" : "opacity-0 invisible pointer-events-none"}`}
    >
      <div
        className={`bg-surface-container border-2 border-outline-variant max-w-md w-full rounded-lg overflow-hidden transition-all duration-300 ease-out shadow-2xl
          ${isOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"}`}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-surface-variant border-b border-outline-variant flex items-center gap-3">
          <div className="p-2 bg-error-container/20 border border-error/30 text-error rounded flex items-center justify-center shrink-0">
            <HiOutlineExclamation className="w-5 h-5" />
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface font-bold truncate">
            {title || t("my_routes.title")}
          </h3>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant flex justify-end gap-3">
          <button
            onClick={cancel}
            className="px-4 py-2 text-body-md font-medium text-on-surface bg-surface-container hover:bg-surface-container-high border border-outline-variant hover:border-outline rounded transition-all cursor-pointer"
          >
            {t("buckets.wizard.cancel")}
          </button>
          <button
            onClick={confirm}
            className="px-5 py-2 text-body-md font-medium text-on-primary bg-primary hover:bg-primary/95 rounded border border-transparent transition-all cursor-pointer"
          >
            {t("buckets.wizard.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
