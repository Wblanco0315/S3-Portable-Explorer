import { create } from 'zustand';

interface LoadingStore {
  isLoading: boolean;
  message: string;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
}

export const useLoadingStore = create<LoadingStore>((set) => ({
  isLoading: false,
  message: '',
  showLoading: (message = 'Loading...') => set({ isLoading: true, message }),
  hideLoading: () => set({ isLoading: false, message: '' }),
}));
