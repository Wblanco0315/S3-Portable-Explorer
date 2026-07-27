import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { HiOutlineX } from 'react-icons/hi';
import { HiOutlinePower } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';
import { useDownloadStore } from './downloadStore';
import { getDb } from '../../shared/hooks/useDatabase';

// Segundos de gracia antes de apagar, para que el usuario pueda cancelar.
const SHUTDOWN_COUNTDOWN_SECONDS = 60;

// Estados que indican que la cola sigue teniendo trabajo pendiente.
const PENDING_STATUSES = ['downloading', 'queued', 'paused'] as const;

/**
 * Vigila la cola de descargas. Cuando el modo "apagar al terminar" está activo
 * y todas las descargas alcanzan un estado terminal, muestra una cuenta regresiva
 * y finalmente apaga el equipo mediante el comando Rust `shutdown_system`.
 *
 * Debe montarse una sola vez (en el layout raíz), igual que DownloadManager.
 */
export const ShutdownManager = () => {
    const { t } = useTranslation();
    const tasks = useDownloadStore((state) => state.tasks);
    const shutdownWhenDone = useDownloadStore((state) => state.shutdownWhenDone);
    const setShutdownWhenDone = useDownloadStore((state) => state.setShutdownWhenDone);

    const [countdown, setCountdown] = useState<number | null>(null);
    const prevPendingRef = useRef(0);

    const pendingCount = tasks.filter((task) =>
        (PENDING_STATUSES as readonly string[]).includes(task.status)
    ).length;

    // Detectar la transición "había trabajo -> ya no hay nada pendiente".
    useEffect(() => {
        const prevPending = prevPendingRef.current;
        prevPendingRef.current = pendingCount;

        if (!shutdownWhenDone) return;
        if (countdown !== null) return; // Ya estamos en cuenta regresiva
        if (prevPending > 0 && pendingCount === 0) {
            setCountdown(SHUTDOWN_COUNTDOWN_SECONDS);
        }
    }, [pendingCount, shutdownWhenDone, countdown]);

    // Si vuelve a aparecer trabajo pendiente durante la cuenta regresiva
    // (p.ej. un auto-reintento re-encola una descarga que había fallado),
    // se aborta el apagado automáticamente. El modo sigue activo para volver
    // a disparar cuando la cola termine de verdad.
    useEffect(() => {
        if (countdown !== null && pendingCount > 0) {
            setCountdown(null);
        }
    }, [pendingCount, countdown]);

    // Cuenta regresiva y disparo del apagado.
    useEffect(() => {
        if (countdown === null) return;

        if (countdown <= 0) {
            // Antes de apagar de golpe (shutdown /s /t 0 mata el proceso sin cierre
            // limpio), forzamos un checkpoint del WAL hacia el .db principal. Así las
            // escrituras 'completed' de las descargas quedan persistidas de verdad y no
            // se pierden si el arranque siguiente limpia el WAL. Ver lib.rs setup().
            const flushAndShutdown = async () => {
                try {
                    const db = await getDb();
                    await db.execute('PRAGMA wal_checkpoint(TRUNCATE)');
                } catch (err) {
                    console.error('[ShutdownManager] No se pudo consolidar la base de datos antes de apagar:', err);
                }
                try {
                    await invoke('shutdown_system');
                } catch (err) {
                    console.error('[ShutdownManager] Falló el apagado del equipo:', err);
                }
            };
            flushAndShutdown();
            setCountdown(null);
            return;
        }

        const timer = window.setTimeout(() => {
            setCountdown((prev) => (prev === null ? null : prev - 1));
        }, 1000);

        return () => window.clearTimeout(timer);
    }, [countdown]);

    if (countdown === null) return null;

    const completedCount = tasks.filter((task) => task.status === 'completed').length;
    const errorCount = tasks.filter((task) => task.status === 'error').length;

    // Cancelación manual: aborta el apagado y desactiva el modo para no re-disparar.
    const cancel = () => {
        setCountdown(null);
        setShutdownWhenDone(false);
    };
    const shutdownNow = () => setCountdown(0);

    return (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs transition-all duration-300">
            <div className="bg-surface-container border-2 border-outline-variant max-w-md w-full rounded-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 bg-surface-variant border-b border-outline-variant flex items-center gap-3">
                    <div className="p-2 bg-error-container/20 border border-error/30 text-error rounded flex items-center justify-center shrink-0">
                        <HiOutlinePower className="w-5 h-5" />
                    </div>
                    <h3 className="font-headline-md text-headline-md text-on-surface font-bold truncate">
                        {t('downloads.shutdown_countdown_title')}
                    </h3>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col items-center text-center gap-4">
                    <div className="relative w-24 h-24 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-4 border-error/20"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-error animate-spin"></div>
                        <span className="text-headline-lg font-bold text-on-surface font-mono">{countdown}</span>
                    </div>

                    <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                        {t('downloads.shutdown_countdown_message', { seconds: countdown })}
                    </p>

                    <div className="flex items-center gap-3 text-label-sm font-mono text-on-surface-variant">
                        <span className="text-primary">
                            {t('downloads.shutdown_completed_count', { count: completedCount })}
                        </span>
                        {errorCount > 0 && (
                            <>
                                <span>•</span>
                                <span className="text-error">
                                    {t('downloads.shutdown_error_count', { count: errorCount })}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant flex justify-between gap-3">
                    <button
                        onClick={cancel}
                        className="flex items-center gap-2 px-4 py-2 text-body-md font-medium text-on-surface bg-surface-container hover:bg-surface-container-high border border-outline-variant hover:border-outline rounded transition-all cursor-pointer"
                    >
                        <HiOutlineX className="w-4 h-4" />
                        {t('downloads.shutdown_cancel')}
                    </button>
                    <button
                        onClick={shutdownNow}
                        className="flex items-center gap-2 px-5 py-2 text-body-md font-medium text-on-error bg-error hover:bg-error/90 rounded border border-transparent transition-all cursor-pointer"
                    >
                        <HiOutlinePower className="w-4 h-4" />
                        {t('downloads.shutdown_now')}
                    </button>
                </div>
            </div>
        </div>
    );
};
