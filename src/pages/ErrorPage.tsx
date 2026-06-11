import { useState } from "react";
import { useRouteError, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  HiOutlineExclamationCircle,
  HiOutlineHome,
  HiOutlineClipboardCopy,
  HiOutlineCheck,
} from "react-icons/hi";

export default function ErrorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const error = useRouteError() as any;
  const [copied, setCopied] = useState(false);

  const is404 = error?.status === 404;
  const errorMsg = error?.message || error?.statusText || String(error || "Unknown error");
  const errorStack = error?.stack || "";

  const handleCopy = () => {
    const textToCopy = `${errorMsg}\n\nStack Trace:\n${errorStack}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface p-6 font-inter text-on-surface">
      <div className="bg-surface-container-low border border-outline-variant rounded-lg p-8 max-w-xl w-full flex flex-col items-center text-center">
        <div className="p-3 bg-error/10 text-error border border-error/20 rounded-full mb-4">
          <HiOutlineExclamationCircle size={40} />
        </div>

        <h1 className="text-headline-md font-bold text-on-surface mb-2">
          {is404 ? t("error_page.not_found_title") : t("error_page.title")}
        </h1>

        <p className="text-body-md text-on-surface-variant mb-6 max-w-md">
          {is404 ? t("error_page.not_found_desc") : t("error_page.subtitle")}
        </p>

        {/* Technical details accordion */}
        {!is404 && (
          <div className="w-full text-left mb-6">
            <details className="group border border-outline-variant bg-surface-container rounded-md overflow-hidden">
              <summary className="flex justify-between items-center px-4 py-2 text-label-md text-on-surface-variant cursor-pointer hover:bg-surface-container-high select-none">
                <span>{t("error_page.details")}</span>
                <span className="transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="p-4 border-t border-outline-variant bg-surface-container-lowest font-mono text-label-sm overflow-x-auto text-error select-text max-h-48 whitespace-pre-wrap">
                {errorMsg}
                {errorStack && (
                  <div className="mt-2 text-on-surface-variant/70 border-t border-outline-variant/30 pt-2 text-[10px]">
                    {errorStack}
                  </div>
                )}
              </div>
            </details>
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center w-full">
          {!is404 && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 border border-outline-variant hover:bg-surface-container-high text-on-surface rounded text-body-md cursor-pointer transition-colors"
            >
              {copied ? <HiOutlineCheck className="text-green-500" size={16} /> : <HiOutlineClipboardCopy size={16} />}
              {copied ? t("error_page.copied") : t("error_page.copy_error")}
            </button>
          )}

          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-on-primary font-medium rounded text-body-md cursor-pointer transition-colors"
          >
            <HiOutlineHome size={16} />
            {t("error_page.go_dashboard")}
          </button>
        </div>
      </div>
    </div>
  );
}
