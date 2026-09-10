import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ticketsApi, exportApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, CheckCircle, Phone, Wrench, Building2, X } from 'lucide-react';
import Pagination from '../components/Pagination';
import DatePicker from '../components/DatePicker';
import ExportDropdown from '../components/ExportDropdown';

const PAGE_SIZE = 10;

const statusConfig = {
  Open: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
  'Pending Job': { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  'In Progress': { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  Finished: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
};

const solvingIcons = { Phone: Phone, 'On-Site': Wrench, Office: Building2 };

export default function ServiceTicketsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [closeModal, setCloseModal] = useState(null);
  const [closeDate, setCloseDate] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [page, setPage] = useState(1);

  const fetchTickets = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await ticketsApi.list(params);
      setTickets(res.data);
      setPagination(res.pagination);
    } catch (err) {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, [statusFilter, dateFrom, dateTo]);
  useEffect(() => { setPage(1); }, [statusFilter, dateFrom, dateTo]);

  const handleSearch = (e) => { e.preventDefault(); fetchTickets(1); };

  const handleClose = async () => {
    if (!closeDate) { toast.error('Please select a date'); return; }
    const jobDateTime = closeTime ? `${closeDate}T${closeTime}` : closeDate;
    try {
      await ticketsApi.updateStatus(closeModal.id, { status: 'Finished', job_finished_date: jobDateTime });
      toast.success('Ticket finished');
      setCloseModal(null); setCloseDate(''); setCloseTime('');
      fetchTickets(pagination.page);
    } catch (err) {
      toast.error(err.data?.message || 'Failed to finish ticket');
    }
  };

  const handleDelete = async (id, ticketNumber) => {
    if (!window.confirm(`Delete ticket ${ticketNumber}?`)) return;
    try {
      await ticketsApi.delete(id);
      toast.success('Ticket deleted');
      fetchTickets(pagination.page);
    } catch (err) {
      toast.error(err.data?.message || 'Delete failed');
    }
  };

  const canCreate = hasPermission('service_tickets', 'create');
  const canClose = hasPermission('service_tickets', 'close');
  const hasDateFilter = dateFrom || dateTo;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Tickets</h1>
          <p className="text-sm text-gray-400 mt-0.5">{pagination.total} total tickets</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDropdown
            onExportExcel={() => { const p = {}; if (statusFilter) p.status = statusFilter; if (search) p.search = search; if (dateFrom) p.date_from = dateFrom; if (dateTo) p.date_to = dateTo; toast.promise(exportApi.ticketsExcel(p), { loading: 'Exporting...', success: 'Excel downloaded!', error: 'Export failed' }); }}
            onExportWord={() => { const p = {}; if (statusFilter) p.status = statusFilter; if (search) p.search = search; if (dateFrom) p.date_from = dateFrom; if (dateTo) p.date_to = dateTo; toast.promise(exportApi.ticketsWord(p), { loading: 'Exporting...', success: 'Word downloaded!', error: 'Export failed' }); }}
          />
          {canCreate && (
            <Link to="/service-tickets/new" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" />
              New Ticket
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
              </div>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Search</button>
            </form>
            <div className="flex gap-2 flex-wrap">
              {['', 'Open', 'Pending Job', 'In Progress', 'Finished'].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s || 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
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
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Hospital</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Error</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-16 text-gray-300 text-sm">Loading...</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-gray-400 text-sm">
                  No tickets found. {canCreate && <Link to="/service-tickets/new" className="text-blue-600 hover:underline">Create one</Link>}
                </td></tr>
              ) : tickets.map((t) => {
                const sc = statusConfig[t.status] || statusConfig.Open;
                const SolveIcon = solvingIcons[t.solving_type] || Wrench;
                return (
                  <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-medium text-gray-900">{t.ticket_number}</div>
                      <div className="font-mono text-xs text-gray-500 sm:hidden">{t.serial_number}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700">{t.hospital_name}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] hidden md:table-cell">
                      <div className="text-gray-800 truncate">{t.error_type}</div>
                      {t.error_code && <div className="text-xs text-gray-400 font-mono">{t.error_code}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-500 text-xs">
                        {new Date(t.complaint_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${sc.bg} ${sc.text} ${sc.ring}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/service-tickets/${t.id}`)} className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors">View</button>
                        {t.status !== 'Finished' && canClose && (
                          <button onClick={() => { setCloseModal(t); setCloseDate(new Date().toISOString().slice(0, 10)); setCloseTime(''); }} className="text-xs text-gray-400 hover:text-emerald-600 px-2 py-1 rounded hover:bg-emerald-50 transition-colors">Finish</button>
                        )}
                        {t.status === 'Open' && hasPermission('service_tickets', 'delete') && (
                          <button onClick={() => handleDelete(t.id, t.ticket_number)} className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100">
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={fetchTickets} />
        </div>
      </div>

      {/* Finish Ticket Modal */}
      {closeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setCloseModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Finish Ticket</h3>
                  <p className="text-xs text-gray-400">{closeModal.ticket_number}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Job Finished Date *</label>
                  <DatePicker value={closeDate} onChange={setCloseDate} placeholder="Select date" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Time (optional)</label>
                  <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
              <button onClick={() => setCloseModal(null)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">Finish Ticket</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
