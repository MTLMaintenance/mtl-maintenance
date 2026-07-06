// reports.js - CSV and PDF Generation
import { fmtDate } from './utils.js';

export function exportCSV(tasks, equipNameFunc) {
  const rows=[['Work Order','Equipment','Assign','Priority','Due','Cost','Status','Meter','Notes']];
  tasks.forEach(t=>rows.push([t.name, equipNameFunc(t.equipId), t.assign, t.priority, t.due, t.cost, t.status, t.meter, t.notes]));
  const csv = rows.map(r=>r.map(x=>`"${String(x||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); 
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'mtl-maintenance-' + new Date().toISOString().slice(0,10) + '.csv'; 
  a.click();
}

export function exportPDF(state, currentUser) {
  const totalCost = state.tasks.reduce((a,t)=>a+(t.cost||0),0);
  const date = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  
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
  <div class="meta">Generated ${date} · ${currentUser?.name||'—'}</div>
  <h2>Work Orders</h2>
  <table><thead><tr><th>Name</th><th>Due</th><th>Cost</th><th>Status</th></tr></thead><tbody>
  ${state.tasks.map(t=>`<tr><td>${t.name}</td><td>${fmtDate(t.due)}</td><td>$${(t.cost||0).toLocaleString()}</td><td>${t.status}</td></tr>`).join('')}
  </tbody></table>
  <div class="no-print" style="text-align:center"><button class="btn-print" onclick="window.print()">🖨 Print / Save as PDF</button></div>
  </body></html>`;

  const w = window.open('','_blank');
  if(w){ w.document.write(html); w.document.close(); }
} 

export function exportHealthCSV(state, calcHealthFunc) {
  const rows = [['Equipment', 'Hours', 'Status', 'Health Score']];
  state.equipment.forEach(e => {
    const score = calcHealthFunc(e.id, state.tasks, state.equipment);
    rows.push([e.name, e.hours, e.status, score + '%']);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'mtl-health-report.csv';
  a.click();
}

export function printQRCode(equipId, state) {
  const equip = state.equipment.find(e=>e.id===equipId); if(!equip) return;
  const url = window.location.origin + window.location.pathname + '?equip=' + equipId;
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
  const win = window.open('','_blank');
  win.document.write(`<html><body><div style="text-align:center;"><h2>${equip.name}</h2><img src="${qrUrl}"/><p>Scan for History</p></div></body></html>`);
  win.document.close();
}

export function printMachineHistory(equipId, state) {
  const e = state.equipment.find(x=>x.id===equipId); if(!e) return;
  const html = `<html><body><h1>History: ${e.name}</h1><p>Full service record generated on ${new Date().toLocaleDateString()}</p></body></html>`;
  const w = window.open('','_blank');
  w.document.write(html); w.document.close();
}
