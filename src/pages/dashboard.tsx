import React, { useEffect, useState } from "react";
import { HiOutlineChartBar, HiOutlineClock, HiOutlineLink, HiOutlineDownload, HiOutlineDatabase } from "react-icons/hi";
import { useDatabase } from "../shared/hooks/useDatabase";
import { listRoutes, Route } from "../features/favorites/favoritesStore";
import { useRouteNavigator } from "../shared/hooks/useRouteNavigator";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  const { navigateToRoute } = useRouteNavigator();
  const { getRecentRoutes } = useDatabase();
  const [recent, setRecent] = useState<{path: string; visited_at: string}[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [r, rt] = await Promise.all([getRecentRoutes(), listRoutes()]);
        setRecent(r);
        setRoutes(rt.slice(0, 5)); // Show only 5 most recent
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      }
    };
    loadData();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
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
          title="Total Downloads" 
          value="1,284" 
          trend="+12% this week"
          icon={<HiOutlineDownload className="w-5 h-5 text-primary" />}
        />
        <StatCard 
          title="Storage Accessed" 
          value="84.2 GB" 
          trend="+5.4% this week"
          icon={<HiOutlineChartBar className="w-5 h-5 text-tertiary" />}
        />
        <StatCard 
          title="Active Buckets" 
          value="12" 
          trend="No change"
          icon={<HiOutlineDatabase className="w-5 h-5 text-secondary" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Favorites Section */}
        <div className="bg-surface-container-low rounded-lg border border-outline-variant p-4 flex flex-col transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-surface-container-high text-primary border border-outline-variant rounded flex items-center justify-center">
              <HiOutlineLink className="w-5 h-5" />
            </div>
            <h2 className="text-headline-md text-on-surface font-semibold">My Routes</h2>
          </div>
          
          <div className="flex-1">
            {routes.length > 0 ? (
              <ul className="space-y-2">
                {routes.map((rt) => (
                  <div
                    key={rt.id}
                    onClick={() => navigateToRoute(rt)}
                    className="group flex items-center justify-between p-2.5 rounded hover:bg-surface-container-highest/50 border border-transparent hover:border-outline-variant/30 transition-colors cursor-pointer mb-2"
                  >
                    <div className="flex items-center gap-3">
                      <HiOutlineLink className="text-on-surface-variant group-hover:text-primary transition-colors" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-body-md font-semibold text-on-surface">{rt.name}</p>
                          {rt.profile && (
                            <span className="px-1.5 py-0.5 bg-surface-container-high text-on-surface-variant rounded-sm text-label-sm font-mono border border-outline-variant uppercase tracking-wider">
                              {rt.profile}
                            </span>
                          )}
                        </div>
                        <p className="text-label-sm text-on-surface-variant truncate max-w-[200px] font-mono mt-0.5">s3://{rt.bucket}/{rt.prefix}</p>
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

        {/* Recent Routes Section */}
        <div className="bg-surface-container-low rounded-lg border border-outline-variant p-4 flex flex-col transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-surface-container-high text-tertiary border border-outline-variant rounded flex items-center justify-center">
              <HiOutlineClock className="w-5 h-5" />
            </div>
            <h2 className="text-headline-md text-on-surface font-semibold">Recent Activity</h2>
          </div>
          
          <div className="flex-1">
            {recent.length > 0 ? (
              <ul className="space-y-2">
                {recent.map((route) => (
                  <li 
                    key={route.path} 
                    className="group flex items-center justify-between p-2.5 rounded hover:bg-surface-container-highest/50 border border-transparent hover:border-outline-variant/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <HiOutlineClock className="text-on-surface-variant group-hover:text-tertiary transition-colors" />
                      <p className="text-body-md text-on-surface-variant truncate max-w-[250px]">
                        {route.path}
                      </p>
                    </div>
                    <span className="text-label-sm text-on-surface-variant font-mono">
                      {new Date(route.visited_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-outline-variant rounded">
                <HiOutlineClock className="w-8 h-8 text-on-surface-variant mb-2" />
                <p className="text-body-md text-on-surface font-semibold">No recent activity</p>
                <p className="text-label-sm text-on-surface-variant mt-1 font-mono">Navigate through buckets to build your history.</p>
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

