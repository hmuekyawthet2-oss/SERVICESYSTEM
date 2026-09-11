const express = require('express');
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const router = express.Router();

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const ML = 42;
const MR = 42;
const CW = PAGE_W - ML - MR;

const BLUE = rgb(0.102, 0.322, 0.463);
const RED = rgb(0.8, 0, 0);
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const GREEN_BG = rgb(0.91, 0.96, 0.91);
const PINK_BG = rgb(1, 0.93, 0.91);
const GRAY = rgb(0.5, 0.5, 0.5);

const COMPANY = {
  name: 'EVER GLORY COMPANY LIMITED',
  addr1: 'Office No. 1301, Corner of Shu Khin Thar Mayopat Road and Aung Tha Khu Street, 6th Ward,',
  addr2: 'Thaketa Township, Yangon, Myanmar.',
  tel: 'Tel: +95 9 420 039 009, +95 9 253 006 633 ~ 44',
  email: 'E-mail: info@everglory.com.mm',
  web: 'Website: www.everglory.com.mm',
  hotline: 'Service Hotline: 09 253333466, 09 751669848',
  footer: 'Copyright documents to Engineer Department and administration office of Ever Glory Co.,ltd.',
};

let logoImage = null;
let logoLoaded = false;

async function loadLogo(doc) {
  if (logoLoaded) return logoImage;
  try {
    const logoPath = path.join(__dirname, '..', 'assets', 'hand.png');
    const buf = fs.readFileSync(logoPath);
    logoImage = await doc.embedPng(buf);
  } catch (e) {
    console.warn('Could not load logo:', e.message);
    logoImage = null;
  }
  logoLoaded = true;
  return logoImage;
}

class F {
  constructor() {
    this.doc = null;
    this.page = null;
    this.y = 0;
    this.fonts = {};
    this.rowH = 13;
  }

  async init() {
    this.doc = await PDFDocument.create();
    this.fonts.bold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.fonts.normal = await this.doc.embedFont(StandardFonts.Helvetica);
    this.fonts.italic = await this.doc.embedFont(StandardFonts.HelveticaOblique);
    await loadLogo(this.doc);
    this.addPage();
  }

  addPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - 20;
  }

  txt(str, x, y, opts = {}) {
    const font = opts.bold ? this.fonts.bold : opts.italic ? this.fonts.italic : this.fonts.normal;
    const size = opts.size || 8;
    const color = opts.color || BLACK;
    this.page.drawText(String(str || ''), { x, y, size, font, color });
  }

  tw(str, size, bold) {
    const font = bold ? this.fonts.bold : this.fonts.normal;
    return font.widthOfTextAtSize(String(str || ''), size || 8);
  }

  line(x1, y1, x2, y2, thickness = 0.5, color = BLACK) {
    this.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
  }

  rect(x, y, w, h, opts = {}) {
    this.page.drawRectangle({
      x, y, width: w, height: h,
      borderWidth: opts.border !== false ? (opts.borderW || 0.5) : 0,
      borderColor: opts.borderColor || BLACK,
      color: opts.fill || undefined,
    });
  }

  async drawHeader() {
    const logo = logoImage;
    if (logo) {
      this.page.drawImage(logo, { x: ML, y: this.y - 52, width: 52, height: 52 });
    }
    const cx = PAGE_W / 2;
    this.txt(COMPANY.name, cx - this.tw(COMPANY.name, 15, true) / 2, this.y - 12, { bold: true, size: 15, color: RED });
    this.txt(COMPANY.addr1, cx - this.tw(COMPANY.addr1, 7) / 2, this.y - 24, { size: 7 });
    this.txt(COMPANY.addr2, cx - this.tw(COMPANY.addr2, 7) / 2, this.y - 33, { size: 7 });
    this.txt(COMPANY.tel, cx - this.tw(COMPANY.tel, 7) / 2, this.y - 42, { size: 7 });
    const emailWeb = `${COMPANY.email}   ${COMPANY.web}`;
    this.txt(emailWeb, cx - this.tw(emailWeb, 7) / 2, this.y - 51, { size: 7 });
    this.line(ML, this.y - 57, PAGE_W - MR, this.y - 57, 1.5);
    this.y = this.y - 67;
  }

  drawDocLine(docNo) {
    this.txt(`Document No: ${docNo}`, ML, this.y, { size: 7 });
    this.txt(COMPANY.hotline, 280, this.y, { size: 7, color: RED, bold: true });
    this.txt('Page 1 of 1', PAGE_W - MR - this.tw('Page 1 of 1', 7), this.y, { size: 7 });
    this.y -= 12;
  }

  drawTitle(title) {
    this.txt(title, PAGE_W / 2 - this.tw(title, 12, true) / 2, this.y, { bold: true, size: 12 });
    this.y -= 14;
  }

  drawFieldPair(l1, v1, l2, v2) {
    const LH = 12;
    if (l1) {
      this.txt(l1, ML, this.y, { bold: true, size: 8 });
      const lw = this.tw(l1, 8, true);
      const vx = ML + lw + 3;
      this.txt(v1 || '', vx, this.y, { size: 8 });
      const lineEnd = 280;
      this.line(vx, this.y - 2, lineEnd, this.y - 2, 0.3, GRAY);
    }
    if (l2) {
      const x2 = 290;
      this.txt(l2, x2, this.y, { bold: true, size: 8 });
      const lw2 = this.tw(l2, 8, true);
      const vx2 = x2 + lw2 + 3;
      this.txt(v2 || '', vx2, this.y, { size: 8 });
      this.line(vx2, this.y - 2, PAGE_W - MR, this.y - 2, 0.3, GRAY);
    }
    this.y -= LH;
  }

  drawCheckbox(label, checked, x, y, bgColor) {
    if (bgColor) {
      this.rect(x - 2, y - 2, 8, 8, { fill: bgColor, border: false });
    }
    this.rect(x, y, 8, 8, { borderW: 0.5 });
    if (checked) {
      this.line(x + 1.5, y + 4, x + 3.5, y + 1.5, 1, BLACK);
      this.line(x + 3.5, y + 1.5, x + 6.5, y + 6.5, 1, BLACK);
    }
    this.txt(label, x + 11, y + 1, { size: 7.5 });
  }

  drawTable(headers, rows, colWidths, opts = {}) {
    const headerH = 15;
    let cx = ML;
    let cy = this.y;

    headers.forEach((h, i) => {
      this.rect(cx, cy - headerH, colWidths[i], headerH, { fill: BLUE, border: false });
      this.txt(h, cx + 3, cy - headerH + 4, { bold: true, size: 7, color: WHITE });
      cx += colWidths[i];
    });
    cy -= headerH;

    const dataH = opts.rowH || this.rowH;
    rows.forEach((row) => {
      cx = ML;
      row.forEach((cell, i) => {
        this.rect(cx, cy - dataH, colWidths[i], dataH, { borderW: 0.3 });
        this.txt(String(cell || ''), cx + 3, cy - dataH + 3, { size: 7 });
        cx += colWidths[i];
      });
      cy -= dataH;
    });
    this.y = cy;
  }

  sectionHeader(title, bgColor) {
    const h = 14;
    this.rect(ML, this.y - h, CW, h, { fill: bgColor || GREEN_BG, border: false });
    this.txt(title, ML + 3, this.y - h + 3.5, { bold: true, size: 8.5, color: BLACK });
    this.y -= h + 4;
  }

  sectionTitleBlue(title) {
    this.txt(title, ML, this.y, { bold: true, size: 9, color: BLUE });
    this.line(ML, this.y - 2, PAGE_W - MR, this.y - 2, 1, BLUE);
    this.y -= 12;
  }

  drawSignatureBlock() {
    this.y -= 4;
    this.line(ML, this.y, PAGE_W - MR, this.y, 1);
    this.y -= 12;
    this.txt('Authorized Engineer', ML, this.y, { bold: true, size: 8.5 });
    this.txt('Customer/ In Charge', 320, this.y, { bold: true, size: 8.5 });
    this.y -= 16;
    this.txt('Signature:', ML, this.y, { size: 8 });
    this.txt('Signature:', 320, this.y, { size: 8 });
    this.y -= 12;
    this.txt('Name:', ML, this.y, { size: 8 });
    this.txt('Name:', 320, this.y, { size: 8 });
    this.y -= 12;
    this.txt('Designation:', ML, this.y, { size: 8 });
    this.txt('Designation:', 320, this.y, { size: 8 });
    this.y -= 14;
  }

  drawFooter() {
    this.txt(COMPANY.footer, PAGE_W / 2 - this.tw(COMPANY.footer, 5.5, false) / 2, 28, { italic: true, size: 5.5, color: GRAY });
  }

  async buffer() {
    return this.doc.save();
  }
}

