// Mechanic-friendly inventory movements; uses a DB RPC for atomic stock/history updates.
import { showToast } from './utils.js';

const $ = id => document.getElementById(id);
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let working = false;

export function openPartMovement(type = 'out') {
  const mode = type === 'in' ? 'in' : 'out';
  $('part-movement-mode').value = mode;
  $('part-movement-title').textContent = mode === 'in' ? 'Receive Parts' : 'Take Parts';
  $('part-movement-submit').textContent = mode === 'in' ? 'Receive Stock' : 'Take From Stock';
  const parts = window.state?.parts || [];
  $('part-movement-part').innerHTML = '<option value="">Select a part...</option>' + parts.map(p => `<option value="${html(p.id)}">${html(p.name)}${p.num ? ' — '+html(p.num) : ''} (${Number(p.qty)||0} in stock)</option>`).join('');
  $('part-movement-qty').value = '1';
  $('part-movement-equipment').innerHTML = '<option value="">Not assigned</option>' + (window.state?.equipment || []).map(e => `<option value="${html(e.id)}">${html(e.name)}</option>`).join('');
  $('part-movement-task').innerHTML = '<option value="">Not assigned</option>' + (window.state?.tasks || []).filter(t => !['completed','closed','cancelled'].includes(String(t.status||'').toLowerCase())).map(t => `<option value="${html(t.id)}">${html(t.title||t.name||'Work Order')} (${html(String(t.id))})</option>`).join('');
  $('part-movement-equipment').value = '';
  $('part-movement-task').value = '';
  $('part-movement-notes').value = '';
  $('part-movement-stock').textContent = 'Select a part to see available stock.';
  $('part-movement-error').textContent = '';
  $('part-movement-submit').disabled = false;
  $('part-movement-dialog').style.display = 'flex';
}
export function closePartMovement() { if (!working) $('part-movement-dialog').style.display = 'none'; }
export function updatePartMovementStock() {
  const part = (window.state?.parts || []).find(p => String(p.id) === $('part-movement-part').value);
  $('part-movement-stock').textContent = part ? `Currently in stock: ${Number(part.qty)||0}` : 'Select a part to see available stock.';
}
export async function submitPartMovement(event) {
  event?.preventDefault();
  if (working) return;
  const mode = $('part-movement-mode').value;
  const partId = $('part-movement-part').value;
  const qty = Number($('part-movement-qty').value);
  const part = (window.state?.parts || []).find(p => String(p.id) === partId);
  const errorEl = $('part-movement-error');
  errorEl.textContent = '';
  if (!part) { errorEl.textContent = 'Select a part.'; return; }
  if (!Number.isSafeInteger(qty) || qty < 1) { errorEl.textContent = 'Enter a whole number of at least 1.'; return; }
  if (mode === 'out' && qty > Number(part.qty||0)) { errorEl.textContent = 'Not enough parts in stock.'; return; }
  if (!navigator.onLine) { errorEl.textContent = 'An internet connection is required to safely record inventory.'; return; }
  working = true;
  $('part-movement-submit').disabled = true;
  try {
    const {data,error} = await window._mpdb.rpc('mtl_move_part', {
      p_part_id: partId,
      p_direction: mode,
      p_quantity: qty,
      p_actor: String(window.currentUser?.name || window.currentUser?.username || 'Unknown'),
      p_equipment_id: $('part-movement-equipment').value || null,
      p_task_id: $('part-movement-task').value || null,
      p_note: $('part-movement-notes').value.trim() || null
    });
    if (error) throw error;
    part.qty = Number(data);
    if (typeof window.renderPartsTable === 'function') window.renderPartsTable();
    window.updateDashboardParts?.(window.state);
    window.refreshDashboard?.();
    $('part-movement-dialog').style.display = 'none';
    showToast(mode === 'in' ? 'Stock received ✓' : 'Parts taken ✓');
    if ($('parts-history-view')?.style.display !== 'none') await loadPartMovementHistory();
  } catch (error) {
    console.error('Stock movement failed', error);
    errorEl.textContent = error.message || 'Unable to update stock.';
  } finally { working = false; $('part-movement-submit').disabled = false; }
}
export async function loadPartMovementHistory() {
  const body = $('parts-history-body');
  if (!body) return;
  body.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
  const { data, error } = await window._mpdb.from('mtl_part_movements').select('*').order('created_at',{ascending:false}).limit(150);
  if (error) { body.innerHTML = `<tr><td colspan="7">Unable to load history: ${html(error.message)}</td></tr>`; return; }
  const history = data || [];
  const partMap = new Map((window.state?.parts || []).map(p => [String(p.id),p.name]));
  const equipMap = new Map((window.state?.equipment || []).map(e => [String(e.id),e.name]));
  body.innerHTML = history.map(h => `<tr><td>${html(new Date(h.created_at).toLocaleString())}</td><td>${html(partMap.get(String(h.part_id)) || h.part_name || 'Unknown')}</td><td>${h.direction==='in'?'Received':'Taken'}</td><td>${html(h.quantity)}</td><td>${html(h.actor)}</td><td>${html(equipMap.get(String(h.equipment_id)) || h.equipment_id || '—')}</td><td>${html(h.note || '—')}</td></tr>`).join('') || '<tr><td colspan="7">No inventory movements yet.</td></tr>';
}
export function showPartsHistory(show) {
  $('parts-inventory-view').style.display = show ? 'none' : '';
  $('parts-consumables-view').style.display = 'none';
  $('parts-history-view').style.display = show ? '' : 'none';
  document.querySelectorAll('#parts-subtab-bar .tab').forEach(btn => btn.classList.toggle('active', btn.id === (show ? 'btn-parts-history' : 'btn-parts-inv')));
  if (show) loadPartMovementHistory();
}
