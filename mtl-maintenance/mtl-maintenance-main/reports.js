// reports.js - CSV and PDF Generation
// Compatible with both the original app.js bridge and the refactored bridge.
import { fmtDate } from './utils.js';

function getState(stateArg) {
  const s = stateArg && typeof stateArg === 'object' ? stateArg : window.state;
  return s && typeof s === 'object' ? s : {};
}

function getCurrentUser(userArg) {
  return userArg || window.currentUser || window.state?.currentUser || null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

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
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (err) {
    console.error('MTL download failed:', err);
    alert('Download failed: ' + (err?.message || err));
    return false;
  }
}

export function exportCSV(tasksArg, equipNameFunc) {
  try {
    const state = getState();
    const tasks = Array.isArray(tasksArg)
      ? tasksArg
      : (Array.isArray(state.tasks) ? state.tasks : []);

    const resolveEquipName = typeof equipNameFunc === 'function'
      ? equipNameFunc
      : (id) => {
          const equip = (state.equipment || []).find(e => String(e.id) === String(id));
          return equip?.name || '—';
        };

    const rows = [[
      'Work Order', 'Equipment', 'Assigned', 'Priority', 'Due',
      'Cost', 'Status', 'Meter', 'Notes'
    ]];

    tasks.forEach(t => rows.push([
      t.name || '',
      resolveEquipName(t.equip_id ?? t.equipId),
      t.assign || t.assigned_to || '',
      t.priority || '',
      t.due || '',
      t.cost ?? '',
      t.status || '',
      t.meter ?? '',
      t.notes || ''
    ]));

    const csv = '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const ok = downloadTextFile(
      'mtl-maintenance-' + new Date().toISOString().slice(0, 10) + '.csv',
      csv,
      'text/csv;charset=utf-8'
    );

    if (ok && typeof window.showToast === 'function') window.showToast('CSV downloaded');
    return ok;
  } catch (err) {
    console.error('MTL CSV export failed:', err);
    alert('CSV export failed: ' + (err?.message || err));
    return false;
  }
}

export function exportPDF(stateArg, currentUserArg) {
  try {
    const state = getState(stateArg);
    const currentUser = getCurrentUser(currentUserArg);
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    const taskRows = tasks.length
      ? tasks.map(t => `
          <tr>
            <td>${escapeHtml(t.name || '—')}</td>
            <td>${escapeHtml(fmtDate(t.due))}</td>
            <td>$${Number(t.cost || 0).toLocaleString()}</td>
            <td>${escapeHtml(t.status || '—')}</td>
          </tr>`).join('')
      : '<tr><td colspan="4" style="text-align:center;color:#777;padding:18px">No work orders found.</td></tr>';

    const html = `<!doctype html>
      <html><head><meta charset="utf-8"><title>MTL Maintenance Report</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a18;margin:0;padding:28px}
        h1{font-size:22px;margin:0 0 3px}
        .meta{color:#666;margin-bottom:20px}
        h2{font-size:14px;color:#185FA5;border-bottom:2px solid #185FA5;padding-bottom:4px;margin:22px 0 8px}
        table{width:100%;border-collapse:collapse}
        th{font-size:10px;text-align:left;text-transform:uppercase;color:#777;padding:6px 7px;border-bottom:2px solid #ddd}
        td{padding:7px;border-bottom:1px solid #eee}
      </style></head><body>
      <h1>MTL Maintenance Report</h1>
      <div class="meta">Generated ${escapeHtml(date)} · ${escapeHtml(currentUser?.name || currentUser?.username || currentUser?.full_name || '—')}</div>
      <h2>Work Orders</h2>
      <table>
        <thead><tr><th>Name</th><th>Due</th><th>Cost</th><th>Status</th></tr></thead>
        <tbody>${taskRows}</tbody>
      </table>
      </body></html>`;

    // Use an in-page iframe instead of a popup so Chrome/Edge popup blockers
    // cannot prevent the Print / Save as PDF dialog from opening.
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '1px';
    frame.style.height = '1px';
    frame.style.border = '0';
    frame.style.opacity = '0';
    document.body.appendChild(frame);

    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc || !frame.contentWindow) throw new Error('Unable to create print document');

    doc.open();
    doc.write(html);
    doc.close();

    const cleanup = () => setTimeout(() => frame.remove(), 500);
    frame.contentWindow.onafterprint = cleanup;

    // Give the iframe one paint cycle before invoking print.
    setTimeout(() => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (err) {
        console.error('MTL print dialog failed:', err);
        frame.remove();
        alert('PDF export failed: ' + (err?.message || err));
      }
    }, 50);

    // Safety cleanup for browsers that do not fire afterprint.
    setTimeout(() => { if (frame.isConnected) frame.remove(); }, 30000);

    if (typeof window.showToast === 'function') window.showToast('Print / Save as PDF opened');
    return true;
  } catch (err) {
    console.error('MTL PDF export failed:', err);
    alert('PDF export failed: ' + (err?.message || err));
    return false;
  }
}

export function exportEquipmentCSV(stateArg) {
  const state = getState(stateArg);
  const rows = [['Equipment','Type','Manufacturer','Serial / Asset #','Status','Hours','Primary Operator','Monthly Budget','Yearly Budget','Notes']];
  (state.equipment || []).forEach(e => rows.push([
    e.name, e.type, e.manufacturer, e.serial, e.status, e.hours, e.op,
    e.monthly_budget, e.yearly_budget, e.notes
  ]));
  const csv = '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  return downloadTextFile(
    'mtl-equipment-' + new Date().toISOString().slice(0,10) + '.csv',
    csv,
    'text/csv;charset=utf-8'
  );
}

export function exportFullDatabase(stateArg) {
  const state = getState(stateArg);
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

export function exportHealthCSV(stateArg, calcHealthFunc) {
  const state = getState(stateArg);
  const rows = [['Equipment', 'Hours', 'Status', 'Health Score']];
  (state.equipment || []).forEach(e => {
    const score = typeof calcHealthFunc === 'function'
      ? calcHealthFunc(e.id, state.tasks || [], state.equipment || [])
      : '';
    rows.push([e.name, e.hours, e.status, score === '' ? '' : score + '%']);
  });
  const csv = '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  return downloadTextFile('mtl-health-report.csv', csv, 'text/csv;charset=utf-8');
}

export function printQRCode(equipId, stateArg) {
  const state = getState(stateArg);
  const equip = (state.equipment || []).find(e => String(e.id) === String(equipId));
  if (!equip) return false;
  const url = window.location.origin + window.location.pathname + '?equip=' + encodeURIComponent(equipId);
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(`<html><body><div style="text-align:center;"><h2>${escapeHtml(equip.name)}</h2><img src="${qrUrl}"/><p>Scan for History</p></div></body></html>`);
  win.document.close();
  return true;
}

export function printMachineHistory(equipId, stateArg) {
  const state = getState(stateArg);
  const equip = (state.equipment || []).find(e => String(e.id) === String(equipId));
  if (!equip) return false;
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(`<html><body><h1>History: ${escapeHtml(equip.name)}</h1><p>Full service record generated on ${new Date().toLocaleDateString()}</p></body></html>`);
  win.document.close();
  return true;
}
