import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

export const getDb = (): Promise<Database> => {
  if (!dbPromise) {
    const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;
    if (!isTauri) {
      return Promise.reject(new Error("Database is only available in the Tauri desktop application."));
    }
    dbPromise = (async () => {
      const db = await Database.load("sqlite:s3explorer_data.db");
      
      // 1. Create action_logs
      await db.execute(`
        CREATE TABLE IF NOT EXISTS action_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action_type TEXT NOT NULL,
          details TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 2. Create favorite_folders
      await db.execute(`
        CREATE TABLE IF NOT EXISTS favorite_folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          parent_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_id) REFERENCES favorite_folders (id) ON DELETE CASCADE
        )
      `);

      // 3. Create favorites
      await db.execute(`
        CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          bucket TEXT NOT NULL,
          prefix TEXT NOT NULL,
          profile TEXT NOT NULL DEFAULT 'default',
          folder_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (folder_id) REFERENCES favorite_folders (id) ON DELETE SET NULL
        )
      `);

      // 4. Favorites migrations
      try {
        await db.execute("ALTER TABLE favorites ADD COLUMN folder_id INTEGER");
      } catch (e) {}
      try {
        await db.execute("ALTER TABLE favorites ADD COLUMN profile TEXT NOT NULL DEFAULT 'default'");
      } catch (e) {}
      try {
        await db.execute("ALTER TABLE favorites ADD COLUMN visit_count INTEGER DEFAULT 0");
      } catch (e) {}

      // 5. Create stats tables
      await db.execute(`
        CREATE TABLE IF NOT EXISTS daily_downloads (
          date TEXT PRIMARY KEY,
          completed_count INTEGER DEFAULT 0,
          bytes_downloaded INTEGER DEFAULT 0
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS daily_active_buckets (
          date TEXT NOT NULL,
          bucket TEXT NOT NULL,
          PRIMARY KEY (date, bucket)
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS daily_active_routes (
          date TEXT NOT NULL,
          route_path TEXT NOT NULL,
          PRIMARY KEY (date, route_path)
        )
      `);

      // 6. Create download tables
      await db.execute(`
        CREATE TABLE IF NOT EXISTS downloads (
          id TEXT PRIMARY KEY,
          fileName TEXT NOT NULL,
          bucket TEXT NOT NULL,
          s3Key TEXT NOT NULL,
          status TEXT NOT NULL,
          progress REAL DEFAULT 0,
          speed TEXT,
          totalSize INTEGER DEFAULT 0,
          downloadedSize INTEGER DEFAULT 0,
          error TEXT,
          startTime INTEGER,
          savePath TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS download_chunks (
          taskId TEXT NOT NULL,
          chunkIndex INTEGER NOT NULL,
          startByte INTEGER NOT NULL,
          endByte INTEGER NOT NULL,
          completed INTEGER DEFAULT 0,
          PRIMARY KEY (taskId, chunkIndex)
        )
      `);

      // Truncate the WAL after init so a future crash leaves a minimal file that's safe to delete.
      await db.execute("PRAGMA wal_checkpoint(TRUNCATE)").catch(() => {});

      return db;
    })();
  }
  return dbPromise;
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

  const logAction = async (actionType: string, details: string) => {
    try {
      const db = await getDb();
      await db.execute(
        "INSERT INTO action_logs (action_type, details) VALUES ($1, $2)",
        [actionType, details]
      );
      // Keep only last 50 action logs
      await db.execute(
        "DELETE FROM action_logs WHERE id NOT IN (SELECT id FROM action_logs ORDER BY created_at DESC LIMIT 50)"
      );
    } catch (err) {
      console.error("Failed to log action:", err);
    }
  };

  const getActionLogs = async () => {
    const db = await getDb();
    return await db.select<{ id: number; action_type: string; details: string; created_at: string }[]>(
      "SELECT id, action_type, details, created_at FROM action_logs ORDER BY created_at DESC LIMIT 50"
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
    logAction,
    getActionLogs,
  };
};
