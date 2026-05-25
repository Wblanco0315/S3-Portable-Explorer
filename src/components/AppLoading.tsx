import React from "react";
import { HiOutlineDatabase } from "react-icons/hi";

interface AppLoadingProps {
  message?: string;
}

export const AppLoading: React.FC<AppLoadingProps> = ({ 
  message = "Initializing S3 Explorer..." 
}) => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-slate-950 animate-in fade-in duration-700">
      
      <div className="flex flex-col items-center max-w-xs w-full px-6">
        
        {/* Subtle Icon Container */}
        <div className="relative mb-8">
          {/* Inner ring pulse for subtle depth */}
          <div className="absolute inset-0 rounded-full bg-indigo-500/10 scale-150 blur-xl animate-pulse" />
          
          <div className="relative flex items-center justify-center w-16 h-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <HiOutlineDatabase className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        {/* Text and Progress */}
        <div className="space-y-4 text-center w-full">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100 tracking-tight">
              {message}
            </h2>
          </div>

          {/* Elegant, thin progress bar */}
          <div className="relative h-[2px] w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="absolute top-0 left-0 h-full w-1/3 bg-indigo-600 dark:bg-indigo-500 rounded-full animate-progress-slide" />
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress-slide {
          0% { left: -40%; width: 30%; }
          50% { width: 60%; }
          100% { left: 110%; width: 30%; }
        }
        .animate-progress-slide {
          animation: progress-slide 2s cubic-bezier(0.65, 0, 0.35, 1) infinite;
        }
      `}} />
    </div>
  );
};

export default AppLoading;
