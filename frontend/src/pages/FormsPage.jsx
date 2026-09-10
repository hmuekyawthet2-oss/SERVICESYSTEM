import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { exportApi, machinesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FileText, CheckCircle, Printer, Download, ArrowLeft, ArrowRight, Search, ChevronDown } from 'lucide-react';

const FORM_TYPES = [
  { key: 'installation', label: 'Installation & Commissioning Report', docNo: 'EG-RE-ME-001-00' },
  { key: 'maintenance', label: 'Maintenance Report', docNo: 'EG-RE-ME-003-00' },
  { key: 'field-service', label: 'Field Service Report', docNo: 'EG-RE-ME-002-00' },
];

const initialFormData = {
  installation: {
    customer_name: '', hospital: '', address: '', township: '', phone: '', email: '',
    equipment: '', model: '', serial_no: '', installation_date: '',
    install_start: '', install_finish: '', working_time: '', warranty: 'under',
    parts: Array(9).fill({ item: '', qty: '', operative: '', non_operative: '', remarks: '' }),
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
    parts: Array(5).fill({ name: '', description: '', unit_price: '', qty: '', amount: '' }),
    parts_total: '', parts_foc: '', parts_net: '',
    fees: Array(5).fill({ description: '', per_day: '', days: '', amount: '' }),
    fee_total: '', fee_foc: '', fee_net: '', grand_total: '', grand_total_word: '',
    env_condition: '',
  },
};

