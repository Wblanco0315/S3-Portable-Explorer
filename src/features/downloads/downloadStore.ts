import { create } from 'zustand';
import { saveDownloadTask, getDownloadHistory, deleteDownloadTask, clearDownloadHistory as clearDbHistory } from './downloadDatabase';

export interface DownloadTask {
    id: string;
    fileName: string;
    bucket: string;
    key: string;
    status: 'queued' | 'downloading' | 'completed' | 'error' | 'canceled';
    progress: number;
    speed: string;
    totalSize: number;
    downloadedSize: number;
    error?: string;
    startTime: number;
    savePath: string;
}

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
            const newTasks = state.tasks.map((t) => t.id === id ? { ...t, ...updates } : t);
            const updatedTask = newTasks.find(t => t.id === id);
            if (updatedTask) {
                // Save to DB (throttling might be good here but SQL plugin is fast enough for 500ms updates)
                saveDownloadTask(updatedTask);
            }
            return { tasks: newTasks };
        });
    },

    retryTask: (id) => {
        set((state) => {
            const newTasks = state.tasks.map((t) => t.id === id ? { 
                ...t, 
                status: 'queued' as const, 
                progress: 0, 
                error: undefined,
                startTime: Date.now()
            } : t);
            const updatedTask = newTasks.find(t => t.id === id);
            if (updatedTask) saveDownloadTask(updatedTask);
            return { tasks: newTasks };
        });
    },

    removeTask: (id) => {
        set((state) => ({
            tasks: state.tasks.filter((t) => t.id !== id)
        }));
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
