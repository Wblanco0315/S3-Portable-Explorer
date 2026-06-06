import React, { useEffect, useState } from "react";
import { HiOutlineChartBar, HiOutlineClock, HiOutlineLink, HiOutlineDownload, HiOutlineDatabase, HiOutlineStar, HiChevronLeft, HiChevronRight } from "react-icons/hi";
import { useDatabase } from "../shared/hooks/useDatabase";
import { getTopVisitedRoutes, Route } from "../features/favorites/favoritesStore";
import { useRouteNavigator } from "../shared/hooks/useRouteNavigator";
import { useDownloadStore } from "../features/downloads/downloadStore";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  const { navigateToRoute } = useRouteNavigator();
  const { getActionLogs } = useDatabase();
  const { tasks, initialize: initDownloads } = useDownloadStore();

  const [recentActions, setRecentActions] = useState<{ id: number; action_type: string; details: string; created_at: string }[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const totalItems = recentActions.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const activePage = currentPage > totalPages ? 1 : currentPage;
  
  const startIndex = (activePage - 1) * pageSize;
  const paginatedActions = recentActions.slice(startIndex, startIndex + pageSize);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [actions, rt] = await Promise.all([getActionLogs(), getTopVisitedRoutes()]);
      setRecentActions(actions);
      setRoutes(rt);
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (tasks.length === 0) {
      initDownloads();
    }
  }, []);

  // Compute real metrics
  const completedDownloads = tasks.filter(t => t.status === "completed");
  const totalDownloadsCount = completedDownloads.length;
  
  const totalBytes = completedDownloads.reduce((sum, t) => sum + (t.totalSize || 0), 0);
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };
  const storageVal = formatBytes(totalBytes);

  const activeBucketsCount = new Set(routes.map(r => r.bucket)).size;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 route-transition">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface">
            Welcome Back
          </h1>
          <p className="text-on-surface-variant text-body-md mt-1">Here's what's happening with your S3 backups today.</p>
        </div>
        <Link 
          to="/buckets"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary font-medium text-body-md rounded border border-transparent hover:bg-primary/95 transition-all duration-200 cursor-pointer"
        >
          <HiOutlineDatabase className="w-5 h-5" />
          Explore Buckets
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title="Completed Downloads" 
          value={String(totalDownloadsCount)} 
          trend={`${tasks.length} in history`}
          icon={<HiOutlineDownload className="w-5 h-5 text-primary" />}
        />
        <StatCard 
          title="Storage Downloaded" 
          value={storageVal} 
          trend="Total transferred"
          icon={<HiOutlineChartBar className="w-5 h-5 text-tertiary" />}
        />
        <StatCard 
          title="Active Buckets (Routes)" 
          value={String(activeBucketsCount)} 
          trend={`${routes.length} saved paths`}
          icon={<HiOutlineDatabase className="w-5 h-5 text-secondary" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Favorites Section */}
        <div className="bg-surface-container-low rounded-lg border border-outline-variant p-4 flex flex-col h-[480px] transition-colors">
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
        <div className="bg-surface-container-low rounded-lg border border-outline-variant p-4 flex flex-col h-[480px] transition-colors">
          <div className="flex items-center gap-3 mb-4 shrink-0">
            <div className="p-2 bg-surface-container-high text-tertiary border border-outline-variant rounded flex items-center justify-center">
              <HiOutlineClock className="w-5 h-5" />
            </div>
            <h2 className="text-headline-md text-on-surface font-semibold">Recent Activity</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-1 min-h-0">
            {recentActions.length > 0 ? (
              <ul className="space-y-2">
                {paginatedActions.map((log) => {
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

          {/* Pagination Controls */}
          {recentActions.length > 0 && (
            <div className="flex items-center justify-between border-t border-outline-variant/30 pt-3 mt-3 shrink-0 text-label-sm">
              <div className="flex items-center gap-2">
                <span className="text-on-surface-variant">Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="bg-surface-container-high border border-outline-variant/50 rounded px-2 py-1 text-on-surface focus:outline-none focus:border-primary cursor-pointer text-label-sm font-mono"
                >
                  {[5, 10, 15, 20].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-on-surface-variant font-mono">
                  Page {activePage} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={activePage === 1}
                    className="p-1 rounded bg-surface-container-high border border-outline-variant/30 hover:border-outline-variant hover:bg-surface-container-highest disabled:opacity-40 disabled:cursor-not-allowed text-on-surface transition-colors cursor-pointer"
                    title="Previous Page"
                  >
                    <HiChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={activePage === totalPages}
                    className="p-1 rounded bg-surface-container-high border border-outline-variant/30 hover:border-outline-variant hover:bg-surface-container-highest disabled:opacity-40 disabled:cursor-not-allowed text-on-surface transition-colors cursor-pointer"
                    title="Next Page"
                  >
                    <HiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
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
        <span className="text-label-sm font-medium text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-sm font-mono">
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

