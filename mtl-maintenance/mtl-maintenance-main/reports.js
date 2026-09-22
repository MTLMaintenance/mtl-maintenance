// reports.js - CSV and PDF Generation
// Export methods are deliberately browser-native and user-visible.
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

function toast(message) {
  if (typeof window.showToast === 'function') window.showToast(message);
}

function downloadTextFile(filename, text, mimeType) {
  const dataUrl = `data:${mimeType},${encodeURIComponent(text)}`;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function exportCSV(tasksArg, equipNameFunc) {
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
    const filename = `mtl-maintenance-${new Date().toISOString().slice(0, 10)}.csv`;

    // Chromium desktop: use the real Save As dialog. This is more reliable
    // than a synthetic Blob download and makes the result unmistakable.
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'CSV file',
            accept: { 'text/csv': ['.csv'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        await writable.close();
        toast('CSV saved');
        return true;
      } catch (err) {
        if (err?.name === 'AbortError') return false; // user cancelled Save As
        console.warn('Save File dialog unavailable, using download fallback:', err);
      }
    }

    // Fallback for browsers without File System Access API.
    downloadTextFile(filename, csv, 'text/csv;charset=utf-8');
    toast('CSV downloaded');
    return true;
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

    // Remove any stale print container from an interrupted prior export.
    document.getElementById('mtl-export-print-root')?.remove();
    document.getElementById('mtl-export-print-style')?.remove();

    const taskRows = tasks.length
      ? tasks.map(t => `
          <tr>
            <td>${escapeHtml(t.name || '—')}</td>
            <td>${escapeHtml(fmtDate(t.due))}</td>
            <td>$${Number(t.cost || 0).toLocaleString()}</td>
            <td>${escapeHtml(t.status || '—')}</td>
          </tr>`).join('')
      : '<tr><td colspan="4" style="text-align:center;color:#777;padding:18px">No work orders found.</td></tr>';

    const root = document.createElement('section');
    root.id = 'mtl-export-print-root';
    root.innerHTML = `
      <h1>MTL Maintenance Report</h1>
      <div class="mtl-print-meta">Generated ${escapeHtml(date)} · ${escapeHtml(currentUser?.name || currentUser?.username || currentUser?.full_name || '—')}</div>
      <h2>Work Orders</h2>
      <table>
        <thead><tr><th>Name</th><th>Due</th><th>Cost</th><th>Status</th></tr></thead>
        <tbody>${taskRows}</tbody>
      </table>`;

    const style = document.createElement('style');
    style.id = 'mtl-export-print-style';
    style.textContent = `
      #mtl-export-print-root { display:none; }
      @media print {
        html, body { background:#fff !important; }
        body > * { display:none !important; }
        body > #mtl-export-print-root {
          display:block !important;
          position:static !important;
          width:auto !important;
          height:auto !important;
          margin:0 !important;
          padding:28px !important;
          color:#1a1a18 !important;
          background:#fff !important;
          font-family:Arial,sans-serif !important;
          font-size:12px !important;
          -webkit-print-color-adjust:exact;
          print-color-adjust:exact;
        }
        #mtl-export-print-root h1 { font-size:22px; margin:0 0 3px; }
        #mtl-export-print-root .mtl-print-meta { color:#666; margin-bottom:20px; }
        #mtl-export-print-root h2 { font-size:14px; color:#185FA5; border-bottom:2px solid #185FA5; padding-bottom:4px; margin:22px 0 8px; }
        #mtl-export-print-root table { width:100%; border-collapse:collapse; }
        #mtl-export-print-root th { font-size:10px; text-align:left; text-transform:uppercase; color:#777; padding:6px 7px; border-bottom:2px solid #ddd; }
        #mtl-export-print-root td { padding:7px; border-bottom:1px solid #eee; }
      }`;

    document.head.appendChild(style);
    document.body.appendChild(root);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      root.remove();
      style.remove();
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 60000);

    // Print the current document so Chrome cannot block a popup/iframe.
    window.print();
    toast('Print / Save as PDF opened');
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
  downloadTextFile('mtl-equipment-' + new Date().toISOString().slice(0,10) + '.csv', csv, 'text/csv;charset=utf-8');
  return true;
}

export function exportFullDatabase(stateArg) {
  const state = getState(stateArg);
  const snapshot = {
    exported_at: new Date().toISOString(),
    format: 'mtl-maintenance-snapshot-v1',
    data: {
      equipment: state.equipment || [], tasks: state.tasks || [], schedules: state.schedules || [],
      parts: state.parts || [], suppliers: state.suppliers || [], documents: state.documents || [],
      partUsage: state.partUsage || [], recurrenceRules: state.recurrenceRules || [], tools: state.tools || [],
      observations: state.observations || [], checklistTemplates: state.checklistTemplates || [], wiki: state.wiki || [],
      chatMessages: state.chatMessages || [], consumables: state.consumables || [], faults: state.faults || [],
      staffAbsences: state.staffAbsences || [], documentBookmarks: state.documentBookmarks || []
    }
  };
  downloadTextFile('mtl-maintenance-snapshot-' + new Date().toISOString().slice(0,10) + '.json', JSON.stringify(snapshot, null, 2), 'application/json;charset=utf-8');
  return true;
}

export function exportHealthCSV(stateArg, calcHealthFunc) {
  const state = getState(stateArg);
  const rows = [['Equipment', 'Hours', 'Status', 'Health Score']];
  (state.equipment || []).forEach(e => {
    const score = typeof calcHealthFunc === 'function' ? calcHealthFunc(e.id, state.tasks || [], state.equipment || []) : '';
    rows.push([e.name, e.hours, e.status, score === '' ? '' : score + '%']);
  });
  const csv = '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  downloadTextFile('mtl-health-report.csv', csv, 'text/csv;charset=utf-8');
  return true;
}

export function printQRCode(equipId, stateArg) {
  const state = getState(stateArg);
  const equip = (state.equipment || []).find(e => String(e.id) === String(equipId));
  if (!equip) return;
  const qr = document.getElementById('equip-qr-canvas');
  const img = qr?.querySelector('img')?.src || qr?.toDataURL?.() || '';
  const w = window.open('', '_blank');
  if (!w) return alert('Please allow popups to print the QR code.');
  w.document.write(`<html><head><title>${escapeHtml(equip.name)} QR Code</title></head><body style="font-family:Arial;text-align:center;padding:40px"><h2>${escapeHtml(equip.name)}</h2>${img ? `<img src="${img}" style="width:300px;height:300px">` : ''}<script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}

export function printMachineHistory() {
  window.print();
}
