import React from 'react';

interface UploadStatusProps {
    status: string | null;
}

export const UploadStatus: React.FC<UploadStatusProps> = ({ status }) => {
    if (!status) return null;

    return (
        <div className="mt-2 text-label-sm font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded inline-flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            {status}
        </div>
    );
};
