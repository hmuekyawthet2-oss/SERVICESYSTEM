import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Reusable numbered pagination component.
 * Shows: < Prev  1 2 3 ... 7  Next >
 */
export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  // Build page numbers array with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    const delta = 2; // pages shown on each side of current

    // Always show first page
    pages.push(1);

    const rangeStart = Math.max(2, page - delta);
    const rangeEnd = Math.min(totalPages - 1, page + delta);

    // Add ellipsis before range if needed
    if (rangeStart > 2) {
      pages.push('...');
    }

    // Add range
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }

    // Add ellipsis after range if needed
    if (rangeEnd < totalPages - 1) {
      pages.push('...');
    }

    // Always show last page (if more than 1)
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      {/* Previous */}
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Prev
      </button>

      {/* Page numbers */}
      {pageNumbers.map((num, idx) =>
        num === '...' ? (
          <span key={`dots-${idx}`} className="px-2 py-1.5 text-xs text-gray-400">
            …
          </span>
        ) : (
          <button
            key={num}
            onClick={() => onPageChange(num)}
            className={`min-w-[32px] px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              page === num
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {num}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
