import {
  createBrowserRouter,
  RouterProvider,
  RouteObject,
} from "react-router-dom";
import DefaultLayout from "./layouts/deafaultLayout";
import DashboardPage from "../pages/dashboard";
import BucketPage from "../pages/bucket";
import BucketExplorerPage from "../pages/bucketExplorer";
import DownloadsPage from "../pages/downloads";
import FavoritesPage from "../pages/favorites";
import SettingsPage from "../pages/settings";
import { AppLoading } from "../components/AppLoading";
import { useState, useEffect } from "react";

let routesConfig: RouteObject[] = [
  {
    path: "/",
    element: <DefaultLayout />,
    children: [
      {
        index: true,
        handle: { title: "Dashboard" },
        element: <DashboardPage />,
      },
      {
        path: "/buckets",
        handle: { title: "Buckets" },
        element: <BucketPage />,
      },
      {
        path: "/buckets/:bucketName",
        handle: { title: "Bucket Explorer" },
        element: <BucketExplorerPage />,
      },
      {
        path: "/downloads",
        handle: { title: "Downloads" },
        element: <DownloadsPage />,
      },
      {
        path: "/favorites",
        handle: { title: "My Routes" },
        element: <FavoritesPage />,
      },
      {
        path: "/settings",
        handle: { title: "Settings" },
        element: <SettingsPage />,
      },
    ],
  },
];

export default function AppRoutes() {
  const [isLoading, setIsLoading] = useState(true);
  const router = createBrowserRouter(routesConfig);

  useEffect(() => {
    // Simulate initial app setup/auth check
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {isLoading && <AppLoading />}
      <RouterProvider router={router} />
    </>
  );
}
