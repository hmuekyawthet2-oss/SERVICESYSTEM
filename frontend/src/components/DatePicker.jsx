import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function formatDateValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateValue(val) {
  if (!val) return null;
  const [y, m, d] = val.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export default function DatePicker({ value, onChange, placeholder = 'Select date', className = '', disabled = false }) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateValue(value);
  const today = new Date();
  const [viewDate, setViewDate] = useState(selectedDate || today);
  const [viewMonth, setViewMonth] = useState(viewDate.getMonth());
  const [viewYear, setViewYear] = useState(viewDate.getFullYear());
  const [showYearPicker, setShowYearPicker] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (selectedDate) {
      setViewMonth(selectedDate.getMonth());
      setViewYear(selectedDate.getFullYear());
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setShowYearPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectDate = useCallback((day) => {
    const date = new Date(viewYear, viewMonth, day);
    onChange(formatDateValue(date));
    setOpen(false);
    setShowYearPicker(false);
  }, [viewYear, viewMonth, onChange]);

  const goToToday = useCallback(() => {
    const now = new Date();
    setViewMonth(now.getMonth());
    setViewYear(now.getFullYear());
    onChange(formatDateValue(now));
    setOpen(false);
    setShowYearPicker(false);
  }, [onChange]);

  const clearDate = useCallback((e) => {
    e.stopPropagation();
    onChange('');
  }, [onChange]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const displayText = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const yearRange = [];
  for (let y = viewYear - 5; y <= viewYear + 5; y++) yearRange.push(y);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(o => !o); setShowYearPicker(false); }}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white text-left ${
          disabled ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50' : 'border-gray-200 hover:border-gray-300 cursor-pointer'
        }`}
      >
        <CalendarDays className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className={displayText ? 'text-gray-700' : 'text-gray-400'}>
          {displayText || placeholder}
        </span>
        {selectedDate && !disabled && (
          <button type="button" onClick={clearDate} className="ml-auto text-gray-400 hover:text-gray-600 p-0.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </button>

      {/* Calendar Dropdown */}
      {open && (
        <div className="absolute z-30 mt-1.5 bg-white rounded-xl border border-gray-200 shadow-xl p-3 w-[280px] select-none" onClick={(e) => e.stopPropagation()}>
          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setShowYearPicker(y => !y)}
              className="flex items-center gap-1 px-2 py-1 text-sm font-semibold text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
              {MONTHS[viewMonth]} {viewYear}
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showYearPicker ? 'rotate-90' : ''}`} />
            </button>
            <button type="button" onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Year Picker */}
          {showYearPicker && (
            <div className="grid grid-cols-5 gap-1 mb-3">
              {yearRange.map(y => (
                <button key={y} type="button"
                  onClick={() => { setViewYear(y); setShowYearPicker(false); }}
                  className={`text-xs py-1.5 rounded-lg font-medium transition-colors ${
                    y === viewYear ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}>
                  {y}
                </button>
              ))}
            </div>
          )}

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = selectedDate &&
                selectedDate.getFullYear() === viewYear &&
                selectedDate.getMonth() === viewMonth &&
                selectedDate.getDate() === day;
              const isToday = today.getFullYear() === viewYear &&
                today.getMonth() === viewMonth &&
                today.getDate() === day;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={`relative w-full h-8 text-xs rounded-lg font-medium transition-all flex items-center justify-center ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isToday
                      ? 'bg-blue-50 text-blue-600 font-bold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {day}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer: Today + Clear */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={clearDate}
              className="text-xs font-medium text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">
              Clear
            </button>
            <button type="button" onClick={goToToday}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors">
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
