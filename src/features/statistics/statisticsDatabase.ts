import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export const getStatsDb = async () => {
    if (!db) {
        db = await Database.load("sqlite:s3explorer.db");
        
        // Initialize stats tables
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
    }
    return db;
};

// Helper for local YYYY-MM-DD string
const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const recordDownloadCompleted = async (bytes: number) => {
    try {
        const database = await getStatsDb();
        const todayStr = getLocalDateString();
        await database.execute(`
            INSERT INTO daily_downloads (date, completed_count, bytes_downloaded)
            VALUES ($1, 1, $2)
            ON CONFLICT(date) DO UPDATE SET
                completed_count = completed_count + 1,
                bytes_downloaded = bytes_downloaded + $2
        `, [todayStr, bytes]);
        console.log(`[Stats] Recorded completed download: ${bytes} bytes on ${todayStr}`);
    } catch (err) {
        console.error("[Stats] Failed to record completed download:", err);
    }
};

export const recordBucketVisit = async (bucket: string) => {
    if (!bucket) return;
    try {
        const database = await getStatsDb();
        const todayStr = getLocalDateString();
        await database.execute(`
            INSERT OR IGNORE INTO daily_active_buckets (date, bucket)
            VALUES ($1, $2)
        `, [todayStr, bucket]);
    } catch (err) {
        console.error("[Stats] Failed to record bucket visit:", err);
    }
};

export const recordRouteVisit = async (bucket: string, prefix: string) => {
    if (!bucket) return;
    try {
        const database = await getStatsDb();
        const todayStr = getLocalDateString();
        const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
        const routePath = `${bucket}/${cleanPrefix}`;
        await database.execute(`
            INSERT OR IGNORE INTO daily_active_routes (date, route_path)
            VALUES ($1, $2)
        `, [todayStr, routePath]);
    } catch (err) {
        console.error("[Stats] Failed to record route visit:", err);
    }
};

export const clearDownloadStats = async () => {
    try {
        const database = await getStatsDb();
        await database.execute("DELETE FROM daily_downloads");
        console.log("[Stats] Cleared daily download statistics");
    } catch (err) {
        console.error("[Stats] Failed to clear download statistics:", err);
    }
};

export interface DailyStats {
    date: string;
    completedDownloads: number;
    storageDownloaded: number;
    activeBuckets: number;
    activeRoutes: number;
}

export const getStatisticsData = async (days: number = 30): Promise<DailyStats[]> => {
    const database = await getStatsDb();
    
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - (days - 1));
    const dateLimitStr = getLocalDateString(dateLimit);

    const downloads = await database.select<{ date: string; completed_count: number; bytes_downloaded: number }[]>(
        "SELECT date, completed_count, bytes_downloaded FROM daily_downloads WHERE date >= $1",
        [dateLimitStr]
    );

    const activeBuckets = await database.select<{ date: string; bucket_count: number }[]>(
        "SELECT date, COUNT(DISTINCT bucket) as bucket_count FROM daily_active_buckets WHERE date >= $1 GROUP BY date",
        [dateLimitStr]
    );

    const activeRoutes = await database.select<{ date: string; route_count: number }[]>(
        "SELECT date, COUNT(DISTINCT route_path) as route_count FROM daily_active_routes WHERE date >= $1 GROUP BY date",
        [dateLimitStr]
    );

    const statsMap: Record<string, DailyStats> = {};
    
    const getOrCreate = (d: string): DailyStats => {
        if (!statsMap[d]) {
            statsMap[d] = {
                date: d,
                completedDownloads: 0,
                storageDownloaded: 0,
                activeBuckets: 0,
                activeRoutes: 0
            };
        }
        return statsMap[d];
    };

    downloads.forEach(row => {
        const s = getOrCreate(row.date);
        s.completedDownloads = row.completed_count;
        s.storageDownloaded = row.bytes_downloaded;
    });

    activeBuckets.forEach(row => {
        const s = getOrCreate(row.date);
        s.activeBuckets = row.bucket_count;
    });

    activeRoutes.forEach(row => {
        const s = getOrCreate(row.date);
        s.activeRoutes = row.route_count;
    });

    // Populate the entire range to avoid missing chart days
    for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = getLocalDateString(d);
        getOrCreate(dateStr);
    }

    return Object.values(statsMap).sort((a, b) => a.date.localeCompare(b.date));
};

