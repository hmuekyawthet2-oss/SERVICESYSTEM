import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';

// ── Generic Inline List Editor ─────────────────────────────
function InlineList({ title, subtitle, api, extraFields = [] }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newExtra, setNewExtra] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editExtra, setEditExtra] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.list();
      setItems(res.data);
    } catch { toast.error(`Failed to load ${title}`); }
    finally { setLoading(false); }
  }, [api, title]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await api.create({ name: newName, ...newExtra });
      setNewName(''); setNewExtra({});
      toast.success(`${title.slice(0, -1)} added`);
      fetchItems();
    } catch (err) { toast.error(err.message || 'Failed to add'); }
    finally { setSaving(false); }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditName(item.name);
    const extra = {};
    extraFields.forEach((f) => { extra[f.key] = item[f.key] || ''; });
    setEditExtra(extra);
  };

  const handleUpdate = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await api.update(editingId, { name: editName, ...editExtra });
      setEditingId(null);
      toast.success('Updated');
      fetchItems();
    } catch (err) { toast.error(err.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.delete(item.id);
      toast.success('Deleted');
      fetchItems();
    } catch (err) { toast.error(err.data?.message || 'Failed to delete'); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          </div>
          <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">
            {items.length} items
          </span>
        </div>
      </div>

      <form onSubmit={handleAdd} className="px-5 py-3 border-b border-gray-100 bg-gray-50/30">
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`Add new ${title.slice(0, -1).toLowerCase()}...`}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          />
          {extraFields.map((f) => (
            <input
              key={f.key}
              value={newExtra[f.key] || ''}
              onChange={(e) => setNewExtra((prev) => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-36 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          ))}
          <button type="submit" disabled={saving || !newName.trim()} className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">Add</button>
        </div>
      </form>

      <div className="max-h-72 overflow-y-auto">
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No items yet</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {items.map((item) => (
              <li key={item.id} className="group">
                {editingId === item.id ? (
                  <div className="flex items-center gap-2 px-5 py-2.5 bg-blue-50/50">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-3 py-1 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(); if (e.key === 'Escape') setEditingId(null); }} />
                    {extraFields.map((f) => (
                      <input key={f.key} value={editExtra[f.key] || ''} onChange={(e) => setEditExtra((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-36 px-3 py-1 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(); if (e.key === 'Escape') setEditingId(null); }} />
                    ))}
                    <button onClick={handleUpdate} disabled={saving} className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                        {item.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-gray-700">{item.name}</span>
                        {extraFields.map((f) => item[f.key] && (
                          <span key={f.key} className="text-xs text-gray-400 ml-2">· {item[f.key]}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(item)} className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors">Edit</button>
                      <button onClick={() => handleDelete(item)} className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">Delete</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Models Manager (linked to Brands) ─────────────────────

function ModelsManager() {
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [editingModel, setEditingModel] = useState(null);
  const [editModelName, setEditModelName] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [bRes, mRes] = await Promise.all([adminApi.brands.list(), adminApi.models.list()]);
      setBrands(bRes.data);
      setModels(mRes.data);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredModels = selectedBrand
    ? models.filter((m) => String(m.brand_id) === String(selectedBrand))
    : models;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newModelName.trim() || !selectedBrand) {
      toast.error('Select a brand and enter model name');
      return;
    }
    try {
      await adminApi.models.create({ name: newModelName, brand_id: selectedBrand });
      setNewModelName('');
      toast.success('Model added');
      fetchAll();
    } catch (err) { toast.error(err.message || 'Failed'); }
  };

  const handleUpdate = async (id) => {
    if (!editModelName.trim()) return;
    const model = models.find((m) => m.id === id);
    try {
      await adminApi.models.update(id, { name: editModelName, brand_id: model.brand_id });
      setEditingModel(null);
      toast.success('Updated');
      fetchAll();
    } catch (err) { toast.error(err.message || 'Failed'); }
  };

  const handleDelete = async (model) => {
    if (!window.confirm(`Delete model "${model.name}"?`)) return;
    try {
      await adminApi.models.delete(model.id);
      toast.success('Deleted');
      fetchAll();
    } catch (err) { toast.error(err.data?.message || 'Failed'); }
  };

  if (loading) return <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">Loading...</div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Models</h3>
            <p className="text-xs text-gray-400 mt-0.5">Equipment models linked to brands</p>
          </div>
          <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-200">
            {filteredModels.length} models
          </span>
        </div>
      </div>

      {/* Brand filter + Add form */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/30 space-y-2">
        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
        >
          <option value="">All Brands</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            value={newModelName}
            onChange={(e) => setNewModelName(e.target.value)}
            placeholder="Add new model..."
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          />
          <button type="submit" disabled={!newModelName.trim() || !selectedBrand} className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">Add</button>
        </form>
      </div>

      {/* Models list */}
      <div className="max-h-96 overflow-y-auto">
        {filteredModels.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No models found</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filteredModels.map((m) => (
              <li key={m.id} className="group">
                {editingModel === m.id ? (
                  <div className="flex items-center gap-2 px-5 py-2.5 bg-blue-50/50">
                    <input
                      value={editModelName}
                      onChange={(e) => setEditModelName(e.target.value)}
                      className="flex-1 px-3 py-1 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(m.id); if (e.key === 'Escape') setEditingModel(null); }}
                    />
                    <button onClick={() => handleUpdate(m.id)} className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1">Save</button>
                    <button onClick={() => setEditingModel(null)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-gray-700">{m.name}</span>
                        <span className="text-xs text-gray-400 ml-2">· {m.brand_name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingModel(m.id); setEditModelName(m.name); }} className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors">Edit</button>
                      <button onClick={() => handleDelete(m)} className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">Delete</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Main Admin Page ────────────────────────────────────────

export default function AdminSettingsPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage the dropdown options and reference data used across the system
        </p>
      </div>

      {/* Lookup tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <InlineList
          title="Townships"
          subtitle="Township and region entries"
          api={adminApi.townships}
          extraFields={[{ key: 'region', placeholder: 'Region' }]}
        />
        <InlineList
          title="Brands"
          subtitle="Equipment manufacturer brands"
          api={adminApi.brands}
        />
        <InlineList
          title="Machine Types"
          subtitle="Categories of medical equipment"
          api={adminApi.machineTypes}
          extraFields={[{ key: 'description', placeholder: 'Description' }]}
        />
      </div>

      {/* Models (linked to brands) */}
      <div className="mb-6">
        <ModelsManager />
      </div>

      {/* Service Engineers */}
      <InlineList
        title="Service Engineers"
        subtitle="Selectable engineer names for installation and maintenance"
        api={adminApi.engineers}
        extraFields={[{ key: 'role', placeholder: 'Role (e.g. Engineer)' }]}
      />
    </div>
  );
}
