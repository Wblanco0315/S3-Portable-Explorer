import { confirm as tauriConfirm } from "@tauri-apps/plugin-dialog";

export interface SafeConfirmOptions {
  title?: string;
  kind?: "info" | "warning" | "error";
  okLabel?: string;
  cancelLabel?: string;
}

/**
 * A robust wrapper around Tauri's confirm dialog.
 * If the Tauri API is not available, fails due to lack of permissions,
 * or is running in a web browser environment, it falls back to the browser's window.confirm.
 */
export async function safeConfirm(
  message: string,
  options?: string | SafeConfirmOptions
): Promise<boolean> {
  try {
    const tauriOptions = typeof options === "string" ? { title: options } : options;
    return await tauriConfirm(message, tauriOptions);
  } catch (error) {
    console.warn("Tauri confirm dialog failed, falling back to window.confirm:", error);
    return window.confirm(message);
  }
}
