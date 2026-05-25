import Database from "@tauri-apps/plugin-sql";

let dbInstance: Database | null = null;

export const getDb = async () => {
  if (!dbInstance) {
    dbInstance = await Database.load("sqlite:s3explorer.db");
  }
  return dbInstance;
};

export const useDatabase = () => {
  // Settings
  const getSetting = async (key: string): Promise<string | null> => {
    const db = await getDb();
    const result = await db.select<{ value: string }[]>(
      "SELECT value FROM settings WHERE key = $1",
      [key]
    );
    return result.length > 0 ? result[0].value : null;
  };

  const saveSetting = async (key: string, value: string) => {
    const db = await getDb();
    await db.execute(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value]
    );
  };

  // Recent Routes
  const addRecentRoute = async (path: string) => {
    const db = await getDb();
    await db.execute(
      "INSERT INTO recent_routes (path) VALUES ($1)",
      [path]
    );
    // Keep only last 10
    await db.execute(
      "DELETE FROM recent_routes WHERE id NOT IN (SELECT id FROM recent_routes ORDER BY visited_at DESC LIMIT 10)"
    );
  };

  const getRecentRoutes = async () => {
    const db = await getDb();
    return await db.select<{ path: string; visited_at: string }[]>(
      "SELECT DISTINCT path, MAX(visited_at) as visited_at FROM recent_routes GROUP BY path ORDER BY visited_at DESC LIMIT 10"
    );
  };

  // Favorites
  const addFavorite = async (path: string, name: string) => {
    const db = await getDb();
    await db.execute(
      "INSERT INTO favorite_routes (path, name) VALUES ($1, $2) ON CONFLICT(path) DO UPDATE SET name = excluded.name",
      [path, name]
    );
  };

  const removeFavorite = async (path: string) => {
    const db = await getDb();
    await db.execute("DELETE FROM favorite_routes WHERE path = $1", [path]);
  };

  const getFavorites = async () => {
    const db = await getDb();
    return await db.select<{ path: string; name: string }[]>(
      "SELECT path, name FROM favorite_routes"
    );
  };

  return {
    getSetting,
    saveSetting,
    addRecentRoute,
    getRecentRoutes,
    addFavorite,
    removeFavorite,
    getFavorites,
  };
};
