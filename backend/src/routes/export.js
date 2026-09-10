const express = require('express');
const ExcelJS = require('exceljs');
const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType } = require('docx');
const pool = require('../config/database');

const router = express.Router();

const MACHINE_SELECT = `
  SELECT m.*,
    t.name AS township_name, t.region AS township_region,
    b.name AS brand_name,
    mt.name AS machine_type_name,
    mo.name AS model_name
  FROM machines m
  JOIN townships t ON m.township_id = t.id
  JOIN brands b ON m.brand_id = b.id
  JOIN machine_types mt ON m.machine_type_id = mt.id
  LEFT JOIN models mo ON m.model_id = mo.id
`;

const PM_SELECT = `
  SELECT ps.*,
    m.serial_number, m.hospital_name, m.model, m.contact_person, m.contact_phone,
    t.name AS township_name,
    b.name AS brand_name,
    mt.name AS machine_type_name
  FROM pm_schedules ps
  JOIN machines m ON ps.machine_id = m.id
  JOIN townships t ON m.township_id = t.id
  JOIN brands b ON m.brand_id = b.id
  JOIN machine_types mt ON m.machine_type_id = mt.id
`;

const TICKET_SELECT = `
  SELECT st.*,
    m.serial_number, m.hospital_name, m.model, m.contact_person, m.contact_phone,
    b.name AS brand_name,
    mt.name AS machine_type_name,
    t.name AS township_name
  FROM service_tickets st
  JOIN machines m ON st.machine_id = m.id
  JOIN brands b ON m.brand_id = b.id
  JOIN machine_types mt ON m.machine_type_id = mt.id
  LEFT JOIN townships t ON m.township_id = t.id
`;

function buildMachineWhere(query) {
  let where = 'WHERE 1=1';
  const params = [];
  let i = 1;
  if (query.search) {
    where += ` AND (m.serial_number ILIKE $${i} OR m.hospital_name ILIKE $${i} OR m.model ILIKE $${i})`;
    params.push(`%${query.search}%`); i++;
  }
  if (query.township_id) { where += ` AND m.township_id = $${i}`; params.push(query.township_id); i++; }
  if (query.brand_id) { where += ` AND m.brand_id = $${i}`; params.push(query.brand_id); i++; }
  if (query.machine_type_id) { where += ` AND m.machine_type_id = $${i}`; params.push(query.machine_type_id); i++; }
  return { where, params };
}

function buildPMWhere(query) {
  let where = 'WHERE 1=1';
  const params = [];
  let i = 1;
  if (query.status) { where += ` AND ps.status = $${i}`; params.push(query.status); i++; }
  if (query.machine_id) { where += ` AND ps.machine_id = $${i}`; params.push(query.machine_id); i++; }
  if (query.township_id) { where += ` AND m.township_id = $${i}`; params.push(query.township_id); i++; }
  if (query.date_from) { where += ` AND ps.pm_date >= $${i}`; params.push(query.date_from); i++; }
  if (query.date_to) { where += ` AND ps.pm_date <= $${i}`; params.push(query.date_to); i++; }
  return { where, params };
}

function buildTicketWhere(query) {
  let where = 'WHERE 1=1';
  const params = [];
  let i = 1;
  if (query.status) { where += ` AND st.status = $${i}`; params.push(query.status); i++; }
  if (query.solving_type) { where += ` AND st.solving_type = $${i}`; params.push(query.solving_type); i++; }
  if (query.machine_id) { where += ` AND st.machine_id = $${i}`; params.push(query.machine_id); i++; }
  if (query.search) {
    where += ` AND (st.ticket_number ILIKE $${i} OR st.error_type ILIKE $${i} OR m.serial_number ILIKE $${i} OR m.hospital_name ILIKE $${i})`;
    params.push(`%${query.search}%`); i++;
  }
  if (query.date_from) { where += ` AND st.complaint_date >= $${i}`; params.push(query.date_from); i++; }
  if (query.date_to) { where += ` AND st.complaint_date <= $${i}`; params.push(query.date_to); i++; }
  return { where, params };
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB');
}

function formatDateTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-GB');
}

