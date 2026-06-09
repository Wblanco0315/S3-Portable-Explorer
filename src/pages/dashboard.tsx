import React, { useEffect, useState } from "react";
import { HiOutlineChartBar, HiOutlineClock, HiOutlineLink, HiOutlineDownload, HiOutlineDatabase, HiOutlineStar } from "react-icons/hi";
import { useDatabase } from "../shared/hooks/useDatabase";
import { getTopVisitedRoutes, Route } from "../features/favorites/favoritesStore";
import { useRouteNavigator } from "../shared/hooks/useRouteNavigator";
import { useDownloadStore } from "../features/downloads/downloadStore";
import { Link } from "react-router-dom";
import { getStatsSummary, StatsSummary } from "../features/statistics/statisticsDatabase";

export default function DashboardPage() {
  const { navigateToRoute } = useRouteNavigator();
  const { getActionLogs } = useDatabase();
  const { tasks, initialize: initDownloads } = useDownloadStore();

  const [recentActions, setRecentActions] = useState<{ id: number; action_type: string; details: string; created_at: string }[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);

  // Statistics States
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const loadData = async () => {
    try {
      const [actions, rt, sum] = await Promise.all([
        getActionLogs(),
        getTopVisitedRoutes(),
        getStatsSummary()
      ]);
      setRecentActions(actions.slice(0, 5));
      setRoutes(rt.slice(0, 5));
      setSummary(sum);
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    }
  };

  useEffect(() => {
    loadData();
    if (tasks.length === 0) {
      initDownloads();
    }
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Map display period key
  const periodKey: 'daily' | 'weekly' | 'monthly' = selectedPeriod;
  const periodLabel = selectedPeriod === 'daily' ? "Today" : selectedPeriod === 'weekly' ? "This Week" : "This Month";

  const completedDownloadsCount = summary ? summary[periodKey].completedDownloads : 0;
  const storageVal = summary ? formatBytes(summary[periodKey].storageDownloaded) : "0 B";
  const activeBucketsCount = summary ? summary[periodKey].activeBuckets : 0;
  const activeRoutesCount = summary ? summary[periodKey].activeRoutes : 0;

  return (
    <div className="p-6 w-full h-full lg:overflow-hidden overflow-y-auto flex flex-col flex-1 space-y-6 route-transition">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface">
            Welcome Back
          </h1>
          <p className="text-on-surface-variant text-body-md mt-1">Here's what's happening with your S3 backups today.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Label selector for Today, Week, Month */}
          <div className="relative flex bg-surface-container-low border border-outline-variant rounded p-0.5 w-60">
            <div 
              className="absolute top-[2px] bottom-[2px] left-[2px] rounded-sm bg-primary transition-transform duration-300 ease-out pointer-events-none"
              style={{
                width: 'calc((100% - 4px) / 3)',
                transform: `translateX(${
                  selectedPeriod === 'daily' 
                    ? '0%' 
                    : selectedPeriod === 'weekly' 
                      ? '100%' 
                      : '200%'
                })`
              }}
            />
            <button
              onClick={() => setSelectedPeriod('daily')}
              className={`relative z-10 flex-1 py-1.5 text-label-sm font-semibold rounded transition-colors duration-300 ease-in-out cursor-pointer ${selectedPeriod === 'daily'
                ? "text-on-primary"
                : "text-on-surface-variant hover:text-on-surface"
                }`}
            >
              Today
            </button>
            <button
              onClick={() => setSelectedPeriod('weekly')}
              className={`relative z-10 flex-1 py-1.5 text-label-sm font-semibold rounded transition-colors duration-300 ease-in-out cursor-pointer ${selectedPeriod === 'weekly'
                ? "text-on-primary"
                : "text-on-surface-variant hover:text-on-surface"
                }`}
            >
              Week
            </button>
            <button
              onClick={() => setSelectedPeriod('monthly')}
              className={`relative z-10 flex-1 py-1.5 text-label-sm font-semibold rounded transition-colors duration-300 ease-in-out cursor-pointer ${selectedPeriod === 'monthly'
                ? "text-on-primary"
                : "text-on-surface-variant hover:text-on-surface"
                }`}
            >
              Month
            </button>
          </div>

          <Link
            to="/buckets"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary font-medium text-body-md rounded border border-transparent hover:bg-primary/95 transition-all duration-200 cursor-pointer"
          >
            <HiOutlineDatabase className="w-5 h-5" />
            Explore Buckets
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Completed Downloads"
          value={String(completedDownloadsCount)}
          trend={periodLabel}
          icon={<HiOutlineDownload className="w-5 h-5 text-primary" />}
        />
        <StatCard
          title="Storage Downloaded"
          value={storageVal}
          trend={periodLabel}
          icon={<HiOutlineChartBar className="w-5 h-5 text-tertiary" />}
        />
        <StatCard
          title="Active Buckets (Routes)"
          value={String(activeBucketsCount)}
          trend={`${activeRoutesCount} routes active`}
          icon={<HiOutlineDatabase className="w-5 h-5 text-secondary" />}
        />
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Favorites Section */}
        <div className="bg-surface-container-low rounded-lg border border-outline-variant p-4 flex flex-col h-full lg:h-full min-h-0 transition-colors">
          <div className="flex items-center gap-3 mb-4 shrink-0">
            <div className="p-2 bg-surface-container-high text-primary border border-outline-variant rounded flex items-center justify-center">
              <HiOutlineLink className="w-5 h-5" />
            </div>
            <h2 className="text-headline-md text-on-surface font-semibold">My Routes (Top Visited)</h2>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 min-h-0">
            {routes.length > 0 ? (
              <ul className="space-y-2">
                {routes.map((rt) => (
                  <div
                    key={rt.id}
                    onClick={() => navigateToRoute(rt)}
                    className="group flex items-center justify-between p-2.5 rounded hover:bg-surface-container-highest/50 border border-transparent hover:border-outline-variant/30 transition-colors cursor-pointer mb-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <HiOutlineLink className="text-on-surface-variant group-hover:text-primary transition-colors shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-body-md font-semibold text-on-surface truncate">{rt.name}</p>
                          {rt.profile && (
                            <span className="px-1.5 py-0.5 bg-surface-container-high text-on-surface-variant rounded-sm text-label-sm font-mono border border-outline-variant uppercase tracking-wider shrink-0">
                              {rt.profile}
                            </span>
                          )}
                          {(rt as any).visit_count > 0 && (
                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-sm text-label-sm font-mono border border-primary/20 shrink-0" title={`${(rt as any).visit_count} visitas`}>
                              {(rt as any).visit_count} visits
                            </span>
                          )}
                        </div>
                        <p className="text-label-sm text-on-surface-variant truncate font-mono mt-0.5">s3://{rt.bucket}/{rt.prefix}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </ul>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-outline-variant rounded">
                <HiOutlineLink className="w-8 h-8 text-on-surface-variant mb-2" />
                <p className="text-body-md text-on-surface font-semibold">No routes yet</p>
                <p className="text-label-sm text-on-surface-variant mt-1 font-mono">Add paths to "My Routes" in the explorer to see them here.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="bg-surface-container-low rounded-lg border border-outline-variant p-4 flex flex-col h-full lg:h-full min-h-0 transition-colors">
          <div className="flex items-center gap-3 mb-4 shrink-0">
            <div className="p-2 bg-surface-container-high text-tertiary border border-outline-variant rounded flex items-center justify-center">
              <HiOutlineClock className="w-5 h-5" />
            </div>
            <h2 className="text-headline-md text-on-surface font-semibold">Recent Activity</h2>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 min-h-0">
            {recentActions.length > 0 ? (
              <ul className="space-y-2">
                {recentActions.map((log) => {
                  let Icon = HiOutlineClock;
                  let colorClass = "text-on-surface-variant group-hover:text-tertiary";

                  if (log.action_type === "download") {
                    Icon = HiOutlineDownload;
                    colorClass = "text-primary group-hover:scale-105";
                  } else if (log.action_type === "favorite") {
                    Icon = HiOutlineStar;
                    colorClass = "text-amber-400 group-hover:scale-105";
                  } else if (log.action_type === "visit") {
                    Icon = HiOutlineDatabase;
                    colorClass = "text-secondary group-hover:scale-105";
                  }

                  return (
                    <li
                      key={log.id}
                      className="group flex items-center justify-between p-2.5 rounded hover:bg-surface-container-highest/50 border border-transparent hover:border-outline-variant/30 transition-colors mb-1.5"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                        <div className={`shrink-0 transition-all ${colorClass}`}>
                          <Icon size={18} />
                        </div>
                        <p className="text-body-md text-on-surface-variant truncate" title={log.details}>
                          {log.details}
                        </p>
                      </div>
                      <span className="text-label-sm text-on-surface-variant font-mono shrink-0">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-outline-variant rounded">
                <HiOutlineClock className="w-8 h-8 text-on-surface-variant mb-2" />
                <p className="text-body-md text-on-surface font-semibold">No recent activity</p>
                <p className="text-label-sm text-on-surface-variant mt-1 font-mono">Navigate through buckets or save paths to build your history.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-component for Stats
function StatCard({ title, value, trend, icon }: { title: string, value: string, trend: string, icon: React.ReactNode }) {
  return (
    <div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded bg-surface-container-high border border-outline-variant flex items-center justify-center">
          {icon}
        </div>
        <span 
          key={trend}
          className="animate-fade-in text-label-sm font-semibold text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-sm font-mono"
        >
          {trend}
        </span>
      </div>
      <div>
        <p className="text-body-md text-on-surface-variant">{title}</p>
        <p className="text-headline-md font-bold text-on-surface mt-0.5">{value}</p>
      </div>
    </div>
  );
}

