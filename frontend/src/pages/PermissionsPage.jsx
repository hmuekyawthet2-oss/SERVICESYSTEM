import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { authApi, permissionsApi } from '../services/api';
import { Shield, Lock } from 'lucide-react';

const TAB_FIELDS = {
  machine_registry: {
    label: 'Machine Registry',
    description: 'Manage installed equipment records',
    fields: [
      { key: 'create', label: 'Create', desc: 'Register new machines' },
      { key: 'edit', label: 'Edit', desc: 'Modify machine details' },
      { key: 'delete', label: 'Delete', desc: 'Remove machines' },
    ],
  },
  pm_dashboard: {
    label: 'PM Dashboard',
    description: 'View and manage preventive maintenance',
    fields: [
      { key: 'view', label: 'View', desc: 'Access PM dashboard' },
      { key: 'complete', label: 'Complete', desc: 'Mark PM tasks as done' },
      { key: 'delete', label: 'Delete', desc: 'Remove PM schedule entries' },
    ],
  },
  service_tickets: {
    label: 'Service Tickets',
    description: 'Manage service complaint tickets',
    fields: [
      { key: 'create', label: 'Create', desc: 'Open new tickets' },
      { key: 'edit', label: 'Edit', desc: 'Modify ticket details' },
      { key: 'delete', label: 'Delete', desc: 'Remove open tickets' },
      { key: 'close', label: 'Close / Finish', desc: 'Mark tickets as finished' },
    ],
  },
  admin_settings: {
    label: 'Settings',
    description: 'Manage dropdown lists and system config',
    fields: [
      { key: 'view', label: 'View', desc: 'Access settings page' },
      { key: 'edit', label: 'Edit', desc: 'Modify dropdown values' },
    ],
  },
  history: {
    label: 'History',
    description: 'View and manage activity logs',
    fields: [
      { key: 'view', label: 'View', desc: 'Access activity history' },
      { key: 'delete', label: 'Delete', desc: 'Remove log entries' },
    ],
  },
};

export default function PermissionsPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPerms, setUserPerms] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', display_name: '', role: 'co_admin' });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await authApi.listUsers();
      setUsers(res.data);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const selectUser = async (user) => {
    setSelectedUser(user);
    try {
      const res = await permissionsApi.getUser(user.id);
      const perms = {};
      for (const tab of Object.keys(TAB_FIELDS)) {
        perms[tab] = {};
        for (const field of TAB_FIELDS[tab].fields) {
          const found = res.data.permissions.find((p) => p.tab === tab && p.field === field.key);
          perms[tab][field.key] = found ? found.granted : false;
        }
      }
      setUserPerms(perms);
    } catch (err) {
      toast.error('Failed to load permissions');
    }
  };

  const togglePerm = (tab, field) => {
    setUserPerms((prev) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        [field]: !prev[tab]?.[field],
      },
    }));
  };

  const toggleAllTab = (tab) => {
    const allGranted = TAB_FIELDS[tab].fields.every((f) => userPerms[tab]?.[f.key]);
    const newVal = {};
    TAB_FIELDS[tab].fields.forEach((f) => { newVal[f.key] = !allGranted; });
    setUserPerms((prev) => ({ ...prev, [tab]: newVal }));
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const permissions = [];
      for (const [tab, fields] of Object.entries(userPerms)) {
        for (const [field, granted] of Object.entries(fields)) {
          permissions.push({ tab, field, granted });
        }
      }
      await permissionsApi.update(selectedUser.id, permissions);
      toast.success('Permissions saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.display_name) {
      toast.error('All fields are required');
      return;
    }
    try {
      await authApi.register(newUser);
      toast.success('User created');
      setShowCreateUser(false);
      setNewUser({ username: '', password: '', display_name: '', role: 'co_admin' });
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to create user');
    }
  };

  const toggleUserActive = async (userId) => {
    try {
      await authApi.toggleUser(userId);
      toast.success('User status updated');
      loadUsers();
      if (selectedUser?.id === userId) {
        setSelectedUser(null);
        setUserPerms({});
      }
    } catch (err) {
      toast.error(err.message || 'Failed to toggle user');
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Permissions</h1>
        <p className="text-sm text-gray-500 mt-1">Manage co-admin access rights per module and field</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Users</h2>
            <button
              onClick={() => setShowCreateUser(true)}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
            >
              + Add
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">Loading...</div>
            ) : users.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No users found</div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {users.map((u) => (
                  <li
                    key={u.id}
                    onClick={() => u.role !== 'main_admin' && selectUser(u)}
                    className={`px-5 py-3 transition-colors ${
                      u.role === 'main_admin' ? 'cursor-default' : 'cursor-pointer'
                    } ${selectedUser?.id === u.id ? 'bg-blue-50/80' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                          u.role === 'main_admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {u.display_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{u.display_name}</p>
                          <p className="text-xs text-gray-400">@{u.username} · {u.role === 'main_admin' ? 'Main Admin' : 'Co-Admin'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                        {u.role !== 'main_admin' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleUserActive(u.id); }}
                            className="text-[10px] text-gray-400 hover:text-gray-600 px-1"
                            title={u.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {u.is_active ? 'Disable' : 'Enable'}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Permissions Editor */}
        <div className="lg:col-span-2">
          {selectedUser ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                    Permissions for {selectedUser.display_name}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">Toggle access for each module and action</p>
                </div>
                <button
                  onClick={savePermissions}
                  disabled={saving}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              <div className="p-5 space-y-5">
                {Object.entries(TAB_FIELDS).map(([tab, config]) => (
                  <div key={tab} className="border border-gray-100 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">{config.label}</h3>
                        <p className="text-xs text-gray-400">{config.description}</p>
                      </div>
                      <button
                        onClick={() => toggleAllTab(tab)}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                      >
                        {config.fields.every((f) => userPerms[tab]?.[f.key]) ? 'Revoke All' : 'Grant All'}
                      </button>
                    </div>

                    <div className="divide-y divide-gray-50">
                      {config.fields.map((field) => (
                        <div key={field.key} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50">
                          <div>
                            <p className="text-sm font-medium text-gray-700">{field.label}</p>
                            <p className="text-xs text-gray-400">{field.desc}</p>
                          </div>
                          <button
                            onClick={() => togglePerm(tab, field.key)}
                            className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                            style={{ backgroundColor: userPerms[tab]?.[field.key] ? '#2563eb' : '#d1d5db' }}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                                userPerms[tab]?.[field.key] ? 'translate-x-[18px]' : 'translate-x-[3px]'
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                <Lock className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">Select a co-admin user to manage their permissions</p>
            </div>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCreateUser(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Create New User</h3>
              <form onSubmit={handleCreateUser} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Display Name *</label>
                  <input value={newUser.display_name} onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    placeholder="e.g., John Technician" autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Username *</label>
                  <input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all font-mono"
                    placeholder="e.g., john_tech" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Password *</label>
                  <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    placeholder="Minimum 6 characters" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                  <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white">
                    <option value="co_admin">Co-Admin</option>
                    <option value="main_admin">Main Admin</option>
                  </select>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
              <button onClick={() => setShowCreateUser(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleCreateUser} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Create User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
