import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { machinesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, X, MapPin, Phone, User, Calendar, Tag, Wrench, FileText, DollarSign, GraduationCap } from 'lucide-react';
import Pagination from '../components/Pagination';

export default function MachineRegistryPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const canCreate = hasPermission('machine_registry', 'create');
  const canEdit = hasPermission('machine_registry', 'edit');
  const canDelete = hasPermission('machine_registry', 'delete');

  const fetchMachines = async (page = 1, searchOverride) => {
    setLoading(true);
    try {
      const searchTerm = searchOverride !== undefined ? searchOverride : search;
      const res = await machinesApi.list({ search: searchTerm, page, limit: 10 });
      setMachines(res.data);
      setPagination(res.pagination);
    } catch (err) {
      toast.error('Failed to load machines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMachines(1); }, []);

  const handleRowClick = async (machine) => {
    setDetailLoading(true);
    setSelectedMachine(machine);
    try {
      const res = await machinesApi.get(machine.id);
      setSelectedMachine(res.data);
    } catch {
      toast.error('Failed to load machine details');
      setSelectedMachine(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchMachines(1);
  };

  const handleDelete = async (id, serialNumber) => {
    if (!window.confirm(`Delete machine ${serialNumber}? This will also remove PM schedules.`)) return;
    try {
      await machinesApi.delete(id);
      toast.success('Machine deleted');
      fetchMachines(pagination.page);
    } catch (err) {
      toast.error(err.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Machine Registry</h1>
          <p className="text-sm text-gray-500 mt-1">{pagination.total} machines registered</p>
        </div>
        {canCreate && (
          <Link to="/machines/new" className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Machine
          </Link>
        )}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by serial number, hospital, or model..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
          </div>
          <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Search</button>
          {search && (
            <button type="button" onClick={() => { setSearch(''); fetchMachines(1, ''); }}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Clear</button>
          )}
        </div>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Serial #</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Hospital</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Township</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Brand / Model</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Installed</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">Contact</th>
                {(canEdit || canDelete) && (
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : machines.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                  No machines found. {canCreate && <Link to="/machines/new" className="text-blue-600 hover:underline">Register the first</Link>}
                </td></tr>
              ) : machines.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleRowClick(m)}>
                  <td className="px-4 py-3"><span className="font-mono font-medium text-gray-900">{m.serial_number}</span></td>
                  <td className="px-4 py-3 text-gray-700">{m.hospital_name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{m.township_name}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="text-gray-900">{m.brand_name}</div>
                    <div className="text-gray-500 text-xs">{m.model}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{m.machine_type_name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                    {new Date(m.installation_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="text-gray-900 text-xs">{m.contact_person}</div>
                    <div className="text-gray-500 text-xs">{m.contact_phone}</div>
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <button onClick={() => navigate(`/machines/${m.id}/edit`)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(m.id, m.serial_number)} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-200">
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={fetchMachines} />
        </div>
      </div>
      {/* Machine Detail Modal */}
      {selectedMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMachine(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedMachine.serial_number}</h3>
                  <p className="text-xs text-gray-400">{selectedMachine.brand_name} {selectedMachine.model}</p>
                </div>
              </div>
              <button onClick={() => setSelectedMachine(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {detailLoading ? (
                <div className="text-center py-12 text-gray-400 text-sm">Loading details...</div>
              ) : (
                <>
                  {/* Location */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Location & Contact</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <p className="text-[10px] text-gray-400 font-medium uppercase">Hospital / Clinic</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">{selectedMachine.hospital_name}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <p className="text-[10px] text-gray-400 font-medium uppercase">Township</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">{selectedMachine.township_name}{selectedMachine.township_region ? `, ${selectedMachine.township_region}` : ''}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <p className="text-[10px] text-gray-400 font-medium uppercase">Contact Person</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">{selectedMachine.contact_person}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <p className="text-[10px] text-gray-400 font-medium uppercase">Phone</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 font-mono">{selectedMachine.contact_phone}</p>
                      </div>
                    </div>
                  </div>

                  {/* Machine Details */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Machine Details</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] text-gray-400 font-medium uppercase">Brand</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedMachine.brand_name}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] text-gray-400 font-medium uppercase">Model</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedMachine.model}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] text-gray-400 font-medium uppercase">Type</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedMachine.machine_type_name}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Tag className="w-3.5 h-3.5 text-gray-400" />
                          <p className="text-[10px] text-gray-400 font-medium uppercase">Serial Number</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 font-mono">{selectedMachine.serial_number}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <p className="text-[10px] text-gray-400 font-medium uppercase">Installation Date</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">
                          {selectedMachine.installation_date ? new Date(selectedMachine.installation_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Technician & Fees */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Technician & Fees</h4>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                        <p className="text-[10px] text-gray-400 font-medium uppercase">Service Engineer(s)</p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{selectedMachine.technician_names || '—'}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center gap-1 mb-1">
                          <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                          <p className="text-[10px] text-gray-400 font-medium uppercase">Service Fee</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">${selectedMachine.service_fees || '0'}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center gap-1 mb-1">
                          <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                          <p className="text-[10px] text-gray-400 font-medium uppercase">Transport Fee</p>
                        </div>
                        <p className="text-sm font-semibold text-gray-800">${selectedMachine.transport_fees || '0'}</p>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                        <p className="text-[10px] text-gray-400 font-medium uppercase">Training Fee</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-800">${selectedMachine.training_fees || '0'}</p>
                    </div>
                  </div>

                  {/* PM Schedules */}
                  {selectedMachine.pm_schedules && selectedMachine.pm_schedules.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">PM Schedules</h4>
                      <div className="space-y-2">
                        {selectedMachine.pm_schedules.map((pm) => (
                          <div key={pm.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono bg-gray-200 text-gray-600 px-2 py-0.5 rounded">PM {pm.pm_number}</span>
                              <div>
                                <p className="text-sm font-medium text-gray-800">Target: {new Date(pm.pm_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                <p className="text-[10px] text-gray-400">Window: {new Date(pm.window_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(pm.window_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                              </div>
                            </div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${pm.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : pm.status === 'Overdue' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                              {pm.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Training Dates */}
                  {selectedMachine.training_dates && selectedMachine.training_dates.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5" /> Training Dates
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedMachine.training_dates.map((td, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-medium ring-1 ring-inset ring-violet-200">
                            <Calendar className="w-3 h-3" />
                            #{td.training_number}: {new Date(td.training_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Tickets */}
                  {selectedMachine.recent_tickets && selectedMachine.recent_tickets.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Recent Service Tickets
                      </h4>
                      <div className="space-y-1.5">
                        {selectedMachine.recent_tickets.slice(0, 5).map((ticket) => (
                          <div key={ticket.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                            <div>
                              <span className="text-xs font-mono font-medium text-gray-700">{ticket.ticket_number}</span>
                              <span className="text-xs text-gray-400 ml-2">{ticket.error_type}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400">{new Date(ticket.complaint_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ticket.status === 'Finished' ? 'bg-emerald-50 text-emerald-600' : ticket.status === 'Open' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                {ticket.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedMachine.notes && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notes</h4>
                      <div className="bg-amber-50 rounded-xl p-3 ring-1 ring-amber-100">
                        <p className="text-sm text-amber-800 leading-relaxed">{selectedMachine.notes}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-3 rounded-b-2xl flex items-center justify-between">
              <p className="text-[10px] text-gray-400">Machine ID: <span className="font-mono">{selectedMachine.id}</span></p>
              <div className="flex gap-2">
                {canEdit && (
                  <button onClick={() => { setSelectedMachine(null); navigate(`/machines/${selectedMachine.id}/edit`); }}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                    Edit Machine
                  </button>
                )}
                <button onClick={() => setSelectedMachine(null)}
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
