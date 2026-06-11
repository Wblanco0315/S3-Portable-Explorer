import { create } from "zustand";

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  resolve: ((value: boolean) => void) | null;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  confirm: () => void;
  cancel: () => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  title: "",
  message: "",
  resolve: null,
  showConfirm: (message: string, title?: string) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        message,
        title: title || "",
        resolve,
      });
    });
  },
  confirm: () => {
    const { resolve } = get();
    if (resolve) resolve(true);
    set({ isOpen: false, resolve: null });
  },
  cancel: () => {
    const { resolve } = get();
    if (resolve) resolve(false);
    set({ isOpen: false, resolve: null });
  },
}));
