import React, { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { exportApi, machinesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FileText, CheckCircle, Download, ArrowLeft, ArrowRight, Search, X, Printer, FileDown } from 'lucide-react';

const FORM_TYPES = [
  { key: 'installation', label: 'Installation & Commissioning Report', docNo: 'EG-RE-ME-001-00' },
  { key: 'maintenance', label: 'Maintenance Report', docNo: 'EG-RE-ME-003-00' },
  { key: 'field-service', label: 'Field Service Report', docNo: 'EG-RE-ME-002-00' },
];

const newPart = () => ({ item: '', qty: '', operative: '', non_operative: '', remarks: '', name: '', description: '', unit_price: '', amount: '' });
const newFee = () => ({ description: '', per_day: '', days: '', amount: '' });

const init = {
  installation: {
    customer_name: '', hospital: '', address: '', township: '', phone: '', email: '',
    equipment: '', model: '', serial_no: '', installation_date: '',
    install_start: '', install_finish: '', working_time: '', warranty: 'under',
    parts: Array.from({ length: 9 }, newPart),
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
    parts: Array.from({ length: 5 }, newPart),
    parts_total: '', parts_foc: '', parts_net: '',
    fees: Array.from({ length: 5 }, newFee),
    fee_total: '', fee_foc: '', fee_net: '', grand_total: '', grand_total_word: '',
    env_condition: '',
  },
};

const COMPANY = {
  name: 'EVER GLORY COMPANY LIMITED',
  addr1: 'Office No. 1301, Corner of Shu Khin Thar Mayopat Road and Aung Tha Khu Street,',
  addr2: '6th Ward, Thaketa Township, Yangon, Myanmar.',
  tel: 'Tel: +95 9 420 039 009, +95 9 253 006 633 ~ 44',
  email: 'E-mail: info@everglory.com.mm',
  web: 'Website: www.everglory.com.mm',
  hotline: 'Service Hotline: 09 253333466, 09 751669848',
  footer: 'Copyright documents to Engineer Department and administration office of Ever Glory Co.,ltd.',
};

function useMachineSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    try { const res = await machinesApi.list({ search: q, limit: 8 }); setResults(res.data || []); setOpen(true); } catch { setResults([]); }
  }, []);
  const onChange = useCallback((val) => {
    setQuery(val); clearTimeout(timer.current); timer.current = setTimeout(() => search(val), 300);
  }, [search]);
  return { query, setQuery, results, open, setOpen, onChange };
}

