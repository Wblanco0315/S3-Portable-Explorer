import Database from "@tauri-apps/plugin-sql";
import { DownloadTask } from "./downloadStore";

let db: Database | null = null;

export const getDownloadDb = async () => {
    if (!db) {
        db = await Database.load("sqlite:s3explorer.db");
        
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
    }
    return db;
};

export const saveDownloadTask = async (task: DownloadTask) => {
    const database = await getDownloadDb();
    return await database.execute(`
        INSERT INTO downloads (id, fileName, bucket, s3Key, status, progress, speed, totalSize, downloadedSize, error, startTime, savePath)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            progress = excluded.progress,
            speed = excluded.speed,
            totalSize = excluded.totalSize,
            downloadedSize = excluded.downloadedSize,
            error = excluded.error
    `, [
        task.id, task.fileName, task.bucket, task.key, task.status, 
        task.progress, task.speed, task.totalSize, task.downloadedSize, 
        task.error || null, task.startTime, task.savePath
    ]);
};

export const getDownloadHistory = async (): Promise<DownloadTask[]> => {
    const database = await getDownloadDb();
    const rows = await database.select<any[]>("SELECT * FROM downloads ORDER BY startTime DESC");
    return rows.map(row => ({
        id: row.id,
        fileName: row.fileName,
        bucket: row.bucket,
        key: row.s3Key,
        status: row.status,
        progress: row.progress,
        speed: row.speed,
        totalSize: row.totalSize,
        downloadedSize: row.downloadedSize,
        error: row.error,
        startTime: row.startTime,
        savePath: row.savePath
    }));
};

export const deleteDownloadTask = async (id: string) => {
    const database = await getDownloadDb();
    return await database.execute("DELETE FROM downloads WHERE id = $1", [id]);
};

export const clearDownloadHistory = async () => {
    const database = await getDownloadDb();
    return await database.execute("DELETE FROM downloads WHERE status NOT IN ('downloading', 'queued')");
};
