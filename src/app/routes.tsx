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
import ErrorPage from "../pages/ErrorPage";
import CloudRoutesPage from "../pages/cloudRoutes";
import CloudGroupsPage from "../pages/cloudGroups";

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
        path: "/cloud-routes",
        handle: { title: "Cloud Routes" },
        element: <CloudRoutesPage />,
      },
      {
        path: "/cloud-groups",
        handle: { title: "Access Groups" },
        element: <CloudGroupsPage />,
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
