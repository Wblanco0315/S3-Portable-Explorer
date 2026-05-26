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
    HiOutlineDocumentText
} from 'react-icons/hi';
import { useDownloadStore, DownloadTask } from '../features/downloads/downloadStore';
import { startS3Download } from '../features/aws/s3Client';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

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
    onRetry 
}: { 
    task: DownloadTask; 
    onDelete: (id: string) => void; 
    onOpenFolder: (path: string) => void;
    onRetry: (task: DownloadTask) => void;
}) => {
    const isDownloading = task.status === 'downloading' || task.status === 'queued';
    const isError = task.status === 'error';
    const isCompleted = task.status === 'completed';

    return (
        <div className="group relative bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-4 transition-all hover:shadow-md dark:shadow-slate-950/40 hover:border-blue-100 dark:hover:border-blue-900/50 mb-3">
            <div className="flex items-start gap-4">
                {/* File Icon */}
                <div className={`p-3 rounded-lg ${isDownloading ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : isError ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400'}`}>
                    <HiOutlineDocumentText size={24} />
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate" title={task.fileName}>
                            {task.fileName}
                        </h3>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                            {task.bucket}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-slate-500">
                        <span className="flex items-center gap-1">
                            <HiOutlineClock size={12} />
                            {formatDate(task.startTime)}
                        </span>
                        <span>•</span>
                        <span>{task.totalSize > 0 ? formatSize(task.totalSize) : formatSize(task.downloadedSize)}</span>
                    </div>

                    {/* Progress Bar */}
                    {isDownloading && (
                        <div className="mt-3">
                            <div className="flex justify-between mb-1 text-[11px] font-medium">
                                <span className="text-blue-600 dark:text-blue-400">
                                    {task.status === 'queued' ? 'En cola...' : `Descargando... ${task.progress.toFixed(1)}%`}
                                </span>
                                {task.status === 'downloading' && (
                                    <span className="text-gray-400 dark:text-slate-500">{task.speed}</span>
                                )}
                            </div>
                            <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-full h-1.5 overflow-hidden">
                                <div 
                                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                                    style={{ width: `${task.progress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Status Feedback */}
                    {!isDownloading && (
                        <div className="mt-2 flex items-center gap-4">
                            <div className={`flex items-center gap-1.5 text-xs font-medium ${isError ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {isError ? <HiOutlineExclamationCircle size={14} /> : <HiOutlineCheckCircle size={14} />}
                                {isError ? `Error: ${task.error}` : 'Completado'}
                            </div>
                            
                            {isCompleted && (
                                <button 
                                    onClick={() => onOpenFolder(task.savePath)}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                >
                                    <HiOutlineFolderOpen size={14} />
                                    Mostrar en carpeta
                                </button>
                            )}

                            {isError && (
                                <button 
                                    onClick={() => onRetry(task)}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                >
                                    <HiOutlineRefresh size={14} />
                                    Reintentar
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={() => onDelete(task.id)}
                        className="p-2 text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Eliminar del historial"
                    >
                        <HiOutlineX size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function DownloadsPage() {
    const { tasks, removeTask, clearHistory } = useDownloadStore();
    const [searchTerm, setSearchTerm] = useState('');

    const handleRetry = async (task: DownloadTask) => {
        try {
            await startS3Download(task.bucket, task.key, task.fileName);
            removeTask(task.id);
        } catch (err) {
            console.error("Retry failed", err);
        }
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
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-4 md:p-8 font-sans text-gray-900 dark:text-slate-100 overflow-y-auto transition-colors duration-300">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Historial de Descargas</h1>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Gestiona tus archivos descargados y el progreso actual.</p>
                    </div>
                    <button 
                        onClick={clearHistory}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shadow-sm"
                    >
                        <HiOutlineTrash size={16} />
                        Limpiar Historial
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative mb-6">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <HiOutlineSearch className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por nombre de archivo o bucket..."
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500/50 focus:border-transparent transition-all outline-none text-sm shadow-sm dark:text-slate-100"
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
                            />
                        ))
                    ) : (
                        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-100 dark:border-slate-800 transition-colors">
                            <div className="mx-auto w-12 h-12 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-gray-400 dark:text-slate-600 mb-4">
                                <HiOutlineDownload size={24} />
                            </div>
                            <p className="text-gray-500 dark:text-slate-400 font-medium">No se encontraron archivos</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Tu historial está vacío o no coincide con la búsqueda.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
