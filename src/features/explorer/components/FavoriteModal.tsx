import React from 'react';
import { FavoriteFolder } from '../../favorites/favoritesStore';

interface FavoriteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    name: string;
    onNameChange: (name: string) => void;
    folders: FavoriteFolder[];
    selectedFolderId: number | null;
    onFolderChange: (id: number | null) => void;
    isSaving: boolean;
}

export const FavoriteModal: React.FC<FavoriteModalProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    name, 
    onNameChange, 
    folders,
    selectedFolderId,
    onFolderChange,
    isSaving 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
            <div className="bg-surface-container border border-outline-variant rounded-lg shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-surface-variant px-margin py-3 border-b border-outline-variant">
                    <h3 className="font-headline-md text-headline-md text-on-surface">Save to My Routes</h3>
                </div>
                
                <div className="p-margin space-y-gutter">
                    <p className="text-body-md text-on-surface-variant">
                        Give this path a custom name to find it easily later.
                    </p>
                    
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                                Name
                            </label>
                            <input 
                                autoFocus
                                type="text" 
                                value={name}
                                onChange={e => onNameChange(e.target.value)}
                                placeholder="e.g. Production Logs"
                                className="w-full bg-surface border border-outline-variant text-on-surface font-label-sm text-label-sm rounded px-3 py-2 focus:border-primary focus:ring-0 focus:outline-none transition-colors"
                                onKeyDown={e => e.key === 'Enter' && !(!name.trim() || isSaving) && onSave()}
                            />
                        </div>
                        
                        <div className="flex flex-col gap-2">
                            <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                                Folder (Optional)
                            </label>
                            <select 
                                value={selectedFolderId || ''}
                                onChange={e => onFolderChange(e.target.value ? Number(e.target.value) : null)}
                                className="w-full bg-surface border border-outline-variant text-on-surface font-label-sm text-label-sm rounded px-3 py-2 focus:border-primary focus:ring-0 focus:outline-none transition-colors cursor-pointer"
                            >
                                <option value="" className="bg-surface text-on-surface">No folder (Root)</option>
                                {(() => {
                                    const result: (FavoriteFolder & { depth: number })[] = [];
                                    const map = new Map<number | null, FavoriteFolder[]>();
                                    
                                    folders.forEach(f => {
                                        const parentId = f.parent_id ?? null;
                                        if (!map.has(parentId)) map.set(parentId, []);
                                        map.get(parentId)!.push(f);
                                    });
                                    
                                    const traverse = (parentId: number | null, depth: number) => {
                                        const children = map.get(parentId) || [];
                                        children.sort((a, b) => a.name.localeCompare(b.name));
                                        children.forEach(child => {
                                            result.push({ ...child, depth });
                                            traverse(child.id!, depth + 1);
                                        });
                                    };
                                    
                                    traverse(null, 0);
                                    
                                    return result.map(f => (
                                        <option key={f.id} value={f.id} className="bg-surface text-on-surface">
                                            {'\u00A0'.repeat(f.depth * 3)}{f.depth > 0 ? '↳ ' : ''}{f.name}
                                        </option>
                                    ));
                                })()}
                            </select>
                        </div>
                        
                        <div className="flex justify-end gap-3 pt-gutter border-t border-outline-variant">
                            <button 
                                onClick={onClose}
                                className="px-4 py-2 rounded font-label-md text-label-md border border-outline-variant bg-surface hover:bg-surface-bright text-on-surface transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={onSave}
                                disabled={isSaving || !name.trim()}
                                className="px-4 py-2 rounded font-label-md text-label-md bg-primary hover:bg-primary-container text-on-primary font-bold disabled:opacity-50 transition-colors cursor-pointer border border-transparent"
                            >
                                {isSaving ? "Saving..." : "Save Route"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
