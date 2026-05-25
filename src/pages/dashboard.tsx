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
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            Welcome Back
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">Here's what's happening with your S3 backups today.</p>
        </div>
        <Link 
          to="/buckets"
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium text-sm rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
        >
          <HiOutlineDatabase className="w-5 h-5" />
          Explore Buckets
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Downloads" 
          value="1,284" 
          trend="+12% this week"
          icon={<HiOutlineDownload className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />}
          color="bg-indigo-50 dark:bg-indigo-500/10"
        />
        <StatCard 
          title="Storage Accessed" 
          value="84.2 GB" 
          trend="+5.4% this week"
          icon={<HiOutlineChartBar className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />}
          color="bg-emerald-50 dark:bg-emerald-500/10"
        />
        <StatCard 
          title="Active Buckets" 
          value="12" 
          trend="No change"
          icon={<HiOutlineDatabase className="w-6 h-6 text-amber-600 dark:text-amber-400" />}
          color="bg-amber-50 dark:bg-amber-500/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Favorites Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 flex flex-col transition-colors">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-lg">
              <HiOutlineLink className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">My Routes</h2>
          </div>
          
          <div className="flex-1">
            {routes.length > 0 ? (
              <ul className="space-y-3">
                {routes.map((rt) => (
                  <div
                    key={rt.id}
                    onClick={() => navigateToRoute(rt)}
                    className="group flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-gray-100 dark:hover:border-slate-700 transition-colors cursor-pointer mb-2"
                  >
                    <div className="flex items-center gap-3">
                      <HiOutlineLink className="text-gray-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">{rt.name}</p>
                          {rt.profile && (
                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded text-[9px] font-extrabold border border-gray-200 dark:border-slate-700 uppercase tracking-wider">
                              {rt.profile}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-slate-500 truncate max-w-[200px]">s3://{rt.bucket}/{rt.prefix}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </ul>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-xl">
                <HiOutlineLink className="w-8 h-8 text-gray-300 dark:text-slate-700 mb-2" />
                <p className="text-sm text-gray-500 dark:text-slate-500 font-medium">No routes yet</p>
                <p className="text-xs text-gray-400 dark:text-slate-600 mt-1">Add paths to "My Routes" in the explorer to see them here.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Routes Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 flex flex-col transition-colors">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-lg">
              <HiOutlineClock className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">Recent Activity</h2>
          </div>
          
          <div className="flex-1">
            {recent.length > 0 ? (
              <ul className="space-y-3">
                {recent.map((route) => (
                  <li key={route.path} className="group flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-gray-100 dark:hover:border-slate-700 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <HiOutlineClock className="text-gray-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors" />
                      <p className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate max-w-[250px]">
                        {route.path}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      {new Date(route.visited_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-xl">
                <HiOutlineClock className="w-8 h-8 text-gray-300 dark:text-slate-700 mb-2" />
                <p className="text-sm text-gray-500 dark:text-slate-500 font-medium">No recent activity</p>
                <p className="text-xs text-gray-400 dark:text-slate-600 mt-1">Navigate through buckets to build your history.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-component for Stats
function StatCard({ title, value, trend, icon, color }: { title: string, value: string, trend: string, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${color}`}>
          {icon}
        </div>
        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
          {trend}
        </span>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-1">{value}</p>
      </div>
    </div>
  );
}
