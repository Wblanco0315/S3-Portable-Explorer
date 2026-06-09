import { useState, useMemo } from 'react';
import {
    HiOutlineDownload,
    HiOutlineCheckCircle,
    HiOutlineExclamationCircle,
    HiOutlineX,
    HiOutlineRefresh,
    HiOutlineClock,
    HiOutlineTrash,
    HiOutlineFolderOpen,
    HiOutlineSearch,
    HiOutlineDocumentText,
    HiOutlinePause
} from 'react-icons/hi';
import { useDownloadStore, DownloadTask } from '../features/downloads/downloadStore';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useTranslation } from 'react-i18next';

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
};

const DownloadItem = ({
    task,
    onDelete,
    onOpenFolder,
    onRetry,
    onPause
}: {
    task: DownloadTask;
    onDelete: (id: string) => void;
    onOpenFolder: (path: string) => void;
    onRetry: (task: DownloadTask) => void;
    onPause: (task: DownloadTask) => void;
}) => {
    const { t } = useTranslation();
    const isDownloading = task.status === 'downloading' || task.status === 'queued';
    const isPaused = task.status === 'paused';
    const isError = task.status === 'error';
    const isCompleted = task.status === 'completed';

    return (
        <div className="group relative bg-surface-container-low border border-outline-variant rounded-lg p-4 transition-all hover:bg-surface-container-highest/20 mb-3">
            <div className="flex items-start gap-4">
                {/* File Icon */}
                <div className={`p-2.5 rounded border ${isDownloading ? 'bg-surface-container text-primary border-primary/20' : isPaused ? 'bg-surface-container text-secondary border-secondary/20' : isError ? 'bg-surface-container text-error border-error/20' : 'bg-surface-container text-on-surface-variant border-outline-variant'}`}>
                    <HiOutlineDocumentText size={20} />
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-body-md font-bold text-on-surface truncate" title={task.fileName}>
                            {task.fileName}
                        </h3>
                        <span className="text-label-sm font-mono font-medium px-1.5 py-0.5 rounded-sm bg-surface-container text-on-surface-variant border border-outline-variant uppercase tracking-wider">
                            {task.bucket}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-label-sm font-mono text-on-surface-variant">
                        <span className="flex items-center gap-1">
                            <HiOutlineClock size={12} />
                            {formatDate(task.startTime)}
                        </span>
                        <span>•</span>
                        <span>
                            {task.totalSize > 0
                                ? `${formatSize(task.downloadedSize)} / ${formatSize(task.totalSize)}`
                                : formatSize(task.downloadedSize)
                            }
                        </span>
                    </div>

                    {/* Progress Bar */}
                    {(isDownloading || isPaused) && (
                        <div className="mt-3">
                            <div className="flex justify-between mb-1 text-label-sm font-mono">
                                <span className={isPaused ? 'text-secondary' : 'text-primary'}>
                                    {task.status === 'queued' ? t('downloads.queued') : isPaused ? t('downloads.paused_pct', { progress: task.progress.toFixed(1) }) : t('downloads.downloading_pct', { progress: task.progress.toFixed(1) })}
                                </span>
                                {task.status === 'downloading' && (
                                    <span className="text-on-surface-variant">{task.speed}</span>
                                )}
                            </div>
                            <div className="w-full bg-surface-container rounded-sm h-1.5 overflow-hidden border border-outline-variant/30">
                                <div
                                    className={`h-1.5 rounded-sm transition-all duration-300 ${isPaused ? 'bg-secondary' : 'bg-primary'}`}
                                    style={{ width: `${task.progress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Status Feedback / Controls */}
                    <div className="mt-2 flex items-center gap-4">
                        {isCompleted && (
                            <>
                                <div className="flex items-center gap-1.5 text-label-sm font-mono font-medium text-primary">
                                    <HiOutlineCheckCircle size={14} />
                                    {t('downloads.completed')}
                                </div>
                                <button
                                    onClick={() => onOpenFolder(task.savePath)}
                                    className="flex items-center gap-1 text-label-sm font-mono font-semibold text-primary hover:underline cursor-pointer"
                                >
                                    <HiOutlineFolderOpen size={14} />
                                    {t('downloads.show_in_folder')}
                                </button>
                            </>
                        )}

                        {isError && (
                            <>
                                <div className="flex items-center gap-1.5 text-label-sm font-mono font-medium text-error">
                                    <HiOutlineExclamationCircle size={14} />
                                    {t('downloads.error_prefix', { error: task.error })}
                                </div>
                                <button
                                    onClick={() => onRetry(task)}
                                    className="flex items-center gap-1 text-label-sm font-mono font-semibold text-primary hover:underline cursor-pointer"
                                >
                                    <HiOutlineRefresh size={14} />
                                    {t('downloads.retry')}
                                </button>
                            </>
                        )}

                        {isPaused && (
                            <>
                                <div className="flex items-center gap-1.5 text-label-sm font-mono font-medium text-secondary">
                                    <HiOutlineClock size={14} />
                                    {t('downloads.paused')}
                                </div>
                                <button
                                    onClick={() => onRetry(task)}
                                    className="flex items-center gap-1 text-label-sm font-mono font-semibold text-primary hover:underline cursor-pointer"
                                >
                                    <HiOutlineRefresh size={14} />
                                    {t('downloads.resume')}
                                </button>
                            </>
                        )}

                        {isDownloading && (
                            <button
                                onClick={() => onPause(task)}
                                className="flex items-center gap-1 text-label-sm font-mono font-semibold text-secondary hover:underline cursor-pointer"
                            >
                                <HiOutlinePause size={14} />
                                {t('downloads.pause')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onDelete(task.id)}
                        className="p-1 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded transition-colors cursor-pointer"
                        title={t('downloads.remove_tooltip')}
                    >
                        <HiOutlineX size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function DownloadsPage() {
    const { tasks, removeTask, clearHistory, retryTask, updateTask } = useDownloadStore();
    const [searchTerm, setSearchTerm] = useState('');
    const { t } = useTranslation();

    const handleRetry = async (task: DownloadTask) => {
        try {
            retryTask(task.id);
        } catch (err) {
            console.error("Retry failed", err);
        }
    };

    const handlePause = (task: DownloadTask) => {
        updateTask(task.id, { status: 'paused', speed: '0 KB/s' });
    };

    const handleReveal = async (path: string) => {
        try {
            await revealItemInDir(path);
        } catch (err) {
            console.error("Failed to reveal file", err);
        }
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter(t =>
            t.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.bucket.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [tasks, searchTerm]);

    return (
        <div className="flex flex-1 bg-surface p-4 md:p-6 font-inter text-on-surface overflow-y-auto transition-colors duration-300">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-headline-lg font-bold text-on-surface">{t('downloads.title')}</h1>
                        <p className="text-body-md text-on-surface-variant mt-1">{t('downloads.subtitle')}</p>
                    </div>
                    <button
                        onClick={clearHistory}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-body-md font-medium text-error bg-surface-container border border-error/20 rounded hover:bg-error-container/25 transition-colors cursor-pointer"
                    >
                        <HiOutlineTrash size={16} />
                        {t('downloads.clear_history')}
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative mb-6">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                        <HiOutlineSearch className="h-5 w-5" />
                    </div>
                    <input
                        type="text"
                        placeholder={t('downloads.search_placeholder')}
                        className="block w-full pl-9 pr-3 py-2.5 border border-outline-variant rounded bg-surface-container text-body-md text-on-surface focus:outline-none focus:border-primary transition-all outline-none font-mono"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Downloads List */}
                <div className="space-y-1 pb-10">
                    {filteredTasks.length > 0 ? (
                        filteredTasks.map(task => (
                            <DownloadItem
                                key={task.id}
                                task={task}
                                onDelete={removeTask}
                                onOpenFolder={handleReveal}
                                onRetry={handleRetry}
                                onPause={handlePause}
                            />
                        ))
                    ) : (
                        <div className="text-center py-12 bg-surface-container rounded-lg border border-dashed border-outline-variant transition-colors">
                            <div className="mx-auto w-12 h-12 bg-surface-container-high rounded flex items-center justify-center text-on-surface-variant border border-outline-variant mb-4">
                                <HiOutlineDownload size={22} />
                            </div>
                            <p className="text-body-md text-on-surface font-semibold">{t('downloads.empty_title')}</p>
                            <p className="text-label-sm text-on-surface-variant mt-1 font-mono">{t('downloads.empty_desc')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
