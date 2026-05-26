import React from "react";
import {
  HiOutlineSearch,
  HiOutlineDownload,
  HiOutlineChevronDown,
  HiOutlineRefresh,
  HiOutlineArrowLeft,
  HiOutlineExternalLink,
} from "react-icons/hi";

interface BucketToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCount: number;
  onRefresh: () => void;
  onBack: () => void;
  canGoBack: boolean;
  onShareSelected: () => void;
  onDownloadSelected: () => void;
}

export const BucketToolbar: React.FC<BucketToolbarProps> = ({
  searchTerm,
  onSearchChange,
  selectedCount,
  onRefresh,
  onBack,
  canGoBack,
  onShareSelected,
  onDownloadSelected,
}) => {
  return (
    <div className="p-4 border-b border-[#eaeded] flex flex-wrap gap-4 items-center justify-between bg-white">
      {/* Navigation and Search */}
      <div className="flex gap-3 items-center flex-1 min-w-[300px]">
        <button
          onClick={onBack}
          disabled={!canGoBack}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          title="Back to parent"
        >
          <HiOutlineArrowLeft className="w-5 h-5" />
        </button>

        <div className="relative flex-1 max-w-md">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Find objects by prefix"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-1.5 bg-white border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 items-center">
        <span className="text-sm text-[#545b64] mr-2">
          <span>{selectedCount}</span> selected
        </span>

        <button
          onClick={onRefresh}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          title="Refresh"
        >
          <HiOutlineRefresh className="w-5 h-5" />
        </button>

        <button
          onClick={onDownloadSelected}
          disabled={selectedCount === 0}
          className="bg-white text-[#16191f] border border-[#545b64] hover:bg-[#fafafa] px-4 py-1.5 text-sm font-bold rounded flex items-center gap-2 disabled:opacity-50"
        >
          <HiOutlineDownload className="w-4 h-4" /> Download
        </button>

        <div className="relative group">
          <button className="bg-white text-[#16191f] border border-[#545b64] hover:bg-[#fafafa] px-4 py-1.5 text-sm font-bold rounded flex items-center gap-1">
            Actions <HiOutlineChevronDown className="w-4 h-4" />
          </button>
          
          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 py-1">
            <button 
              onClick={onShareSelected}
              disabled={selectedCount !== 1}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <HiOutlineExternalLink className="w-4 h-4" />
              Share (Presigned URL)
            </button>
            <button 
              disabled={selectedCount === 0}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <HiOutlineDownload className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
