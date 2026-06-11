import { useConfirmStore } from "../hooks/useConfirmStore";

export interface SafeConfirmOptions {
  title?: string;
  kind?: "info" | "warning" | "error";
  okLabel?: string;
  cancelLabel?: string;
}

/**
 * A wrapper around the custom Webview confirm modal managed via Zustand.
 * Provides a React-rendered dialog that matches the application's visual style.
 */
export async function safeConfirm(
  message: string,
  options?: string | SafeConfirmOptions
): Promise<boolean> {
  const title = typeof options === "string" ? options : options?.title;
  return useConfirmStore.getState().showConfirm(message, title);
}
