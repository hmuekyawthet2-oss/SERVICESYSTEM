import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import toast from 'react-hot-toast';
import {
  Monitor,
  CalendarCheck,
  ClipboardList,
  Shield,
  Settings,
  LogOut,
  KeyRound,
  Users,
  X,
  History,
  Menu,
  ChevronRight,
  Database,
  ScrollText,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Machine Registry', icon: Monitor },
  { to: '/pm-dashboard', label: 'PM Dashboard', icon: CalendarCheck },
  { to: '/service-tickets', label: 'Service Tickets', icon: ClipboardList },
  { to: '/history', label: 'History', icon: History },
];

const adminNavItems = [
  { to: '/permissions', label: 'Permissions', icon: Shield },
  { to: '/login-logs', label: 'Login Logs', icon: ScrollText },
  { to: '/admin', label: 'Settings', icon: Settings },
  { to: '/backup', label: 'Backup', icon: Database },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showForceLogout, setShowForceLogout] = useState(false);
  const [users, setUsers] = useState([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setChangingPassword(true);
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success('Password changed successfully');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await authApi.listUsers();
      setUsers(res.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleForceLogout = async (userId, username) => {
    if (!window.confirm(`Force logout "${username}"? They will need to log in again and their password will be reset.`)) return;
    try {
      await authApi.forceLogout(userId);
      toast.success(`${username} has been logged out and password reset`);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to force logout');
    }
  };

  const handleNavClick = () => setSidebarOpen(false);

  useEffect(() => {
    if (showForceLogout && user?.role === 'main_admin') {
      fetchUsers();
    }
  }, [showForceLogout]);

  const SidebarContent = () => (
    <>
      <div className="p-5 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Monitor className="w-6 h-6 text-blue-400" />
            <span>Service System</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Medical Equipment Management</p>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          );
        })}

        {user?.role === 'main_admin' && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Admin</p>
            </div>
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              );
            })}
            <button
              onClick={() => { setShowForceLogout(true); setSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Users className="w-5 h-5" />
              Force Logout
            </button>
          </>
        )}
      </nav>

      {/* User info + Actions */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium text-slate-300">
            {user?.display_name?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.display_name}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{user?.role === 'main_admin' ? 'Main Admin' : 'Co-Admin'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowChangePassword(true); setSidebarOpen(false); }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Password
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 z-30 flex items-center px-4">
        <button onClick={() => setSidebarOpen(true)} className="text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-bold text-white ml-3 flex items-center gap-2">
          <Monitor className="w-4 h-4 text-blue-400" />
          Service System
        </h1>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar - desktop: fixed, mobile: slide-in */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="hidden lg:block p-5 border-b border-slate-700">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Monitor className="w-6 h-6 text-blue-400" />
            <span>Service System</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Medical Equipment Management</p>
        </div>
        {/* Mobile close button header */}
        <div className="lg:hidden p-5 border-b border-slate-700 flex items-center justify-between">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Monitor className="w-6 h-6 text-blue-400" />
            <span>Service System</span>
          </h1>
          <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            );
          })}

          {user?.role === 'main_admin' && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Admin</p>
              </div>
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </NavLink>
                );
              })}
              <button
                onClick={() => { setShowForceLogout(true); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Users className="w-5 h-5" />
                Force Logout
              </button>
            </>
          )}
        </nav>

        {/* User info + Actions */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium text-slate-300">
              {user?.display_name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.display_name}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{user?.role === 'main_admin' ? 'Main Admin' : 'Co-Admin'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowChangePassword(true); setSidebarOpen(false); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Password
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-lg hover:bg-slate-700 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto lg:pt-0 pt-14">
        <div className="p-4 sm:p-6">
          <Outlet />
        </div>
      </main>

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowChangePassword(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Change Password</h3>
                  <p className="text-xs text-gray-400">Update your account password</p>
                </div>
              </div>
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Current Password *</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    placeholder="Enter current password" autoFocus required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">New Password *</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    placeholder="At least 6 characters" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Confirm New Password *</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    placeholder="Re-enter new password" required />
                </div>
              </form>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
              <button onClick={() => { setShowChangePassword(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleChangePassword} disabled={changingPassword}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Force Logout Modal (Admin only) */}
      {showForceLogout && user?.role === 'main_admin' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowForceLogout(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Force Logout Users</h3>
                  <p className="text-xs text-gray-400">Terminate active sessions and reset passwords</p>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {loadingUsers ? (
                  <p className="text-sm text-gray-400 text-center py-4">Loading users...</p>
                ) : users.filter(u => u.id !== user?.id).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No other users found</p>
                ) : (
                  users.filter(u => u.id !== user?.id).map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                          u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {u.display_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{u.display_name}</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                            {u.role === 'main_admin' ? 'Main Admin' : 'Co-Admin'}
                            {!u.is_active && ' • Inactive'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleForceLogout(u.id, u.username)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        Force Logout
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end">
              <button onClick={() => setShowForceLogout(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
