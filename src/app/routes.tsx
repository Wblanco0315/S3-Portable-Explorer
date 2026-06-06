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
  const router = createBrowserRouter(routesConfig);

  return <RouterProvider router={router} />;
}