export default function FormsPage() {
  const { hasPermission } = useAuth();
  const [formType, setFormType] = useState('');
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const ms = useMachineSearch();

  const canExport = hasPermission('service_tickets', 'create');
  const setField = useCallback((k, v) => setFormData(p => ({ ...p, [k]: v })), []);
  const setPart = useCallback((i, k, v) => setFormData(p => {
    const parts = [...(p.parts || [])]; parts[i] = { ...parts[i], [k]: v }; return { ...p, parts };
  }), []);
  const setFee = useCallback((i, k, v) => setFormData(p => {
    const fees = [...(p.fees || [])]; fees[i] = { ...fees[i], [k]: v }; return { ...p, fees };
  }), []);

  const fillMachine = (m) => {
    setFormData(p => ({
      ...p, hospital: m.hospital_name || '', address: m.address || '', township: m.township_name || '',
      phone: m.contact_phone || '', email: m.contact_email || '',
      equipment: m.machine_type_name || m.type_name || '', model: m.model_name || m.model || '',
      serial_no: m.serial_number || '',
      installation_date: m.installation_date ? new Date(m.installation_date).toLocaleDateString('en-GB') : '',
    }));
    ms.setQuery(m.serial_number || ''); ms.setOpen(false); toast.success('Auto-filled');
  };

  const startForm = (t) => { setFormType(t); setFormData(JSON.parse(JSON.stringify(init[t]))); setStep(1); };

  const handleFinalConfirm = async () => {
    setLoading(true);
    try { await exportApi.formPdf(formType, formData); toast.success('PDF downloaded!'); setStep(3); }
    catch (err) { toast.error(err.message || 'PDF failed'); }
    finally { setLoading(false); }
  };

  const handlePrint = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/forms/${formType}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => { printWindow.print(); };
      } else {
        toast.error('Pop-up blocked. Please allow pop-ups for this site.');
      }
    } catch (err) {
      toast.error(err.message || 'Print failed');
    }
  };

  if (!canExport) return <div className="max-w-4xl mx-auto py-12 text-center"><FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" /><h2 className="text-lg font-semibold text-gray-600">Access Denied</h2></div>;

  return (
    <div className="max-w-5xl mx-auto">
      {step > 0 && (
        <div className="flex items-center gap-2 mb-6 text-sm">
          {['Select', 'Fill', 'Review', 'Done'].map((l, i) => (
            <React.Fragment key={l}>
              {i > 0 && <div className={`h-px flex-1 ${i <= step ? 'bg-blue-500' : 'bg-gray-200'}`} />}
              <div className={`flex items-center gap-1 ${i <= step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${i < step ? 'bg-blue-600 text-white' : i === step ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500' : 'bg-gray-100 text-gray-400'}`}>{i < step ? <CheckCircle size={14} /> : i + 1}</div>
                <span className="hidden sm:inline">{l}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {step === 0 && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Service Forms</h1>
          <p className="text-sm text-gray-500 mb-6">Select a form type to generate a PDF report, or download a blank form to fill manually</p>
          <div className="grid gap-4 mb-8">
            {FORM_TYPES.map(f => (
              <button key={f.key} onClick={() => startForm(f.key)} className="flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left group">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition"><FileText className="w-6 h-6 text-blue-600" /></div>
                <div className="flex-1"><h3 className="font-semibold text-gray-900">{f.label}</h3><p className="text-xs text-gray-400">Doc No: {f.docNo}</p></div>
                <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition" />
              </button>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-1">Download Blank Forms</h2>
            <p className="text-xs text-gray-400 mb-4">Download empty form templates to fill manually (print or write)</p>
            <div className="grid gap-3">
              {FORM_TYPES.map(f => (
                <button key={f.key} onClick={async () => {
                  try { await exportApi.blankFormPdf(f.key); toast.success(`Blank ${f.label} downloaded!`); }
                  catch (err) { toast.error(err.message || 'Download failed'); }
                }} className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-all text-left group">
                  <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center group-hover:bg-green-50 transition"><FileDown className="w-5 h-5 text-gray-500 group-hover:text-green-600" /></div>
                  <div className="flex-1"><h3 className="text-sm font-medium text-gray-700">{f.label}</h3><p className="text-xs text-gray-400">Blank template — {f.docNo}</p></div>
                  <Download className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <button onClick={() => setStep(0)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"><ArrowLeft size={16} /> Back</button>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{FORM_TYPES.find(f => f.key === formType)?.label}</h1>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 relative">
            <p className="text-sm font-medium text-blue-800 mb-2">Quick Fill from Machine Registry</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={ms.query} onChange={e => ms.onChange(e.target.value)} onFocus={() => ms.results.length > 0 && ms.setOpen(true)} placeholder="Type to search by serial number, hospital, or model..." className="w-full pl-9 pr-8 py-2 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              {ms.query && <button onClick={() => { ms.setQuery(''); ms.setResults([]); ms.setOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
            </div>
            {ms.open && ms.results.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-blue-100 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                {ms.results.map(m => (
                  <button key={m.id} onClick={() => fillMachine(m)} className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex justify-between border-b border-gray-50 last:border-0">
                    <span className="font-medium">{m.serial_number} — {m.hospital_name}</span>
                    <span className="text-gray-400">{m.brand_name} {m.model_name || m.model}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <FormFields formType={formType} formData={formData} setField={setField} setPart={setPart} setFee={setFee} />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setStep(0)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"><CheckCircle size={16} /> 1st Confirm — Review</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"><ArrowLeft size={16} /> Back to editing</button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Review — Preview Before Export</h1>
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4">This preview shows exactly how the PDF will look.</p>
          <div className="bg-white border border-gray-300 rounded shadow-sm p-2">
            <div className="border border-gray-200 p-8 max-w-[210mm] mx-auto bg-white" style={{ fontFamily: 'Times New Roman, Times, serif', fontSize: '11px', lineHeight: '1.4', color: '#000' }}>
              <FormReview formType={formType} formData={formData} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Edit Again</button>
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"><Printer size={16} /> Print</button>
            <button onClick={handleFinalConfirm} disabled={loading} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"><Download size={16} /> {loading ? 'Generating...' : '2nd Confirm — Export PDF'}</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">PDF Generated Successfully!</h2>
          <p className="text-sm text-gray-500 mb-6">Choose what to do next</p>
          <div className="flex justify-center gap-3 flex-wrap">
            <button onClick={handleFinalConfirm} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
              <Download size={16} /> Download PDF Again
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Printer size={16} /> Print PDF
            </button>
            <button onClick={() => { setStep(0); setFormType(''); setFormData({}); }} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
              <FileText size={16} /> Create Another Form
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PDF Header (reused in review)
// ═══════════════════════════════════════════════════════════════
function PdfHeader({ docNo }) {
  return (
    <div style={{ position: 'relative', borderBottom: '2px solid #000', paddingBottom: '6px', marginBottom: '6px' }}>
      <div style={{ position: 'absolute', left: 0, top: 0 }}>
        <img src="/hand.png" alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '15px', fontWeight: 'bold', letterSpacing: '1px', color: '#cc0000' }}>{COMPANY.name}</div>
        <div style={{ fontSize: '8px', color: '#333', lineHeight: '1.3' }}>{COMPANY.addr1}</div>
        <div style={{ fontSize: '8px', color: '#333', lineHeight: '1.3' }}>{COMPANY.addr2}</div>
        <div style={{ fontSize: '8px', color: '#333', lineHeight: '1.3' }}>{COMPANY.tel}</div>
        <div style={{ fontSize: '8px', color: '#333', lineHeight: '1.3' }}>{COMPANY.email} &nbsp;&nbsp; {COMPANY.web}</div>
      </div>
    </div>
  );
}

function PdfDocLine({ docNo, title }) {
  return (
    <div style={{ fontSize: '8px', color: '#666', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
      <span>Document No: {docNo}</span>
      <span style={{ color: '#cc0000', fontWeight: 'bold' }}>{COMPANY.hotline}</span>
      <span>Page 1 of 1</span>
    </div>
  );
}

// Field layout matching PDF: bold label + value + underline
function FRow({ left, right }) {
  return (
    <div style={{ display: 'flex', gap: '16px', marginBottom: '2px' }}>
      {left && <div style={{ flex: 1 }}><FField {...left} /></div>}
      {right && <div style={{ flex: 1 }}><FField {...right} /></div>}
      {!right && <div style={{ flex: 1 }} />}
    </div>
  );
}

function FField({ label, value }) {
  return (
    <div style={{ fontSize: '10px', lineHeight: '1.6' }}>
      <span style={{ fontWeight: 'bold' }}>{label} </span>
      <span style={{ borderBottom: '1px solid #999', display: 'inline-block', minWidth: '80px' }}>{value || ''}</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#1a5276', borderBottom: '1px solid #1a5276', paddingBottom: '2px', marginTop: '10px', marginBottom: '4px' }}>
      {children}
    </div>
  );
}

function PdfTable({ headers, rows, colWidths }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginBottom: '6px' }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} style={{ background: '#1a5276', color: '#fff', border: '1px solid #1a5276', padding: '3px 4px', textAlign: 'left', width: colWidths?.[i], fontWeight: 'bold', fontSize: '8px' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => (
              <td key={ci} style={{ border: '1px solid #999', padding: '3px 4px', minHeight: '16px' }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SignatureBlock() {
  return (
    <div style={{ borderTop: '1px solid #000', paddingTop: '10px', marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', fontSize: '10px' }}>
      <div>
        <div style={{ fontWeight: 'bold' }}>Authorized Engineer</div>
        <div style={{ marginTop: '24px' }}>Signature: _______________</div>
      </div>
      <div>
        <div style={{ fontWeight: 'bold' }}>Customer/ In Charge</div>
        <div style={{ marginTop: '24px' }}>Signature: _______________</div>
      </div>
    </div>
  );
}

function PdfFooter() {
  return <div style={{ fontSize: '7px', color: '#666', fontStyle: 'italic', textAlign: 'center', marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '4px' }}>{COMPANY.footer}</div>;
}

// ═══════════════════════════════════════════════════════════════
// REVIEW: INSTALLATION
// ═══════════════════════════════════════════════════════════════
function ReviewInstallation({ d }) {
  const fmt = v => { if (!v) return ''; try { return new Date(v).toLocaleDateString('en-GB'); } catch { return v; } };
  return (
    <div>
      <PdfHeader />
      <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 'bold', margin: '8px 0' }}>Installation and Commissioning Report</div>
      <PdfDocLine docNo="EG-RE-ME-001-00" />
      <FRow left={{ label: "Customer's Name:", value: d.customer_name }} right={{ label: 'Department/Hospital:', value: d.hospital }} />
      <FRow left={{ label: 'Address:', value: d.address }} right={{ label: 'Township:', value: d.township }} />
      <FRow left={{ label: 'Ph No:', value: d.phone }} right={{ label: 'Email:', value: d.email }} />
      <FRow left={{ label: 'Equipment:', value: d.equipment }} right={{ label: 'Installation Start Date:', value: d.install_start }} />
      <FRow left={{ label: 'Model:', value: d.model }} right={{ label: 'Installation Finished Date:', value: d.install_finish }} />
      <FRow left={{ label: 'Serial No:', value: d.serial_no }} right={{ label: 'Working Day/Time:', value: d.working_time }} />
      <FRow left={{ label: 'Installation Date:', value: fmt(d.installation_date) }} right={{ label: 'Warranty:', value: d.warranty === 'under' ? '( Under )' : '( Over )' }} />

      <SectionTitle>Installation Parts and Supplies</SectionTitle>
      <PdfTable headers={['No', 'Item List', 'Qty', 'OPERATIVE', 'NON OPERATIVE', 'REMARKS']} colWidths={['24px', null, '40px', '70px', '80px', '70px']}
        rows={(d.parts || []).filter(p => p.item).map((p, i) => [i + 1, p.item, p.qty, p.operative, p.non_operative, p.remarks])}
      />

      <SectionTitle>Report</SectionTitle>
      <div style={{ fontSize: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
          <div>1 &nbsp; Parts Condition &nbsp;&nbsp;&nbsp; ( {d.parts_condition || '   '} )</div>
          <div>Installation Complete Date: &nbsp; {fmt(d.install_complete_date) || '____/____/2026'}</div>
          <div>2 &nbsp; Installation Condition &nbsp;&nbsp; ( {d.install_condition || '   '} )</div>
          <div>Test Running Date: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {fmt(d.test_running_date) || '____/____/2026'}</div>
          <div>3 &nbsp; Operation Condition &nbsp;&nbsp;&nbsp;&nbsp; ( {d.operation_condition || '   '} )</div>
          <div>User Training for respective person: &nbsp; [ {d.training_complete ? 'X' : ' '} ] Complete</div>
        </div>
      </div>

      <div style={{ fontSize: '9px', fontStyle: 'italic', marginTop: '10px' }}>Warranty Exclusions</div>
      <div style={{ fontSize: '8px', marginTop: '4px', lineHeight: '1.5' }}>
        <div>The distributor shall not be responsible on the following factors:</div>
        <div style={{ paddingLeft: '10px' }}>I. &nbsp;Natural Disaster.</div>
        <div style={{ paddingLeft: '10px' }}>II. &nbsp;Any defect due to unspecified connection/environment such as Unstable Power Supply, Commercial or</div>
        <div style={{ paddingLeft: '20px' }}>Generator Failure without protection and End User's Fault, Humidity and Air Conditioning shortage etc.</div>
        <div style={{ paddingLeft: '10px' }}>III. Failure caused by customized modification beyond the Manufacturer's Recommendation.</div>
        <div style={{ paddingLeft: '10px' }}>IV. &nbsp;Any consumable parts like Lamp, pneumatic tubing, Mechanical Belt, Chassis Cover, Cuvettes etc.</div>
      </div>

      <div style={{ fontSize: '9px', marginTop: '8px', lineHeight: '1.5' }}>
        The above equipment has proven satisfactory in installation, operation, hand-on training and thus passed<br />
        Commission on date &nbsp;{fmt(d.commission_date) || '____/____/2026'}<br />
        Therefore, the Warranty Period shall be from &nbsp;{fmt(d.warranty_from) || '____/____/2026'} &nbsp;to &nbsp;{fmt(d.warranty_to) || '____/____/2027'}.
      </div>

      <div style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '10px' }}>Remark:</div>
      <div style={{ fontSize: '9px', minHeight: '30px', borderBottom: '1px solid #999', marginBottom: '4px' }}>{d.remark || ''}</div>

      <SignatureBlock />
      <PdfFooter />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REVIEW: MAINTENANCE
// ═══════════════════════════════════════════════════════════════
function ReviewMaintenance({ d }) {
  const fmt = v => { if (!v) return ''; try { return new Date(v).toLocaleDateString('en-GB'); } catch { return v; } };
  return (
    <div>
      <PdfHeader />
      <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 'bold', margin: '8px 0' }}>Maintenance Report</div>
      <PdfDocLine docNo="EG-RE-ME-003-00" />
      <FRow left={{ label: "Customer's Name:", value: d.customer_name }} right={{ label: 'Department/Hospital:', value: d.hospital }} />
      <FRow left={{ label: 'Address:', value: d.address }} right={{ label: 'Township:', value: d.township }} />
      <FRow left={{ label: 'Ph No:', value: d.phone }} right={{ label: 'Email:', value: d.email }} />
      <FRow left={{ label: 'Install Date:', value: fmt(d.install_date) }} right={{ label: 'Date:', value: fmt(d.report_date) }} />
      <FRow left={{ label: 'Equipment:', value: d.equipment }} />
      <FRow left={{ label: 'Model:', value: d.model }} />
      <FRow left={{ label: 'Serial No:', value: d.serial_no }} />

      <SectionTitle>REPORT / ACTION TAKEN</SectionTitle>
      <div style={{ fontSize: '9px', minHeight: '50px', borderBottom: '1px solid #999', padding: '4px', whiteSpace: 'pre-wrap' }}>{d.report_action || ''}</div>

      <SectionTitle>Checking Up</SectionTitle>
      <div style={{ fontSize: '9px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
        <div>1 &nbsp;Parts Condition</div><div>5 &nbsp;General Service</div>
        <div>2 &nbsp;Machine Condition</div><div>6 &nbsp;Calibration Condition</div>
        <div>3 &nbsp;Operation Condition</div><div>7 &nbsp;Testing Condition</div>
        <div>4 &nbsp;Service Condition</div><div>8 &nbsp;Repair / Breakdown</div>
      </div>

      <div style={{ fontSize: '9px', marginTop: '8px' }}>
        <div>General machine condition &nbsp;&nbsp; [ {d.general_condition === 'Good' ? 'X' : ' '} ] Good &nbsp; [ {d.general_condition === 'Fair' ? 'X' : ' '} ] Fair &nbsp; [ {d.general_condition === 'Fail' ? 'X' : ' '} ] Fail</div>
        <div>Environment Condition &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [ {d.environment_condition === 'Good' ? 'X' : ' '} ] Good &nbsp; [ {d.environment_condition === 'Fair' ? 'X' : ' '} ] Fair &nbsp; [ {d.environment_condition === 'Poor' ? 'X' : ' '} ] Poor</div>
      </div>

      <FRow left={{ label: 'Service Start Date:', value: fmt(d.service_start) }} right={{ label: 'Service Complete Date:', value: fmt(d.service_complete) }} />
      <FRow left={{ label: 'Human Error:', value: d.human_error }} right={{ label: 'Test Running Date:', value: fmt(d.test_running) }} />
      <div style={{ fontSize: '9px' }}>Test Complete: &nbsp;[ {d.test_complete ? 'X' : ' '} ]</div>

      <SectionTitle>ADDITIONAL REMARK</SectionTitle>
      <div style={{ fontSize: '9px', minHeight: '24px', borderBottom: '1px solid #999', padding: '4px' }}>{d.additional_remark || ''}</div>

      <SignatureBlock />
      <PdfFooter />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REVIEW: FIELD SERVICE
// ═══════════════════════════════════════════════════════════════
function ReviewFieldService({ d }) {
  const fmt = v => { if (!v) return ''; try { return new Date(v).toLocaleDateString('en-GB'); } catch { return v; } };
  return (
    <div>
      <PdfHeader />
      <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 'bold', margin: '8px 0' }}>Field Service Report</div>
      <PdfDocLine docNo="EG-RE-ME-002-00" />
      <FRow left={{ label: "Customer's Name:", value: d.customer_name }} right={{ label: 'Department/Hospital:', value: d.hospital }} />
      <FRow left={{ label: 'Address:', value: d.address }} right={{ label: 'Township:', value: d.township }} />
      <FRow left={{ label: 'Ph No:', value: d.phone }} right={{ label: 'Email:', value: d.email }} />
      <FRow left={{ label: 'Equipment:', value: d.equipment }} right={{ label: 'Service Start Date:', value: d.service_start }} />
      <FRow left={{ label: 'Model:', value: d.model }} right={{ label: 'Service Finished Date:', value: d.service_finish }} />
      <FRow left={{ label: 'Serial No:', value: d.serial_no }} right={{ label: 'Working Day/Time:', value: d.working_time }} />
      <FRow left={{ label: 'Installation Date:', value: fmt(d.installation_date) }} right={{ label: 'Warranty:', value: d.warranty === 'under' ? '( Under )' : '( Over )' }} />

      <SectionTitle>Failure Description</SectionTitle>
      <div style={{ fontSize: '9px', minHeight: '30px', borderBottom: '1px solid #999', padding: '4px', whiteSpace: 'pre-wrap' }}>{d.failure_description || ''}</div>

      <SectionTitle>Inspection & Fixed</SectionTitle>
      <div style={{ fontSize: '9px', minHeight: '30px', borderBottom: '1px solid #999', padding: '4px', whiteSpace: 'pre-wrap' }}>{d.inspection_fixed || ''}</div>

      <div style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '6px' }}>Action(s) Taken: &nbsp;
        <span style={{ fontWeight: 'normal' }}>
          [ {(d.actions_taken || '').toLowerCase().includes('maintained') ? 'X' : ' '} ] Maintained &nbsp;
          [ {(d.actions_taken || '').toLowerCase().includes('reconditioned') ? 'X' : ' '} ] Reconditioned &nbsp;
          [ {(d.actions_taken || '').toLowerCase().includes('replace') ? 'X' : ' '} ] Replace &nbsp;
          [ {(d.actions_taken || '').toLowerCase().includes('repair') ? 'X' : ' '} ] Repair
        </span>
      </div>

      <SectionTitle>PARTS</SectionTitle>
      <PdfTable headers={['No', 'Parts', 'Descriptions', 'Unit Price', 'Qty', 'Amount(Kyat)']} colWidths={['24px', null, null, '60px', '36px', '70px']}
        rows={(d.parts || []).filter(p => p.name || p.description).map((p, i) => [i + 1, p.name, p.description, p.unit_price, p.qty, p.amount])}
      />
      <div style={{ fontSize: '9px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginTop: '2px' }}>
        <div>Total (Kyat): <b>{d.parts_total}</b></div>
        <div>FOC (Kyat): <b>{d.parts_foc}</b></div>
        <div>Net (Kyat): <b>{d.parts_net}</b></div>
      </div>

      <SectionTitle>FEE CHARGES</SectionTitle>
      <PdfTable headers={['No', 'Fees', 'Descriptions', 'Per day fee', 'Days', 'Amount(Kyat)']} colWidths={['24px', null, null, '60px', '36px', '70px']}
        rows={[
          [1, 'Service Fees', d.fees?.[0]?.description || '', d.fees?.[0]?.per_day || '', d.fees?.[0]?.days || '', d.fees?.[0]?.amount || ''],
          [2, 'Transportation Fees', d.fees?.[1]?.description || '', d.fees?.[1]?.per_day || '', d.fees?.[1]?.days || '', d.fees?.[1]?.amount || ''],
          [3, 'Costs of meal', d.fees?.[2]?.description || '', d.fees?.[2]?.per_day || '', d.fees?.[2]?.days || '', d.fees?.[2]?.amount || ''],
          [4, 'Accommodation Fees', d.fees?.[3]?.description || '', d.fees?.[3]?.per_day || '', d.fees?.[3]?.days || '', d.fees?.[3]?.amount || ''],
          [5, 'Other Fee', d.fees?.[4]?.description || '', d.fees?.[4]?.per_day || '', d.fees?.[4]?.days || '', d.fees?.[4]?.amount || ''],
        ]}
      />
      <div style={{ fontSize: '9px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginTop: '2px' }}>
        <div>Total (Kyat): <b>{d.fee_total}</b></div>
        <div>FOC (Kyat): <b>{d.fee_foc}</b></div>
        <div>Net (Kyat): <b>{d.fee_net}</b></div>
      </div>
      <div style={{ fontSize: '10px', marginTop: '4px' }}>
        Grand Total (Kyat): <b>{d.grand_total}</b>
      </div>
      <div style={{ fontSize: '9px', marginTop: '2px' }}>By Word: {d.grand_total_word}</div>

      <div style={{ fontSize: '10px', marginTop: '6px', fontWeight: 'bold' }}>
        Environmental Condition (Humidity, Dust, Electricity, etc.) &nbsp;
        [ {d.env_condition?.toLowerCase() === 'good' ? 'X' : ' '} ] Good &nbsp;
        [ {d.env_condition?.toLowerCase() === 'fair' ? 'X' : ' '} ] Fair &nbsp;
        [ {d.env_condition?.toLowerCase() === 'poor' ? 'X' : ' '} ] Poor
      </div>

      <SignatureBlock />
      <PdfFooter />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REVIEW DISPATCHER
// ═══════════════════════════════════════════════════════════════
function FormReview({ formType, formData }) {
  if (formType === 'installation') return <ReviewInstallation d={formData} />;
  if (formType === 'maintenance') return <ReviewMaintenance d={formData} />;
  if (formType === 'field-service') return <ReviewFieldService d={formData} />;
  return null;
}

// ═══════════════════════════════════════════════════════════════
// INPUT FIELDS (Step 1 — fill form)
// ═══════════════════════════════════════════════════════════════
function F({ label, field, formData, setField, type = 'text', options, rows, placeholder }) {
  const val = formData[field] || '';
  if (type === 'select') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <select value={val} onChange={e => setField(field, e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
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
        <textarea value={val} onChange={e => setField(field, e.target.value)} rows={rows || 3} placeholder={placeholder || label} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-y" />
      </div>
    );
  }
  if (type === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={!!formData[field]} onChange={e => setField(field, e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
        <span className="text-sm text-gray-600">{label}</span>
      </div>
    );
  }
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} value={val} onChange={e => setField(field, e.target.value)} placeholder={placeholder || label} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
    </div>
  );
}

function Sec({ title, children }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-blue-800 border-b-2 border-blue-200 pb-1 mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function InstallationFields({ d, setField, setPart }) {
  return (
    <div className="space-y-6">
      <Sec title="Customer Information">
        <F label="Customer's Name" field="customer_name" formData={d} setField={setField} />
        <F label="Department/Hospital" field="hospital" formData={d} setField={setField} />
        <F label="Address" field="address" formData={d} setField={setField} />
        <F label="Township" field="township" formData={d} setField={setField} />
        <F label="Ph No" field="phone" formData={d} setField={setField} />
        <F label="Email" field="email" formData={d} setField={setField} />
      </Sec>
      <Sec title="Equipment Information">
        <F label="Equipment" field="equipment" formData={d} setField={setField} />
        <F label="Model" field="model" formData={d} setField={setField} />
        <F label="Serial No" field="serial_no" formData={d} setField={setField} />
        <F label="Installation Date" field="installation_date" type="date" formData={d} setField={setField} />
        <F label="Installation Start Date" field="install_start" type="date" formData={d} setField={setField} />
        <F label="Installation Finished Date" field="install_finish" type="date" formData={d} setField={setField} />
        <F label="Working Day/Time" field="working_time" formData={d} setField={setField} />
        <F label="Warranty" field="warranty" type="select" options={[{ value: 'under', label: 'Under' }, { value: 'over', label: 'Over' }]} formData={d} setField={setField} />
      </Sec>
      <div>
        <h3 className="text-sm font-semibold text-blue-800 border-b-2 border-blue-200 pb-1 mb-3">Installation Parts and Supplies</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-blue-800 text-white">
              <th className="border px-2 py-1.5 w-8">No</th><th className="border px-2 py-1.5 text-left">Item List</th><th className="border px-2 py-1.5 w-16">Qty</th><th className="border px-2 py-1.5 w-24">OPERATIVE</th><th className="border px-2 py-1.5 w-28">NON OPERATIVE</th><th className="border px-2 py-1.5 w-24">REMARKS</th>
            </tr></thead>
            <tbody>{Array.from({ length: 9 }, (_, i) => (
              <tr key={i}>
                <td className="border px-2 py-1 text-center">{i + 1}</td>
                <td className="border px-1 py-0.5"><input value={d.parts?.[i]?.item || ''} onChange={e => setPart(i, 'item', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                <td className="border px-1 py-0.5"><input value={d.parts?.[i]?.qty || ''} onChange={e => setPart(i, 'qty', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                <td className="border px-1 py-0.5"><input value={d.parts?.[i]?.operative || ''} onChange={e => setPart(i, 'operative', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                <td className="border px-1 py-0.5"><input value={d.parts?.[i]?.non_operative || ''} onChange={e => setPart(i, 'non_operative', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                <td className="border px-1 py-0.5"><input value={d.parts?.[i]?.remarks || ''} onChange={e => setPart(i, 'remarks', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      <Sec title="Report">
        <F label="1. Parts Condition" field="parts_condition" type="select" options={['Good', 'Fair', 'Poor']} formData={d} setField={setField} />
        <F label="Installation Complete Date" field="install_complete_date" type="date" formData={d} setField={setField} />
        <F label="2. Installation Condition" field="install_condition" type="select" options={['Good', 'Fair', 'Poor']} formData={d} setField={setField} />
        <F label="Test Running Date" field="test_running_date" type="date" formData={d} setField={setField} />
        <F label="3. Operation Condition" field="operation_condition" type="select" options={['Good', 'Fair', 'Poor']} formData={d} setField={setField} />
        <F label="User Training Complete" field="training_complete" type="checkbox" formData={d} setField={setField} />
      </Sec>
      <Sec title="Warranty Period">
        <F label="Commission Date" field="commission_date" type="date" formData={d} setField={setField} />
        <F label="Warranty From" field="warranty_from" type="date" formData={d} setField={setField} />
        <F label="Warranty To" field="warranty_to" type="date" formData={d} setField={setField} />
      </Sec>
      <F label="Remark" field="remark" type="textarea" formData={d} setField={setField} />
    </div>
  );
}

function MaintenanceFields({ d, setField }) {
  return (
    <div className="space-y-6">
      <Sec title="Customer Information">
        <F label="Customer's Name" field="customer_name" formData={d} setField={setField} />
        <F label="Department/Hospital" field="hospital" formData={d} setField={setField} />
        <F label="Address" field="address" formData={d} setField={setField} />
        <F label="Township" field="township" formData={d} setField={setField} />
        <F label="Ph No" field="phone" formData={d} setField={setField} />
        <F label="Email" field="email" formData={d} setField={setField} />
        <F label="Install Date" field="install_date" type="date" formData={d} setField={setField} />
        <F label="Date" field="report_date" type="date" formData={d} setField={setField} />
      </Sec>
      <Sec title="Equipment Information">
        <F label="Equipment" field="equipment" formData={d} setField={setField} />
        <F label="Model" field="model" formData={d} setField={setField} />
        <F label="Serial No" field="serial_no" formData={d} setField={setField} />
      </Sec>
      <F label="Report / Action Taken" field="report_action" type="textarea" formData={d} setField={setField} rows={5} />
      <Sec title="Checking Up">
        <F label="1. Parts Condition" field="check_parts" formData={d} setField={setField} />
        <F label="5. General Service" field="check_general" formData={d} setField={setField} />
        <F label="2. Machine Condition" field="check_machine" formData={d} setField={setField} />
        <F label="6. Calibration Condition" field="check_calibration" formData={d} setField={setField} />
        <F label="3. Operation Condition" field="check_operation" formData={d} setField={setField} />
        <F label="7. Testing Condition" field="check_testing" formData={d} setField={setField} />
        <F label="4. Service Condition" field="check_service" formData={d} setField={setField} />
        <F label="8. Repair / Breakdown" field="check_repair" formData={d} setField={setField} />
      </Sec>
      <Sec title="Conditions">
        <F label="General Machine Condition" field="general_condition" type="select" options={['Good', 'Fair', 'Fail']} formData={d} setField={setField} />
        <F label="Environment Condition" field="environment_condition" type="select" options={['Good', 'Fair', 'Poor']} formData={d} setField={setField} />
        <F label="Service Start Date" field="service_start" type="date" formData={d} setField={setField} />
        <F label="Service Complete Date" field="service_complete" type="date" formData={d} setField={setField} />
        <F label="Human Error" field="human_error" type="select" options={['Yes', 'No']} formData={d} setField={setField} />
        <F label="Test Running Date" field="test_running" type="date" formData={d} setField={setField} />
        <F label="Test Complete" field="test_complete" type="checkbox" formData={d} setField={setField} />
      </Sec>
      <F label="Additional Remark" field="additional_remark" type="textarea" formData={d} setField={setField} />
    </div>
  );
}

function FieldServiceFields({ d, setField, setPart, setFee }) {
  return (
    <div className="space-y-6">
      <Sec title="Customer Information">
        <F label="Customer's Name" field="customer_name" formData={d} setField={setField} />
        <F label="Department/Hospital" field="hospital" formData={d} setField={setField} />
        <F label="Address" field="address" formData={d} setField={setField} />
        <F label="Township" field="township" formData={d} setField={setField} />
        <F label="Ph No" field="phone" formData={d} setField={setField} />
        <F label="Email" field="email" formData={d} setField={setField} />
      </Sec>
      <Sec title="Equipment Information">
        <F label="Equipment" field="equipment" formData={d} setField={setField} />
        <F label="Model" field="model" formData={d} setField={setField} />
        <F label="Serial No" field="serial_no" formData={d} setField={setField} />
        <F label="Installation Date" field="installation_date" type="date" formData={d} setField={setField} />
        <F label="Service Start Date" field="service_start" type="date" formData={d} setField={setField} />
        <F label="Service Finished Date" field="service_finish" type="date" formData={d} setField={setField} />
        <F label="Working Day/Time" field="working_time" formData={d} setField={setField} />
        <F label="Warranty" field="warranty" type="select" options={[{ value: 'under', label: 'Under' }, { value: 'over', label: 'Over' }]} formData={d} setField={setField} />
      </Sec>
      <F label="Failure Description" field="failure_description" type="textarea" formData={d} setField={setField} />
      <F label="Inspection & Fixed" field="inspection_fixed" type="textarea" formData={d} setField={setField} />
      <Sec title="Actions Taken">
        <div className="col-span-2 flex flex-wrap gap-4">
          {['Maintained', 'Reconditioned', 'Replace', 'Repair'].map(a => (
            <label key={a} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={(d.actions_taken || '').toLowerCase().includes(a.toLowerCase())} onChange={e => {
                const c = (d.actions_taken || '').toLowerCase(); const l = a.toLowerCase();
                setField('actions_taken', e.target.checked ? (c ? c + ', ' + l : l) : c.replace(new RegExp(`[,\\s]*${l}\\s*`, 'i'), '').trim());
              }} className="w-4 h-4 rounded border-gray-300" />
              <span className="text-sm">{a}</span>
            </label>
          ))}
        </div>
      </Sec>
      <div>
        <h3 className="text-sm font-semibold text-blue-800 border-b-2 border-blue-200 pb-1 mb-3">Parts</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-blue-800 text-white">
              <th className="border px-2 py-1.5 w-8">No</th><th className="border px-2 py-1.5 text-left">Parts</th><th className="border px-2 py-1.5 text-left">Descriptions</th><th className="border px-2 py-1.5 w-24">Unit Price</th><th className="border px-2 py-1.5 w-16">Qty</th><th className="border px-2 py-1.5 w-28">Amount(Kyat)</th>
            </tr></thead>
            <tbody>{Array.from({ length: 5 }, (_, i) => (
              <tr key={i}>
                <td className="border px-2 py-1 text-center">{i + 1}</td>
                <td className="border px-1 py-0.5"><input value={d.parts?.[i]?.name || ''} onChange={e => setPart(i, 'name', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                <td className="border px-1 py-0.5"><input value={d.parts?.[i]?.description || ''} onChange={e => setPart(i, 'description', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                <td className="border px-1 py-0.5"><input value={d.parts?.[i]?.unit_price || ''} onChange={e => setPart(i, 'unit_price', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                <td className="border px-1 py-0.5"><input value={d.parts?.[i]?.qty || ''} onChange={e => setPart(i, 'qty', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                <td className="border px-1 py-0.5"><input value={d.parts?.[i]?.amount || ''} onChange={e => setPart(i, 'amount', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <F label="Total (Kyat)" field="parts_total" formData={d} setField={setField} />
          <F label="FOC (Kyat)" field="parts_foc" formData={d} setField={setField} />
          <F label="Net (Kyat)" field="parts_net" formData={d} setField={setField} />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-blue-800 border-b-2 border-blue-200 pb-1 mb-3">Fee Charges</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-blue-800 text-white">
              <th className="border px-2 py-1.5 w-8">No</th><th className="border px-2 py-1.5 text-left">Fees</th><th className="border px-2 py-1.5 text-left">Descriptions</th><th className="border px-2 py-1.5 w-24">Per Day Fee</th><th className="border px-2 py-1.5 w-16">Days</th><th className="border px-2 py-1.5 w-28">Amount(Kyat)</th>
            </tr></thead>
            <tbody>{['Service Fees', 'Transportation Fees', 'Costs of Meal', 'Accommodation Fees', 'Other Fee'].map((label, i) => (
              <tr key={i}>
                <td className="border px-2 py-1 text-center">{i + 1}</td>
                <td className="border px-2 py-1 text-gray-600">{label}</td>
                <td className="border px-1 py-0.5"><input value={d.fees?.[i]?.description || ''} onChange={e => setFee(i, 'description', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                <td className="border px-1 py-0.5"><input value={d.fees?.[i]?.per_day || ''} onChange={e => setFee(i, 'per_day', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                <td className="border px-1 py-0.5"><input value={d.fees?.[i]?.days || ''} onChange={e => setFee(i, 'days', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
                <td className="border px-1 py-0.5"><input value={d.fees?.[i]?.amount || ''} onChange={e => setFee(i, 'amount', e.target.value)} className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:outline-none focus:bg-blue-50 rounded" /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-2">
          <F label="Total (Kyat)" field="fee_total" formData={d} setField={setField} />
          <F label="FOC (Kyat)" field="fee_foc" formData={d} setField={setField} />
          <F label="Net (Kyat)" field="fee_net" formData={d} setField={setField} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <F label="Grand Total (Kyat)" field="grand_total" formData={d} setField={setField} />
          <F label="Grand Total by Word" field="grand_total_word" formData={d} setField={setField} />
        </div>
      </div>
      <F label="Environmental Condition (Humidity, Dust, Electricity, etc.)" field="env_condition" type="select" options={['Good', 'Fair', 'Poor']} formData={d} setField={setField} />
    </div>
  );
}

function FormFields({ formType, formData, setField, setPart, setFee }) {
  if (formType === 'installation') return <InstallationFields d={formData} setField={setField} setPart={setPart} />;
  if (formType === 'maintenance') return <MaintenanceFields d={formData} setField={setField} />;
  if (formType === 'field-service') return <FieldServiceFields d={formData} setField={setField} setPart={setPart} setFee={setFee} />;
  return null;
}
