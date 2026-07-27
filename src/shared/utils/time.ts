/**
 * Utilidades reutilizables para el formateo de tiempo (ETA, duraciones, etc.).
 */

/**
 * Formatea una cantidad de segundos en un texto legible corto.
 *
 * Ejemplos:
 *   45      -> "45s"
 *   90      -> "1m 30s"
 *   3720    -> "1h 2m"
 *   0 / <0  -> ""
 *
 * @param totalSeconds Segundos restantes/transcurridos.
 * @returns Cadena legible o "" si no aplica.
 */
export const formatDuration = (totalSeconds: number): string => {
    if (!isFinite(totalSeconds) || totalSeconds <= 0) return '';

    const seconds = Math.ceil(totalSeconds);

    if (seconds < 60) {
        return `${seconds}s`;
    }

    if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remSeconds = seconds % 60;
        return remSeconds > 0 ? `${minutes}m ${remSeconds}s` : `${minutes}m`;
    }

    const hours = Math.floor(seconds / 3600);
    const remMinutes = Math.floor((seconds % 3600) / 60);
    return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
};

/**
 * Calcula y formatea el tiempo estimado restante (ETA) a partir del tamaño
 * pendiente y la velocidad actual.
 *
 * @param remainingBytes Bytes que faltan por descargar.
 * @param bytesPerSecond Velocidad actual en bytes por segundo.
 * @returns ETA formateado (p.ej. "2m 5s") o "" si no se puede estimar.
 */
export const formatEta = (remainingBytes: number, bytesPerSecond: number): string => {
    if (bytesPerSecond <= 0 || remainingBytes <= 0) return '';
    return formatDuration(remainingBytes / bytesPerSecond);
};
