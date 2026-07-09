import { create } from 'zustand';
import { saveDownloadTask, getDownloadHistory, deleteDownloadTask, clearDownloadHistory as clearDbHistory } from './downloadDatabase';

export interface DownloadTask {
    id: string;
    fileName: string;
    bucket: string;
    key: string;
    status: 'queued' | 'downloading' | 'completed' | 'error' | 'canceled' | 'paused';
    progress: number;
    speed: string;
    totalSize: number;
    downloadedSize: number;
    error?: string;
    startTime: number;
    savePath: string;
    chunks?: {
        index: number;
        completed: boolean;
        downloadedBytes: number;
        totalBytes: number;
    }[];
    eta?: string;
}

// Trailing-edge throttle helper to limit database saves
function throttleTrailing<T extends (...args: any[]) => void>(
    func: T,
    limit: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
    let lastFunc: number | undefined;
    let lastRan: number | undefined;

    const throttled = function (this: any, ...args: Parameters<T>) {
        const context = this;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = window.setTimeout(function () {
                if (lastRan && (Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (lastRan ? (Date.now() - lastRan) : 0));
        }
    };

    throttled.cancel = () => {
        if (lastFunc) {
            clearTimeout(lastFunc);
            lastFunc = undefined;
        }
        lastRan = undefined;
    };

    return throttled as any;
}

type ThrottledSaveFn = ((task: DownloadTask) => void) & { cancel: () => void };
const throttledSaves = new Map<string, ThrottledSaveFn>();

const getThrottledSave = (taskId: string) => {
    let throttledSave = throttledSaves.get(taskId);
    if (!throttledSave) {
        throttledSave = throttleTrailing((task: DownloadTask) => {
            saveDownloadTask(task);
        }, 2000); // Save to database at most once every 2 seconds during active downloading
        throttledSaves.set(taskId, throttledSave);
    }
    return throttledSave;
};

export const clearThrottledSave = (taskId: string) => {
    const throttledSave = throttledSaves.get(taskId);
    if (throttledSave) {
        throttledSave.cancel();
        throttledSaves.delete(taskId);
    }
};

interface DownloadStore {
    tasks: DownloadTask[];
    maxConcurrentDownloads: number;
    initialize: () => Promise<void>;
    addTask: (task: Omit<DownloadTask, 'progress' | 'speed' | 'downloadedSize' | 'startTime'>) => void;
    updateTask: (id: string, updates: Partial<DownloadTask>) => void;
    retryTask: (id: string) => void;
    removeTask: (id: string) => void;
    clearHistory: () => void;
    setMaxConcurrent: (count: number) => void;
}

export const useDownloadStore = create<DownloadStore>((set) => ({
    tasks: [],
    maxConcurrentDownloads: 3,

    initialize: async () => {
        const history = await getDownloadHistory();
        set({ tasks: history });
    },

    addTask: (task) => {
        const newTask: DownloadTask = {
            ...task,
            status: 'queued',
            progress: 0,
            speed: '0 KB/s',
            downloadedSize: 0,
            startTime: Date.now()
        };

        set((state) => ({ tasks: [newTask, ...state.tasks] }));
        saveDownloadTask(newTask); // Async save
    },

    updateTask: (id, updates) => {
        set((state) => {
            const currentTask = state.tasks.find(t => t.id === id);
            if (!currentTask) return state;

            const updatedTask = { ...currentTask, ...updates };
            const newTasks = state.tasks.map((t) => t.id === id ? updatedTask : t);

            // If we are changing to a final/transition state (completed, error, paused, etc.),
            // save immediately. Otherwise, throttle the DB save.
            const isStatusChange = updates.status && updates.status !== currentTask.status;
            const isFinalState = updates.status && ['completed', 'error', 'paused', 'canceled'].includes(updates.status);

            if (isStatusChange || isFinalState) {
                // Cancel/remove throttled save for this task and save immediately
                const throttledSave = throttledSaves.get(id);
                if (throttledSave) {
                    throttledSave.cancel();
                    throttledSaves.delete(id);
                }
                saveDownloadTask(updatedTask);
            } else {
                // Throttle progress/speed saves
                const throttledSave = getThrottledSave(id);
                throttledSave(updatedTask);
            }

            return { tasks: newTasks };
        });
    },

    retryTask: (id) => {
        set((state) => {
            const newTasks = state.tasks.map((t) => t.id === id ? {
                ...t,
                status: 'queued' as const,
                progress: t.status === 'paused' || t.status === 'error' ? t.progress : 0,
                error: undefined,
                startTime: Date.now()
            } : t);
            const updatedTask = newTasks.find(t => t.id === id);
            if (updatedTask) {
                const throttledSave = throttledSaves.get(id);
                if (throttledSave) {
                    throttledSave.cancel();
                    throttledSaves.delete(id);
                }
                saveDownloadTask(updatedTask);
            }
            return { tasks: newTasks };
        });
    },

    removeTask: (id) => {
        set((state) => ({
            tasks: state.tasks.filter((t) => t.id !== id)
        }));
        const throttledSave = throttledSaves.get(id);
        if (throttledSave) {
            throttledSave.cancel();
            throttledSaves.delete(id);
        }
        deleteDownloadTask(id);
    },

    clearHistory: () => {
        set((state) => ({
            tasks: state.tasks.filter((t) => t.status === 'downloading' || t.status === 'queued')
        }));
        clearDbHistory();
    },

    setMaxConcurrent: (count) => set({ maxConcurrentDownloads: count })
}));
