import { useEffect, useRef } from 'react';
import { useDownloadStore, UNLIMITED_RETRIES } from './downloadStore';
import { executeDownloadTask, isAwsAuthenticated } from '../aws/s3Client';
import { safeConfirm } from '../../shared/utils/dialog';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Track which tasks are currently being executed by THIS instance of the manager
const runningTasks = new Set<string>();

// Reintento automático a nivel de tarea: si una descarga termina en 'error'
// (por causas ajenas a los bloques, como fallo al firmar la URL o leer el tamaño),
// se re-encola automáticamente según el límite configurado (con backoff).
const autoRetryCounts = new Map<string, number>();
const scheduledAutoRetries = new Set<string>();

export const useDownloadManager = () => {
    const tasks = useDownloadStore((state) => state.tasks);
    const maxConcurrent = useDownloadStore((state) => state.maxConcurrentDownloads);
    const updateTask = useDownloadStore((state) => state.updateTask);
    const initializeStore = useDownloadStore((state) => state.initialize);
    const initialized = useRef(false);
    
    const retryTask = useDownloadStore((state) => state.retryTask);
    const maxRetries = useDownloadStore((state) => state.maxRetries);

    const navigate = useNavigate();
    const { t } = useTranslation();
    const hasPromptedRef = useRef(false);

    // Track queued tasks count to reset prompt ref when a new task is queued
    const queuedTasksCount = tasks.filter(t => t.status === 'queued').length;
    const lastQueuedCount = useRef(0);

    // Reset prompt flag if we become authenticated
    const authenticated = isAwsAuthenticated();
    useEffect(() => {
        if (authenticated) {
            hasPromptedRef.current = false;
        }
    }, [authenticated]);

    // Reset prompt flag if the number of queued tasks increases (e.g. user retries)
    useEffect(() => {
        if (queuedTasksCount > lastQueuedCount.current) {
            hasPromptedRef.current = false;
        }
        lastQueuedCount.current = queuedTasksCount;
    }, [queuedTasksCount]);

    useEffect(() => {
        // One-time cleanup: any task that was 'downloading' when the app closed
        // should be reset to 'queued' so it can be picked up again.
        const init = async () => {
            if (!initialized.current) {
                await initializeStore();
                // After loading from DB, check for stuck tasks
                const currentTasks = useDownloadStore.getState().tasks;
                currentTasks.forEach(t => {
                    if (t.status === 'downloading') {
                        updateTask(t.id, { status: 'queued', progress: 0, speed: '0 KB/s' });
                    }
                });
                initialized.current = true;
            }
        };
        
        init();
    }, [initializeStore, updateTask]);

    // Auto-reintento de tareas que terminaron en 'error'
    useEffect(() => {
        if (!initialized.current) return;
        if (!isAwsAuthenticated()) return;

        tasks.forEach((task) => {
            // Al completar, liberar el contador para futuras descargas del mismo id
            if (task.status === 'completed') {
                autoRetryCounts.delete(task.id);
                return;
            }

            if (task.status !== 'error' || scheduledAutoRetries.has(task.id)) return;

            const unlimited = maxRetries === UNLIMITED_RETRIES;
            const attempts = autoRetryCounts.get(task.id) || 0;
            if (!unlimited && attempts >= maxRetries) return;

            scheduledAutoRetries.add(task.id);
            const delay = Math.min(3000 * (attempts + 1), 15000);

            setTimeout(() => {
                scheduledAutoRetries.delete(task.id);
                const current = useDownloadStore.getState().tasks.find(t => t.id === task.id);
                // Solo reintentar si sigue en error (el usuario no lo tocó entretanto)
                if (current && current.status === 'error') {
                    autoRetryCounts.set(task.id, attempts + 1);
                    const limitLabel = unlimited ? '∞' : maxRetries;
                    console.warn(`[DownloadManager] Auto-reintento ${attempts + 1}/${limitLabel} para: ${current.fileName}`);
                    retryTask(task.id);
                }
            }, delay);
        });
    }, [tasks, retryTask, maxRetries]);

    useEffect(() => {
        if (!initialized.current) return;

        // Cleanup runningTasks set (remove tasks that are no longer 'downloading')
        for (const taskId of runningTasks) {
            const task = tasks.find(t => t.id === taskId);
            if (!task || task.status !== 'downloading') {
                runningTasks.delete(taskId);
            }
        }

        // Start new tasks if we have capacity
        if (runningTasks.size < maxConcurrent) {
            const nextTask = [...tasks].reverse().find(t => t.status === 'queued' && !runningTasks.has(t.id));
            
            if (nextTask) {
                // If not authenticated, do not start downloading, instead show prompt to authenticate
                if (!isAwsAuthenticated()) {
                    const triggerAuthPrompt = async () => {
                        if (hasPromptedRef.current) return;
                        hasPromptedRef.current = true;
                        
                        const confirmed = await safeConfirm(
                            t("downloads.auth_required_desc"),
                            { title: t("downloads.auth_required_title") }
                        );
                        
                        if (confirmed) {
                            navigate("/buckets");
                        }
                    };
                    triggerAuthPrompt();
                    return;
                }

                runningTasks.add(nextTask.id);
                // We don't await this, it runs in background
                executeDownloadTask(nextTask.id).finally(() => {
                    runningTasks.delete(nextTask.id);
                });
            }
        }
    }, [tasks, maxConcurrent, updateTask, navigate, t]);
};

// Component-less manager to be included in the layout or root
export const DownloadManager = () => {
    useDownloadManager();
    return null;
};
