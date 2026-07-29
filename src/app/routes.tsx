import {
  createBrowserRouter,
  RouterProvider,
  RouteObject,
  Navigate,
} from "react-router-dom";
import DefaultLayout from "./layouts/deafaultLayout";
import DashboardPage from "../pages/dashboard";
import BucketPage from "../pages/bucket";
import BucketExplorerPage from "../pages/bucketExplorer";
import DownloadsPage from "../pages/downloads";
import FavoritesPage from "../pages/favorites";
import SettingsLayout from "../pages/settings/SettingsLayout";
import DownloadsSettings from "../pages/settings/DownloadsSettings";
import SystemSettings from "../pages/settings/SystemSettings";
import AwsSettings from "../pages/settings/AwsSettings";
import ErrorPage from "../pages/ErrorPage";

let routesConfig: RouteObject[] = [
  {
    path: "/",
    element: <DefaultLayout />,
    errorElement: <ErrorPage />,
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
        element: <SettingsLayout />,
        children: [
          { index: true, element: <Navigate to="downloads" replace /> },
          {
            path: "downloads",
            handle: { title: "Downloads" },
            element: <DownloadsSettings />,
          },
          {
            path: "system",
            handle: { title: "System" },
            element: <SystemSettings />,
          },
          {
            path: "aws",
            handle: { title: "AWS SSO" },
            element: <AwsSettings />,
          },
        ],
      },
    ],
  },
];

export default function AppRoutes() {
  const router = createBrowserRouter(routesConfig);

  return <RouterProvider router={router} />;
}
