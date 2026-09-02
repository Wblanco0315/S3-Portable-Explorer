import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  HiOutlineDownload,
  HiOutlineCog,
  HiOutlineKey,
} from "react-icons/hi";
import type { IconType } from "react-icons";

interface SettingsTab {
  to: string;
  key: string;
  Icon: IconType;
}

const TABS: SettingsTab[] = [
  { to: "downloads", key: "downloads", Icon: HiOutlineDownload },
  { to: "system", key: "system", Icon: HiOutlineCog },
  { to: "aws", key: "aws", Icon: HiOutlineKey },
];

/**
 * Settings shell: renders the page title and the folder-style tab strip.
 * Each tab is a real nested route; the active section is rendered through
 * the <Outlet /> inside the folder "body" panel.
 */
export default function SettingsLayout() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <div className="h-full p-margin w-full text-on-surface flex flex-col">
      <div className="mb-margin">
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-unit">{t("settings.title")}</h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant">{t("settings.subtitle")}</p>
      </div>

      {/* Folder-style tab strip. Depth comes from tonal layers + borders (no shadows). */}
      <nav className="flex items-end gap-1 px-2 relative z-10" aria-label={t("settings.title")}>
        {TABS.map(({ to, key, Icon }) => (
          <NavLink
            key={key}
            to={to}
            className={({ isActive }) =>
              `group relative flex items-center gap-2 rounded-t-lg border border-outline-variant px-4 font-label-md text-label-md transition-colors duration-200 cursor-pointer select-none ${isActive
                ? "-mb-px z-20 bg-surface-container border-b-surface-container pt-3 pb-3 text-on-surface font-semibold"
                : "z-0 bg-surface-container-low border-b-outline-variant pt-2 pb-2 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? "text-primary" : "text-on-surface-variant group-hover:text-on-surface"}>
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <span className="whitespace-nowrap">{t(`settings.tabs.${key}`)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Folder body. Only the sub-route content re-animates on tab change
          (keyed on the pathname); the title and tab strip stay mounted. */}
      <div className="bg-surface-container border border-outline-variant rounded-b-lg rounded-tr-lg flex-1 min-h-0 flex flex-col">
        <div key={location.pathname} className="subroute-transition flex-1 min-h-0 flex flex-col">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
