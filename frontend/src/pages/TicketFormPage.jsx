import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ticketsApi, machinesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, CheckCircle, UserPlus, X } from 'lucide-react';
import DatePicker from '../components/DatePicker';

const emptyForm = {
  machine_id: '',
  complaint_date: '',
  error_type: '',
  error_code: '',
  solving_type: 'On-Site',
  solution_process: '',
  spare_parts_needed: false,
  spare_parts_description: '',
  action_date: '',
  technician_name: '',
  service_fees: '',
  transport_fees: '',
  training_fees: '',
};

const statusConfig = {
  Open: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
  'Pending Job': { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  'In Progress': { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  Finished: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
};

const validTransitions = {
  Open: ['Pending Job', 'In Progress', 'Finished'],
  'Pending Job': ['In Progress', 'Finished'],
  'In Progress': ['Finished'],
  Finished: [],
};

export default function TicketFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isView = Boolean(id);
  const { hasPermission } = useAuth();

  const canCreate = hasPermission('service_tickets', 'create');
  const canEdit = hasPermission('service_tickets', 'edit');
  if (!isView && !canCreate) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-gray-500 text-sm">You don't have permission to create service tickets.</p>
        <button onClick={() => navigate('/service-tickets')} className="mt-3 text-sm text-blue-600 hover:underline">← Back to Tickets</button>
      </div>
    );
  }

  const [form, setForm] = useState(emptyForm);
  const [ticket, setTicket] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [machines, setMachines] = useState([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [closeModal, setCloseModal] = useState(false);
  const [closeDate, setCloseDate] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [engineers, setEngineers] = useState([]);
  const [selectedEngineers, setSelectedEngineers] = useState([]);
  const [showEngineerDropdown, setShowEngineerDropdown] = useState(false);

  useEffect(() => {
    machinesApi.list({ limit: 200 }).then((res) => setMachines(res.data)).catch(() => toast.error('Failed to load machines')).finally(() => setMachinesLoading(false));
    machinesApi.getEngineers().then((res) => setEngineers(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isView) {
      ticketsApi.get(id).then((res) => {
        const d = res.data;
        setTicket(d);
        const techNames = d.technician_name || '';
        setSelectedEngineers(techNames ? techNames.split(',').map(n => n.trim()).filter(Boolean) : []);
        setForm({
          machine_id: d.machine_id,
          complaint_date: d.complaint_date?.split('T')[0] || '',
          error_type: d.error_type,
          error_code: d.error_code || '',
          solving_type: d.solving_type,
          solution_process: d.solution_process || '',
          spare_parts_needed: d.spare_parts_needed,
          spare_parts_description: d.spare_parts_description || '',
          action_date: d.action_date ? d.action_date.slice(0, 16) : '',
          technician_name: d.technician_name || '',
          service_fees: d.service_fees || '',
          transport_fees: d.transport_fees || '',
          training_fees: d.training_fees || '',
        });
      }).catch(() => { toast.error('Ticket not found'); navigate('/service-tickets'); });
    }
  }, [id, isView]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const toggleEngineer = (name) => {
    setSelectedEngineers((prev) => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name];
      setForm((f) => ({ ...f, technician_name: next.join(', ') }));
      return next;
    });
  };

  const removeEngineer = (name) => {
    setSelectedEngineers((prev) => {
      const next = prev.filter(n => n !== name);
      setForm((f) => ({ ...f, technician_name: next.join(', ') }));
      return next;
    });
  };

  const fieldLabels = {
    machine_id: 'Machine',
    complaint_date: 'Complaint Date',
    error_type: 'Error Type',
    solving_type: 'Solving Type',
  };

  const validate = () => {
    const errs = {};
    if (!form.machine_id) errs.machine_id = 'Required';
    if (!form.complaint_date) errs.complaint_date = 'Required';
    if (!form.error_type.trim()) errs.error_type = 'Required';
    if (!form.solving_type) errs.solving_type = 'Required';
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
      await ticketsApi.create(form);
      toast.success('Service ticket created!');
      navigate('/service-tickets');
    } catch (err) {
      if (err.data?.errors) {
        const fe = {}; err.data.errors.forEach((e) => { fe[e.field] = e.message; }); setErrors(fe);
      } else { toast.error(err.message || 'Failed to create ticket'); }
    } finally { setSubmitting(false); }
  };

  const handleStatusTransition = async (newStatus) => {
    if (newStatus === 'Finished') {
      setCloseDate(new Date().toISOString().slice(0, 10));
      setCloseTime('');
      setCloseModal(true);
      return;
    }
    try {
      await ticketsApi.updateStatus(ticket.id, { status: newStatus });
      toast.success(`Ticket updated to: ${newStatus}`);
      const res = await ticketsApi.get(id); setTicket(res.data);
    } catch (err) { toast.error(err.data?.message || 'Failed'); }
  };

  const handleConfirmClose = async () => {
    if (!closeDate) { toast.error('Select a date'); return; }
    const dt = closeTime ? `${closeDate}T${closeTime}` : closeDate;
    try {
      await ticketsApi.updateStatus(ticket.id, { status: 'Finished', job_finished_date: dt });
      toast.success('Ticket finished');
      setCloseModal(false);
      const res = await ticketsApi.get(id); setTicket(res.data);
    } catch (err) { toast.error(err.data?.message || 'Failed'); }
  };

  // ── Engineer Multi-Select Component ───────────────────────
  const EngineerMultiSelect = ({ value, onChange }) => (
    <div className="relative">
      <label className="block text-xs font-medium text-gray-500 mb-1">Service Engineer(s) <span className="text-gray-400 font-normal">(click to select multiple)</span></label>
      {/* Selected chips */}
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
      {/* Dropdown trigger */}
      <button type="button" onClick={() => setShowEngineerDropdown(!showEngineerDropdown)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white text-left flex items-center justify-between">
        <span className={selectedEngineers.length ? 'text-gray-700' : 'text-gray-400'}>
          {selectedEngineers.length ? `${selectedEngineers.length} engineer(s) selected` : 'Select engineers...'}
        </span>
        <UserPlus className="w-4 h-4 text-gray-400" />
      </button>
      {/* Dropdown list */}
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
      {/* Also allow manual typing */}
      <input type="text" name="technician_name" value={form.technician_name} onChange={(e) => {
        handleChange(e);
        setSelectedEngineers(e.target.value.split(',').map(n => n.trim()).filter(Boolean));
      }} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
        placeholder="Or type names manually, comma-separated" />
    </div>
  );

  // ── View Mode ─────────────────────────────────────────────
  if (isView && ticket) {
    const sc = statusConfig[ticket.status] || statusConfig.Open;
    const transitions = validTransitions[ticket.status] || [];

    return (
      <div className="max-w-4xl mx-auto">
        <button onClick={() => navigate('/service-tickets')} className="text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Tickets
        </button>
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{ticket.ticket_number}</h1>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${sc.bg} ${sc.text} ${sc.ring}`}>{ticket.status}</span>
        </div>

        {/* Machine Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Machine</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[['Serial', ticket.serial_number], ['Hospital', ticket.hospital_name], ['Brand / Model', `${ticket.brand_name} ${ticket.model}`], ['Type', ticket.machine_type_name], ['Township', ticket.township_name], ['Contact', ticket.contact_person], ['Phone', ticket.contact_phone]].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="font-medium text-gray-700 mt-0.5">{val || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Complaint Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Complaint</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[['Date', ticket.complaint_date ? new Date(ticket.complaint_date).toLocaleDateString() : '—'], ['Error Type', ticket.error_type], ['Error Code', ticket.error_code || 'N/A'], ['Solving', ticket.solving_type], ['Action Date', ticket.action_date ? new Date(ticket.action_date).toLocaleString() : 'N/A'], ['Technician', ticket.technician_name || 'N/A']].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="font-medium text-gray-700 mt-0.5 whitespace-pre-wrap">{val}</p>
              </div>
            ))}
            <div className="md:col-span-3">
              <p className="text-xs text-gray-400">Solution</p>
              <p className="font-medium text-gray-700 mt-0.5 whitespace-pre-wrap">{ticket.solution_process || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Spare Parts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Spare Parts</h2>
          <div className="text-sm">
            <p className="text-gray-500">Needed: <strong className="text-gray-700">{ticket.spare_parts_needed ? 'Yes' : 'No'}</strong></p>
            {ticket.spare_parts_needed && ticket.spare_parts_description && <p className="text-gray-600 mt-1">{ticket.spare_parts_description}</p>}
            {ticket.job_finished_date && <p className="text-gray-500 mt-1">Finished: <strong className="text-gray-700">{new Date(ticket.job_finished_date).toLocaleString()}</strong></p>}
          </div>
        </div>

        {/* Fees */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Fees</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {[['Service Fees', ticket.service_fees], ['Transport Fees', ticket.transport_fees], ['Training Fees', ticket.training_fees]].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="font-medium text-gray-700 mt-0.5">${Number(val || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        {transitions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Actions</h2>
            <div className="flex gap-2">
              {transitions.map((st) => {
                const canDo = st === 'Finished'
                  ? hasPermission('service_tickets', 'close')
                  : hasPermission('service_tickets', 'edit');
                if (!canDo) return null;
                return (
                  <button key={st} onClick={() => handleStatusTransition(st)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    st === 'Finished' ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
                    st === 'In Progress' ? 'bg-blue-600 text-white hover:bg-blue-700' :
                    'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>Move to {st}</button>
                );
              })}
            </div>
          </div>
        )}

        {/* Finish Modal */}
        {closeModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setCloseModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Finish Ticket</h3>
                    <p className="text-xs text-gray-400">{ticket.ticket_number}</p>
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
                <button onClick={() => setCloseModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleConfirmClose} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">Finish</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Create Mode ───────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate('/service-tickets')} className="text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4 inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" />
        Back to Tickets
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">New Service Ticket</h1>
      <p className="text-sm text-gray-400 mb-6">A unique Request ID will be auto-generated.</p>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Machine & Complaint */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Machine & Complaint</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Machine *</label>
                <select name="machine_id" value={form.machine_id} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white" disabled={machinesLoading}>
                  <option value="">{machinesLoading ? 'Loading...' : 'Select machine...'}</option>
                  {machines.map((m) => <option key={m.id} value={m.id}>{m.serial_number} — {m.hospital_name} ({m.brand_name} {m.model})</option>)}
                </select>
                {errors.machine_id && <p className="text-xs text-red-500 mt-1">{errors.machine_id}</p>}
              </div>                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Complaint Date *</label>
                  <DatePicker value={form.complaint_date} onChange={(val) => handleChange({ target: { name: 'complaint_date', value: val } })} placeholder="Select date" />
                  {errors.complaint_date && <p className="text-xs text-red-500 mt-1">{errors.complaint_date}</p>}
                </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Solving Type *</label>
                <select name="solving_type" value={form.solving_type} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all bg-white">
                  <option value="Phone">By Phone</option>
                  <option value="On-Site">On-Site</option>
                  <option value="Office">Office</option>
                </select>
                {errors.solving_type && <p className="text-xs text-red-500 mt-1">{errors.solving_type}</p>}
              </div>
            </div>
          </div>

          {/* Error Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Error Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Error Type * <span className="text-gray-400 font-normal">(list all errors, one per line if needed)</span></label>
                <textarea name="error_type" value={form.error_type} onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  rows={4}
                  placeholder={"e.g., Power Failure\nDisplay Error Code E-1042\nBoot Loop on Startup\nSensor Calibration Failed"} />
                {errors.error_type && <p className="text-xs text-red-500 mt-1">{errors.error_type}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Error Code</label>
                <input name="error_code" value={form.error_code} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all font-mono" placeholder="e.g., E-1042" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Action Date & Time</label>
                <input type="datetime-local" name="action_date" value={form.action_date} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Solution Process</label>
                <textarea name="solution_process" value={form.solution_process} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" rows={3} placeholder="Describe the solution..." />
              </div>
              <div className="md:col-span-2">
                <EngineerMultiSelect />
              </div>
            </div>
          </div>

          {/* Spare Parts */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Spare Parts</h2>
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <div className="relative">
                <input type="checkbox" name="spare_parts_needed" checked={form.spare_parts_needed} onChange={handleChange} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform"></div>
              </div>
              <span className="text-sm font-medium text-gray-700">Spare Parts Required</span>
              {form.spare_parts_needed && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md ring-1 ring-amber-200">Status → Pending Job</span>}
            </label>
            {form.spare_parts_needed && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <textarea name="spare_parts_description" value={form.spare_parts_description} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" rows={2} placeholder="List required parts..." />
              </div>
            )}
          </div>

          {/* Fees */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Fees</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { name: 'service_fees', label: 'Service Fees' },
                { name: 'transport_fees', label: 'Transport Fees' },
                { name: 'training_fees', label: 'Training Fees' },
              ].map(({ name, label }) => (
                <div key={name}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <input type="number" name={name} value={form[name]} onChange={handleChange} className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" placeholder="0.00" min="0" step="0.01" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 mt-6 pb-6">
          <button type="button" onClick={() => navigate('/service-tickets')} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          <button type="submit" disabled={submitting} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {submitting ? 'Creating...' : 'Create Ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
