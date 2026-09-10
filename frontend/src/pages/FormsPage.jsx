import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { exportApi, machinesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FileText, CheckCircle, Printer, Download, ArrowLeft, ArrowRight, Search, X } from 'lucide-react';

const FORM_TYPES = [
  { key: 'installation', label: 'Installation & Commissioning Report', docNo: 'EG-RE-ME-001-00' },
  { key: 'maintenance', label: 'Maintenance Report', docNo: 'EG-RE-ME-003-00' },
  { key: 'field-service', label: 'Field Service Report', docNo: 'EG-RE-ME-002-00' },
];

const emptyPart = () => ({ item: '', qty: '', operative: '', non_operative: '', remarks: '', description: '', unit_price: '', amount: '', name: '' });
const emptyFee = () => ({ description: '', per_day: '', days: '', amount: '' });

const init = {
  installation: {
    customer_name: '', hospital: '', address: '', township: '', phone: '', email: '',
    equipment: '', model: '', serial_no: '', installation_date: '',
    install_start: '', install_finish: '', working_time: '', warranty: 'under',
    parts: Array.from({ length: 9 }, emptyPart),
    parts_condition: '', install_condition: '', operation_condition: '',
    install_complete_date: '', test_running_date: '', training_complete: false,
    commission_date: '', warranty_from: '', warranty_to: '', remark: '',
  },
  maintenance: {
    customer_name: '', hospital: '', address: '', township: '', phone: '', email: '',
    install_date: '', report_date: '', equipment: '', model: '', serial_no: '',
    report_action: '',
    check_parts: '', check_machine: '', check_operation: '', check_service: '',
    check_general: '', check_calibration: '', check_testing: '', check_repair: '',
    general_condition: '', environment_condition: '',
    service_start: '', service_complete: '', human_error: '', test_running: '', test_complete: false,
    additional_remark: '',
  },
  'field-service': {
    customer_name: '', hospital: '', address: '', township: '', phone: '', email: '',
    equipment: '', model: '', serial_no: '', installation_date: '',
    service_start: '', service_finish: '', working_time: '', warranty: 'under',
    failure_description: '', inspection_fixed: '', actions_taken: '',
    parts: Array.from({ length: 5 }, emptyPart),
    parts_total: '', parts_foc: '', parts_net: '',
    fees: Array.from({ length: 5 }, emptyFee),
    fee_total: '', fee_foc: '', fee_net: '', grand_total: '', grand_total_word: '',
    env_condition: '',
  },
};

function useMachineSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    try {
      const res = await machinesApi.list({ search: q, limit: 8 });
      setResults(res.data || []);
      setOpen(true);
    } catch { setResults([]); }
  }, []);

  const onQueryChange = useCallback((val) => {
    setQuery(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(val), 300);
  }, [search]);

  return { query, setQuery, results, open, setOpen, onQueryChange };
}

