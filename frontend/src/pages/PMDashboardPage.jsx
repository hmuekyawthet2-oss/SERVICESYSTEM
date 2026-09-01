import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { pmSchedulesApi } from '../services/api';
import { formatDateDisplay } from '../utils/pmCalculator';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, X, Trash2 } from 'lucide-react';
import Pagination from '../components/Pagination';
import DatePicker from '../components/DatePicker';

const colorMeta = {
  red: { label: 'Overdue', desc: 'Past PM window', dot: 'bg-red-500', card: 'border-red-200 bg-red-50/50', text: 'text-red-700', num: 'text-red-600', ring: 'ring-red-500' },
  blue: { label: 'Upcoming', desc: 'Within 1 month', dot: 'bg-blue-500', card: 'border-blue-200 bg-blue-50/50', text: 'text-blue-700', num: 'text-blue-600', ring: 'ring-blue-500' },
  green: { label: 'During Period', desc: 'Active PM period', dot: 'bg-emerald-500', card: 'border-emerald-200 bg-emerald-50/50', text: 'text-emerald-700', num: 'text-emerald-600', ring: 'ring-emerald-500' },
  gray: { label: 'Scheduled', desc: 'No active period', dot: 'bg-gray-300', card: 'border-gray-200 bg-gray-50/50', text: 'text-gray-500', num: 'text-gray-600', ring: 'ring-gray-400' },
};

const PAGE_SIZE = 10;

export default function PMDashboardPage() {
  const [schedules, setSchedules] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterColor, setFilterColor] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { hasPermission } = useAuth();
  const [completeModal, setCompleteModal] = useState(null);
  const [completedBy, setCompletedBy] = useState('');
  const [page, setPage] = useState(1);
  const canComplete = hasPermission('pm_dashboard', 'complete');
  const canDelete = hasPermission('pm_dashboard', 'delete');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterColor) params.color = filterColor;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const [d, s] = await Promise.all([pmSchedulesApi.getDashboard(params), pmSchedulesApi.getSummary()]);
      setSchedules(d.data);
      setSummary(s.data);
    } catch { toast.error('Failed to load PM data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [filterColor, dateFrom, dateTo]);
  useEffect(() => { setPage(1); }, [filterColor, dateFrom, dateTo]);

  const totalPages = Math.ceil(schedules.length / PAGE_SIZE);
  const paginatedSchedules = schedules.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleComplete = async () => {
    if (!completeModal) return;
    try {
      await pmSchedulesApi.complete(completeModal.id, { completed_by: completedBy });
      toast.success('PM completed');
      setCompleteModal(null); setCompletedBy(''); fetchData();
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (schedule) => {
    if (!window.confirm(`Delete PM #${schedule.pm_number} for ${schedule.serial_number}?`)) return;
    try {
      await pmSchedulesApi.delete(schedule.id);
      toast.success('PM schedule deleted');
      fetchData();
    } catch (err) {
      toast.error(err.data?.message || 'Failed to delete');
    }
  };

  const hasDateFilter = dateFrom || dateTo;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Preventive Maintenance</h1>
        <p className="text-sm text-gray-400 mt-0.5">Track and manage scheduled maintenance for all equipment</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { key: 'red', count: summary.overdue },
            { key: 'blue', count: summary.upcoming },
            { key: 'green', count: summary.in_window },
            { key: 'gray', count: summary.scheduled },
          ].map(({ key, count }) => {
            const m = colorMeta[key];
            return (
              <button
                key={key}
                onClick={() => setFilterColor(filterColor === key ? '' : key)}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  filterColor === key ? `${m.card} border-current shadow-sm` : 'bg-white border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${m.dot}`}></span>
                  <div>
                    <p className={`text-2xl font-bold tabular-nums ${m.num}`}>{count}</p>
                    <p className="text-xs text-gray-400 font-medium">{m.label}</p>
                  </div>
                </div>
              </button>
            );
          })}
          <div className="p-4 rounded-xl bg-gray-900 text-white">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <div>
                <p className="text-2xl font-bold tabular-nums">{summary.completed}</p>
                <p className="text-xs text-gray-400 font-medium">Completed</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Range Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="flex flex-col sm:flex-row items-end gap-3">
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-xs font-medium text-gray-500 mb-1">Date From</label>
            <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From date" />
          </div>
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-xs font-medium text-gray-500 mb-1">Date To</label>
            <DatePicker value={dateTo} onChange={setDateTo} placeholder="To date" />
          </div>
          {hasDateFilter && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap inline-flex items-center gap-1">
              Clear Dates <X className="w-3 h-3" />
            </button>
          )}
          {filterColor && (
            <button onClick={() => setFilterColor('')}
              className="px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap inline-flex items-center gap-1">
              Clear Color Filter <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Schedule List</h2>
          <span className="text-xs text-gray-400">{schedules.length} schedules</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Machine</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Hospital</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">PM</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Target</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Period</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-16 text-gray-300 text-sm">Loading...</td></tr>
              ) : paginatedSchedules.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-gray-400 text-sm">No schedules found</td></tr>
              ) : paginatedSchedules.map((s) => {
                const m = colorMeta[s.color] || colorMeta.gray;
                return (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-xs font-mono">{s.serial_number}</div>
                      <div className="text-xs text-gray-400">{s.brand_name} {s.model}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{s.hospital_name}</td>
                    <td className="px-4 py-3 text-center"><span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">PM {s.pm_number}</span></td>
                    <td className="px-4 py-3 font-medium text-gray-700 text-sm">{formatDateDisplay(s.pm_date)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell">{formatDateDisplay(s.window_start)} – {formatDateDisplay(s.window_end)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${m.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`}></span>
                        {s.status_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {s.status !== 'Completed' && canComplete && (
                          <button onClick={() => setCompleteModal(s)} className="text-xs font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded hover:bg-emerald-50 transition-colors">
                            Complete
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(s)} className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors inline-flex items-center gap-1">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="border-t border-gray-100">
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>

      {/* Complete Modal */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setCompleteModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Mark PM Complete</h3>
                  <p className="text-xs text-gray-400">{completeModal.serial_number} — PM #{completeModal.pm_number}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Completed By</label>
                <input value={completedBy} onChange={(e) => setCompletedBy(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                  placeholder="Technician name (optional)" autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleComplete(); }} />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
              <button onClick={() => { setCompleteModal(null); setCompletedBy(''); }} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleComplete} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
