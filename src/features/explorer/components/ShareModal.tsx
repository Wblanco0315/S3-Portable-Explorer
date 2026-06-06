import React, { useState } from 'react';
import { HiOutlineClipboardCopy, HiOutlineCheck, HiOutlineExternalLink } from 'react-icons/hi';
import { S3Object } from '../types';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    object: S3Object | null;
    onGenerate: (expiresIn: number) => Promise<string>;
}

export const ShareModal: React.FC<ShareModalProps> = ({ 
    isOpen, 
    onClose, 
    object, 
    onGenerate 
}) => {
    const [expiresIn, setExpiresIn] = useState(3600); // 1 hour default
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!isOpen || !object) return null;

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const url = await onGenerate(expiresIn);
            setGeneratedUrl(url);
        } catch (err) {
            console.error("Failed to generate URL", err);
            alert("Error generating link");
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = async () => {
        if (!generatedUrl) return;
        await navigator.clipboard.writeText(generatedUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const expirationOptions = [
        { label: '1 Hour', value: 3600 },
        { label: '1 Day', value: 86400 },
        { label: '7 Days', value: 604800 },
    ];

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
            <div className="bg-surface-container border border-outline-variant rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 text-on-surface">
                <div className="bg-surface-variant px-margin py-3 border-b border-outline-variant flex justify-between items-center">
                    <h3 className="font-headline-md text-headline-md text-on-surface">Share Object</h3>
                    <button 
                        onClick={onClose} 
                        className="text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-container-highest/50 transition-colors cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-margin space-y-gutter">
                    <div className="flex flex-col gap-2">
                        <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Object</label>
                        <p className="text-body-md font-mono text-on-surface break-all bg-surface border border-outline-variant p-3 rounded font-medium select-all">
                            {object.name}
                        </p>
                    </div>

                    {!generatedUrl ? (
                        <div className="space-y-gutter">
                            <div className="flex flex-col gap-2">
                                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Link Expiration</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {expirationOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setExpiresIn(opt.value)}
                                            className={`px-3 py-2 text-body-md font-medium rounded border transition-all cursor-pointer ${
                                                expiresIn === opt.value
                                                ? "bg-primary text-on-primary border-transparent font-bold"
                                                : "bg-surface border-outline-variant hover:bg-surface-bright text-on-surface"
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="w-full bg-primary hover:bg-primary-container text-on-primary font-bold py-2.5 rounded shadow-sm transition-colors border border-transparent disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer font-label-md text-label-md"
                            >
                                {isGenerating ? (
                                    <div className="w-5 h-5 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin"></div>
                                ) : (
                                    <HiOutlineExternalLink className="w-5 h-5" />
                                )}
                                Generate Shared Link
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-gutter animate-in fade-in slide-in-from-bottom-2">
                            <div className="p-3 bg-surface-container border border-primary/20 rounded text-on-surface text-body-md">
                                <p className="font-bold text-primary mb-1 flex items-center gap-2">
                                    <HiOutlineCheck className="w-4 h-4" /> Link Generated Successfully
                                </p>
                                <p className="text-label-sm font-mono text-on-surface-variant">
                                    This link will be valid for {expirationOptions.find(o => o.value === expiresIn)?.label}.
                                </p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Shared URL</label>
                                <div className="flex gap-2">
                                    <input 
                                        readOnly
                                        type="text" 
                                        value={generatedUrl}
                                        className="flex-1 px-3 py-2 bg-surface border border-outline-variant rounded text-label-sm font-mono text-on-surface outline-none select-all"
                                    />
                                    <button 
                                        onClick={copyToClipboard}
                                        className={`px-4 py-2 rounded font-bold text-body-md transition-all flex items-center gap-2 cursor-pointer ${
                                            copied 
                                            ? "bg-tertiary text-on-tertiary" 
                                            : "bg-primary text-on-primary hover:bg-primary-container"
                                        }`}
                                    >
                                        {copied ? <HiOutlineCheck className="w-4 h-4" /> : <HiOutlineClipboardCopy className="w-4 h-4" />}
                                        {copied ? "Copied!" : "Copy"}
                                    </button>
                                </div>
                            </div>

                            <button 
                                onClick={() => setGeneratedUrl(null)}
                                className="w-full py-2 text-body-md text-primary font-medium hover:underline cursor-pointer bg-transparent border-none outline-none"
                            >
                                Generate another link with different expiration
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