export default function FormsPage() {
  const { hasPermission } = useAuth();
  const [formType, setFormType] = useState('');
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const machineSearch = useMachineSearch();

  const canExport = hasPermission('service_tickets', 'create');

  const setField = useCallback((key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const setPartField = useCallback((index, key, value) => {
    setFormData(prev => {
      const parts = [...(prev.parts || [])];
      parts[index] = { ...parts[index], [key]: value };
      return { ...prev, parts };
    });
  }, []);

  const setFeeField = useCallback((index, key, value) => {
    setFormData(prev => {
      const fees = [...(prev.fees || [])];
      fees[index] = { ...fees[index], [key]: value };
      return { ...prev, fees };
    });
  }, []);

  const fillFromMachine = (m) => {
    setFormData(prev => ({
      ...prev,
      hospital: m.hospital_name || '',
      address: m.address || '',
      township: m.township_name || '',
      phone: m.contact_phone || '',
      email: m.contact_email || '',
      equipment: m.machine_type_name || m.type_name || '',
      model: m.model_name || m.model || '',
      serial_no: m.serial_number || '',
      installation_date: m.installation_date ? new Date(m.installation_date).toLocaleDateString('en-GB') : '',
    }));
    machineSearch.setQuery(m.serial_number || m.hospital_name || '');
    machineSearch.setOpen(false);
    toast.success('Machine data auto-filled');
  };

  const startForm = (type) => {
    setFormType(type);
    setFormData(JSON.parse(JSON.stringify(init[type])));
    setStep(1);
  };

  const handleFinalConfirm = async () => {
    setLoading(true);
    try {
      await exportApi.formPdf(formType, formData);
      toast.success('PDF downloaded!');
      setStep(3);
    } catch { toast.error('PDF generation failed'); }
    finally { setLoading(false); }
  };

  if (!canExport) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-600">Access Denied</h2>
        <p className="text-sm text-gray-400 mt-1">You don't have permission to access forms.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {step > 0 && (
        <div className="flex items-center gap-2 mb-6 text-sm">
          {['Select Form', 'Fill Details', 'Review', 'Complete'].map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && <div className={`h-px flex-1 ${i <= step ? 'bg-blue-500' : 'bg-gray-200'}`} />}
              <div className={`flex items-center gap-1 ${i <= step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${i < step ? 'bg-blue-600 text-white' : i === step ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500' : 'bg-gray-100 text-gray-400'}`}>
                  {i < step ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span className="hidden sm:inline">{label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {step === 0 && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Service Forms</h1>
          <p className="text-sm text-gray-500 mb-6">Select a form type to generate a PDF report</p>
          <div className="grid gap-4">
            {FORM_TYPES.map(f => (
              <button key={f.key} onClick={() => startForm(f.key)}
                className="flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left group">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{f.label}</h3>
                  <p className="text-xs text-gray-400">Doc No: {f.docNo}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition" />
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <button onClick={() => setStep(0)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {FORM_TYPES.find(f => f.key === formType)?.label}
          </h1>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 relative">
            <p className="text-sm font-medium text-blue-800 mb-2">Quick Fill from Machine Registry</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={machineSearch.query}
                  onChange={e => machineSearch.onQueryChange(e.target.value)}
                  onFocus={() => machineSearch.results.length > 0 && machineSearch.setOpen(true)}
                  placeholder="Type to search by serial number, hospital, or model..."
                  className="w-full pl-9 pr-8 py-2 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {machineSearch.query && (
                  <button onClick={() => { machineSearch.setQuery(''); machineSearch.setResults([]); machineSearch.setOpen(false); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            {machineSearch.open && machineSearch.results.length > 0 && (
              <div className="absolute left-4 right-4 mt-1 bg-white border border-blue-100 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                {machineSearch.results.map(m => (
                  <button key={m.id} onClick={() => fillFromMachine(m)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex justify-between border-b border-gray-50 last:border-0">
                    <span className="font-medium">{m.serial_number} — {m.hospital_name}</span>
                    <span className="text-gray-400">{m.brand_name} {m.model_name || m.model}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <FormFields formType={formType} formData={formData} setField={setField} setPartField={setPartField} setFeeField={setFeeField} />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setStep(0)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <CheckCircle size={16} /> 1st Confirm — Review
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft size={16} /> Back to editing
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Review Form</h1>
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4">
            Please review all details carefully before exporting.
          </p>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <FormReview formType={formType} formData={formData} />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Edit Again</button>
            <button onClick={handleFinalConfirm} disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
              <Download size={16} /> {loading ? 'Generating...' : '2nd Confirm — Export PDF'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">PDF Generated Successfully!</h2>
          <p className="text-sm text-gray-500 mb-6">Your form has been downloaded.</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => { setStep(0); setFormType(''); setFormData({}); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              Create Another Form
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Reusable field components
// ═══════════════════════════════════════════════════════════════
function F({ label, field, formData, setField, type = 'text', options, rows, placeholder }) {
  const val = formData[field] || '';
  const ph = placeholder || label;
  if (type === 'select') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <select value={val} onChange={e => setField(field, e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
          <option value="">Select...</option>
          {options.map(o => <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>{typeof o === 'string' ? o : o.label}</option>)}
        </select>
      </div>
    );
  }
  if (type === 'textarea') {
    return (
      <div className="col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <textarea value={val} onChange={e => setField(field, e.target.value)}
          rows={rows || 3} placeholder={ph}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y" />
      </div>
    );
  }
  if (type === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={!!formData[field]} onChange={e => setField(field, e.target.checked)}
          className="w-4 h-4 rounded border-gray-300" />
        <span className="text-sm text-gray-600">{label}</span>
      </div>
    );
  }
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} value={val} onChange={e => setField(field, e.target.value)} placeholder={ph}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-blue-800 border-b-2 border-blue-200 pb-1 mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INSTALLATION FIELDS
// ═══════════════════════════════════════════════════════════════
function InstallationFields({ formData, setField, setPartField }) {
  return (
    <div className="space-y-6">
      <Section title="Customer Information">
        <F label="Customer's Name" field="customer_name" formData={formData} setField={setField} />
        <F label="Department/Hospital" field="hospital" formData={formData} setField={setField} />
        <F label="Address" field="address" formData={formData} setField={setField} />
        <F label="Township" field="township" formData={formData} setField={setField} />
        <F label="Ph No" field="phone" formData={formData} setField={setField} />
        <F label="Email" field="email" formData={formData} setField={setField} />
      </Section>
      <Section title="Equipment Information">
        <F label="Equipment" field="equipment" formData={formData} setField={setField} />
        <F label="Model" field="model" formData={formData} setField={setField} />
        <F label="Serial No" field="serial_no" formData={formData} setField={setField} />
        <F label="Installation Date" field="installation_date" type="date" formData={formData} setField={setField} />
        <F label="Installation Start Date" field="install_start" type="date" formData={formData} setField={setField} />
        <F label="Installation Finished Date" field="install_finish" type="date" formData={formData} setField={setField} />
        <F label="Working Day/Time" field="working_time" formData={formData} setField={setField} />
        <F label="Warranty" field="warranty" type="select" options={[{ value: 'under', label: 'Under Warranty' }, { value: 'over', label: 'Over Warranty' }]} formData={formData} setField={setField} />
      </Section>
      <div>
        <h3 className="text-sm font-semibold text-blue-800 border-b-2 border-blue-200 pb-1 mb-3">Installation Parts and Supplies</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-blue-50">
                <th className="border px-2 py-1.5 text-left w-8">No</th>
                <th className="border px-2 py-1.5 text-left">Item List</th>
                <th className="border px-2 py-1.5 text-left w-16">Qty</th>
                <th className="border px-2 py-1.5 text-left w-24">OPERATIVE</th>
                <th className="border px-2 py-1.5 text-left w-24">NON OPERATIVE</th>
                <th className="border px-2 py-1.5 text-left">REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 9 }, (_, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1 text-center">{i + 1}</td>
                  <td className="border px-1 py-0.5"><input value={formData.parts?.[i]?.item || ''} onChange={e => setPartField(i, 'item', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                  <td className="border px-1 py-0.5"><input value={formData.parts?.[i]?.qty || ''} onChange={e => setPartField(i, 'qty', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                  <td className="border px-1 py-0.5"><input value={formData.parts?.[i]?.operative || ''} onChange={e => setPartField(i, 'operative', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                  <td className="border px-1 py-0.5"><input value={formData.parts?.[i]?.non_operative || ''} onChange={e => setPartField(i, 'non_operative', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                  <td className="border px-1 py-0.5"><input value={formData.parts?.[i]?.remarks || ''} onChange={e => setPartField(i, 'remarks', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Section title="Report">
        <F label="1. Parts Condition" field="parts_condition" type="select" options={['Good', 'Fair', 'Poor']} formData={formData} setField={setField} />
        <F label="Installation Complete Date" field="install_complete_date" type="date" formData={formData} setField={setField} />
        <F label="2. Installation Condition" field="install_condition" type="select" options={['Good', 'Fair', 'Poor']} formData={formData} setField={setField} />
        <F label="Test Running Date" field="test_running_date" type="date" formData={formData} setField={setField} />
        <F label="3. Operation Condition" field="operation_condition" type="select" options={['Good', 'Fair', 'Poor']} formData={formData} setField={setField} />
        <F label="User Training Complete" field="training_complete" type="checkbox" formData={formData} setField={setField} />
      </Section>
      <Section title="Warranty Period">
        <F label="Commission Date" field="commission_date" type="date" formData={formData} setField={setField} />
        <F label="Warranty From" field="warranty_from" type="date" formData={formData} setField={setField} />
        <F label="Warranty To" field="warranty_to" type="date" formData={formData} setField={setField} />
      </Section>
      <F label="Remark" field="remark" type="textarea" formData={formData} setField={setField} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAINTENANCE FIELDS
// ═══════════════════════════════════════════════════════════════
function MaintenanceFields({ formData, setField }) {
  return (
    <div className="space-y-6">
      <Section title="Customer Information">
        <F label="Customer's Name" field="customer_name" formData={formData} setField={setField} />
        <F label="Department/Hospital" field="hospital" formData={formData} setField={setField} />
        <F label="Address" field="address" formData={formData} setField={setField} />
        <F label="Township" field="township" formData={formData} setField={setField} />
        <F label="Ph No" field="phone" formData={formData} setField={setField} />
        <F label="Email" field="email" formData={formData} setField={setField} />
        <F label="Install Date" field="install_date" type="date" formData={formData} setField={setField} />
        <F label="Date" field="report_date" type="date" formData={formData} setField={setField} />
      </Section>
      <Section title="Equipment Information">
        <F label="Equipment" field="equipment" formData={formData} setField={setField} />
        <F label="Model" field="model" formData={formData} setField={setField} />
        <F label="Serial No" field="serial_no" formData={formData} setField={setField} />
      </Section>
      <F label="Report / Action Taken" field="report_action" type="textarea" formData={formData} setField={setField} rows={5} />
      <Section title="Checking Up">
        <F label="1. Parts Condition" field="check_parts" formData={formData} setField={setField} />
        <F label="5. General Service" field="check_general" formData={formData} setField={setField} />
        <F label="2. Machine Condition" field="check_machine" formData={formData} setField={setField} />
        <F label="6. Calibration Condition" field="check_calibration" formData={formData} setField={setField} />
        <F label="3. Operation Condition" field="check_operation" formData={formData} setField={setField} />
        <F label="7. Testing Condition" field="check_testing" formData={formData} setField={setField} />
        <F label="4. Service Condition" field="check_service" formData={formData} setField={setField} />
        <F label="8. Repair / Breakdown" field="check_repair" formData={formData} setField={setField} />
      </Section>
      <Section title="Conditions">
        <F label="General Machine Condition" field="general_condition" type="select" options={['Good', 'Fair', 'Fail']} formData={formData} setField={setField} />
        <F label="Environment Condition" field="environment_condition" type="select" options={['Good', 'Fair', 'Poor']} formData={formData} setField={setField} />
        <F label="Service Start Date" field="service_start" type="date" formData={formData} setField={setField} />
        <F label="Service Complete Date" field="service_complete" type="date" formData={formData} setField={setField} />
        <F label="Human Error" field="human_error" type="select" options={['Yes', 'No']} formData={formData} setField={setField} />
        <F label="Test Running Date" field="test_running" type="date" formData={formData} setField={setField} />
        <F label="Test Complete" field="test_complete" type="checkbox" formData={formData} setField={setField} />
      </Section>
      <F label="Additional Remark" field="additional_remark" type="textarea" formData={formData} setField={setField} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FIELD SERVICE FIELDS
// ═══════════════════════════════════════════════════════════════
function FieldServiceFields({ formData, setField, setPartField, setFeeField }) {
  return (
    <div className="space-y-6">
      <Section title="Customer Information">
        <F label="Customer's Name" field="customer_name" formData={formData} setField={setField} />
        <F label="Department/Hospital" field="hospital" formData={formData} setField={setField} />
        <F label="Address" field="address" formData={formData} setField={setField} />
        <F label="Township" field="township" formData={formData} setField={setField} />
        <F label="Ph No" field="phone" formData={formData} setField={setField} />
        <F label="Email" field="email" formData={formData} setField={setField} />
      </Section>
      <Section title="Equipment Information">
        <F label="Equipment" field="equipment" formData={formData} setField={setField} />
        <F label="Model" field="model" formData={formData} setField={setField} />
        <F label="Serial No" field="serial_no" formData={formData} setField={setField} />
        <F label="Installation Date" field="installation_date" type="date" formData={formData} setField={setField} />
        <F label="Service Start Date" field="service_start" type="date" formData={formData} setField={setField} />
        <F label="Service Finished Date" field="service_finish" type="date" formData={formData} setField={setField} />
        <F label="Working Day/Time" field="working_time" formData={formData} setField={setField} />
        <F label="Warranty" field="warranty" type="select" options={[{ value: 'under', label: 'Under Warranty' }, { value: 'over', label: 'Over Warranty' }]} formData={formData} setField={setField} />
      </Section>
      <F label="Failure Description" field="failure_description" type="textarea" formData={formData} setField={setField} />
      <F label="Inspection & Fixed" field="inspection_fixed" type="textarea" formData={formData} setField={setField} />
      <div>
        <h3 className="text-sm font-semibold text-blue-800 border-b-2 border-blue-200 pb-1 mb-3">Actions Taken</h3>
        <div className="flex flex-wrap gap-4">
          {['Maintained', 'Reconditioned', 'Replace', 'Repair'].map(a => (
            <label key={a} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={(formData.actions_taken || '').toLowerCase().includes(a.toLowerCase())}
                onChange={e => {
                  const current = (formData.actions_taken || '').toLowerCase();
                  const low = a.toLowerCase();
                  setField('actions_taken', e.target.checked
                    ? (current ? current + ', ' + low : low)
                    : current.replace(new RegExp(`[,\\s]*${low}\\s*`, 'i'), '').trim());
                }} className="w-4 h-4 rounded border-gray-300" />
              <span className="text-sm">{a}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-blue-800 border-b-2 border-blue-200 pb-1 mb-3">Parts</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-blue-50">
                <th className="border px-2 py-1.5 text-left w-8">No</th>
                <th className="border px-2 py-1.5 text-left">Parts</th>
                <th className="border px-2 py-1.5 text-left">Descriptions</th>
                <th className="border px-2 py-1.5 text-left w-24">Unit Price</th>
                <th className="border px-2 py-1.5 text-left w-16">Qty</th>
                <th className="border px-2 py-1.5 text-left w-28">Amount(Kyat)</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1 text-center">{i + 1}</td>
                  <td className="border px-1 py-0.5"><input value={formData.parts?.[i]?.name || ''} onChange={e => setPartField(i, 'name', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                  <td className="border px-1 py-0.5"><input value={formData.parts?.[i]?.description || ''} onChange={e => setPartField(i, 'description', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                  <td className="border px-1 py-0.5"><input value={formData.parts?.[i]?.unit_price || ''} onChange={e => setPartField(i, 'unit_price', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                  <td className="border px-1 py-0.5"><input value={formData.parts?.[i]?.qty || ''} onChange={e => setPartField(i, 'qty', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                  <td className="border px-1 py-0.5"><input value={formData.parts?.[i]?.amount || ''} onChange={e => setPartField(i, 'amount', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <F label="Total (Kyat)" field="parts_total" formData={formData} setField={setField} />
          <F label="FOC (Kyat)" field="parts_foc" formData={formData} setField={setField} />
          <F label="Net (Kyat)" field="parts_net" formData={formData} setField={setField} />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-blue-800 border-b-2 border-blue-200 pb-1 mb-3">Fee Charges</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-blue-50">
                <th className="border px-2 py-1.5 text-left w-8">No</th>
                <th className="border px-2 py-1.5 text-left">Fees</th>
                <th className="border px-2 py-1.5 text-left">Descriptions</th>
                <th className="border px-2 py-1.5 text-left w-24">Per Day Fee</th>
                <th className="border px-2 py-1.5 text-left w-16">Days</th>
                <th className="border px-2 py-1.5 text-left w-28">Amount(Kyat)</th>
              </tr>
            </thead>
            <tbody>
              {['Service Fees', 'Transportation Fees', 'Costs of Meal', 'Accommodation Fees', 'Other Fee'].map((label, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1 text-center">{i + 1}</td>
                  <td className="border px-2 py-1 text-gray-600">{label}</td>
                  <td className="border px-1 py-0.5"><input value={formData.fees?.[i]?.description || ''} onChange={e => setFeeField(i, 'description', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                  <td className="border px-1 py-0.5"><input value={formData.fees?.[i]?.per_day || ''} onChange={e => setFeeField(i, 'per_day', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                  <td className="border px-1 py-0.5"><input value={formData.fees?.[i]?.days || ''} onChange={e => setFeeField(i, 'days', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                  <td className="border px-1 py-0.5"><input value={formData.fees?.[i]?.amount || ''} onChange={e => setFeeField(i, 'amount', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <F label="Total (Kyat)" field="fee_total" formData={formData} setField={setField} />
          <F label="FOC (Kyat)" field="fee_foc" formData={formData} setField={setField} />
          <F label="Net (Kyat)" field="fee_net" formData={formData} setField={setField} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <F label="Grand Total (Kyat)" field="grand_total" formData={formData} setField={setField} />
          <F label="Grand Total by Word" field="grand_total_word" formData={formData} setField={setField} />
        </div>
      </div>
      <F label="Environmental Condition (Humidity, Dust, Electricity, etc.)" field="env_condition" type="select" options={['Good', 'Fair', 'Poor']} formData={formData} setField={setField} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FORM FIELDS DISPATCHER
// ═══════════════════════════════════════════════════════════════
function FormFields({ formType, formData, setField, setPartField, setFeeField }) {
  if (formType === 'installation') return <InstallationFields formData={formData} setField={setField} setPartField={setPartField} />;
  if (formType === 'maintenance') return <MaintenanceFields formData={formData} setField={setField} />;
  if (formType === 'field-service') return <FieldServiceFields formData={formData} setField={setField} setPartField={setPartField} setFeeField={setFeeField} />;
  return null;
}

// ═══════════════════════════════════════════════════════════════
// REVIEW — Matches PDF form layout
// ═══════════════════════════════════════════════════════════════
function FormReview({ formType, formData }) {
  const Row = ({ label, value }) => (
    <div className="flex items-baseline gap-1 text-sm">
      <span className="font-semibold whitespace-nowrap">{label}</span>
      <span className="border-b border-dotted border-gray-400 flex-1 min-w-[60px] text-center">{value || '________________'}</span>
    </div>
  );
  const RowPair = ({ l1, v1, l2, v2 }) => (
    <div className="grid grid-cols-2 gap-4">
      <Row label={l1} value={v1} />
      <Row label={l2} value={v2} />
    </div>
  );
  const fmtDate = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-GB'); } catch { return d; }
  };
  const fmtBool = (v) => v ? 'Yes' : 'No';

  if (formType === 'installation') {
    return (
      <div className="space-y-4 font-serif">
        <div className="text-center border-b-2 border-blue-600 pb-2">
          <h2 className="text-lg font-bold">EVER GLORY COMPANY LIMITED</h2>
          <p className="text-[10px] text-gray-500">Office No. 1301, Corner of Shu Khin Thar Mayopat Road and Aung Tha Khu Street</p>
          <p className="text-[10px] text-gray-500">6th Ward, Thaketa Township, Yangon, Myanmar.</p>
        </div>
        <div className="text-center font-bold text-base">Installation and Commissioning Report</div>
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>Document No: EG-RE-ME-001-00</span>
          <span>Service Hotline: 09 253333466</span>
        </div>

        <div className="space-y-2">
          <RowPair l1="Customer's Name:" v1={formData.customer_name} l2="Department/Hospital:" v2={formData.hospital} />
          <RowPair l1="Address:" v1={formData.address} l2="Township:" v2={formData.township} />
          <RowPair l1="Ph No:" v1={formData.phone} l2="Email:" v2={formData.email} />
          <RowPair l1="Equipment:" v1={formData.equipment} l2="Installation Start Date:" v2={formData.install_start} />
          <RowPair l1="Model:" v1={formData.model} l2="Installation Finished Date:" v2={formData.install_finish} />
          <RowPair l1="Serial No:" v1={formData.serial_no} l2="Working Day/Time:" v2={formData.working_time} />
          <div className="flex gap-4">
            <Row label="Installation Date:" value={fmtDate(formData.installation_date)} />
            <span className="text-sm font-semibold">Warranty: ({formData.warranty === 'under' ? 'Under' : 'Over'})</span>
          </div>
        </div>

        <div>
          <h4 className="font-bold text-sm border-b border-blue-600 pb-1">Installation Parts and Supplies</h4>
          <table className="w-full text-xs border-collapse mt-1">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">No</th>
                <th className="border px-2 py-1 text-left">Item List</th>
                <th className="border px-2 py-1">Qty</th>
                <th className="border px-2 py-1">OPERATIVE</th>
                <th className="border px-2 py-1">NON OPERATIVE</th>
                <th className="border px-2 py-1">REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {(formData.parts || []).filter(p => p.item).map((p, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1 text-center">{i + 1}</td>
                  <td className="border px-2 py-1">{p.item}</td>
                  <td className="border px-2 py-1 text-center">{p.qty}</td>
                  <td className="border px-2 py-1 text-center">{p.operative}</td>
                  <td className="border px-2 py-1 text-center">{p.non_operative}</td>
                  <td className="border px-2 py-1">{p.remarks}</td>
                </tr>
              ))}
              {(!formData.parts || formData.parts.every(p => !p.item)) && (
                <tr><td colSpan={6} className="border px-2 py-2 text-center text-gray-400">No parts entered</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-1">
          <h4 className="font-bold text-sm border-b border-blue-600 pb-1">Report</h4>
          <p className="text-sm">1  Parts Condition:           ( {formData.parts_condition || '____'} )</p>
          <p className="text-sm">2  Installation Condition:    ( {formData.install_condition || '____'} )</p>
          <p className="text-sm">3  Operation Condition:       ( {formData.operation_condition || '____'} )</p>
          <p className="text-sm">Installation Complete Date:   {fmtDate(formData.install_complete_date)}</p>
          <p className="text-sm">Test Running Date:           {fmtDate(formData.test_running_date)}</p>
          <p className="text-sm">User Training Complete:      {fmtBool(formData.training_complete)}</p>
        </div>

        <div className="space-y-1 text-xs text-gray-600 italic">
          <p className="font-bold not-italic">Warranty Exclusions</p>
          <p>The distributor shall not be responsible on the following factors:</p>
          <p>I. Natural Disaster.</p>
          <p>II. Any defect due to unspecified connection/environment such as Unstable Power Supply...</p>
          <p>III. Failure caused by customized modification beyond the Manufacturer's Recommendation.</p>
          <p>IV. Any consumable parts like Lamp, pneumatic tubing, etc.</p>
        </div>

        <div className="text-sm">
          <p>The above equipment has proven satisfactory and thus passed Commission on date: <b>{fmtDate(formData.commission_date)}</b></p>
          <p>Warranty Period from <b>{fmtDate(formData.warranty_from)}</b> to <b>{fmtDate(formData.warranty_to)}</b></p>
        </div>

        {formData.remark && <div className="text-sm"><b>Remark:</b> {formData.remark}</div>}

        <div className="border-t pt-4 grid grid-cols-2 gap-8 text-sm mt-4">
          <div>
            <p className="font-semibold">Authorized Engineer</p>
            <p className="mt-4">Signature: _______________</p>
          </div>
          <div>
            <p className="font-semibold">Customer/In Charge</p>
            <p className="mt-4">Signature: _______________</p>
          </div>
        </div>
      </div>
    );
  }

  if (formType === 'maintenance') {
    return (
      <div className="space-y-4 font-serif">
        <div className="text-center border-b-2 border-blue-600 pb-2">
          <h2 className="text-lg font-bold">EVER GLORY COMPANY LIMITED</h2>
        </div>
        <div className="text-center font-bold text-base">Maintenance Report</div>
        <div className="space-y-2">
          <RowPair l1="Customer's Name:" v1={formData.customer_name} l2="Department/Hospital:" v2={formData.hospital} />
          <RowPair l1="Address:" v1={formData.address} l2="Township:" v2={formData.township} />
          <RowPair l1="Ph No:" v1={formData.phone} l2="Email:" v2={formData.email} />
          <RowPair l1="Equipment:" v1={formData.equipment} l2="Report Date:" v2={fmtDate(formData.report_date)} />
          <RowPair l1="Model:" v1={formData.model} l2="" v2="" />
          <Row label="Serial No:" value={formData.serial_no} />
          <Row label="Install Date:" value={fmtDate(formData.install_date)} />
        </div>
        {formData.report_action && (
          <div><h4 className="font-bold text-sm border-b border-blue-600 pb-1">Report / Action Taken</h4>
          <p className="text-sm mt-1 whitespace-pre-wrap">{formData.report_action}</p></div>
        )}
        <div className="space-y-1">
          <h4 className="font-bold text-sm border-b border-blue-600 pb-1">Checking Up</h4>
          {[
            ['1. Parts Condition', formData.check_parts], ['5. General Service', formData.check_general],
            ['2. Machine Condition', formData.check_machine], ['6. Calibration Condition', formData.check_calibration],
            ['3. Operation Condition', formData.check_operation], ['7. Testing Condition', formData.check_testing],
            ['4. Service Condition', formData.check_service], ['8. Repair / Breakdown', formData.check_repair],
          ].map(([l, v], i) => <p key={i} className="text-sm">{l}: {v || '____'}</p>)}
        </div>
        <div className="space-y-1">
          <p className="text-sm">General Machine Condition: <b>{formData.general_condition || '____'}</b></p>
          <p className="text-sm">Environment Condition: <b>{formData.environment_condition || '____'}</b></p>
          <RowPair l1="Service Start Date:" v1={fmtDate(formData.service_start)} l2="Service Complete Date:" v2={fmtDate(formData.service_complete)} />
          <RowPair l1="Human Error:" v1={formData.human_error} l2="Test Running Date:" v2={fmtDate(formData.test_running)} />
          <p className="text-sm">Test Complete: {fmtBool(formData.test_complete)}</p>
        </div>
        {formData.additional_remark && <div className="text-sm"><b>Additional Remark:</b> {formData.additional_remark}</div>}
        <div className="border-t pt-4 grid grid-cols-2 gap-8 text-sm mt-4">
          <div><p className="font-semibold">Authorized Engineer</p><p className="mt-4">Signature: _______________</p></div>
          <div><p className="font-semibold">Customer/In Charge</p><p className="mt-4">Signature: _______________</p></div>
        </div>
      </div>
    );
  }

  if (formType === 'field-service') {
    return (
      <div className="space-y-4 font-serif">
        <div className="text-center border-b-2 border-blue-600 pb-2">
          <h2 className="text-lg font-bold">EVER GLORY COMPANY LIMITED</h2>
        </div>
        <div className="text-center font-bold text-base">Field Service Report</div>
        <div className="space-y-2">
          <RowPair l1="Customer's Name:" v1={formData.customer_name} l2="Department/Hospital:" v2={formData.hospital} />
          <RowPair l1="Address:" v1={formData.address} l2="Township:" v2={formData.township} />
          <RowPair l1="Ph No:" v1={formData.phone} l2="Email:" v2={formData.email} />
          <RowPair l1="Equipment:" v1={formData.equipment} l2="Service Start Date:" v2={fmtDate(formData.service_start)} />
          <RowPair l1="Model:" v1={formData.model} l2="Service Finished Date:" v2={fmtDate(formData.service_finish)} />
          <RowPair l1="Serial No:" v1={formData.serial_no} l2="Working Day/Time:" v2={formData.working_time} />
          <div className="flex gap-4">
            <Row label="Installation Date:" value={fmtDate(formData.installation_date)} />
            <span className="text-sm font-semibold">Warranty: ({formData.warranty === 'under' ? 'Under' : 'Over'})</span>
          </div>
        </div>
        {formData.failure_description && (
          <div><h4 className="font-bold text-sm border-b border-blue-600 pb-1">Failure Description</h4>
          <p className="text-sm mt-1 whitespace-pre-wrap">{formData.failure_description}</p></div>
        )}
        {formData.inspection_fixed && (
          <div><h4 className="font-bold text-sm border-b border-blue-600 pb-1">Inspection & Fixed</h4>
          <p className="text-sm mt-1 whitespace-pre-wrap">{formData.inspection_fixed}</p></div>
        )}
        {formData.actions_taken && <p className="text-sm">Actions Taken: <b>{formData.actions_taken}</b></p>}
        <div>
          <h4 className="font-bold text-sm border-b border-blue-600 pb-1">Parts</h4>
          <table className="w-full text-xs border-collapse mt-1">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">No</th>
                <th className="border px-2 py-1 text-left">Parts</th>
                <th className="border px-2 py-1 text-left">Descriptions</th>
                <th className="border px-2 py-1">Unit Price</th>
                <th className="border px-2 py-1">Qty</th>
                <th className="border px-2 py-1">Amount(Kyat)</th>
              </tr>
            </thead>
            <tbody>
              {(formData.parts || []).filter(p => p.name || p.description).map((p, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1 text-center">{i + 1}</td>
                  <td className="border px-2 py-1">{p.name}</td>
                  <td className="border px-2 py-1">{p.description}</td>
                  <td className="border px-2 py-1 text-center">{p.unit_price}</td>
                  <td className="border px-2 py-1 text-center">{p.qty}</td>
                  <td className="border px-2 py-1 text-center">{p.amount}</td>
                </tr>
              ))}
              {(!formData.parts || formData.parts.every(p => !p.name && !p.description)) && (
                <tr><td colSpan={6} className="border px-2 py-2 text-center text-gray-400">No parts entered</td></tr>
              )}
            </tbody>
          </table>
          <div className="grid grid-cols-3 gap-3 text-sm mt-1">
            <span>Total: <b>{formData.parts_total}</b></span>
            <span>FOC: <b>{formData.parts_foc}</b></span>
            <span>Net: <b>{formData.parts_net}</b></span>
          </div>
        </div>
        <div>
          <h4 className="font-bold text-sm border-b border-blue-600 pb-1">Fee Charges</h4>
          <table className="w-full text-xs border-collapse mt-1">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">No</th>
                <th className="border px-2 py-1 text-left">Fees</th>
                <th className="border px-2 py-1 text-left">Descriptions</th>
                <th className="border px-2 py-1">Per Day</th>
                <th className="border px-2 py-1">Days</th>
                <th className="border px-2 py-1">Amount(Kyat)</th>
              </tr>
            </thead>
            <tbody>
              {(formData.fees || []).filter(f => f.amount || f.per_day).map((f, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1 text-center">{i + 1}</td>
                  <td className="border px-2 py-1">{['Service', 'Transportation', 'Meal', 'Accommodation', 'Other'][i]} Fees</td>
                  <td className="border px-2 py-1">{f.description}</td>
                  <td className="border px-2 py-1 text-center">{f.per_day}</td>
                  <td className="border px-2 py-1 text-center">{f.days}</td>
                  <td className="border px-2 py-1 text-center">{f.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-3 gap-3 text-sm mt-1">
            <span>Total: <b>{formData.fee_total}</b></span>
            <span>FOC: <b>{formData.fee_foc}</b></span>
            <span>Net: <b>{formData.fee_net}</b></span>
          </div>
          <div className="text-sm mt-1 space-y-1">
            <p>Grand Total: <b>{formData.grand_total} Kyat</b></p>
            <p>By Word: <b>{formData.grand_total_word}</b></p>
          </div>
        </div>
        <p className="text-sm">Environmental Condition: <b>{formData.env_condition || '____'}</b></p>
        <div className="border-t pt-4 grid grid-cols-2 gap-8 text-sm mt-4">
          <div><p className="font-semibold">Authorized Engineer</p><p className="mt-4">Signature: _______________</p></div>
          <div><p className="font-semibold">Customer/In Charge</p><p className="mt-4">Signature: _______________</p></div>
        </div>
      </div>
    );
  }
  return null;
}
