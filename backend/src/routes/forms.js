const express = require('express');
const PDFDocument = require('pdfkit');

const router = express.Router();

const COMPANY = {
  name: 'EVER GLORY COMPANY LIMITED',
  address: 'Office No. 1301, Corner of Shu Khin Thar Mayopat Road and Aung Tha Khu Street, 6th Ward,',
  address2: 'Thaketa Township, Yangon, Myanmar.',
  tel: 'Tel: +95 9 420 039 009, +95 9 253 006 633 ~ 44',
  email: 'E-mail: info@everglory.com.mm',
  website: 'Website: www.everglory.com.mm',
  hotline: 'Service Hotline: 09 253333466, 09 751669848',
};

// Helper: buffer PDF instead of streaming (Vercel serverless compatible)
function bufferPdf(buildFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try { buildFn(doc); doc.end(); } catch (e) { reject(e); }
  });
}

function drawHeader(doc) {
  doc.fontSize(14).font('Helvetica-Bold').text(COMPANY.name, { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(7).font('Helvetica').text(COMPANY.address, { align: 'center' });
  doc.text(COMPANY.address2, { align: 'center' });
  doc.text(COMPANY.tel, { align: 'center' });
  doc.text(`${COMPANY.email}   ${COMPANY.website}`, { align: 'center' });
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.3);
}

function drawField(doc, label, value, x, y, w) {
  doc.fontSize(8).font('Helvetica-Bold').text(label, x, y);
  const valX = x + doc.widthOfString(label) + 4;
  doc.font('Helvetica').text(value || '________________', valX, y, { width: w - doc.widthOfString(label) - 8 });
  const lineY = y + 12;
  doc.moveTo(valX, lineY).lineTo(x + w, lineY).strokeColor('#999').lineWidth(0.5).stroke().strokeColor('black').lineWidth(1);
  return lineY + 4;
}

function drawCheckbox(doc, label, checked, x, y) {
  doc.fontSize(8).font('Helvetica').rect(x, y, 8, 8).stroke();
  if (checked) { doc.fontSize(8).text('X', x + 1.5, y + 0.5); }
  doc.text(label, x + 11, y + 1);
  return doc;
}

function drawSectionTitle(doc, title, y) {
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a5276').text(title, 50, y);
  doc.fillColor('black');
  doc.moveTo(50, y + 12).lineTo(545, y + 12).strokeColor('#1a5276').lineWidth(1).stroke().strokeColor('black').lineWidth(1);
  return y + 16;
}

function drawTable(doc, headers, rows, x, y, colWidths) {
  let curY = y;
  const rowH = 14;
  doc.fontSize(7).font('Helvetica-Bold');
  headers.forEach((h, i) => {
    const colX = x + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.rect(colX, curY, colWidths[i], rowH).fill('#1a5276').fillColor('white').text(h, colX + 2, curY + 3, { width: colWidths[i] - 4 });
  });
  curY += rowH;
  doc.font('Helvetica').fillColor('black');
  rows.forEach((row) => {
    row.forEach((cell, i) => {
      const colX = x + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.rect(colX, curY, colWidths[i], rowH).stroke();
      doc.text(String(cell || ''), colX + 2, curY + 3, { width: colWidths[i] - 4 });
    });
    curY += rowH;
  });
  return curY;
}

// ═══════════════════════════════════════════════════════════════
// INSTALLATION FORM
// ═══════════════════════════════════════════════════════════════
router.post('/installation/pdf', async (req, res) => {
  try {
    const d = req.body;
    const pdf = await bufferPdf((doc) => {
      drawHeader(doc);
      doc.fontSize(12).font('Helvetica-Bold').text('Installation and Commissioning Report', { align: 'center' });
      doc.moveDown(0.5);

      const y0 = doc.y;
      doc.fontSize(7).font('Helvetica').text('Document No: EG-RE-ME-001-00', 50, y0);
      doc.text(COMPANY.hotline, 320, y0, { align: 'right', width: 225 });
      doc.text('Page 1 of 1', 500, y0, { align: 'right', width: 50 });
      doc.moveDown(0.8);

      let y = doc.y;
      y = drawField(doc, "Customer's Name:", d.customer_name, 50, y, 240);
      y = drawField(doc, 'Department/Hospital:', d.hospital, 300, y - 16, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Address:', d.address, 50, y, 240);
      y = drawField(doc, 'Township:', d.township, 300, y, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Ph No:', d.phone, 50, y, 240);
      y = drawField(doc, 'Email:', d.email, 300, y, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Equipment:', d.equipment, 50, y, 240);
      y = drawField(doc, 'Installation Start Date:', d.install_start, 300, y, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Model:', d.model, 50, y, 240);
      y = drawField(doc, 'Installation Finished Date:', d.install_finish, 300, y, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Serial No:', d.serial_no, 50, y, 240);
      y = drawField(doc, 'Working Day/Time:', d.working_time, 300, y, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Installation Date:', d.installation_date, 50, y, 240);
      doc.fontSize(8).font('Helvetica-Bold').text('Warranty:', 300, y);
      drawCheckbox(doc, 'Under', d.warranty === 'under', 365, y);
      drawCheckbox(doc, 'Over', d.warranty === 'over', 420, y);
      y += 18;

      y = drawSectionTitle(doc, 'Installation Parts and Supplies', y + 4);
      const partHeaders = ['No', 'Item List', 'Qty', 'OPERATIVE', 'NON OPERATIVE', 'REMARKS'];
      const partWidths = [30, 160, 50, 80, 90, 85];
      const partRows = (d.parts || []).map((p, i) => [i + 1, p.item || '', p.qty || '', p.operative || '', p.non_operative || '', p.remarks || '']);
      while (partRows.length < 9) partRows.push([partRows.length + 1, '', '', '', '', '']);
      y = drawTable(doc, partHeaders, partRows.slice(0, 9), 50, y, partWidths);

      y = drawSectionTitle(doc, 'Report', y + 6);
      doc.fontSize(8).font('Helvetica');
      doc.text(`1  Parts Condition            ( ${d.parts_condition || '   '} )`, 55, y);
      doc.text(`Installation Complete Date:   ${d.install_complete_date || '____/____/2026'}`, 310, y);
      y += 14;
      doc.text(`2  Installation Condition     ( ${d.install_condition || '   '} )`, 55, y);
      doc.text(`Test Running Date:           ${d.test_running_date || '____/____/2026'}`, 310, y);
      y += 14;
      doc.text(`3  Operation Condition       ( ${d.operation_condition || '   '} )`, 55, y);
      doc.text('User Training for respective person:', 310, y);
      drawCheckbox(doc, 'Complete', d.training_complete, 490, y);
      y += 20;

      doc.fontSize(7).font('Helvetica-Oblique').text('Warranty Exclusions', 50, y);
      y += 10;
      doc.fontSize(6.5).font('Helvetica').text('The distributor shall not be responsible on the following factors:', 50, y);
      y += 8;
      doc.text('I.  Natural Disaster.', 55, y); y += 8;
      doc.text('II. Any defect due to unspecified connection/environment such as Unstable Power Supply, Commercial or', 55, y); y += 8;
      doc.text('    Generator Failure without protection and End User\'s Fault, Humidity and Air Conditioning shortage etc.', 60, y); y += 8;
      doc.text('III. Failure caused by customized modification beyond the Manufacturer\'s Recommendation.', 55, y); y += 8;
      doc.text('IV. Any consumable parts like Lamp, pneumatic tubing, Mechanical Belt, Chassis Cover, Cuvettes etc.', 55, y); y += 10;

      doc.fontSize(7).font('Helvetica').text('The above equipment has proven satisfactory in installation, operation, hand-on training and thus passed', 50, y); y += 8;
      doc.text(`Commission on date  ${d.commission_date || '____/____/2026'}`, 50, y); y += 8;
      doc.text(`Therefore, the Warranty Period shall be from  ${d.warranty_from || '____/____/2026'}  to  ${d.warranty_to || '____/____/2027'}.`, 50, y); y += 14;

      doc.fontSize(8).font('Helvetica-Bold').text('Remark:', 50, y); y += 12;
      doc.fontSize(7).font('Helvetica').text(d.remark || '', 55, y, { width: 490 });
      y = doc.y + 16;

      doc.moveTo(50, y).lineTo(545, y).stroke(); y += 10;
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('Authorized Engineer', 50, y);
      doc.text('Customer/ In Charge', 310, y);
      y += 16;
      doc.font('Helvetica');
      doc.text('Signature:', 50, y); doc.text('Signature:', 310, y);
      y += 12;
      doc.text('Name:', 50, y); doc.text('Name:', 310, y);
      y += 12;
      doc.text('Designation:', 50, y); doc.text('Designation:', 310, y);

      doc.fontSize(5).font('Helvetica-Oblique').text('Copyright documents to Engineer Department and administration office of Ever Glory Co.,ltd.', 50, doc.page.height - 40, { align: 'center', width: 495 });
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=installation_report.pdf');
    res.send(pdf);
  } catch (err) {
    console.error('Installation PDF error:', err);
    res.status(500).json({ success: false, message: 'PDF generation failed: ' + (err.message || 'unknown') });
  }
});

// ═══════════════════════════════════════════════════════════════
// MAINTENANCE FORM
// ═══════════════════════════════════════════════════════════════
router.post('/maintenance/pdf', async (req, res) => {
  try {
    const d = req.body;
    const pdf = await bufferPdf((doc) => {
      drawHeader(doc);
      doc.fontSize(12).font('Helvetica-Bold').text('Maintenance Report', { align: 'center' });
      doc.moveDown(0.5);

      const y0 = doc.y;
      doc.fontSize(7).font('Helvetica').text('Document No: EG-RE-ME-003-00', 50, y0);
      doc.text(COMPANY.hotline, 320, y0, { align: 'right', width: 225 });
      doc.text('Page 1 of 1', 500, y0, { align: 'right', width: 50 });
      doc.moveDown(0.8);

      let y = doc.y;
      y = drawField(doc, "Customer's Name:", d.customer_name, 50, y, 240);
      y = drawField(doc, 'Department/Hospital:', d.hospital, 300, y - 16, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Address:', d.address, 50, y, 240);
      y = drawField(doc, 'Township:', d.township, 300, y, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Ph No:', d.phone, 50, y, 240);
      y = drawField(doc, 'Email:', d.email, 300, y, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Install Date:', d.install_date, 50, y, 240);
      y = drawField(doc, 'Date:', d.report_date, 300, y, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Equipment:', d.equipment, 50, y, 240);
      y = drawField(doc, '', '', 300, y, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Model:', d.model, 50, y, 240);
      y = drawField(doc, '', '', 300, y, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Serial No:', d.serial_no, 50, y, 240);

      y += 8;
      y = drawSectionTitle(doc, 'REPORT / ACTION TAKEN', y);
      doc.fontSize(7).font('Helvetica');
      const reportText = d.report_action || '';
      doc.text(reportText, 55, y + 4, { width: 490, lineGap: 2 });
      y = Math.max(doc.y + 6, y + 60);
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 6;

      y = drawSectionTitle(doc, 'Checking Up', y + 4);
      const checks = [
        ['1  Parts Condition', d.check_parts], ['5  General Service', d.check_general],
        ['2  Machine Condition', d.check_machine], ['6  Calibration Condition', d.check_calibration],
        ['3  Operation Condition', d.check_operation], ['7  Testing Condition', d.check_testing],
        ['4  Service Condition', d.check_service], ['8  Repair / Breakdown', d.check_repair],
      ];
      doc.fontSize(7).font('Helvetica');
      for (let i = 0; i < 4; i++) {
        doc.text(checks[i][0], 55, y + i * 12);
        doc.text(checks[i + 4][0], 300, y + i * 12);
      }
      y += 52;

      doc.fontSize(7);
      doc.text('General machine condition', 55, y);
      drawCheckbox(doc, 'Good', d.general_condition === 'Good', 200, y);
      drawCheckbox(doc, 'Fair', d.general_condition === 'Fair', 260, y);
      drawCheckbox(doc, 'Fail', d.general_condition === 'Fail', 320, y);
      y += 12;
      doc.text('Environment Condition', 55, y);
      drawCheckbox(doc, 'Good', d.environment_condition === 'Good', 200, y);
      drawCheckbox(doc, 'Fair', d.environment_condition === 'Fair', 260, y);
      drawCheckbox(doc, 'Poor', d.environment_condition === 'Poor', 320, y);
      y += 14;

      y = drawField(doc, 'Service Start Date:', d.service_start, 50, y, 240);
      y = drawField(doc, 'Service Complete Date:', d.service_complete, 300, y - 16, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Human Error:', d.human_error, 50, y, 240);
      y += 4;
      y = drawField(doc, 'Test Running Date:', d.test_running, 50, y, 240);
      drawCheckbox(doc, 'Complete', d.test_complete, 300, y);
      y += 16;

      y = drawSectionTitle(doc, 'ADDITIONAL REMARK', y);
      doc.fontSize(7).font('Helvetica').text(d.additional_remark || '', 55, y + 4, { width: 490 });
      y = Math.max(doc.y + 10, y + 30);

      doc.moveTo(50, y).lineTo(545, y).stroke(); y += 10;
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('Authorized Engineer', 50, y);
      doc.text('Customer/In Charge', 310, y);
      y += 16;
      doc.font('Helvetica');
      doc.text('Signature :', 50, y); doc.text('Signature :', 310, y);
      y += 12;
      doc.text('Name :', 50, y); doc.text('Name :', 310, y);
      y += 12;
      doc.text('Designation :', 50, y); doc.text('Designation :', 310, y);

      doc.fontSize(5).font('Helvetica-Oblique').text('Copyright documents to Engineer Department and administration office of Ever Glory Co.,ltd.', 50, doc.page.height - 40, { align: 'center', width: 495 });
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=maintenance_report.pdf');
    res.send(pdf);
  } catch (err) {
    console.error('Maintenance PDF error:', err);
    res.status(500).json({ success: false, message: 'PDF generation failed: ' + (err.message || 'unknown') });
  }
});

// ═══════════════════════════════════════════════════════════════
// FIELD SERVICE FORM
// ═══════════════════════════════════════════════════════════════
router.post('/field-service/pdf', async (req, res) => {
  try {
    const d = req.body;
    const pdf = await bufferPdf((doc) => {
      drawHeader(doc);
      doc.fontSize(12).font('Helvetica-Bold').text('Field Service Report', { align: 'center' });
      doc.moveDown(0.5);

      const y0 = doc.y;
      doc.fontSize(7).font('Helvetica').text('Document No: EG-RE-ME-002-00', 50, y0);
      doc.text(COMPANY.hotline, 320, y0, { align: 'right', width: 225 });
      doc.text('Page 1 of 1', 500, y0, { align: 'right', width: 50 });
      doc.moveDown(0.8);

      let y = doc.y;
      y = drawField(doc, "Customer's Name:", d.customer_name, 50, y, 240);
      y = drawField(doc, 'Department/Hospital:', d.hospital, 300, y - 16, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Address:', d.address, 50, y, 240);
      y = drawField(doc, 'Township:', d.township, 300, y, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Ph No:', d.phone, 50, y, 240);
      y = drawField(doc, 'Email:', d.email, 300, y, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Equipment:', d.equipment, 50, y, 240);
      y = drawField(doc, 'Service Start Date:', d.service_start, 300, y, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Model:', d.model, 50, y, 240);
      y = drawField(doc, 'Service Finished Date:', d.service_finish, 300, y, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Serial No:', d.serial_no, 50, y, 240);
      y = drawField(doc, 'Working Day/Time:', d.working_time, 300, y, 245);
      y = Math.max(y, y + 16);
      y = drawField(doc, 'Installation Date:', d.installation_date, 50, y, 240);
      doc.fontSize(8).font('Helvetica-Bold').text('Warranty:', 300, y);
      drawCheckbox(doc, 'Under', d.warranty === 'under', 365, y);
      drawCheckbox(doc, 'Over', d.warranty === 'over', 420, y);
      y += 18;

      y = drawSectionTitle(doc, 'Failure Description', y);
      doc.fontSize(7).font('Helvetica').text(d.failure_description || '', 55, y + 4, { width: 490, lineGap: 2 });
      y = Math.max(doc.y + 6, y + 30);

      y = drawSectionTitle(doc, 'Inspection & Fixed', y);
      doc.fontSize(7).font('Helvetica').text(d.inspection_fixed || '', 55, y + 4, { width: 490, lineGap: 2 });
      y = Math.max(doc.y + 6, y + 30);

      doc.fontSize(8).font('Helvetica-Bold').text('Action(s) Taken:', 50, y);
      drawCheckbox(doc, 'Maintained', (d.actions_taken || '').toLowerCase().includes('maintained'), 165, y);
      drawCheckbox(doc, 'Reconditioned', (d.actions_taken || '').toLowerCase().includes('reconditioned'), 260, y);
      drawCheckbox(doc, 'Replace', (d.actions_taken || '').toLowerCase().includes('replace'), 370, y);
      drawCheckbox(doc, 'Repair', (d.actions_taken || '').toLowerCase().includes('repair'), 450, y);
      y += 16;

      y = drawSectionTitle(doc, 'PARTS', y);
      const partHeaders = ['No', 'Parts', 'Descriptions', 'Unit Price', 'Qty', 'Amount(Kyat)'];
      const partWidths = [30, 90, 140, 80, 50, 95];
      const partRows = (d.parts || []).map((p, i) => [i + 1, p.name || '', p.description || '', p.unit_price || '', p.qty || '', p.amount || '']);
      while (partRows.length < 5) partRows.push([partRows.length + 1, '', '', '', '', '']);
      y = drawTable(doc, partHeaders, partRows.slice(0, 5), 50, y, partWidths);

      doc.fontSize(7).font('Helvetica-Bold');
      doc.text('Total (Kyat)', 370, y + 2);
      doc.text('FOC (Kyat)', 370, y + 14);
      doc.text('Net (Kyat)', 370, y + 26);
      doc.font('Helvetica');
      doc.text(d.parts_total || '', 460, y + 2);
      doc.text(d.parts_foc || '', 460, y + 14);
      doc.text(d.parts_net || '', 460, y + 26);
      y += 40;

      y = drawSectionTitle(doc, 'FEE CHARGES', y);
      const feeHeaders = ['No', 'Fees', 'Descriptions', 'Per day fee', 'Days', 'Amount(Kyat)'];
      const feeWidths = [30, 120, 120, 80, 50, 95];
      const feeLabels = ['Service Fees', 'Transportation Fees', 'Costs of meal', 'Accommodation Fees', 'Other Fee'];
      const feeRows = feeLabels.map((label, i) => {
        const fd = (d.fees || [])[i] || {};
        return [i + 1, label, fd.description || '', fd.per_day || '', fd.days || '', fd.amount || ''];
      });
      y = drawTable(doc, feeHeaders, feeRows, 50, y, feeWidths);

      doc.fontSize(7).font('Helvetica-Bold');
      doc.text('Total (Kyat)', 370, y + 2);
      doc.text('FOC (Kyat)', 370, y + 14);
      doc.text('Net (Kyat)', 370, y + 26);
      doc.text('Grand Total (Kyat)', 350, y + 38);
      doc.font('Helvetica');
      doc.text(d.fee_total || '', 460, y + 2);
      doc.text(d.fee_foc || '', 460, y + 14);
      doc.text(d.fee_net || '', 460, y + 26);
      doc.font('Helvetica-Bold').text(d.grand_total || '', 460, y + 38);
      y += 56;

      doc.font('Helvetica').fontSize(7).text('By Word:', 50, y);
      doc.text(d.grand_total_word || '', 100, y);
      y += 14;

      doc.fontSize(7).font('Helvetica-Bold').text('Environmental Condition(Humidity, Dust, Electricity, etc.)', 50, y);
      drawCheckbox(doc, 'Good', d.env_condition?.toLowerCase() === 'good', 370, y);
      drawCheckbox(doc, 'Fair', d.env_condition?.toLowerCase() === 'fair', 420, y);
      drawCheckbox(doc, 'Poor', d.env_condition?.toLowerCase() === 'poor', 470, y);
      y += 16;

      doc.moveTo(50, y).lineTo(545, y).stroke(); y += 10;
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('Authorized Engineer', 50, y);
      doc.text('Customer/ In Charge', 310, y);
      y += 16;
      doc.font('Helvetica');
      doc.text('Signature -', 50, y); doc.text('Signature -', 310, y);
      y += 12;
      doc.text('Name -', 50, y); doc.text('Name -', 310, y);
      y += 12;
      doc.text('Designation -', 50, y); doc.text('Designation -', 310, y);

      doc.fontSize(5).font('Helvetica-Oblique').text('Copyright documents to Engineer Department and administration office of Ever Glory Co.,ltd.', 50, doc.page.height - 40, { align: 'center', width: 495 });
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=field_service_report.pdf');
    res.send(pdf);
  } catch (err) {
    console.error('Field Service PDF error:', err);
    res.status(500).json({ success: false, message: 'PDF generation failed: ' + (err.message || 'unknown') });
  }
});

module.exports = router;