// ═══════════════════════════════════════════════════════════════
// INSTALLATION FORM
// ═══════════════════════════════════════════════════════════════
router.post('/installation/pdf', async (req, res) => {
  try {
    const d = req.body;
    const w = new F();
    await w.init();

    await w.drawHeader();
    w.drawTitle('Installation and Commissioning Report');
    w.drawDocLine('EG-RE-ME-001-00');

    w.drawFieldPair("Customer's Name:", d.customer_name, 'Department/Hospital:', d.hospital);
    w.drawFieldPair('Address:', d.address, 'Township:', d.township);
    w.drawFieldPair('Ph No:', d.phone, 'Email:', d.email);
    w.drawFieldPair('Equipment:', d.equipment, 'Installation Start Date:', d.install_start);
    w.drawFieldPair('Model:', d.model, 'Installation Finished Date:', d.install_finish);
    w.drawFieldPair('Serial No:', d.serial_no, 'Working Day/Time:', d.working_time);
    w.drawFieldPair('Installation Date:', d.installation_date, '', '');
    w.drawCheckbox('Warranty:', false, ML, w.y + 2);
    w.drawCheckbox('Under', d.warranty === 'under', ML + 80, w.y + 2);
    w.drawCheckbox('Over', d.warranty === 'over', ML + 140, w.y + 2);
    w.y -= 8;

    w.sectionHeader('Installation Parts and Supplies');
    const partCols = [28, 142, 50, 80, 85, 70];
    const partRows = (d.parts || []).slice(0, 9).map((p, i) => [i + 1, p.item || '', p.qty || '', p.operative || '', p.non_operative || '', p.remarks || '']);
    while (partRows.length < 9) partRows.push([partRows.length + 1, '', '', '', '', '']);
    w.drawTable(['No', 'Item List', 'Qty', 'OPERATIVE', 'NON OPERATIVE', 'REMARKS'], partRows, partCols);

    w.y -= 4;
    w.sectionHeader('Report');
    const rl = ML + 5;
    w.txt(`1   Parts Condition              ( ${d.parts_condition || '    '} )`, rl, w.y, { size: 8 });
    w.txt(`Installation Complete Date:    ${d.install_complete_date || '____/____/2026'}`, 320, w.y, { size: 8 });
    w.y -= 12;
    w.txt(`2   Installation Condition       ( ${d.install_condition || '    '} )`, rl, w.y, { size: 8 });
    w.txt(`Test Running Date:             ${d.test_running_date || '____/____/2026'}`, 320, w.y, { size: 8 });
    w.y -= 12;
    w.txt(`3   Operation Condition          ( ${d.operation_condition || '    '} )`, rl, w.y, { size: 8 });
    w.txt('User Training for respective person:', 320, w.y, { size: 8 });
    w.drawCheckbox('Complete', d.training_complete, 480, w.y);
    w.y -= 16;

    w.txt('Warranty Exclusions', ML, w.y, { italic: true, size: 8 });
    w.y -= 10;
    const excl = [
      'The distributor shall not be responsible on the following factors:',
      'I.    Natural Disaster.',
      'II.   Any defect due to unspecified connection/environment such as Unstable Power Supply, Commercial or',
      '      Generator Failure without protection and End User\'s Fault, Humidity and Air Conditioning shortage etc.',
      'III.  Failure caused by customized modification beyond the Manufacturer\'s Recommendation.',
      'IV.   Any consumable parts like Lamp, pneumatic tubing, Mechanical Belt, Chassis Cover, Cuvettes etc.',
    ];
    excl.forEach(line => { w.txt(line, ML + 5, w.y, { size: 7 }); w.y -= 9; });
    w.y -= 4;

    w.txt(`The above equipment has proven satisfactory in installation, operation, hand-on training and thus passed`, ML, w.y, { size: 7.5 }); w.y -= 9;
    w.txt(`Commission on date  ${d.commission_date || '____/____/2026'}`, ML + 10, w.y, { size: 7.5 }); w.y -= 9;
    w.txt(`Therefore, the Warranty Period shall be from  ${d.warranty_from || '____/____/2026'}  to  ${d.warranty_to || '____/____/2027'}.`, ML + 10, w.y, { size: 7.5 }); w.y -= 14;

    w.txt('Remark:', ML, w.y, { bold: true, size: 8.5 }); w.y -= 12;
    if (d.remark) { w.txt(d.remark, ML + 5, w.y, { size: 7.5 }); w.y -= 12; }
    w.line(ML, w.y, PAGE_W - MR, w.y, 0.3, GRAY);
    w.y -= 4;

    w.drawSignatureBlock();
    w.drawFooter();

    const buf = await w.buffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=installation_report.pdf');
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('Installation PDF error:', err);
    res.status(500).json({ success: false, message: 'PDF generation failed: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// MAINTENANCE FORM
// ═══════════════════════════════════════════════════════════════
router.post('/maintenance/pdf', async (req, res) => {
  try {
    const d = req.body;
    const w = new F();
    await w.init();

    await w.drawHeader();
    w.drawTitle('Maintenance Report');
    w.drawDocLine('EG-RE-ME-003-00');

    w.drawFieldPair("Customer's Name:", d.customer_name, 'Department/Hospital:', d.hospital);
    w.drawFieldPair('Address:', d.address, 'Township:', d.township);
    w.drawFieldPair('Ph No:', d.phone, 'Email:', d.email);
    w.drawFieldPair('Install Date:', d.install_date, 'Date:', d.report_date);
    w.drawFieldPair('Equipment:', d.equipment, '', '');
    w.drawFieldPair('Model:', d.model, '', '');
    w.drawFieldPair('Serial No:', d.serial_no, '', '');

    w.y -= 2;
    w.sectionHeader('REPORT / ACTION TAKEN', PINK_BG);
    w.y += 2;
    if (d.report_action) { w.txt(d.report_action, ML + 5, w.y, { size: 7.5 }); w.y -= 30; }
    else { w.y -= 40; }

    w.sectionTitleBlue('Checking Up');
    w.txt('1   Parts Condition', ML + 5, w.y, { size: 8 });
    w.txt('5   General Service', 310, w.y, { size: 8 });
    w.y -= 11;
    w.txt('2   Machine Condition', ML + 5, w.y, { size: 8 });
    w.txt('6   Calibration Condition', 310, w.y, { size: 8 });
    w.y -= 11;
    w.txt('3   Operation Condition', ML + 5, w.y, { size: 8 });
    w.txt('7   Testing Condition', 310, w.y, { size: 8 });
    w.y -= 11;
    w.txt('4   Service Condition', ML + 5, w.y, { size: 8 });
    w.txt('8   Repair / Breakdown', 310, w.y, { size: 8 });
    w.y -= 16;

    const cbY = w.y;
    w.txt('General machine condition', ML + 5, cbY, { size: 8 });
    w.drawCheckbox('Good', d.general_condition === 'Good', 210, cbY, GREEN_BG);
    w.drawCheckbox('Fair', d.general_condition === 'Fair', 280, cbY, rgb(1, 0.95, 0.8));
    w.drawCheckbox('Fail', d.general_condition === 'Fail', 350, cbY, rgb(1, 0.85, 0.7));
    w.y -= 13;
    w.txt('Environment Condition', ML + 5, w.y, { size: 8 });
    w.drawCheckbox('Good', d.environment_condition === 'Good', 210, w.y, GREEN_BG);
    w.drawCheckbox('Fair', d.environment_condition === 'Fair', 280, w.y, rgb(1, 0.95, 0.8));
    w.drawCheckbox('Poor', d.environment_condition === 'Poor', 350, w.y, rgb(1, 0.85, 0.7));
    w.y -= 16;

    w.drawFieldPair('Service Start Date:', d.service_start, 'Service Complete Date:', d.service_complete);
    w.drawFieldPair('Human Error:', d.human_error, 'Test Running Date:', d.test_running);
    w.drawCheckbox('Complete', d.test_complete, 420, w.y + 2, GREEN_BG);
    w.y -= 8;

    w.y -= 4;
    w.sectionHeader('ADDITIONAL REMARK', PINK_BG);
    if (d.additional_remark) { w.txt(d.additional_remark, ML + 5, w.y, { size: 7.5 }); w.y -= 16; }
    else { w.y -= 24; }

    w.drawSignatureBlock();
    w.drawFooter();

    const buf = await w.buffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=maintenance_report.pdf');
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('Maintenance PDF error:', err);
    res.status(500).json({ success: false, message: 'PDF generation failed: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// FIELD SERVICE FORM
// ═══════════════════════════════════════════════════════════════
router.post('/field-service/pdf', async (req, res) => {
  try {
    const d = req.body;
    const w = new F();
    await w.init();

    await w.drawHeader();
    w.drawTitle('Field Service Report');
    w.drawDocLine('EG-RE-ME-002-00');

    w.drawFieldPair("Customer's Name:", d.customer_name, 'Department/Hospital:', d.hospital);
    w.drawFieldPair('Address:', d.address, 'Township:', d.township);
    w.drawFieldPair('Ph No:', d.phone, 'Email:', d.email);
    w.drawFieldPair('Equipment:', d.equipment, 'Service Start Date:', d.service_start);
    w.drawFieldPair('Model:', d.model, 'Service Finished Date:', d.service_finish);
    w.drawFieldPair('Serial No:', d.serial_no, 'Working Day/Time:', d.working_time);
    w.drawFieldPair('Installation Date:', d.installation_date, '', '');
    w.drawCheckbox('Warranty:', false, ML, w.y + 2);
    w.drawCheckbox('Under', d.warranty === 'under', ML + 80, w.y + 2);
    w.drawCheckbox('Over', d.warranty === 'over', ML + 140, w.y + 2);
    w.y -= 6;

    w.sectionTitleBlue('Failure Description');
    if (d.failure_description) w.txt(d.failure_description, ML + 5, w.y, { size: 7.5 });
    w.y -= 30;

    w.sectionTitleBlue('Inspection & Fixed');
    if (d.inspection_fixed) w.txt(d.inspection_fixed, ML + 5, w.y, { size: 7.5 });
    w.y -= 20;

    w.txt('Action(s) Taken:', ML, w.y, { bold: true, size: 8.5 });
    w.drawCheckbox('Maintained', (d.actions_taken || '').toLowerCase().includes('maintained'), 120, w.y, GREEN_BG);
    w.drawCheckbox('Reconditioned', (d.actions_taken || '').toLowerCase().includes('reconditioned'), 210, w.y, GREEN_BG);
    w.drawCheckbox('Replace', (d.actions_taken || '').toLowerCase().includes('replace'), 320, w.y, GREEN_BG);
    w.drawCheckbox('Repair', (d.actions_taken || '').toLowerCase().includes('repair'), 400, w.y, GREEN_BG);
    w.y -= 12;

    w.y -= 4;
    w.sectionHeader('PARTS');
    const partCols = [28, 90, 120, 80, 45, 92];
    const partRows = (d.parts || []).slice(0, 5).map((p, i) => [i + 1, p.name || '', p.description || '', p.unit_price || '', p.qty || '', p.amount || '']);
    while (partRows.length < 5) partRows.push([partRows.length + 1, '', '', '', '', '']);
    w.drawTable(['No', 'Parts', 'Descriptions', 'Unit Price', 'Qty', 'Amount(Kyat)'], partRows, partCols, { rowH: 12 });

    w.y -= 2;
    w.txt('Remark:', ML, w.y, { bold: true, size: 8 });
    w.txt('Total (Kyat)', 370, w.y, { bold: true, size: 7.5 });
    w.txt(d.parts_total || '', 455, w.y, { size: 7.5 });
    w.y -= 11;
    w.txt('FOC (Kyat)', 370, w.y, { bold: true, size: 7.5 });
    w.txt(d.parts_foc || '', 455, w.y, { size: 7.5 });
    w.y -= 11;
    w.txt('Net (Kyat)', 370, w.y, { bold: true, size: 7.5 });
    w.txt(d.parts_net || '', 455, w.y, { size: 7.5 });
    w.y -= 14;

    w.sectionHeader('FEE CHARGES');
    const feeCols = [28, 100, 100, 75, 45, 92];
    const feeLabels = ['Service Fees', 'Transportation Fees', 'Costs of meal', 'Accommodation Fees', 'Other Fee'];
    const feeRows = feeLabels.map((label, i) => {
      const fd = (d.fees || [])[i] || {};
      return [i + 1, label, fd.description || '', fd.per_day || '', fd.days || '', fd.amount || ''];
    });
    w.drawTable(['No', 'Fees', 'Descriptions', 'Per day fee', 'Days', 'Amount(Kyat)'], feeRows, feeCols, { rowH: 12 });

    w.y -= 2;
    w.txt('Remark:', ML, w.y, { bold: true, size: 8 });
    w.txt('Total (Kyat)', 370, w.y, { bold: true, size: 7.5 });
    w.txt(d.fee_total || '', 455, w.y, { size: 7.5 });
    w.y -= 11;
    w.txt('FOC (Kyat)', 370, w.y, { bold: true, size: 7.5 });
    w.txt(d.fee_foc || '', 455, w.y, { size: 7.5 });
    w.y -= 11;
    w.txt('Net (Kyat)', 370, w.y, { bold: true, size: 7.5 });
    w.txt(d.fee_net || '', 455, w.y, { size: 7.5 });
    w.y -= 14;

    w.txt('Grand Total (Kyat)', 350, w.y, { bold: true, size: 8.5 });
    w.txt(d.grand_total || '', 455, w.y, { bold: true, size: 8.5 });
    w.y -= 11;
    w.txt('By Word:', ML, w.y, { size: 7.5 });
    w.txt(d.grand_total_word || '', ML + 55, w.y, { size: 7.5 });
    w.y -= 14;

    w.txt('Environmental Condition(Humidity, Dust, Electricity, etc.)', ML, w.y, { bold: true, size: 7.5 });
    w.drawCheckbox('Good', d.env_condition?.toLowerCase() === 'good', 380, w.y, GREEN_BG);
    w.drawCheckbox('Fair', d.env_condition?.toLowerCase() === 'fair', 430, w.y, rgb(1, 0.95, 0.8));
    w.drawCheckbox('Poor', d.env_condition?.toLowerCase() === 'poor', 480, w.y, rgb(1, 0.85, 0.7));
    w.y -= 14;

    w.drawSignatureBlock();
    w.drawFooter();

    const buf = await w.buffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=field_service_report.pdf');
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('Field Service PDF error:', err);
    res.status(500).json({ success: false, message: 'PDF generation failed: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// BLANK FORM TEMPLATES (for manual filling)
// ═══════════════════════════════════════════════════════════════
router.get('/blank/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const w = new F();
    await w.init();

    await w.drawHeader();

    if (type === 'installation') {
      w.drawTitle('Installation and Commissioning Report');
      w.drawDocLine('EG-RE-ME-001-00');
      for (let i = 0; i < 4; i++) w.drawFieldPair(i === 0 ? "Customer's Name:" : '', '', i === 0 ? 'Department/Hospital:' : '', '');
      w.drawFieldPair('Address:', '', 'Township:', '');
      w.drawFieldPair('Ph No:', '', 'Email:', '');
      w.drawFieldPair('Equipment:', '', 'Installation Start Date:', '');
      w.drawFieldPair('Model:', '', 'Installation Finished Date:', '');
      w.drawFieldPair('Serial No:', '', 'Working Day/Time:', '');
      w.drawFieldPair('Installation Date:', '', '', '');
      w.drawCheckbox('Warranty:', false, ML, w.y + 2);
      w.drawCheckbox('Under', false, ML + 80, w.y + 2);
      w.drawCheckbox('Over', false, ML + 140, w.y + 2);
      w.y -= 8;
      w.sectionHeader('Installation Parts and Supplies');
      const partCols = [28, 142, 50, 80, 85, 70];
      const emptyRows = Array.from({ length: 9 }, (_, i) => [i + 1, '', '', '', '', '']);
      w.drawTable(['No', 'Item List', 'Qty', 'OPERATIVE', 'NON OPERATIVE', 'REMARKS'], emptyRows, partCols);
      w.y -= 4;
      w.sectionHeader('Report');
      w.txt('1   Parts Condition              (     )', ML + 5, w.y, { size: 8 });
      w.txt('Installation Complete Date:    ____/____/2026', 320, w.y, { size: 8 }); w.y -= 12;
      w.txt('2   Installation Condition       (     )', ML + 5, w.y, { size: 8 });
      w.txt('Test Running Date:             ____/____/2026', 320, w.y, { size: 8 }); w.y -= 12;
      w.txt('3   Operation Condition          (     )', ML + 5, w.y, { size: 8 });
      w.txt('User Training for respective person:', 320, w.y, { size: 8 });
      w.drawCheckbox('Complete', false, 480, w.y); w.y -= 16;
      w.txt('Warranty Exclusions', ML, w.y, { italic: true, size: 8 }); w.y -= 10;
      ['The distributor shall not be responsible on the following factors:', 'I.    Natural Disaster.', 'II.   Any defect due to unspecified connection/environment such as Unstable Power Supply, Commercial or', '      Generator Failure without protection and End User\'s Fault, Humidity and Air Conditioning shortage etc.', 'III.  Failure caused by customized modification beyond the Manufacturer\'s Recommendation.', 'IV.   Any consumable parts like Lamp, pneumatic tubing, Mechanical Belt, Chassis Cover, Cuvettes etc.'].forEach(line => { w.txt(line, ML + 5, w.y, { size: 7 }); w.y -= 9; });
      w.y -= 4;
      w.txt('The above equipment has proven satisfactory in installation, operation, hand-on training and thus passed', ML, w.y, { size: 7.5 }); w.y -= 9;
      w.txt('Commission on date  ____/____/2026', ML + 10, w.y, { size: 7.5 }); w.y -= 9;
      w.txt('Therefore, the Warranty Period shall be from  ____/____/2026  to  ____/____/2027.', ML + 10, w.y, { size: 7.5 }); w.y -= 14;
      w.txt('Remark:', ML, w.y, { bold: true, size: 8.5 }); w.y -= 20;
      w.line(ML, w.y, PAGE_W - MR, w.y, 0.3, GRAY); w.y -= 4;
    } else if (type === 'maintenance') {
      w.drawTitle('Maintenance Report');
      w.drawDocLine('EG-RE-ME-003-00');
      w.drawFieldPair("Customer's Name:", '', 'Department/Hospital:', '');
      w.drawFieldPair('Address:', '', 'Township:', '');
      w.drawFieldPair('Ph No:', '', 'Email:', '');
      w.drawFieldPair('Install Date:', '', 'Date:', '');
      w.drawFieldPair('Equipment:', '', '', '');
      w.drawFieldPair('Model:', '', '', '');
      w.drawFieldPair('Serial No:', '', '', '');
      w.y -= 2;
      w.sectionHeader('REPORT / ACTION TAKEN', PINK_BG); w.y += 2; w.y -= 50;
      w.sectionTitleBlue('Checking Up');
      w.txt('1   Parts Condition', ML + 5, w.y, { size: 8 }); w.txt('5   General Service', 310, w.y, { size: 8 }); w.y -= 11;
      w.txt('2   Machine Condition', ML + 5, w.y, { size: 8 }); w.txt('6   Calibration Condition', 310, w.y, { size: 8 }); w.y -= 11;
      w.txt('3   Operation Condition', ML + 5, w.y, { size: 8 }); w.txt('7   Testing Condition', 310, w.y, { size: 8 }); w.y -= 11;
      w.txt('4   Service Condition', ML + 5, w.y, { size: 8 }); w.txt('8   Repair / Breakdown', 310, w.y, { size: 8 }); w.y -= 16;
      w.txt('General machine condition', ML + 5, w.y, { size: 8 });
      w.drawCheckbox('Good', false, 210, w.y, GREEN_BG); w.drawCheckbox('Fair', false, 280, w.y, rgb(1, 0.95, 0.8)); w.drawCheckbox('Fail', false, 350, w.y, rgb(1, 0.85, 0.7)); w.y -= 13;
      w.txt('Environment Condition', ML + 5, w.y, { size: 8 });
      w.drawCheckbox('Good', false, 210, w.y, GREEN_BG); w.drawCheckbox('Fair', false, 280, w.y, rgb(1, 0.95, 0.8)); w.drawCheckbox('Poor', false, 350, w.y, rgb(1, 0.85, 0.7)); w.y -= 16;
      w.drawFieldPair('Service Start Date:', '', 'Service Complete Date:', '');
      w.drawFieldPair('Human Error:', '', 'Test Running Date:', '');
      w.drawCheckbox('Complete', false, 420, w.y + 2, GREEN_BG); w.y -= 8;
      w.y -= 4; w.sectionHeader('ADDITIONAL REMARK', PINK_BG); w.y -= 24;
    } else if (type === 'field-service') {
      w.drawTitle('Field Service Report');
      w.drawDocLine('EG-RE-ME-002-00');
      w.drawFieldPair("Customer's Name:", '', 'Department/Hospital:', '');
      w.drawFieldPair('Address:', '', 'Township:', '');
      w.drawFieldPair('Ph No:', '', 'Email:', '');
      w.drawFieldPair('Equipment:', '', 'Service Start Date:', '');
      w.drawFieldPair('Model:', '', 'Service Finished Date:', '');
      w.drawFieldPair('Serial No:', '', 'Working Day/Time:', '');
      w.drawFieldPair('Installation Date:', '', '', '');
      w.drawCheckbox('Warranty:', false, ML, w.y + 2);
      w.drawCheckbox('Under', false, ML + 80, w.y + 2);
      w.drawCheckbox('Over', false, ML + 140, w.y + 2); w.y -= 6;
      w.sectionTitleBlue('Failure Description'); w.y -= 24;
      w.sectionTitleBlue('Inspection & Fixed'); w.y -= 16;
      w.txt('Action(s) Taken:', ML, w.y, { bold: true, size: 8.5 });
      w.drawCheckbox('Maintained', false, 120, w.y, GREEN_BG);
      w.drawCheckbox('Reconditioned', false, 210, w.y, GREEN_BG);
      w.drawCheckbox('Replace', false, 320, w.y, GREEN_BG);
      w.drawCheckbox('Repair', false, 400, w.y, GREEN_BG); w.y -= 12;
      w.y -= 4; w.sectionHeader('PARTS');
      const partCols = [28, 90, 120, 80, 45, 92];
      w.drawTable(['No', 'Parts', 'Descriptions', 'Unit Price', 'Qty', 'Amount(Kyat)'], Array.from({ length: 5 }, (_, i) => [i + 1, '', '', '', '', '']), partCols, { rowH: 12 });
      w.y -= 2; w.txt('Remark:', ML, w.y, { bold: true, size: 8 }); w.txt('Total (Kyat)', 370, w.y, { bold: true, size: 7.5 }); w.y -= 11;
      w.txt('FOC (Kyat)', 370, w.y, { bold: true, size: 7.5 }); w.y -= 11;
      w.txt('Net (Kyat)', 370, w.y, { bold: true, size: 7.5 }); w.y -= 14;
      w.sectionHeader('FEE CHARGES');
      const feeCols = [28, 100, 100, 75, 45, 92];
      w.drawTable(['No', 'Fees', 'Descriptions', 'Per day fee', 'Days', 'Amount(Kyat)'], ['Service Fees', 'Transportation Fees', 'Costs of meal', 'Accommodation Fees', 'Other Fee'].map((l, i) => [i + 1, l, '', '', '', '']), feeCols, { rowH: 12 });
      w.y -= 2; w.txt('Remark:', ML, w.y, { bold: true, size: 8 }); w.txt('Total (Kyat)', 370, w.y, { bold: true, size: 7.5 }); w.y -= 11;
      w.txt('FOC (Kyat)', 370, w.y, { bold: true, size: 7.5 }); w.y -= 11;
      w.txt('Net (Kyat)', 370, w.y, { bold: true, size: 7.5 }); w.y -= 14;
      w.txt('Grand Total (Kyat)', 350, w.y, { bold: true, size: 8.5 }); w.y -= 11;
      w.txt('By Word:', ML, w.y, { size: 7.5 }); w.y -= 14;
      w.txt('Environmental Condition(Humidity, Dust, Electricity, etc.)', ML, w.y, { bold: true, size: 7.5 });
      w.drawCheckbox('Good', false, 380, w.y, GREEN_BG);
      w.drawCheckbox('Fair', false, 430, w.y, rgb(1, 0.95, 0.8));
      w.drawCheckbox('Poor', false, 480, w.y, rgb(1, 0.85, 0.7)); w.y -= 14;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid form type' });
    }

    w.drawSignatureBlock();
    w.drawFooter();

    const buf = await w.buffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=blank_${type}_form.pdf`);
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('Blank form PDF error:', err);
    res.status(500).json({ success: false, message: 'PDF generation failed: ' + err.message });
  }
});

module.exports = router;
