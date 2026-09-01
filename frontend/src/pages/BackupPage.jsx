import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { backupApi } from '../services/api';
import { Download, Database, Shield, CheckCircle } from 'lucide-react';

export default function BackupPage() {
  const [downloading, setDownloading] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const filename = await backupApi.download();
      setLastBackup({ filename, time: new Date() });
      toast.success(`Backup downloaded: ${filename}`);
    } catch (err) {
      toast.error(err.message || 'Failed to create backup');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Database Backup</h1>
        <p className="text-sm text-gray-400 mt-0.5">Download a complete SQL backup of your database</p>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 mb-5">
            <Database className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Export Database</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Download a full <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">.sql</code> file
            containing all tables, data, and schema. You can use this to restore your database later.
          </p>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Generating backup...' : 'Download .sql Backup'}
          </button>
        </div>

        {/* Last backup info */}
        {lastBackup && (
          <div className="border-t border-gray-100 bg-gray-50 px-8 py-4">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Last backup: <span className="font-mono text-xs">{lastBackup.filename}</span>
              at {lastBackup.time.toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <Shield className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">What's included</h3>
              <p className="text-xs text-gray-500 mt-1">
                All tables: Users, Machines, PM Schedules, Service Tickets, Audit Logs,
                Settings (Townships, Brands, Models, Machine Types, Engineers)
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Database className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">How to restore</h3>
              <p className="text-xs text-gray-500 mt-1">
                Run <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px] font-mono">psql -U postgres -d service_db -f backup.sql</code> to restore
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
