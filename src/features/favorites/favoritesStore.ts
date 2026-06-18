import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { getDb as getSharedDb } from "../../shared/hooks/useDatabase";

export interface Route {
    id?: number;
    name: string;
    bucket: string;
    prefix: string;
    profile: string;
    folder_id?: number | null;
    created_at?: string;
}

export interface FavoriteFolder {
    id?: number;
    name: string;
    parent_id?: number | null;
    created_at?: string;
}

const getDb = () => {
    return getSharedDb();
};

export const addRoute = async (route: Route) => {
    const database = await getDb();
    return await database.execute(
        "INSERT INTO favorites (name, bucket, prefix, profile, folder_id) VALUES ($1, $2, $3, $4, $5)",
        [route.name, route.bucket, route.prefix, route.profile, route.folder_id || null]
    );
};

// Folder Operations
export const addFolder = async (name: string, parentId: number | null = null) => {
    const database = await getDb();
    return await database.execute(
        "INSERT INTO favorite_folders (name, parent_id) VALUES ($1, $2)",
        [name, parentId]
    );
};

export const listFolders = async (): Promise<FavoriteFolder[]> => {
    const database = await getDb();
    return await database.select<FavoriteFolder[]>("SELECT * FROM favorite_folders ORDER BY name ASC");
};

export const removeFolder = async (id: number) => {
    const database = await getDb();
    return await database.execute("DELETE FROM favorite_folders WHERE id = $1", [id]);
};

export const updateRouteFolder = async (routeId: number, folderId: number | null) => {
    const database = await getDb();
    return await database.execute(
        "UPDATE favorites SET folder_id = $1 WHERE id = $2",
        [folderId, routeId]
    );
};

export const updateFolderParent = async (folderId: number, parentId: number | null) => {
    const database = await getDb();
    // Prevent moving a folder into itself (simple check)
    if (folderId === parentId) return;
    return await database.execute(
        "UPDATE favorite_folders SET parent_id = $1 WHERE id = $2",
        [parentId, folderId]
    );
};

export const removeRoute = async (id: number) => {
    const database = await getDb();
    return await database.execute("DELETE FROM favorites WHERE id = $1", [id]);
};

export const listRoutes = async (): Promise<Route[]> => {
    const database = await getDb();
    return await database.select<Route[]>("SELECT * FROM favorites ORDER BY created_at DESC");
};

export const incrementRouteVisit = async (routeId: number) => {
    const database = await getDb();
    return await database.execute(
        "UPDATE favorites SET visit_count = COALESCE(visit_count, 0) + 1 WHERE id = $1",
        [routeId]
    );
};

export const getTopVisitedRoutes = async (): Promise<Route[]> => {
    const database = await getDb();
    return await database.select<Route[]>(
        "SELECT * FROM favorites ORDER BY COALESCE(visit_count, 0) DESC, created_at DESC LIMIT 10"
    );
};

// Export/Import Types
export interface ExportInfo {
  name: string;
  exported_at: string;
  version: string;
}

export interface ExportRouteItem {
  name: string;
  bucket: string;
  prefix: string;
  profile: string;
}

export interface ExportFolderItem {
  name: string;
  item: (ExportRouteItem | ExportFolderItem)[];
}

export interface PostmanStyleExport {
  info: ExportInfo;
  item: (ExportRouteItem | ExportFolderItem)[];
}

export const exportFavorites = async (): Promise<boolean> => {
  const routes = await listRoutes();
  const folders = await listFolders();

  // Helper to build hierarchy starting from parent_id recursively
  const buildItemTree = (parentId: number | null): (ExportRouteItem | ExportFolderItem)[] => {
    const matchingFolders = folders.filter((f) => (f.parent_id ?? null) === parentId);
    const matchingRoutes = routes.filter((r) => (r.folder_id ?? null) === parentId);

    const folderItems: ExportFolderItem[] = matchingFolders.map((f) => ({
      name: f.name,
      item: buildItemTree(f.id!),
    }));

    const routeItems: ExportRouteItem[] = matchingRoutes.map((r) => ({
      name: r.name,
      bucket: r.bucket,
      prefix: r.prefix,
      profile: r.profile,
    }));

    return [...folderItems, ...routeItems];
  };

  const exportData: PostmanStyleExport = {
    info: {
      name: "S3 Explorer Routes Collection",
      exported_at: new Date().toISOString(),
      version: "1.0.0",
    },
    item: buildItemTree(null),
  };

  // Open save dialog
  const filePath = await save({
    defaultPath: "s3_explorer_favorites.json",
    filters: [
      {
        name: "JSON Collection",
        extensions: ["json"],
      },
    ],
  });

  if (!filePath) return false;

  await writeTextFile(filePath, JSON.stringify(exportData, null, 2));
  return true;
};

export const importFavorites = async (): Promise<boolean> => {
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: "JSON Collection",
        extensions: ["json"],
      },
    ],
  });

  if (!selected || typeof selected !== "string") return false;

  const content = await readTextFile(selected);
  const data = JSON.parse(content) as PostmanStyleExport;

  if (!data.info || !data.item || !Array.isArray(data.item)) {
    throw new Error("Invalid format. Must be a valid Postman-style S3 Favorites export JSON.");
  }

  // Recursive importer
  const importItemTree = async (items: (ExportRouteItem | ExportFolderItem)[], parentId: number | null) => {
    for (const it of items) {
      if ("bucket" in it) {
        // It is a Route
        await addRoute({
          name: it.name,
          bucket: it.bucket,
          prefix: it.prefix || "",
          profile: it.profile || "default",
          folder_id: parentId,
        });
      } else if ("item" in it) {
        // It is a Folder
        const result = (await addFolder(it.name, parentId)) as any;
        const newFolderId = result.lastInsertId;
        if (newFolderId) {
          await importItemTree(it.item, newFolderId);
        }
      }
    }
  };

  await importItemTree(data.item, null);
  return true;
};
