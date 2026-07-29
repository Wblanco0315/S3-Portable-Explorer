import { useTranslation } from "react-i18next";
import {
  HiOutlineCog,
  HiOutlineTranslate,
  HiOutlineColorSwatch,
  HiOutlineSelector,
  HiCheckCircle,
} from "react-icons/hi";
import { useTheme } from "../../app/ThemeContext";
import SectionHeader from "./SectionHeader";
import { UpdatesCard, DocSupportCard } from "./AboutSettings";

/** Interface-level preferences: language and theme. */
export default function SystemSettings() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const selectTheme = (value: "light" | "dark") => {
    if (value !== theme) toggleTheme();
  };

  return (
    <div className="w-full flex flex-col h-full">
      {/* Page Header Content */}
      <div className="p-margin border-b border-outline-variant bg-surface-container-low shrink-0">
        <SectionHeader icon={<HiOutlineCog className="w-6 h-6" />} title={t("settings.system_settings")} />
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      {/* 2-Column Layout Container */}
      <div className="grid grid-cols-12">
        {/* Left Column (Wider - 8 columns) */}
        <div className="col-span-12 lg:col-span-8 p-6 gap-6">
          <div className="space-y-6">
            {/* Language */}
            <section className="gap-3 flex flex-col bg-surface-container-low border border-outline-variant rounded-xl p-6">
              <div className="flex gap-5">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                  <HiOutlineTranslate className="w-6 h-6" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="font-bold text-on-surface text-sm">{t("settings.language_label")}</h3>
                  <p className="text-body-sm text-on-surface-variant">{t("settings.language_desc")}</p>
                </div>
              </div>
              <div className="relative">
                <select
                  value={i18n.language?.startsWith("es") ? "es" : "en"}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 pr-10 text-on-surface text-sm appearance-none cursor-pointer focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="en">{t("settings.languages.en")}</option>
                  <option value="es">{t("settings.languages.es")}</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <HiOutlineSelector className="w-5 h-5 text-on-surface-variant" />
                </div>
              </div>
            </section>

            {/* Theme */}
            <section className="gap-5 flex flex-col bg-surface-container-low border border-outline-variant rounded-xl p-6">
              <div className="flex gap-5">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                  <HiOutlineColorSwatch className="w-6 h-6" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="font-bold text-on-surface text-sm">{t("settings.theme_label")}</h3>
                  <p className="text-body-sm text-on-surface-variant">{t("settings.theme_desc")}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Light option */}
                <button
                  type="button"
                  onClick={() => selectTheme("light")}
                  aria-pressed={theme === "light"}
                  className={`relative text-left rounded-xl border p-3 transition-all cursor-pointer ${theme === "light"
                    ? "border-primary ring-2 ring-primary/40 bg-primary/5"
                    : "border-outline-variant hover:border-outline"
                    }`}
                >
                  {theme === "light" && (
                    <HiCheckCircle className="absolute top-2 right-2 w-6 h-6 text-primary drop-shadow" />
                  )}
                  {/* Light preview mockup */}
                  <div className="rounded-lg bg-[#f1f3f7] border border-black/10 p-3 aspect-[2/1] flex gap-2 overflow-hidden">
                    <div className="w-1/4 rounded bg-white border border-black/5"></div>
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-1.5 w-1/2 rounded bg-black/15"></div>
                      <div className="h-1.5 w-3/4 rounded bg-black/10"></div>
                      <div className="h-1.5 w-2/3 rounded bg-black/10"></div>
                      <div className="mt-auto h-4 w-1/3 rounded bg-[#13324f]"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-semibold text-sm text-on-surface">{t("settings.themes.light")}</span>
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${theme === "light" ? "border-primary" : "border-outline"
                        }`}
                    >
                      {theme === "light" && <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>}
                    </span>
                  </div>
                </button>

                {/* Dark option */}
                <button
                  type="button"
                  onClick={() => selectTheme("dark")}
                  aria-pressed={theme === "dark"}
                  className={`relative text-left rounded-xl border p-3 transition-all cursor-pointer ${theme === "dark"
                    ? "border-primary ring-2 ring-primary/40 bg-primary/5"
                    : "border-outline-variant hover:border-outline"
                    }`}
                >
                  {theme === "dark" && (
                    <HiCheckCircle className="absolute top-2 right-2 w-6 h-6 text-primary drop-shadow" />
                  )}
                  {/* Dark preview mockup */}
                  <div className="rounded-lg bg-[#0d1117] border border-white/10 p-3 aspect-[2/1] flex gap-2 overflow-hidden">
                    <div className="w-1/4 rounded bg-[#161b22] border border-white/5"></div>
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-1.5 w-1/2 rounded bg-white/25"></div>
                      <div className="h-1.5 w-3/4 rounded bg-white/15"></div>
                      <div className="h-1.5 w-2/3 rounded bg-white/15"></div>
                      <div className="mt-auto h-4 w-1/3 rounded bg-[#1e4976]"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-semibold text-sm text-on-surface">{t("settings.themes.dark")}</span>
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${theme === "dark" ? "border-primary" : "border-outline"
                        }`}
                    >
                      {theme === "dark" && <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>}
                    </span>
                  </div>
                </button>
              </div>
            </section>

            {/* Documentation & Support */}
            <DocSupportCard />
          </div>
        </div>

        {/* Right Column (Narrower - 4 columns) */}
        <aside className="col-span-12 lg:col-span-4 p-margin">
          <div className="space-y-xl">
            <UpdatesCard />
          </div>
        </aside>
      </div>
      </div>
    </div>
  );
}
