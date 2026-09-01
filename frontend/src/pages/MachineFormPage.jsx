import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { machinesApi } from '../services/api';
import { calculatePMSchedule, formatDateDisplay } from '../utils/pmCalculator';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, X, Plus, CheckCircle, UserPlus } from 'lucide-react';
import DatePicker from '../components/DatePicker';

const emptyForm = {
  hospital_name: '',
  township_id: '',
  contact_person: '',
  contact_phone: '',
  installation_date: '',
  brand_id: '',
  model_id: '',
  model: '',
  machine_type_id: '',
  serial_number: '',
  technician_names: '',
  service_fees: '',
  transport_fees: '',
  training_fees: '',
  notes: '',
};

export default function MachineFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user, hasPermission } = useAuth();

  const canCreate = hasPermission('machine_registry', 'create');
  const canEdit = hasPermission('machine_registry', 'edit');
  if (isEdit && !canEdit) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-gray-500 text-sm">You don't have permission to edit machines.</p>
        <button onClick={() => navigate('/')} className="mt-3 text-sm text-blue-600 hover:underline">← Back to Registry</button>
      </div>
    );
  }
  if (!isEdit && !canCreate) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-gray-500 text-sm">You don't have permission to create machines.</p>
        <button onClick={() => navigate('/')} className="mt-3 text-sm text-blue-600 hover:underline">← Back to Registry</button>
      </div>
    );
  }

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [lookups, setLookups] = useState({ townships: [], brands: [], types: [], models: [] });
  const [trainingDates, setTrainingDates] = useState([]);
  const [nextTrainingNum, setNextTrainingNum] = useState(1);
  const [engineers, setEngineers] = useState([]);
  const [selectedEngineers, setSelectedEngineers] = useState([]);
  const [showEngineerDropdown, setShowEngineerDropdown] = useState(false);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [t, b, ty, eng] = await Promise.all([
          machinesApi.getTownships(),
          machinesApi.getBrands(),
          machinesApi.getTypes(),
          machinesApi.getEngineers(),
        ]);
        setLookups({ townships: t.data, brands: b.data, types: ty.data, models: [] });
        setEngineers(eng.data);
      } catch (err) {
        toast.error('Failed to load form data');
      }
    };
    loadLookups();
  }, []);

  useEffect(() => {
    if (form.brand_id) {
      machinesApi.getModels(form.brand_id).then((res) => {
        setLookups((prev) => ({ ...prev, models: res.data }));
      }).catch(() => {});
    } else {
      setLookups((prev) => ({ ...prev, models: [] }));
    }
  }, [form.brand_id]);

  useEffect(() => {
    if (isEdit) {
      machinesApi.get(id).then((res) => {
        const m = res.data;
        setForm({
          hospital_name: m.hospital_name,
          township_id: m.township_id,
          contact_person: m.contact_person,
          contact_phone: m.contact_phone,
          installation_date: m.installation_date?.split('T')[0] || '',
          brand_id: m.brand_id,
          model_id: m.model_id || '',
          model: m.model || '',
          machine_type_id: m.machine_type_id,
          serial_number: m.serial_number,
          technician_names: m.technician_names || '',
          service_fees: m.service_fees || '',
          transport_fees: m.transport_fees || '',
          training_fees: m.training_fees || '',
          notes: m.notes || '',
        });
        const techNames = m.technician_names || '';
        setSelectedEngineers(techNames ? techNames.split(',').map(n => n.trim()).filter(Boolean) : []);
        if (m.training_dates && m.training_dates.length > 0) {
          setTrainingDates(m.training_dates.map((td) => td.training_date.split('T')[0]));
          setNextTrainingNum(m.training_dates.length + 1);
        }
      }).catch(() => {
        toast.error('Failed to load machine data');
        navigate('/');
      });
    }
  }, [id, isEdit]);

  const pmPreview = form.installation_date ? calculatePMSchedule(form.installation_date) : null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'brand_id') {
        next.model_id = '';
        next.model = '';
      }
      if (name === 'model_id' && value) {
        const selected = lookups.models.find((m) => String(m.id) === String(value));
        if (selected) next.model = selected.name;
      }
      return next;
    });
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const toggleEngineer = (name) => {
    setSelectedEngineers((prev) => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name];
      setForm((f) => ({ ...f, technician_names: next.join(', ') }));
      return next;
    });
  };

  const removeEngineer = (name) => {
    setSelectedEngineers((prev) => {
      const next = prev.filter(n => n !== name);
      setForm((f) => ({ ...f, technician_names: next.join(', ') }));
      return next;
    });
  };

  const handleAddTrainingDate = () => {
    setTrainingDates((prev) => [...prev, '']);
    setNextTrainingNum((prev) => prev + 1);
  };

  const handleTrainingDateChange = (index, value) => {
    setTrainingDates((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleRemoveTrainingDate = (index) => {
    setTrainingDates((prev) => prev.filter((_, i) => i !== index));
  };

  const fieldLabels = {
    hospital_name: 'Hospital/Clinic Name',
    township_id: 'Township',
    contact_person: 'Contact Person',
    contact_phone: 'Phone Number',
    installation_date: 'Installation Date',
    brand_id: 'Brand',
    model: 'Model',
    machine_type_id: 'Machine Type',
    serial_number: 'Serial Number',
  };

  const validate = () => {
    const errs = {};
    if (!form.hospital_name.trim()) errs.hospital_name = 'Required';
    if (!form.township_id) errs.township_id = 'Required';
    if (!form.contact_person.trim()) errs.contact_person = 'Required';
    if (!form.contact_phone.trim()) errs.contact_phone = 'Required';
    if (!form.installation_date) errs.installation_date = 'Required';
    if (!form.brand_id) errs.brand_id = 'Required';
    if (!form.model.trim()) errs.model = 'Required';
    if (!form.machine_type_id) errs.machine_type_id = 'Required';
    if (!form.serial_number.trim()) errs.serial_number = 'Required';
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const missing = Object.keys(errs).map(k => fieldLabels[k] || k).join(', ');
      toast.error(`Please fill in: ${missing}`);
    }
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        training_dates: trainingDates.filter(Boolean),
      };
      if (isEdit) {
        await machinesApi.update(id, payload);
        toast.success('Machine updated');
      } else {
        await machinesApi.create(payload);
        toast.success('Machine registered! PM schedules auto-generated.');
      }
      navigate('/');
    } catch (err) {
      if (err.status === 409) {
        setErrors({ serial_number: 'Serial number already exists' });
        toast.error('Duplicate serial number');
      } else if (err.data?.errors) {
        const fieldErrors = {};
        err.data.errors.forEach((e) => { fieldErrors[e.field] = e.message; });
        setErrors(fieldErrors);
        toast.error('Please fix the form errors');
      } else {
        toast.error(err.message || 'Failed to save');
      }
    } finally {
      setSubmitting(false);
    }
  };



  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4 inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" />
        Back to Registry
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{isEdit ? 'Edit Machine' : 'Register New Machine'}</h1>
      <p className="text-sm text-gray-400 mb-6">{isEdit ? 'Update machine details' : 'PM schedules will be auto-generated'}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Location & Contact */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Location & Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField name="hospital_name" placeholder="e.g., Yangon General Hospital" label="Hospital / Clinic Name" value={form.hospital_name} onChange={handleChange} error={errors.hospital_name} />
            <div>
              <FieldLabel label="Township / Town" />
              <select name="township_id" value={form.township_id} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white">
                <option value="">Select township...</option>
                {lookups.townships.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.region})</option>
                ))}
              </select>
              {errors.township_id && <p className="text-xs text-red-500 mt-1">{errors.township_id}</p>}
            </div>
            <InputField name="contact_person" placeholder="e.g., Dr. Aung Kyaw" label="Contact Person" value={form.contact_person} onChange={handleChange} error={errors.contact_person} />
            <InputField name="contact_phone" placeholder="e.g., +95 9 123 456 789" label="Phone Number" value={form.contact_phone} onChange={handleChange} error={errors.contact_phone} />
          </div>
        </div>

        {/* Machine Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Machine Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel label="Brand" />
              <select name="brand_id" value={form.brand_id} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white">
                <option value="">Select brand...</option>
                {lookups.brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {errors.brand_id && <p className="text-xs text-red-500 mt-1">{errors.brand_id}</p>}
            </div>

            <div>
              <FieldLabel label="Model" />
              {lookups.models.length > 0 ? (
                <select name="model_id" value={form.model_id} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white">
                  <option value="">Select model...</option>
                  {lookups.models.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              ) : (
                <input name="model" value={form.model} onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  placeholder={form.brand_id ? "No models for this brand — type manually" : "Select brand first"} />
              )}
              {errors.model && <p className="text-xs text-red-500 mt-1">{errors.model}</p>}
            </div>

            <div>
              <FieldLabel label="Type of Machine" />
              <select name="machine_type_id" value={form.machine_type_id} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white">
                <option value="">Select type...</option>
                {lookups.types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {errors.machine_type_id && <p className="text-xs text-red-500 mt-1">{errors.machine_type_id}</p>}
            </div>

            <InputField name="serial_number" placeholder="e.g., CT-2024-001" label="Serial Number" className="font-mono" value={form.serial_number} onChange={handleChange} error={errors.serial_number} />                <div>
                  <FieldLabel label="Installation Date" />
                  <DatePicker value={form.installation_date} onChange={(val) => handleChange({ target: { name: 'installation_date', value: val } })} placeholder="Select date" />
                  {errors.installation_date && <p className="text-xs text-red-500 mt-1">{errors.installation_date}</p>}
                </div>
          </div>
        </div>

        {/* Technician & Fees */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Technician & Fees</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Multi-select engineers */}
            <div className="md:col-span-2 relative">
              <label className="block text-xs font-medium text-gray-500 mb-1">Service Engineer(s) <span className="text-gray-400 font-normal">(click to select multiple)</span></label>
              {selectedEngineers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedEngineers.map((name) => (
                    <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-md ring-1 ring-inset ring-blue-200">
                      {name}
                      <button type="button" onClick={() => removeEngineer(name)} className="hover:text-blue-900">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setShowEngineerDropdown(!showEngineerDropdown)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white text-left flex items-center justify-between">
                <span className={selectedEngineers.length ? 'text-gray-700' : 'text-gray-400'}>
                  {selectedEngineers.length ? `${selectedEngineers.length} engineer(s) selected` : 'Select engineers...'}
                </span>
                <UserPlus className="w-4 h-4 text-gray-400" />
              </button>
              {showEngineerDropdown && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {engineers.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400 text-center">No engineers in system</div>
                  ) : engineers.map((eng) => (
                    <button key={eng.id} type="button" onClick={() => toggleEngineer(eng.name)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${
                        selectedEngineers.includes(eng.name) ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}>
                      <span>{eng.name} {eng.role && <span className="text-xs text-gray-400">· {eng.role}</span>}</span>
                      {selectedEngineers.includes(eng.name) && <CheckCircle className="w-4 h-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
              <input type="text" name="technician_names" value={form.technician_names} onChange={(e) => {
                handleChange(e);
                setSelectedEngineers(e.target.value.split(',').map(n => n.trim()).filter(Boolean));
              }} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                placeholder="Or type names manually, comma-separated" />
            </div>
            <div>
              <FieldLabel label="Service Fees" required={false} />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input type="number" name="service_fees" value={form.service_fees} onChange={handleChange}
                  className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  placeholder="0.00" min="0" step="0.01" />
              </div>
            </div>
            <div>
              <FieldLabel label="Transportation Fees" required={false} />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input type="number" name="transport_fees" value={form.transport_fees} onChange={handleChange}
                  className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  placeholder="0.00" min="0" step="0.01" />
              </div>
            </div>
            <div>
              <FieldLabel label="Training Fees" required={false} />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input type="number" name="training_fees" value={form.training_fees} onChange={handleChange}
                  className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  placeholder="0.00" min="0" step="0.01" />
              </div>
            </div>
          </div>
        </div>

        {/* Training Dates */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Training Dates</h2>
            <button type="button" onClick={handleAddTrainingDate}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors inline-flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add Training
            </button>
          </div>

          {trainingDates.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No training dates recorded yet. Click "+ Add Training" to add one.</p>
          ) : (
            <div className="space-y-3">
              {trainingDates.map((date, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded min-w-[60px]">
                    {index + 1}{getOrdinal(index + 1)} Training
                  </span>
                  <DatePicker value={date} onChange={(val) => handleTrainingDateChange(index, val)} placeholder="Select training date" className="flex-1" />
                  {date && (
                    <span className="text-xs text-gray-500 min-w-[100px]">
                      {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                  <button type="button" onClick={() => handleRemoveTrainingDate(index)}
                    className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Notes</h2>
          <textarea name="notes" value={form.notes} onChange={handleChange}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            rows={3} placeholder="Additional notes about the installation..." />
        </div>

        {/* PM Preview */}
        {pmPreview && (
          <div className="bg-blue-50/80 rounded-xl border border-blue-100 p-5">
            <h2 className="text-sm font-semibold text-blue-800 mb-3 uppercase tracking-wider">Auto-Generated PM Schedule Preview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[{ label: '1st Preventive Maintenance', data: pmPreview.pm1 }, { label: '2nd Preventive Maintenance', data: pmPreview.pm2 }].map(({ label, data }) => (
                <div key={label} className="bg-white rounded-lg p-4 border border-blue-100">
                  <h3 className="font-medium text-blue-900 text-sm mb-2">{label}</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">PM Date:</span> <strong>{formatDateDisplay(data.pmDate)}</strong></p>
                    <p><span className="text-gray-500">Window:</span> {formatDateDisplay(data.windowStart)} – {formatDateDisplay(data.windowEnd)}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-blue-600 mt-3">Both PM schedules will be auto-created when you register this machine.</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <button type="button" onClick={() => navigate('/')} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {submitting ? 'Saving...' : isEdit ? 'Update Machine' : 'Register Machine'}
          </button>
        </div>
      </form>
    </div>
  );
}

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return (s[(v - 20) % 10] || s[v] || s[0]);
}

// These MUST be outside MachineFormPage to prevent re-mount on every keystroke
function FieldLabel({ label, required }) {
  return (
    <label className="block text-xs font-medium text-gray-500 mb-1">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
  );
}

function InputField({ name, placeholder, type = 'text', className = '', value, onChange, error, label, required, disabled }) {
  return (
    <div className={className}>
      <FieldLabel label={label || name} required={required !== false} />
      <input
        type={type}
        name={name}
        value={value || ''}
        onChange={onChange}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
        placeholder={placeholder}
        disabled={disabled}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
