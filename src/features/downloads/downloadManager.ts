import { useEffect, useRef } from 'react';
import { useDownloadStore } from './downloadStore';
import { executeDownloadTask, isAwsAuthenticated } from '../aws/s3Client';
import { safeConfirm } from '../../shared/utils/dialog';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Track which tasks are currently being executed by THIS instance of the manager
const runningTasks = new Set<string>();

export const useDownloadManager = () => {
    const tasks = useDownloadStore((state) => state.tasks);
    const maxConcurrent = useDownloadStore((state) => state.maxConcurrentDownloads);
    const updateTask = useDownloadStore((state) => state.updateTask);
    const initializeStore = useDownloadStore((state) => state.initialize);
    const initialized = useRef(false);
    
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