export interface PeriodStats {
    completedDownloads: number;
    storageDownloaded: number;
    activeBuckets: number;
    activeRoutes: number;
}

export interface StatsSummary {
    daily: PeriodStats;
    weekly: PeriodStats;
    monthly: PeriodStats;
}

export const getStatsSummary = async (): Promise<StatsSummary> => {
    const database = await getStatsDb();
    const todayStr = getLocalDateString();
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);
    const oneWeekAgoStr = getLocalDateString(oneWeekAgo);
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 29);
    const oneMonthAgoStr = getLocalDateString(oneMonthAgo);

    const getPeriodDownloads = async (sinceDate: string, untilDate?: string) => {
        let sql = "SELECT SUM(completed_count) as count, SUM(bytes_downloaded) as bytes FROM daily_downloads WHERE date >= $1";
        let params = [sinceDate];
        if (untilDate) {
            sql += " AND date <= $2";
            params.push(untilDate);
        }
        const rows = await database.select<{ count: number | null; bytes: number | null }[]>(sql, params);
        return {
            completedDownloads: rows[0]?.count || 0,
            storageDownloaded: rows[0]?.bytes || 0
        };
    };

    const getPeriodActiveBuckets = async (sinceDate: string, untilDate?: string) => {
        let sql = "SELECT COUNT(DISTINCT bucket) as count FROM daily_active_buckets WHERE date >= $1";
        let params = [sinceDate];
        if (untilDate) {
            sql += " AND date <= $2";
            params.push(untilDate);
        }
        const rows = await database.select<{ count: number }[]>(sql, params);
        return rows[0]?.count || 0;
    };

    const getPeriodActiveRoutes = async (sinceDate: string, untilDate?: string) => {
        let sql = "SELECT COUNT(DISTINCT route_path) as count FROM daily_active_routes WHERE date >= $1";
        let params = [sinceDate];
        if (untilDate) {
            sql += " AND date <= $2";
            params.push(untilDate);
        }
        const rows = await database.select<{ count: number }[]>(sql, params);
        return rows[0]?.count || 0;
    };

    const todayDownloads = await getPeriodDownloads(todayStr, todayStr);
    const todayBuckets = await getPeriodActiveBuckets(todayStr, todayStr);
    const todayRoutes = await getPeriodActiveRoutes(todayStr, todayStr);

    const weeklyDownloads = await getPeriodDownloads(oneWeekAgoStr);
    const weeklyBuckets = await getPeriodActiveBuckets(oneWeekAgoStr);
    const weeklyRoutes = await getPeriodActiveRoutes(oneWeekAgoStr);

    const monthlyDownloads = await getPeriodDownloads(oneMonthAgoStr);
    const monthlyBuckets = await getPeriodActiveBuckets(oneMonthAgoStr);
    const monthlyRoutes = await getPeriodActiveRoutes(oneMonthAgoStr);

    return {
        daily: {
            completedDownloads: todayDownloads.completedDownloads,
            storageDownloaded: todayDownloads.storageDownloaded,
            activeBuckets: todayBuckets,
            activeRoutes: todayRoutes
        },
        weekly: {
            completedDownloads: weeklyDownloads.completedDownloads,
            storageDownloaded: weeklyDownloads.storageDownloaded,
            activeBuckets: weeklyBuckets,
            activeRoutes: weeklyRoutes
        },
        monthly: {
            completedDownloads: monthlyDownloads.completedDownloads,
            storageDownloaded: monthlyDownloads.storageDownloaded,
            activeBuckets: monthlyBuckets,
            activeRoutes: monthlyRoutes
        }
    };
};
