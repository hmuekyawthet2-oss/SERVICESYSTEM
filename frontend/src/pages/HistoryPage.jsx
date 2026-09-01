import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { auditLogsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, Trash2, X, Clock, Plus, Pencil, Trash } from 'lucide-react';
import Pagination from '../components/Pagination';
import DatePicker from '../components/DatePicker';

const actionConfig = {
  CREATE: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', icon: Plus },
  UPDATE: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200', icon: Pencil },
  DELETE: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', icon: Trash },
};

const moduleLabels = {
  machine_registry: 'Machine Registry',
  pm_dashboard: 'PM Dashboard',
  service_tickets: 'Service Tickets',
  admin_settings: 'Settings',
};

export default function HistoryPage() {
  const { user, hasPermission } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const fetchLogs = async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 10 };
      if (search) params.search = search;
      if (moduleFilter) params.module = moduleFilter;
      if (actionFilter) params.action = actionFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await auditLogsApi.list(params);
      setLogs(res.data);
      setPagination(res.pagination);
      setPage(p);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(1); }, [moduleFilter, actionFilter, dateFrom, dateTo]);
  useEffect(() => { setPage(1); }, [moduleFilter, actionFilter, dateFrom, dateTo]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handleDelete = async (log) => {
    if (!window.confirm('Delete this log entry?')) return;
    try {
      await auditLogsApi.delete(log.id);
      toast.success('Log entry deleted');
      fetchLogs(pagination.page);
    } catch (err) {
      toast.error(err.data?.message || 'Failed to delete');
    }
  };

  const hasDateFilter = dateFrom || dateTo;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activity History</h1>
        <p className="text-sm text-gray-400 mt-0.5">{pagination.total} total log entries</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by user, entity, or label..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
              </div>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Search</button>
            </form>
            <div className="flex gap-2 flex-wrap">
              {['', 'CREATE', 'UPDATE', 'DELETE'].map((a) => (
                <button key={a} onClick={() => setActionFilter(a)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${actionFilter === a ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {a || 'All'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-end gap-3 pt-2 border-t border-gray-100">
            <div className="flex-1 w-full sm:w-auto">
              <label className="block text-xs font-medium text-gray-500 mb-1">Module</label>
              <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white">
                <option value="">All Modules</option>
                {Object.entries(moduleLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
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
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Module</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-16 text-gray-300 text-sm">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-gray-400 text-sm">No activity recorded yet</td></tr>
              ) : logs.map((log) => {
                const ac = actionConfig[log.action] || actionConfig.UPDATE;
                const ActionIcon = ac.icon;
                return (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-700">
                            {new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="text-gray-400">
                            {new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-600">
                          {log.display_name?.charAt(0) || log.username?.charAt(0) || '?'}
                        </div>
                        <span className="text-sm text-gray-700">{log.display_name || log.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${ac.bg} ${ac.text} ${ac.ring}`}>
                        <ActionIcon className="w-3 h-3" />
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-medium">
                        {moduleLabels[log.module] || log.module}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700 max-w-[200px] truncate">{log.entity_label || log.entity_type}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{log.entity_id?.slice(0, 8)}...</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hasPermission('history', 'delete') && (
                        <button onClick={() => handleDelete(log)}
                          className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors inline-flex items-center gap-1">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100">
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={fetchLogs} />
        </div>
      </div>
    </div>
  );
}
