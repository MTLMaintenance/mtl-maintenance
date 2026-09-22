// reports.js - CSV and PDF Generation
import { fmtDate } from './utils.js';

function downloadTextFile(filename, text, mimeType) {
  try {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    console.error('Download failed:', err);
    return false;
  }
}

export function exportCSV(tasks = window.state?.tasks || [], equipNameFunc = null) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const resolveEquipName = typeof equipNameFunc === 'function'
    ? equipNameFunc
    : (id) => {
        const e = (window.state?.equipment || []).find(x => x.id === id);
        return e?.name || '—';
      };

  const rows=[['Work Order','Equipment','Assigned','Priority','Due','Cost','Status','Meter','Notes']];
  safeTasks.forEach(t=>rows.push([
    t.name || '',
    resolveEquipName(t.equip_id || t.equipId),
    t.assign || t.assigned_to || '',
    t.priority || '',
    t.due || '',
    t.cost ?? '',
    t.status || '',
    t.meter ?? '',
    t.notes || ''
  ]));

  // UTF-8 BOM helps Excel open names/notes cleanly.
  const csv = '\ufeff' + rows.map(r=>r.map(x=>`"${String(x ?? '').replace(/"/g,'""')}"`).join(',')).join('\r\n');
  return downloadTextFile(
    'mtl-maintenance-' + new Date().toISOString().slice(0,10) + '.csv',
    csv,
    'text/csv;charset=utf-8'
  );
}

export function exportEquipmentCSV(state = window.state || {}) {
  const rows = [['Equipment','Type','Manufacturer','Serial / Asset #','Status','Hours','Primary Operator','Monthly Budget','Yearly Budget','Notes']];
  (state.equipment || []).forEach(e => rows.push([
    e.name, e.type, e.manufacturer, e.serial, e.status, e.hours, e.op,
    e.monthly_budget, e.yearly_budget, e.notes
  ]));
  const csv = '\ufeff' + rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  return downloadTextFile(
    'mtl-equipment-' + new Date().toISOString().slice(0,10) + '.csv',
    csv,
    'text/csv;charset=utf-8'
  );
}

export function exportPDF(state = window.state || {}, currentUser = window.currentUser || null) {
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const date = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const taskRows = tasks.length
    ? tasks.map(t=>`<tr><td>${escapeHtml(t.name || '—')}</td><td>${escapeHtml(fmtDate(t.due))}</td><td>$${Number(t.cost||0).toLocaleString()}</td><td>${escapeHtml(t.status || '—')}</td></tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:#777;padding:18px">No work orders found.</td></tr>';

  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MTL Report</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a18;margin:0;padding:28px}
    h1{font-size:22px;margin-bottom:3px}h2{font-size:14px;color:#185FA5;border-bottom:2px solid #185FA5;padding-bottom:4px;margin:22px 0 8px}
    table{width:100%;border-collapse:collapse;margin-bottom:6px}th{font-size:10px;text-align:left;text-transform:uppercase;color:#888;padding:5px 7px;border-bottom:2px solid #eee}
    td{padding:6px 7px;border-bottom:1px solid #eee;font-size:12px}
    @media print{.no-print{display:none}}
    .btn-print{padding:10px 25px; font-weight:bold; cursor:pointer; background:#fff; border:2px solid #1a1a18; border-radius:8px; margin-top:30px}
  </style></head><body>
  <h1>⚙ MTL Maintenance Report</h1>
  <div class="meta">Generated ${escapeHtml(date)} · ${escapeHtml(currentUser?.name || currentUser?.username || '—')}</div>
  <h2>Work Orders</h2>
  <table><thead><tr><th>Name</th><th>Due</th><th>Cost</th><th>Status</th></tr></thead><tbody>
  ${taskRows}
  </tbody></table>
  <div class="no-print" style="text-align:center"><button class="btn-print" onclick="window.print()">🖨 Print / Save as PDF</button></div>
  </body></html>`;

  const w = window.open('','_blank');
  if (!w) {
    console.warn('PDF report popup was blocked by the browser.');
    alert('The PDF report window was blocked by your browser. Please allow pop-ups for MTL Maintenance and try again.');
    return false;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function exportFullDatabase(state = window.state || {}) {
  // Snapshot the maintenance data already loaded into the app. Deliberately
  // excludes login credentials/session tokens while preserving operational data.
  const snapshot = {
    exported_at: new Date().toISOString(),
    format: 'mtl-maintenance-snapshot-v1',
    data: {
      equipment: state.equipment || [],
      tasks: state.tasks || [],
      schedules: state.schedules || [],
      parts: state.parts || [],
      suppliers: state.suppliers || [],
      documents: state.documents || [],
      partUsage: state.partUsage || [],
      recurrenceRules: state.recurrenceRules || [],
      tools: state.tools || [],
      observations: state.observations || [],
      checklistTemplates: state.checklistTemplates || [],
      wiki: state.wiki || [],
      chatMessages: state.chatMessages || [],
      consumables: state.consumables || [],
      faults: state.faults || [],
      staffAbsences: state.staffAbsences || [],
      documentBookmarks: state.documentBookmarks || []
    }
  };
  return downloadTextFile(
    'mtl-maintenance-snapshot-' + new Date().toISOString().slice(0,10) + '.json',
    JSON.stringify(snapshot, null, 2),
    'application/json;charset=utf-8'
  );
}

export function exportHealthCSV(state = window.state || {}, calcHealthFunc) {
  const rows = [['Equipment', 'Hours', 'Status', 'Health Score']];
  (state.equipment || []).forEach(e => {
    const score = typeof calcHealthFunc === 'function'
      ? calcHealthFunc(e.id, state.tasks || [], state.equipment || [])
      : '';
    rows.push([e.name, e.hours, e.status, score === '' ? '' : score + '%']);
  });
  const csv = '\ufeff' + rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  return downloadTextFile('mtl-health-report.csv', csv, 'text/csv;charset=utf-8');
}

export function printQRCode(equipId, state = window.state || {}) {
  const equip = (state.equipment || []).find(e=>e.id===equipId); if(!equip) return;
  const url = window.location.origin + window.location.pathname + '?equip=' + equipId;
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
  const win = window.open('','_blank');
  if (!win) return false;
  win.document.write(`<html><body><div style="text-align:center;"><h2>${escapeHtml(equip.name)}</h2><img src="${qrUrl}"/><p>Scan for History</p></div></body></html>`);
  win.document.close();
  return true;
}

export function printMachineHistory(equipId, state = window.state || {}) {
  const e = (state.equipment || []).find(x=>x.id===equipId); if(!e) return;
  const html = `<html><body><h1>History: ${escapeHtml(e.name)}</h1><p>Full service record generated on ${new Date().toLocaleDateString()}</p></body></html>`;
  const w = window.open('','_blank');
  if (!w) return false;
  w.document.write(html); w.document.close();
  return true;
}
