const express = require('express');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const router = express.Router();

const COMPANY = {
  name: 'EVER GLORY COMPANY LIMITED',
  address: 'Office No. 1301, Corner of Shu Khin Thar Mayopat Road and Aung Tha Khu Street, 6th Ward,',
  address2: 'Thaketa Township, Yangon, Myanmar.',
  tel: 'Tel: +95 9 420 039 009, +95 9 253 006 633 ~ 44',
  email: 'E-mail: info@everglory.com.mm',
  website: 'Website: www.everglory.com.mm',
  hotline: 'Service Hotline: 09 253333466, 09 751669848',
  footer: 'Copyright documents to Engineer Department and administration office of Ever Glory Co.,ltd.',
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const ML = 50;
const MR = 50;
const CW = PAGE_W - ML - MR;

class PdfWriter {
  constructor() {
    this.doc = null;
    this.page = null;
    this.y = 0;
    this.fonts = {};
    this.rowH = 14;
  }

  async init() {
    this.doc = await PDFDocument.create();
    this.fonts.bold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.fonts.normal = await this.doc.embedFont(StandardFonts.Helvetica);
    this.fonts.italic = await this.doc.embedFont(StandardFonts.HelveticaOblique);
    this.addPage();
  }

  addPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - 50;
  }

  text(str, x, y, opts = {}) {
    const font = opts.bold ? this.fonts.bold : opts.italic ? this.fonts.italic : this.fonts.normal;
    const size = opts.size || 8;
    const color = opts.color || rgb(0, 0, 0);
    this.page.drawText(String(str || ''), { x, y, size, font, color });
  }

  textWidth(str, size, bold) {
    const font = bold ? this.fonts.bold : this.fonts.normal;
    return font.widthOfTextAtSize(String(str || ''), size || 8);
  }

  moveTo(x, y) { this._lineX = x; this._lineY = y; }
  lineTo(x, y) {
    this.page.drawLine({ start: { x: this._lineX, y: this._lineY }, end: { x, y }, thickness: 1, color: rgb(0, 0, 0) });
  }
  strokeBlue() {
    this.page.drawLine({ start: { x: ML, y: this._lineY }, end: { x: PAGE_W - MR, y: this._lineY }, thickness: 1, color: rgb(0.102, 0.322, 0.463) });
  }
  lineGray(x, y, x2) {
    this.page.drawLine({ start: { x, y }, end: { x: x2, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
  }
  lineThin(x, y, x2) {
    this.page.drawLine({ start: { x, y }, end: { x: x2 || PAGE_W - MR, y }, thickness: 0.5, color: rgb(0, 0, 0) });
  }

  rect(x, y, w, h, fill) {
    this.page.drawRectangle({ x, y, width: w, height: h, borderWidth: 0.5, borderColor: rgb(0, 0, 0), color: fill || undefined });
  }
  rectBlue(x, y, w, h) {
    this.page.drawRectangle({ x, y, width: w, height: h, borderWidth: 0, color: rgb(0.102, 0.322, 0.463) });
  }

  sectionTitle(title, y) {
    this.text(title, ML, y, { bold: true, size: 9, color: rgb(0.102, 0.322, 0.463) });
    this.page.drawLine({ start: { x: ML, y: y - 4 }, end: { x: PAGE_W - MR, y: y - 4 }, thickness: 1, color: rgb(0.102, 0.322, 0.463) });
    return y - 18;
  }

  drawField(label, value, x, y, w) {
    this.text(label, x, y, { bold: true, size: 8 });
    const lw = this.textWidth(label, 8, true);
    const vx = x + lw + 4;
    this.text(value || '________________', vx, y, { size: 8 });
    this.lineGray(vx, y - 2, x + w);
    return y - 16;
  }

  drawCheckbox(label, checked, x, y) {
    this.rect(x, y, 8, 8);
    if (checked) this.text('X', x + 1.5, y + 1, { size: 8 });
    this.text(label, x + 11, y + 1, { size: 8 });
  }

  drawTable(headers, rows, x, y, colWidths) {
    let curY = y;
    // Header row
    let cx = x;
    headers.forEach((h, i) => {
      this.rectBlue(cx, curY - this.rowH, colWidths[i], this.rowH);
      this.text(h, cx + 2, curY - this.rowH + 3, { bold: true, size: 7, color: rgb(1, 1, 1) });
      cx += colWidths[i];
    });
    curY -= this.rowH;
    // Data rows
    rows.forEach((row) => {
      cx = x;
      row.forEach((cell, i) => {
        this.rect(cx, curY - this.rowH, colWidths[i], this.rowH);
        this.text(String(cell || ''), cx + 2, curY - this.rowH + 3, { size: 7 });
        cx += colWidths[i];
      });
      curY -= this.rowH;
    });
    return curY;
  }

  getBuffer() { return this.doc.save(); }
}

// ═══════════════════════════════════════════════════════════════
// INSTALLATION FORM
// ═══════════════════════════════════════════════════════════════
router.post('/installation/pdf', async (req, res) => {
  try {
    const d = req.body;
    const w = new PdfWriter();
    await w.init();

    // Header
    w.text(COMPANY.name, ML, w.y, { bold: true, size: 14 });
    w.y -= 14;
    w.text(COMPANY.address, ML, w.y, { size: 7 }); w.y -= 9;
    w.text(COMPANY.address2, ML, w.y, { size: 7 }); w.y -= 9;
    w.text(COMPANY.tel, ML, w.y, { size: 7 }); w.y -= 9;
    w.text(`${COMPANY.email}   ${COMPANY.website}`, ML, w.y, { size: 7 }); w.y -= 12;
    w.page.drawLine({ start: { x: ML, y: w.y }, end: { x: PAGE_W - MR, y: w.y }, thickness: 1 }); w.y -= 14;

    // Title
    w.text('Installation and Commissioning Report', ML, w.y, { bold: true, size: 12 });
    w.y -= 20;

    // Doc line
    w.text('Document No: EG-RE-ME-001-00', ML, w.y, { size: 7 });
    w.text(COMPANY.hotline, PAGE_W - MR - w.textWidth(COMPANY.hotline, 7), w.y, { size: 7 });
    w.y -= 14;

    // Fields - two columns
    let y = w.y;
    y = w.drawField("Customer's Name:", d.customer_name, ML, y, 240);
    y = w.drawField('Department/Hospital:', d.hospital, 300, y + 16, 245);
    y -= 16;
    y = w.drawField('Address:', d.address, ML, y, 240);
    y = w.drawField('Township:', d.township, 300, y + 16, 245);
    y -= 16;
    y = w.drawField('Ph No:', d.phone, ML, y, 240);
    y = w.drawField('Email:', d.email, 300, y + 16, 245);
    y -= 16;
    y = w.drawField('Equipment:', d.equipment, ML, y, 240);
    y = w.drawField('Installation Start Date:', d.install_start, 300, y + 16, 245);
    y -= 16;
    y = w.drawField('Model:', d.model, ML, y, 240);
    y = w.drawField('Installation Finished Date:', d.install_finish, 300, y + 16, 245);
    y -= 16;
    y = w.drawField('Serial No:', d.serial_no, ML, y, 240);
    y = w.drawField('Working Day/Time:', d.working_time, 300, y + 16, 245);
    y -= 16;
    y = w.drawField('Installation Date:', d.installation_date, ML, y, 240);
    w.text('Warranty:', 300, y + 14, { bold: true, size: 8 });
    w.drawCheckbox('Under', d.warranty === 'under', 365, y + 14);
    w.drawCheckbox('Over', d.warranty === 'over', 420, y + 14);
    y -= 20;

    // Parts table
    y = w.sectionTitle('Installation Parts and Supplies', y);
    const partHeaders = ['No', 'Item List', 'Qty', 'OPERATIVE', 'NON OPERATIVE', 'REMARKS'];
    const partWidths = [30, 160, 50, 80, 90, 85];
    const partRows = (d.parts || []).slice(0, 9).map((p, i) => [i + 1, p.item || '', p.qty || '', p.operative || '', p.non_operative || '', p.remarks || '']);
    while (partRows.length < 9) partRows.push([partRows.length + 1, '', '', '', '', '']);
    y = w.drawTable(partHeaders, partRows, ML, y, partWidths);

    // Report
    y -= 6;
    y = w.sectionTitle('Report', y);
    w.text(`1  Parts Condition           ( ${d.parts_condition || '   '} )`, ML + 5, y, { size: 8 });
    w.text(`Installation Complete Date:  ${d.install_complete_date || '____/____/2026'}`, 310, y, { size: 8 });
    y -= 14;
    w.text(`2  Installation Condition    ( ${d.install_condition || '   '} )`, ML + 5, y, { size: 8 });
    w.text(`Test Running Date:          ${d.test_running_date || '____/____/2026'}`, 310, y, { size: 8 });
    y -= 14;
    w.text(`3  Operation Condition      ( ${d.operation_condition || '   '} )`, ML + 5, y, { size: 8 });
    w.text('User Training for respective person:', 310, y, { size: 8 });
    w.drawCheckbox('Complete', d.training_complete, 490, y);
    y -= 20;

    // Warranty Exclusions
    w.text('Warranty Exclusions', ML, y, { italic: true, size: 7 }); y -= 10;
    w.text('The distributor shall not be responsible on the following factors:', ML, y, { size: 6.5 }); y -= 8;
    w.text('I.  Natural Disaster.', ML + 5, y, { size: 6.5 }); y -= 8;
    w.text('II. Any defect due to unspecified connection/environment such as Unstable Power Supply, Commercial or', ML + 5, y, { size: 6.5 }); y -= 8;
    w.text('    Generator Failure without protection and End User\'s Fault, Humidity and Air Conditioning shortage etc.', ML + 10, y, { size: 6.5 }); y -= 8;
    w.text('III. Failure caused by customized modification beyond the Manufacturer\'s Recommendation.', ML + 5, y, { size: 6.5 }); y -= 8;
    w.text('IV. Any consumable parts like Lamp, pneumatic tubing, Mechanical Belt, Chassis Cover, Cuvettes etc.', ML + 5, y, { size: 6.5 }); y -= 12;

    // Commission text
    w.text('The above equipment has proven satisfactory in installation, operation, hand-on training and thus passed', ML, y, { size: 7 }); y -= 8;
    w.text(`Commission on date  ${d.commission_date || '____/____/2026'}`, ML, y, { size: 7 }); y -= 8;
    w.text(`Therefore, the Warranty Period shall be from  ${d.warranty_from || '____/____/2026'}  to  ${d.warranty_to || '____/____/2027'}.`, ML, y, { size: 7 }); y -= 14;

    // Remark
    w.text('Remark:', ML, y, { bold: true, size: 8 }); y -= 12;
    if (d.remark) w.text(d.remark, ML + 5, y, { size: 7 });
    y -= 16;

    // Signature line
    w.page.drawLine({ start: { x: ML, y: w.y + (w.y - y) }, end: { x: PAGE_W - MR, y: w.y + (w.y - y) }, thickness: 1 });
    const sigY = y - 4;
    w.text('Authorized Engineer', ML, sigY, { bold: true, size: 8 });
    w.text('Customer/ In Charge', 310, sigY, { bold: true, size: 8 });
    w.text('Signature:', ML, sigY - 16, { size: 8 });
    w.text('Signature:', 310, sigY - 16, { size: 8 });
    w.text('Name:', ML, sigY - 28, { size: 8 });
    w.text('Name:', 310, sigY - 28, { size: 8 });
    w.text('Designation:', ML, sigY - 40, { size: 8 });
    w.text('Designation:', 310, sigY - 40, { size: 8 });

    // Footer
    const footerY = 40;
    w.text(COMPANY.footer, ML, footerY, { italic: true, size: 5 });

    const pdfBytes = await w.getBuffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=installation_report.pdf');
    res.send(Buffer.from(pdfBytes));
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
    const w = new PdfWriter();
    await w.init();

    w.text(COMPANY.name, ML, w.y, { bold: true, size: 14 }); w.y -= 14;
    w.text(COMPANY.address, ML, w.y, { size: 7 }); w.y -= 9;
    w.text(COMPANY.address2, ML, w.y, { size: 7 }); w.y -= 9;
    w.text(COMPANY.tel, ML, w.y, { size: 7 }); w.y -= 9;
    w.text(`${COMPANY.email}   ${COMPANY.website}`, ML, w.y, { size: 7 }); w.y -= 12;
    w.page.drawLine({ start: { x: ML, y: w.y }, end: { x: PAGE_W - MR, y: w.y }, thickness: 1 }); w.y -= 14;

    w.text('Maintenance Report', ML, w.y, { bold: true, size: 12 }); w.y -= 20;
    w.text('Document No: EG-RE-ME-003-00', ML, w.y, { size: 7 });
    w.text(COMPANY.hotline, PAGE_W - MR - w.textWidth(COMPANY.hotline, 7), w.y, { size: 7 }); w.y -= 14;

    let y = w.y;
    y = w.drawField("Customer's Name:", d.customer_name, ML, y, 240);
    y = w.drawField('Department/Hospital:', d.hospital, 300, y + 16, 245); y -= 16;
    y = w.drawField('Address:', d.address, ML, y, 240);
    y = w.drawField('Township:', d.township, 300, y + 16, 245); y -= 16;
    y = w.drawField('Ph No:', d.phone, ML, y, 240);
    y = w.drawField('Email:', d.email, 300, y + 16, 245); y -= 16;
    y = w.drawField('Install Date:', d.install_date, ML, y, 240);
    y = w.drawField('Date:', d.report_date, 300, y + 16, 245); y -= 16;
    y = w.drawField('Equipment:', d.equipment, ML, y, 240); y -= 16;
    y = w.drawField('Model:', d.model, ML, y, 240); y -= 16;
    y = w.drawField('Serial No:', d.serial_no, ML, y, 240);

    y -= 8;
    y = w.sectionTitle('REPORT / ACTION TAKEN', y);
    if (d.report_action) w.text(d.report_action, ML + 5, y, { size: 7 });
    y = Math.max(y - 50, 100);
    w.page.drawLine({ start: { x: ML, y: w.y + (w.y - y) }, end: { x: PAGE_W - MR, y: w.y + (w.y - y) }, thickness: 1 });
    y -= 6;

    y = w.sectionTitle('Checking Up', y);
    const checks = [
      ['1  Parts Condition', d.check_parts], ['5  General Service', d.check_general],
      ['2  Machine Condition', d.check_machine], ['6  Calibration Condition', d.check_calibration],
      ['3  Operation Condition', d.check_operation], ['7  Testing Condition', d.check_testing],
      ['4  Service Condition', d.check_service], ['8  Repair / Breakdown', d.check_repair],
    ];
    for (let i = 0; i < 4; i++) {
      w.text(checks[i][0], ML + 5, y - i * 12, { size: 7 });
      w.text(checks[i + 4][0], 300, y - i * 12, { size: 7 });
    }
    y -= 52;

    w.text('General machine condition', ML + 5, y, { size: 7 });
    w.drawCheckbox('Good', d.general_condition === 'Good', 200, y);
    w.drawCheckbox('Fair', d.general_condition === 'Fair', 260, y);
    w.drawCheckbox('Fail', d.general_condition === 'Fail', 320, y);
    y -= 12;
    w.text('Environment Condition', ML + 5, y, { size: 7 });
    w.drawCheckbox('Good', d.environment_condition === 'Good', 200, y);
    w.drawCheckbox('Fair', d.environment_condition === 'Fair', 260, y);
    w.drawCheckbox('Poor', d.environment_condition === 'Poor', 320, y);
    y -= 16;

    y = w.drawField('Service Start Date:', d.service_start, ML, y, 240);
    y = w.drawField('Service Complete Date:', d.service_complete, 300, y + 16, 245); y -= 16;
    y = w.drawField('Human Error:', d.human_error, ML, y, 240); y -= 2;
    y = w.drawField('Test Running Date:', d.test_running, ML, y, 240);
    w.drawCheckbox('Complete', d.test_complete, 300, y + 14); y -= 16;

    y = w.sectionTitle('ADDITIONAL REMARK', y);
    if (d.additional_remark) w.text(d.additional_remark, ML + 5, y, { size: 7 });
    y = Math.max(y - 30, 100);

    const sigY2 = y - 4;
    w.page.drawLine({ start: { x: ML, y: sigY2 + 4 }, end: { x: PAGE_W - MR, y: sigY2 + 4 }, thickness: 1 });
    w.text('Authorized Engineer', ML, sigY2, { bold: true, size: 8 });
    w.text('Customer/In Charge', 310, sigY2, { bold: true, size: 8 });
    w.text('Signature :', ML, sigY2 - 16, { size: 8 });
    w.text('Signature :', 310, sigY2 - 16, { size: 8 });
    w.text('Name :', ML, sigY2 - 28, { size: 8 });
    w.text('Name :', 310, sigY2 - 28, { size: 8 });
    w.text('Designation :', ML, sigY2 - 40, { size: 8 });
    w.text('Designation :', 310, sigY2 - 40, { size: 8 });

    w.text(COMPANY.footer, ML, 40, { italic: true, size: 5 });

    const pdfBytes = await w.getBuffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=maintenance_report.pdf');
    res.send(Buffer.from(pdfBytes));
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
    const w = new PdfWriter();
    await w.init();

    w.text(COMPANY.name, ML, w.y, { bold: true, size: 14 }); w.y -= 14;
    w.text(COMPANY.address, ML, w.y, { size: 7 }); w.y -= 9;
    w.text(COMPANY.address2, ML, w.y, { size: 7 }); w.y -= 9;
    w.text(COMPANY.tel, ML, w.y, { size: 7 }); w.y -= 9;
    w.text(`${COMPANY.email}   ${COMPANY.website}`, ML, w.y, { size: 7 }); w.y -= 12;
    w.page.drawLine({ start: { x: ML, y: w.y }, end: { x: PAGE_W - MR, y: w.y }, thickness: 1 }); w.y -= 14;

    w.text('Field Service Report', ML, w.y, { bold: true, size: 12 }); w.y -= 20;
    w.text('Document No: EG-RE-ME-002-00', ML, w.y, { size: 7 });
    w.text(COMPANY.hotline, PAGE_W - MR - w.textWidth(COMPANY.hotline, 7), w.y, { size: 7 }); w.y -= 14;

    let y = w.y;
    y = w.drawField("Customer's Name:", d.customer_name, ML, y, 240);
    y = w.drawField('Department/Hospital:', d.hospital, 300, y + 16, 245); y -= 16;
    y = w.drawField('Address:', d.address, ML, y, 240);
    y = w.drawField('Township:', d.township, 300, y + 16, 245); y -= 16;
    y = w.drawField('Ph No:', d.phone, ML, y, 240);
    y = w.drawField('Email:', d.email, 300, y + 16, 245); y -= 16;
    y = w.drawField('Equipment:', d.equipment, ML, y, 240);
    y = w.drawField('Service Start Date:', d.service_start, 300, y + 16, 245); y -= 16;
    y = w.drawField('Model:', d.model, ML, y, 240);
    y = w.drawField('Service Finished Date:', d.service_finish, 300, y + 16, 245); y -= 16;
    y = w.drawField('Serial No:', d.serial_no, ML, y, 240);
    y = w.drawField('Working Day/Time:', d.working_time, 300, y + 16, 245); y -= 16;
    y = w.drawField('Installation Date:', d.installation_date, ML, y, 240);
    w.text('Warranty:', 300, y + 14, { bold: true, size: 8 });
    w.drawCheckbox('Under', d.warranty === 'under', 365, y + 14);
    w.drawCheckbox('Over', d.warranty === 'over', 420, y + 14);
    y -= 20;

    y = w.sectionTitle('Failure Description', y);
    if (d.failure_description) w.text(d.failure_description, ML + 5, y, { size: 7 });
    y = Math.max(y - 24, 100);

    y = w.sectionTitle('Inspection & Fixed', y);
    if (d.inspection_fixed) w.text(d.inspection_fixed, ML + 5, y, { size: 7 });
    y = Math.max(y - 24, 100);

    w.text('Action(s) Taken:', ML, y, { bold: true, size: 8 });
    w.drawCheckbox('Maintained', (d.actions_taken || '').toLowerCase().includes('maintained'), 165, y);
    w.drawCheckbox('Reconditioned', (d.actions_taken || '').toLowerCase().includes('reconditioned'), 260, y);
    w.drawCheckbox('Replace', (d.actions_taken || '').toLowerCase().includes('replace'), 370, y);
    w.drawCheckbox('Repair', (d.actions_taken || '').toLowerCase().includes('repair'), 450, y);
    y -= 16;

    y = w.sectionTitle('PARTS', y);
    const partHeaders = ['No', 'Parts', 'Descriptions', 'Unit Price', 'Qty', 'Amount(Kyat)'];
    const partWidths = [30, 90, 140, 80, 50, 95];
    const partRows = (d.parts || []).slice(0, 5).map((p, i) => [i + 1, p.name || '', p.description || '', p.unit_price || '', p.qty || '', p.amount || '']);
    while (partRows.length < 5) partRows.push([partRows.length + 1, '', '', '', '', '']);
    y = w.drawTable(partHeaders, partRows, ML, y, partWidths);

    w.text('Total (Kyat)', 370, y + 2, { bold: true, size: 7 });
    w.text('FOC (Kyat)', 370, y - 10, { bold: true, size: 7 });
    w.text('Net (Kyat)', 370, y - 22, { bold: true, size: 7 });
    w.text(d.parts_total || '', 460, y + 2, { size: 7 });
    w.text(d.parts_foc || '', 460, y - 10, { size: 7 });
    w.text(d.parts_net || '', 460, y - 22, { size: 7 });
    y -= 36;

    y = w.sectionTitle('FEE CHARGES', y);
    const feeHeaders = ['No', 'Fees', 'Descriptions', 'Per day fee', 'Days', 'Amount(Kyat)'];
    const feeWidths = [30, 120, 120, 80, 50, 95];
    const feeLabels = ['Service Fees', 'Transportation Fees', 'Costs of meal', 'Accommodation Fees', 'Other Fee'];
    const feeRows = feeLabels.map((label, i) => {
      const fd = (d.fees || [])[i] || {};
      return [i + 1, label, fd.description || '', fd.per_day || '', fd.days || '', fd.amount || ''];
    });
    y = w.drawTable(feeHeaders, feeRows, ML, y, feeWidths);

    w.text('Total (Kyat)', 370, y + 2, { bold: true, size: 7 });
    w.text('FOC (Kyat)', 370, y - 10, { bold: true, size: 7 });
    w.text('Net (Kyat)', 370, y - 22, { bold: true, size: 7 });
    w.text(d.fee_total || '', 460, y + 2, { size: 7 });
    w.text(d.fee_foc || '', 460, y - 10, { size: 7 });
    w.text(d.fee_net || '', 460, y - 22, { size: 7 });
    y -= 36;

    w.text('Grand Total (Kyat)', 350, y, { bold: true, size: 7 });
    w.text(d.grand_total || '', 460, y, { bold: true, size: 7 });
    y -= 12;
    w.text('By Word:', ML, y, { size: 7 });
    w.text(d.grand_total_word || '', ML + 50, y, { size: 7 });
    y -= 14;

    w.text('Environmental Condition(Humidity, Dust, Electricity, etc.)', ML, y, { bold: true, size: 7 });
    w.drawCheckbox('Good', d.env_condition?.toLowerCase() === 'good', 370, y);
    w.drawCheckbox('Fair', d.env_condition?.toLowerCase() === 'fair', 420, y);
    w.drawCheckbox('Poor', d.env_condition?.toLowerCase() === 'poor', 470, y);
    y -= 16;

    const sigY3 = y - 4;
    w.page.drawLine({ start: { x: ML, y: sigY3 + 4 }, end: { x: PAGE_W - MR, y: sigY3 + 4 }, thickness: 1 });
    w.text('Authorized Engineer', ML, sigY3, { bold: true, size: 8 });
    w.text('Customer/ In Charge', 310, sigY3, { bold: true, size: 8 });
    w.text('Signature -', ML, sigY3 - 16, { size: 8 });
    w.text('Signature -', 310, sigY3 - 16, { size: 8 });
    w.text('Name -', ML, sigY3 - 28, { size: 8 });
    w.text('Name -', 310, sigY3 - 28, { size: 8 });
    w.text('Designation -', ML, sigY3 - 40, { size: 8 });
    w.text('Designation -', 310, sigY3 - 40, { size: 8 });

    w.text(COMPANY.footer, ML, 40, { italic: true, size: 5 });

    const pdfBytes = await w.getBuffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=field_service_report.pdf');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Field Service PDF error:', err);
    res.status(500).json({ success: false, message: 'PDF generation failed: ' + err.message });
  }
});

module.exports = router;