// ── Machine Excel ───────────────────────────────────────────
router.get('/machines/excel', async (req, res) => {
  try {
    const { where, params } = buildMachineWhere(req.query);
    const result = await pool.query(`${MACHINE_SELECT} ${where} ORDER BY m.created_at DESC`, params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Machine Registry');
    ws.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Serial Number', key: 'serial_number', width: 18 },
      { header: 'Hospital', key: 'hospital_name', width: 25 },
      { header: 'Township', key: 'township_name', width: 18 },
      { header: 'Region', key: 'township_region', width: 15 },
      { header: 'Brand', key: 'brand_name', width: 15 },
      { header: 'Model', key: 'model', width: 18 },
      { header: 'Type', key: 'machine_type_name', width: 18 },
      { header: 'Contact Person', key: 'contact_person', width: 18 },
      { header: 'Contact Phone', key: 'contact_phone', width: 15 },
      { header: 'Installation Date', key: 'installation_date', width: 15 },
      { header: 'Service Fees', key: 'service_fees', width: 12 },
      { header: 'Transport Fees', key: 'transport_fees', width: 12 },
      { header: 'Training Fees', key: 'training_fees', width: 12 },
      { header: 'Technician', key: 'technician_names', width: 20 },
      { header: 'Notes', key: 'notes', width: 25 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    headerRow.alignment = { horizontal: 'center' };

    result.rows.forEach((r, i) => {
      ws.addRow({
        no: i + 1,
        serial_number: r.serial_number,
        hospital_name: r.hospital_name,
        township_name: r.township_name,
        township_region: r.township_region,
        brand_name: r.brand_name,
        model: r.model,
        machine_type_name: r.machine_type_name,
        contact_person: r.contact_person,
        contact_phone: r.contact_phone,
        installation_date: formatDate(r.installation_date),
        service_fees: r.service_fees,
        transport_fees: r.transport_fees,
        training_fees: r.training_fees,
        technician_names: r.technician_names,
        notes: r.notes,
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=machine_registry.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export machines excel error:', err);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// ── Machine Word ────────────────────────────────────────────
router.get('/machines/word', async (req, res) => {
  try {
    const { where, params } = buildMachineWhere(req.query);
    const result = await pool.query(`${MACHINE_SELECT} ${where} ORDER BY m.created_at DESC`, params);

    const headerCells = ['No', 'Serial #', 'Hospital', 'Township', 'Brand', 'Model', 'Type', 'Contact', 'Phone', 'Installed'];
    const headerRow = new TableRow({
      children: headerCells.map(text => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18, font: 'Calibri' })] })],
        shading: { type: ShadingType.SOLID, color: '2563EB', fill: '2563EB' },
      })),
    });

    const dataRows = result.rows.map((r, i) => new TableRow({
      children: [
        i + 1, r.serial_number, r.hospital_name, r.township_name,
        r.brand_name, r.model, r.machine_type_name,
        r.contact_person, r.contact_phone, formatDate(r.installation_date),
      ].map(text => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(text || ''), size: 18, font: 'Calibri' })] })],
      })),
    }));

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children: [
          new Paragraph({ text: 'Machine Registry', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: `Exported: ${new Date().toLocaleString('en-GB')}`, spacing: { after: 200 } }),
          new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=machine_registry.docx');
    res.send(buffer);
  } catch (err) {
    console.error('Export machines word error:', err);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// ── PM Schedules Excel ──────────────────────────────────────
router.get('/pm/excel', async (req, res) => {
  try {
    const { where, params } = buildPMWhere(req.query);
    const result = await pool.query(`${PM_SELECT} ${where} ORDER BY ps.pm_date ASC`, params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('PM Schedules');
    ws.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Serial Number', key: 'serial_number', width: 18 },
      { header: 'Hospital', key: 'hospital_name', width: 25 },
      { header: 'Township', key: 'township_name', width: 18 },
      { header: 'Brand', key: 'brand_name', width: 15 },
      { header: 'Model', key: 'model', width: 18 },
      { header: 'Type', key: 'machine_type_name', width: 18 },
      { header: 'PM Number', key: 'pm_number', width: 10 },
      { header: 'PM Date', key: 'pm_date', width: 13 },
      { header: 'Window Start', key: 'window_start', width: 13 },
      { header: 'Window End', key: 'window_end', width: 13 },
      { header: 'Status', key: 'status', width: 13 },
      { header: 'Completed Date', key: 'completed_date', width: 15 },
      { header: 'Completed By', key: 'completed_by', width: 18 },
      { header: 'Action Date', key: 'action_date', width: 13 },
      { header: 'Notes', key: 'notes', width: 25 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
    headerRow.alignment = { horizontal: 'center' };

    result.rows.forEach((r, i) => {
      ws.addRow({
        no: i + 1,
        serial_number: r.serial_number,
        hospital_name: r.hospital_name,
        township_name: r.township_name,
        brand_name: r.brand_name,
        model: r.model,
        machine_type_name: r.machine_type_name,
        pm_number: `PM ${r.pm_number}`,
        pm_date: formatDate(r.pm_date),
        window_start: formatDate(r.window_start),
        window_end: formatDate(r.window_end),
        status: r.status,
        completed_date: formatDate(r.completed_date),
        completed_by: r.completed_by,
        action_date: formatDate(r.action_date),
        notes: r.notes,
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=pm_schedules.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export pm excel error:', err);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// ── PM Schedules Word ───────────────────────────────────────
router.get('/pm/word', async (req, res) => {
  try {
    const { where, params } = buildPMWhere(req.query);
    const result = await pool.query(`${PM_SELECT} ${where} ORDER BY ps.pm_date ASC`, params);

    const headerCells = ['No', 'Serial #', 'Hospital', 'PM', 'Target Date', 'Period', 'Status', 'Completed'];
    const headerRow = new TableRow({
      children: headerCells.map(text => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18, font: 'Calibri' })] })],
        shading: { type: ShadingType.SOLID, color: '16A34A', fill: '16A34A' },
      })),
    });

    const dataRows = result.rows.map((r, i) => new TableRow({
      children: [
        i + 1, r.serial_number, r.hospital_name, `PM ${r.pm_number}`,
        formatDate(r.pm_date), `${formatDate(r.window_start)} - ${formatDate(r.window_end)}`,
        r.status, formatDate(r.completed_date),
      ].map(text => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(text || ''), size: 18, font: 'Calibri' })] })],
      })),
    }));

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children: [
          new Paragraph({ text: 'PM Schedules', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: `Exported: ${new Date().toLocaleString('en-GB')}`, spacing: { after: 200 } }),
          new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=pm_schedules.docx');
    res.send(buffer);
  } catch (err) {
    console.error('Export pm word error:', err);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// ── Service Tickets Excel ───────────────────────────────────
router.get('/tickets/excel', async (req, res) => {
  try {
    const { where, params } = buildTicketWhere(req.query);
    const result = await pool.query(`${TICKET_SELECT} ${where} ORDER BY st.created_at DESC`, params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Service Tickets');
    ws.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Ticket #', key: 'ticket_number', width: 22 },
      { header: 'Serial Number', key: 'serial_number', width: 18 },
      { header: 'Hospital', key: 'hospital_name', width: 25 },
      { header: 'Township', key: 'township_name', width: 18 },
      { header: 'Brand', key: 'brand_name', width: 15 },
      { header: 'Model', key: 'model', width: 18 },
      { header: 'Type', key: 'machine_type_name', width: 18 },
      { header: 'Complaint Date', key: 'complaint_date', width: 15 },
      { header: 'Error Type', key: 'error_type', width: 22 },
      { header: 'Error Code', key: 'error_code', width: 12 },
      { header: 'Solving Type', key: 'solving_type', width: 13 },
      { header: 'Status', key: 'status', width: 13 },
      { header: 'Technician', key: 'technician_name', width: 18 },
      { header: 'Action Date', key: 'action_date', width: 15 },
      { header: 'Finished Date', key: 'job_finished_date', width: 15 },
      { header: 'Service Fees', key: 'service_fees', width: 12 },
      { header: 'Transport Fees', key: 'transport_fees', width: 12 },
      { header: 'Spare Parts', key: 'spare_parts_needed', width: 12 },
      { header: 'Solution', key: 'solution_process', width: 25 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
    headerRow.alignment = { horizontal: 'center' };

    result.rows.forEach((r, i) => {
      ws.addRow({
        no: i + 1,
        ticket_number: r.ticket_number,
        serial_number: r.serial_number,
        hospital_name: r.hospital_name,
        township_name: r.township_name,
        brand_name: r.brand_name,
        model: r.model,
        machine_type_name: r.machine_type_name,
        complaint_date: formatDate(r.complaint_date),
        error_type: r.error_type,
        error_code: r.error_code,
        solving_type: r.solving_type,
        status: r.status,
        technician_name: r.technician_name,
        action_date: formatDateTime(r.action_date),
        job_finished_date: formatDateTime(r.job_finished_date),
        service_fees: r.service_fees,
        transport_fees: r.transport_fees,
        spare_parts_needed: r.spare_parts_needed ? 'Yes' : 'No',
        solution_process: r.solution_process,
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=service_tickets.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export tickets excel error:', err);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// ── Service Tickets Word ────────────────────────────────────
router.get('/tickets/word', async (req, res) => {
  try {
    const { where, params } = buildTicketWhere(req.query);
    const result = await pool.query(`${TICKET_SELECT} ${where} ORDER BY st.created_at DESC`, params);

    const headerCells = ['No', 'Ticket #', 'Serial #', 'Hospital', 'Error', 'Date', 'Status', 'Solving'];
    const headerRow = new TableRow({
      children: headerCells.map(text => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18, font: 'Calibri' })] })],
        shading: { type: ShadingType.SOLID, color: 'DC2626', fill: 'DC2626' },
      })),
    });

    const dataRows = result.rows.map((r, i) => new TableRow({
      children: [
        i + 1, r.ticket_number, r.serial_number, r.hospital_name,
        r.error_type, formatDate(r.complaint_date), r.status, r.solving_type,
      ].map(text => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(text || ''), size: 18, font: 'Calibri' })] })],
      })),
    }));

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children: [
          new Paragraph({ text: 'Service Tickets', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: `Exported: ${new Date().toLocaleString('en-GB')}`, spacing: { after: 200 } }),
          new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=service_tickets.docx');
    res.send(buffer);
  } catch (err) {
    console.error('Export tickets word error:', err);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// ── Single Machine Word ─────────────────────────────────────
router.get('/machines/:id/word', async (req, res) => {
  try {
    const result = await pool.query(`${MACHINE_SELECT} WHERE m.id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Machine not found' });
    const r = result.rows[0];

    const fields = [
      ['Hospital', r.hospital_name], ['Township', `${r.township_name}, ${r.township_region}`],
      ['Contact Person', r.contact_person], ['Phone', r.contact_phone],
      ['Brand', r.brand_name], ['Model', r.model], ['Type', r.machine_type_name],
      ['Serial Number', r.serial_number], ['Installation Date', formatDate(r.installation_date)],
      ['Technician', r.technician_names], ['Notes', r.notes],
    ];

    const tableRows = fields.map(([label, value]) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: 'Calibri' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(value || ''), size: 20, font: 'Calibri' })] })] }),
      ],
    }));

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: 'Machine Details', heading: HeadingLevel.HEADING_1 }),
          new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=machine_${r.serial_number}.docx`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// ── Single Ticket Word ──────────────────────────────────────
router.get('/tickets/:id/word', async (req, res) => {
  try {
    const result = await pool.query(`${TICKET_SELECT} WHERE st.id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Ticket not found' });
    const r = result.rows[0];

    const fields = [
      ['Ticket Number', r.ticket_number], ['Hospital', r.hospital_name],
      ['Serial Number', r.serial_number], ['Brand/Model', `${r.brand_name} ${r.model}`],
      ['Complaint Date', formatDate(r.complaint_date)], ['Error Type', r.error_type],
      ['Error Code', r.error_code], ['Solving Type', r.solving_type],
      ['Status', r.status], ['Technician', r.technician_name],
      ['Action Date', formatDateTime(r.action_date)], ['Finished Date', formatDateTime(r.job_finished_date)],
      ['Solution', r.solution_process],
      ['Spare Parts', r.spare_parts_needed ? `Yes - ${r.spare_parts_description || ''}` : 'No'],
    ];

    const tableRows = fields.map(([label, value]) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: 'Calibri' })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(value || ''), size: 20, font: 'Calibri' })] })] }),
      ],
    }));

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: 'Service Ticket Details', heading: HeadingLevel.HEADING_1 }),
          new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=ticket_${r.ticket_number}.docx`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

module.exports = router;
