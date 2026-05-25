import React from 'react';
import { FavoriteFolder } from '../favorites/favoritesStore';

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold mb-2">Save to My Routes</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Give this path a custom name to find it easily later.
                </p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                        <input 
                            autoFocus
                            type="text" 
                            value={name}
                            onChange={e => onNameChange(e.target.value)}
                            placeholder="e.g. Production Logs"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                            onKeyDown={e => e.key === 'Enter' && !(!name.trim() || isSaving) && onSave()}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Folder (Optional)</label>
                        <select 
                            value={selectedFolderId || ''}
                            onChange={e => onFolderChange(e.target.value ? Number(e.target.value) : null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        >
                            <option value="">No folder (Root)</option>
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
                                    <option key={f.id} value={f.id}>
                                        {'\u00A0'.repeat(f.depth * 3)}{f.depth > 0 ? '↳ ' : ''}{f.name}
                                    </option>
                                ));
                            })()}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={onSave}
                            disabled={isSaving || !name.trim()}
                            className="px-4 py-2 text-sm font-bold bg-[#ec7211] text-white rounded hover:bg-[#eb5f07] disabled:opacity-50 transition-colors"
                        >
                            {isSaving ? "Saving..." : "Save Route"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
