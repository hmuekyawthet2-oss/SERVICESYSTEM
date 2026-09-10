import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';

export default function ExportDropdown({ onExportExcel, onExportWord, singleLabel, onExportSingle, singleDisabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
      >
        <Download size={15} />
        Export
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <button
            onClick={() => { onExportExcel(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
          >
            <FileSpreadsheet size={16} className="text-green-600" />
            Export All as Excel
          </button>
          <button
            onClick={() => { onExportWord(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <FileText size={16} className="text-blue-600" />
            Export All as Word
          </button>
          {onExportSingle && (
            <>
              <div className="border-t border-gray-100" />
              <button
                onClick={() => { onExportSingle(); setOpen(false); }}
                disabled={singleDisabled}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileText size={16} className="text-purple-600" />
                {singleLabel || 'Export Selected as Word'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