export default function FormsPage() {
  const { hasPermission } = useAuth();
  const [formType, setFormType] = useState('');
  const [step, setStep] = useState(0); // 0=select, 1=fill, 2=review, 3=done
  const [formData, setFormData] = useState({});
  const [machineSearch, setMachineSearch] = useState('');
  const [machineResults, setMachineResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const canExport = hasPermission('service_tickets', 'create');

  const setField = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const searchMachine = async () => {
    if (!machineSearch.trim()) return;
    try {
      const res = await machinesApi.list({ search: machineSearch, limit: 5 });
      setMachineResults(res.data);
    } catch { toast.error('Search failed'); }
  };

  const fillFromMachine = (m) => {
    setFormData(prev => ({
      ...prev,
      customer_name: prev.customer_name || '',
      hospital: m.hospital_name || '',
      address: '',
      township: m.township_name || '',
      phone: m.contact_phone || '',
      equipment: m.machine_type_name || '',
      model: m.model || '',
      serial_no: m.serial_number || '',
      installation_date: m.installation_date ? new Date(m.installation_date).toLocaleDateString('en-GB') : '',
    }));
    setMachineResults([]);
    setMachineSearch('');
    toast.success('Machine data filled');
  };

  const startForm = (type) => {
    setFormType(type);
    setFormData({ ...initialFormData[type] });
    setStep(1);
  };

  const handleConfirm = () => {
    setStep(2);
    toast('Review your form carefully before exporting', { icon: '👁️' });
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

  const handlePrint = () => {
    window.print();
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
    <div className="max-w-4xl mx-auto">
      {/* Step Indicator */}
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

      {/* STEP 0: Select Form Type */}
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

      {/* STEP 1: Fill Form */}
      {step === 1 && (
        <div>
          <button onClick={() => setStep(0)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft size={16} /> Back to form selection
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {FORM_TYPES.find(f => f.key === formType)?.label}
          </h1>

          {/* Machine search */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-blue-800 mb-2">Quick Fill from Machine Registry</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={machineSearch} onChange={e => setMachineSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchMachine()}
                  placeholder="Search by serial number or hospital..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <button onClick={searchMachine} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Search</button>
            </div>
            {machineResults.length > 0 && (
              <div className="mt-2 bg-white border border-blue-100 rounded-lg divide-y">
                {machineResults.map(m => (
                  <button key={m.id} onClick={() => fillFromMachine(m)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex justify-between">
                    <span className="font-medium">{m.serial_number} - {m.hospital_name}</span>
                    <span className="text-gray-400">{m.brand_name} {m.model}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Form fields */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <FormFields formType={formType} formData={formData} setField={setField} />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setStep(0)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={handleConfirm} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <CheckCircle size={16} /> 1st Confirm - Review
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Review */}
      {step === 2 && (
        <div>
          <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft size={16} /> Back to editing
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Review Form</h1>
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4">
            Please review all details carefully. Once you click the final confirm, the PDF will be generated.
          </p>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <FormReview formType={formType} formData={formData} />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Edit Again</button>
            <button onClick={handleFinalConfirm} disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
              <Download size={16} /> {loading ? 'Generating...' : '2nd Confirm - Export PDF'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Done */}
      {step === 3 && (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">PDF Generated Successfully!</h2>
          <p className="text-sm text-gray-500 mb-6">Your form has been downloaded as a PDF file.</p>
          <div className="flex justify-center gap-3">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              <Printer size={16} /> Print
            </button>
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
// FORM FIELDS COMPONENT
// ═══════════════════════════════════════════════════════════════
function FormFields({ formType, formData, setField }) {
  const Field = ({ label, field, type = 'text', options, rows }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {type === 'select' ? (
        <select value={formData[field] || ''} onChange={e => setField(field, e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="">Select...</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={formData[field] || ''} onChange={e => setField(field, e.target.value)}
          rows={rows || 3} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
      ) : type === 'checkbox' ? (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!formData[field]} onChange={e => setField(field, e.target.checked)}
            className="w-4 h-4 rounded border-gray-300" />
          <span className="text-sm text-gray-600">Yes</span>
        </label>
      ) : (
        <input type={type} value={formData[field] || ''} onChange={e => setField(field, e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      )}
    </div>
  );

  const Section = ({ title, children }) => (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1 mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );

  if (formType === 'installation') {
    return (
      <div className="space-y-6">
        <Section title="Customer Information">
          <Field label="Customer's Name" field="customer_name" />
          <Field label="Department/Hospital" field="hospital" />
          <Field label="Address" field="address" />
          <Field label="Township" field="township" />
          <Field label="Phone Number" field="phone" />
          <Field label="Email" field="email" />
        </Section>
        <Section title="Equipment Information">
          <Field label="Equipment" field="equipment" />
          <Field label="Model" field="model" />
          <Field label="Serial No" field="serial_no" />
          <Field label="Installation Date" field="installation_date" />
          <Field label="Installation Start Date/Time" field="install_start" />
          <Field label="Installation Finished Date/Time" field="install_finish" />
          <Field label="Working Day/Time" field="working_time" />
          <Field label="Warranty" field="warranty" type="select" options={['under', 'over']} />
        </Section>
        <Section title="Installation Parts">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="col-span-2 grid grid-cols-5 gap-2 text-xs">
              <input placeholder="Item" value={formData.parts?.[i]?.item || ''} onChange={e => { const p = [...(formData.parts || [])]; p[i] = { ...p[i], item: e.target.value }; setField('parts', p); }}
                className="px-2 py-1 border rounded" />
              <input placeholder="Qty" value={formData.parts?.[i]?.qty || ''} onChange={e => { const p = [...(formData.parts || [])]; p[i] = { ...p[i], qty: e.target.value }; setField('parts', p); }}
                className="px-2 py-1 border rounded" />
              <input placeholder="Operative" value={formData.parts?.[i]?.operative || ''} onChange={e => { const p = [...(formData.parts || [])]; p[i] = { ...p[i], operative: e.target.value }; setField('parts', p); }}
                className="px-2 py-1 border rounded" />
              <input placeholder="Non-Op" value={formData.parts?.[i]?.non_operative || ''} onChange={e => { const p = [...(formData.parts || [])]; p[i] = { ...p[i], non_operative: e.target.value }; setField('parts', p); }}
                className="px-2 py-1 border rounded" />
              <input placeholder="Remarks" value={formData.parts?.[i]?.remarks || ''} onChange={e => { const p = [...(formData.parts || [])]; p[i] = { ...p[i], remarks: e.target.value }; setField('parts', p); }}
                className="px-2 py-1 border rounded" />
            </div>
          ))}
        </Section>
        <Section title="Report">
          <Field label="Parts Condition" field="parts_condition" type="select" options={['Good', 'Fair', 'Poor']} />
          <Field label="Installation Condition" field="install_condition" type="select" options={['Good', 'Fair', 'Poor']} />
          <Field label="Operation Condition" field="operation_condition" type="select" options={['Good', 'Fair', 'Poor']} />
          <Field label="Installation Complete Date" field="install_complete_date" />
          <Field label="Test Running Date" field="test_running_date" />
          <Field label="User Training Complete" field="training_complete" type="checkbox" />
        </Section>
        <Section title="Warranty & Remark">
          <Field label="Commission Date" field="commission_date" />
          <Field label="Warranty From" field="warranty_from" />
          <Field label="Warranty To" field="warranty_to" />
          <Field label="Remark" field="remark" type="textarea" />
        </Section>
      </div>
    );
  }

  if (formType === 'maintenance') {
    return (
      <div className="space-y-6">
        <Section title="Customer Information">
          <Field label="Customer's Name" field="customer_name" />
          <Field label="Department/Hospital" field="hospital" />
          <Field label="Address" field="address" />
          <Field label="Township" field="township" />
          <Field label="Phone Number" field="phone" />
          <Field label="Email" field="email" />
          <Field label="Install Date" field="install_date" />
          <Field label="Report Date" field="report_date" />
        </Section>
        <Section title="Equipment Information">
          <Field label="Equipment" field="equipment" />
          <Field label="Model" field="model" />
          <Field label="Serial No" field="serial_no" />
        </Section>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Report / Action Taken</label>
          <textarea value={formData.report_action || ''} onChange={e => setField('report_action', e.target.value)}
            rows={5} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
        </div>
        <Section title="Checking Up">
          <Field label="1. Parts Condition" field="check_parts" />
          <Field label="5. General Service" field="check_general" />
          <Field label="2. Machine Condition" field="check_machine" />
          <Field label="6. Calibration Condition" field="check_calibration" />
          <Field label="3. Operation Condition" field="check_operation" />
          <Field label="7. Testing Condition" field="check_testing" />
          <Field label="4. Service Condition" field="check_service" />
          <Field label="8. Repair / Breakdown" field="check_repair" />
        </Section>
        <Section title="Conditions">
          <Field label="General Machine Condition" field="general_condition" type="select" options={['good', 'fair', 'fail']} />
          <Field label="Environment Condition" field="environment_condition" type="select" options={['good', 'fair', 'poor']} />
          <Field label="Service Start Date" field="service_start" />
          <Field label="Service Complete Date" field="service_complete" />
          <Field label="Human Error" field="human_error" type="select" options={['Yes', 'No']} />
          <Field label="Test Running Date" field="test_running" />
          <Field label="Test Complete" field="test_complete" type="checkbox" />
        </Section>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Additional Remark</label>
          <textarea value={formData.additional_remark || ''} onChange={e => setField('additional_remark', e.target.value)}
            rows={3} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
        </div>
      </div>
    );
  }

  if (formType === 'field-service') {
    return (
      <div className="space-y-6">
        <Section title="Customer Information">
          <Field label="Customer's Name" field="customer_name" />
          <Field label="Department/Hospital" field="hospital" />
          <Field label="Address" field="address" />
          <Field label="Township" field="township" />
          <Field label="Phone Number" field="phone" />
          <Field label="Email" field="email" />
        </Section>
        <Section title="Equipment Information">
          <Field label="Equipment" field="equipment" />
          <Field label="Model" field="model" />
          <Field label="Serial No" field="serial_no" />
          <Field label="Installation Date" field="installation_date" />
          <Field label="Service Start Date/Time" field="service_start" />
          <Field label="Service Finished Date/Time" field="service_finish" />
          <Field label="Working Day/Time" field="working_time" />
          <Field label="Warranty" field="warranty" type="select" options={['under', 'over']} />
        </Section>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Failure Description</label>
          <textarea value={formData.failure_description || ''} onChange={e => setField('failure_description', e.target.value)}
            rows={3} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Inspection & Fixed</label>
          <textarea value={formData.inspection_fixed || ''} onChange={e => setField('inspection_fixed', e.target.value)}
            rows={3} className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
        </div>
        <Section title="Actions Taken">
          <div className="col-span-2 flex gap-4">
            {['maintained', 'reconditioned', 'replace', 'repair'].map(a => (
              <label key={a} className="flex items-center gap-1">
                <input type="checkbox" checked={(formData.actions_taken || '').includes(a)}
                  onChange={e => {
                    const current = formData.actions_taken || '';
                    setField('actions_taken', e.target.checked ? `${current} ${a}`.trim() : current.replace(a, '').trim());
                  }} className="w-4 h-4" />
                <span className="text-sm capitalize">{a}</span>
              </label>
            ))}
          </div>
        </Section>
        <Section title="Parts">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="col-span-2 grid grid-cols-4 gap-2 text-xs">
              <input placeholder="Part" value={formData.parts?.[i]?.name || ''} onChange={e => { const p = [...(formData.parts || [])]; p[i] = { ...p[i], name: e.target.value }; setField('parts', p); }}
                className="px-2 py-1 border rounded" />
              <input placeholder="Description" value={formData.parts?.[i]?.description || ''} onChange={e => { const p = [...(formData.parts || [])]; p[i] = { ...p[i], description: e.target.value }; setField('parts', p); }}
                className="px-2 py-1 border rounded" />
              <input placeholder="Unit Price" value={formData.parts?.[i]?.unit_price || ''} onChange={e => { const p = [...(formData.parts || [])]; p[i] = { ...p[i], unit_price: e.target.value }; setField('parts', p); }}
                className="px-2 py-1 border rounded" />
              <input placeholder="Qty" value={formData.parts?.[i]?.qty || ''} onChange={e => { const p = [...(formData.parts || [])]; p[i] = { ...p[i], qty: e.target.value }; setField('parts', p); }}
                className="px-2 py-1 border rounded" />
            </div>
          ))}
          <Section title="Parts Totals">
            <Field label="Total (Kyat)" field="parts_total" />
            <Field label="FOC (Kyat)" field="parts_foc" />
            <Field label="Net (Kyat)" field="parts_net" />
          </Section>
        </Section>
        <Section title="Fee Charges">
          {['Service', 'Transportation', 'Meal', 'Accommodation', 'Other'].map((label, i) => (
            <div key={i} className="col-span-2 grid grid-cols-4 gap-2 text-xs">
              <span className="py-1 text-gray-600">{label}</span>
              <input placeholder="Per day" value={formData.fees?.[i]?.per_day || ''} onChange={e => { const f = [...(formData.fees || [])]; f[i] = { ...f[i], per_day: e.target.value }; setField('fees', f); }}
                className="px-2 py-1 border rounded" />
              <input placeholder="Days" value={formData.fees?.[i]?.days || ''} onChange={e => { const f = [...(formData.fees || [])]; f[i] = { ...f[i], days: e.target.value }; setField('fees', f); }}
                className="px-2 py-1 border rounded" />
              <input placeholder="Amount" value={formData.fees?.[i]?.amount || ''} onChange={e => { const f = [...(formData.fees || [])]; f[i] = { ...f[i], amount: e.target.value }; setField('fees', f); }}
                className="px-2 py-1 border rounded" />
            </div>
          ))}
          <Section title="Fee Totals">
            <Field label="Total (Kyat)" field="fee_total" />
            <Field label="FOC (Kyat)" field="fee_foc" />
            <Field label="Net (Kyat)" field="fee_net" />
            <Field label="Grand Total (Kyat)" field="grand_total" />
            <Field label="Grand Total by Word" field="grand_total_word" />
          </Section>
        </Section>
        <Section title="Environment">
          <Field label="Environmental Condition" field="env_condition" type="select" options={['good', 'fair', 'poor']} />
        </Section>
      </div>
    );
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// FORM REVIEW COMPONENT
// ═══════════════════════════════════════════════════════════════
function FormReview({ formType, formData }) {
  const sections = Object.entries(formData).filter(([k, v]) => {
    if (k === 'parts' || k === 'fees') return true;
    return v !== '' && v !== false && v !== null && v !== undefined;
  });

  return (
    <div className="space-y-3">
      {sections.map(([key, value]) => {
        if (key === 'parts' && Array.isArray(value)) {
          const filledParts = value.filter(p => p.item || p.name || p.description);
          if (filledParts.length === 0) return null;
          return (
            <div key={key}>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Parts</h4>
              {filledParts.map((p, i) => (
                <div key={i} className="text-sm text-gray-700 ml-2">
                  {i + 1}. {p.item || p.name} {p.description ? `- ${p.description}` : ''} {p.qty ? `x${p.qty}` : ''} {p.amount ? `= ${p.amount} Ks` : ''}
                </div>
              ))}
            </div>
          );
        }
        if (key === 'fees' && Array.isArray(value)) {
          const filledFees = value.filter(f => f.amount || f.per_day);
          if (filledFees.length === 0) return null;
          return (
            <div key={key}>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Fee Charges</h4>
              {filledFees.map((f, i) => (
                <div key={i} className="text-sm text-gray-700 ml-2">
                  Fee {i + 1}: {f.per_day}/day x {f.days} days = {f.amount} Ks
                </div>
              ))}
            </div>
          );
        }
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const displayVal = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
        return (
          <div key={key} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
            <span className="text-xs font-medium text-gray-500">{label}</span>
            <span className="text-sm text-gray-800 text-right max-w-[60%]">{displayVal}</span>
          </div>
        );
      })}
    </div>
  );
}
