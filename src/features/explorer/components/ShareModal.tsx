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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Share Object</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Object</label>
                        <p className="text-sm font-medium text-gray-900 break-all bg-gray-50 p-2 rounded border border-gray-100">
                            {object.name}
                        </p>
                    </div>

                    {!generatedUrl ? (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Link Expiration</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {expirationOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setExpiresIn(opt.value)}
                                            className={`px-3 py-2 text-sm rounded border transition-all ${
                                                expiresIn === opt.value
                                                ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-bold"
                                                : "border-gray-200 hover:border-gray-300 text-gray-600"
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
                                className="w-full bg-[#ec7211] hover:bg-[#eb5f07] text-white font-bold py-2.5 rounded shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isGenerating ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <HiOutlineExternalLink className="w-5 h-5" />
                                )}
                                Generate Shared Link
                            </button>
                        </>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="p-3 bg-green-50 border border-green-100 rounded text-green-800 text-sm">
                                <p className="font-bold mb-1 flex items-center gap-2">
                                    <HiOutlineCheck className="w-4 h-4" /> Link Generated Successfully
                                </p>
                                <p>This link will be valid for {expirationOptions.find(o => o.value === expiresIn)?.label}.</p>
                            </div>

                            <div className="relative">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Shared URL</label>
                                <div className="flex gap-2">
                                    <input 
                                        readOnly
                                        type="text" 
                                        value={generatedUrl}
                                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 outline-none"
                                    />
                                    <button 
                                        onClick={copyToClipboard}
                                        className={`px-4 py-2 rounded font-bold text-sm transition-all flex items-center gap-2 ${
                                            copied 
                                            ? "bg-green-500 text-white" 
                                            : "bg-indigo-600 text-white hover:bg-indigo-700"
                                        }`}
                                    >
                                        {copied ? <HiOutlineCheck className="w-4 h-4" /> : <HiOutlineClipboardCopy className="w-4 h-4" />}
                                        {copied ? "Copied!" : "Copy"}
                                    </button>
                                </div>
                            </div>

                            <button 
                                onClick={() => setGeneratedUrl(null)}
                                className="w-full py-2 text-sm text-indigo-600 font-medium hover:underline"
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
