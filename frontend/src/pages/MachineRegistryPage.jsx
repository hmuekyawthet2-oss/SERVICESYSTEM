import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { machinesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Search } from 'lucide-react';
import Pagination from '../components/Pagination';

export default function MachineRegistryPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

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
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
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
    </div>
  );
}
