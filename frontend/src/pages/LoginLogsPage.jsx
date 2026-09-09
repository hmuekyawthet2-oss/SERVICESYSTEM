import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { loginLogsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, Monitor, Smartphone, Tablet, Globe, Clock, CheckCircle, XCircle, Shield, Users, AlertTriangle, Trash2, X, MapPin, Navigation, Copy } from 'lucide-react';
import Pagination from '../components/Pagination';
import DatePicker from '../components/DatePicker';

const statusConfig = {
  success: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', icon: CheckCircle, label: 'Success' },
  failed: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', icon: XCircle, label: 'Failed' },
};

const deviceIcons = {
  Desktop: Monitor,
  Mobile: Smartphone,
  Tablet: Tablet,
  Unknown: Globe,
};

export default function LoginLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);

  if (!user || user.role !== 'main_admin') {
    return (
      <div className="max-w-6xl mx-auto text-center py-20">
        <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Only Main Admin can view login logs.</p>
      </div>
    );
  }

  const fetchLogs = async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await loginLogsApi.list(params);
      setLogs(res.data);
      setPagination(res.pagination);
      setPage(p);
    } catch (err) {
      toast.error('Failed to load login logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await loginLogsApi.getStats();
      setStats(res.data);
    } catch {
      // stats endpoint might not exist yet if table not created
    }
  };

  useEffect(() => { fetchLogs(1); fetchStats(); }, [statusFilter, dateFrom, dateTo]);
  useEffect(() => { setPage(1); }, [statusFilter, dateFrom, dateTo]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handleDelete = async (log) => {
    if (!window.confirm(`Delete login log for "${log.username}"?`)) return;
    try {
      await loginLogsApi.delete(log.id);
      toast.success('Log entry deleted');
      fetchLogs(pagination.page);
      fetchStats();
    } catch (err) {
      toast.error(err.data?.message || 'Failed to delete');
    }
  };

  const hasDateFilter = dateFrom || dateTo;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Login Logs</h1>
        <p className="text-sm text-gray-400 mt-0.5">Monitor all user login activity — {pagination.total} total entries</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{stats.totalLogins}</p>
                <p className="text-xs text-gray-400 font-medium">Total Logins</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <Clock className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{stats.todayLogins}</p>
                <p className="text-xs text-gray-400 font-medium">Today</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{stats.failedAttempts}</p>
                <p className="text-xs text-gray-400 font-medium">Failed Attempts</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-50">
                <Users className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{stats.activeUsers24h}</p>
                <p className="text-xs text-gray-400 font-medium">Active 24h</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by username, IP, device, browser..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
              </div>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Search</button>
            </form>
            <div className="flex gap-2 flex-wrap">
              {['', 'success', 'failed'].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s ? statusConfig[s].label : 'All'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-end gap-3 pt-2 border-t border-gray-100">
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
                className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap">
                Clear Dates ✕
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
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">IP Address</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Device</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Browser</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">OS</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-16 text-gray-300 text-sm">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-gray-400 text-sm">No login logs recorded yet</td></tr>
              ) : logs.map((log) => {
                const sc = statusConfig[log.status] || statusConfig.success;
                const StatusIcon = sc.icon;
                const DeviceIcon = deviceIcons[log.device_type] || Globe;
                const loginTime = new Date(log.created_at);
                return (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setSelectedLog(log)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-gray-700">
                            {loginTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
                          </div>
                          <div className="text-gray-400">
                            {loginTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-600 flex-shrink-0">
                          {log.display_name?.charAt(0) || log.username?.charAt(0) || '?'}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">{log.display_name || log.username}</span>
                          <div className="text-[10px] text-gray-400 font-mono">{log.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${sc.bg} ${sc.text} ${sc.ring}`}>
                        <StatusIcon className="w-3 h-3" />
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {log.ip_address || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <DeviceIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-600">{log.device_type || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-gray-500">{log.browser || '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-gray-500">{log.os || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(log)}
                        className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors inline-flex items-center gap-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
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
      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Login Detail</h3>
                <p className="text-xs text-gray-400 mt-0.5">Full information for this login event</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Status Banner */}
              {(() => {
                const sc = statusConfig[selectedLog.status] || statusConfig.success;
                const StatusIcon = sc.icon;
                return (
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${sc.bg} ring-1 ring-inset ${sc.ring}`}>
                    <StatusIcon className={`w-5 h-5 ${sc.text}`} />
                    <span className={`text-sm font-semibold ${sc.text}`}>Login {sc.label}</span>
                  </div>
                );
              })()}

              {/* User Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">User Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 font-medium uppercase">Display Name</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedLog.display_name || '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 font-medium uppercase">Username</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5 font-mono">{selectedLog.username}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 font-medium uppercase">User ID</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5 font-mono">{selectedLog.user_id || '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 font-medium uppercase">Role</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5 capitalize">{selectedLog.user_role || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Network Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Network</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-gray-400 font-medium uppercase">IP Address</p>
                      {selectedLog.ip_address && (
                        <button onClick={() => copyToClipboard(selectedLog.ip_address)} className="text-gray-400 hover:text-blue-600 transition-colors">
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5 font-mono">{selectedLog.ip_address || '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 font-medium uppercase">Device Type</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {(() => {
                        const DeviceIcon = deviceIcons[selectedLog.device_type] || Globe;
                        return <DeviceIcon className="w-4 h-4 text-gray-500" />;
                      })()}
                      <span className="text-sm font-semibold text-gray-800">{selectedLog.device_type || 'Unknown'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timing */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Timing</h4>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <p className="text-sm font-semibold text-gray-800">
                      {(() => {
                        const d = new Date(selectedLog.created_at);
                        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                        return d.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long', timeZone: tz });
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Browser & OS */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Browser &amp; Platform</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 font-medium uppercase">Browser</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedLog.browser || '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 font-medium uppercase">OS</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedLog.os || '—'}</p>
                  </div>
                </div>
              </div>

              {/* User Agent */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">User Agent</h4>
                  {selectedLog.user_agent && (
                    <button onClick={() => copyToClipboard(selectedLog.user_agent)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-600 transition-colors">
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  )}
                </div>
                <div className="bg-gray-900 rounded-xl p-3">
                  <p className="text-xs text-gray-300 font-mono break-all leading-relaxed">{selectedLog.user_agent || '—'}</p>
                </div>
              </div>

              {/* Error Reason (failed only) */}
              {selectedLog.status === 'failed' && selectedLog.error_message && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider">Error Details</h4>
                  <div className="bg-red-50 rounded-xl p-3 ring-1 ring-red-100">
                    <p className="text-sm text-red-700">{selectedLog.error_message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-3 rounded-b-2xl flex items-center justify-between">
              <p className="text-[10px] text-gray-400">Log ID: <span className="font-mono">{selectedLog.id}</span></p>
              <div className="flex gap-2">
                <button onClick={() => handleDelete(selectedLog)}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
                <button onClick={() => setSelectedLog(null)}
                  className="px-4 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
