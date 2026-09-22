// automation.js - Recurrence Engine & Bulk Actions
import { supabase } from './db.js';
import { uid, showToast } from './utils.js';

// 1. The Recurrence Engine (Auto-generates 500hr services, etc.)
export async function runRecurrenceEngine() {
   const state = window.state; 
  if (!state || !state.recurrenceRules) return;
  const today = new Date(); 
  today.setHours(0,0,0,0);

  for (const rule of state.recurrenceRules) {
    if (!rule.active) continue;
    let shouldGenerate = false;
    let nextDue = new Date(rule.next_due || today);

    if (rule.type === 'calendar') {
      if (!rule.next_due || new Date(rule.next_due) <= today) shouldGenerate = true;
    } else if (rule.type === 'hours') {
      const equip = state.equipment.find(e => e.id === rule.equip_id);
      const lastHours = parseFloat(rule.last_generated_hours || 0);
      if (equip && equip.hours >= (lastHours + (rule.runtime_hours || 500))) shouldGenerate = true;
    }

    if (shouldGenerate) {
      const wo = {
        id: uid(),
        name: rule.name,
        equip_id: rule.equip_id,
        assign: rule.template?.assign || '',
        priority: rule.priority || 'High',
        due: nextDue.toISOString().slice(0,10),
        status: 'Open',
        notes: (rule.notes || '') + '\n[Auto-generated]',
        photos: [], checklist: []
      };

      // Prevent duplicates for the same day
      const exists = state.tasks.find(t => t.name === rule.name && t.due === wo.due && (t.equip_id || t.equipId) === rule.equip_id);
      if (!exists) {
        const { error } = await supabase.from('tasks').upsert(wo);
        if (error) {
          console.error('Failed to auto-create recurring work order:', error);
          continue;
        }
        state.tasks.push({ ...wo, equipId: wo.equip_id });
        
        // Update the rule's "Next Due" date in Supabase
        let next = new Date(nextDue);
        if (rule.interval_unit === 'day') next.setDate(next.getDate() + rule.interval_value);
        if (rule.interval_unit === 'week') next.setDate(next.getDate() + (rule.interval_value * 7));
        if (rule.interval_unit === 'month') next.setMonth(next.getMonth() + rule.interval_value);
        
        await supabase.from('recurrence_rules').update({
          next_due: next.toISOString().slice(0,10),
          last_generated: today.toISOString().slice(0,10)
        }).eq('id', rule.id);
      }
    }
  }
}

// 2. Create Bulk Work Orders (e.g., "Grease all excavators")
export async function createBulkWO(name, checkedIds, priority, due, notes, state) {
  let created = 0;
  for(const equipId of checkedIds) {
    const record = {
        id: uid(), name, equip_id: equipId, assign:'', priority, due,
        cost: 0, status: 'Open', notes, photos: [], checklist: []
    };
    const { error } = await supabase.from('tasks').upsert(record);
    if (error) {
      console.error('Failed to create bulk work order:', error);
      continue;
    }
    state.tasks.push({ ...record, equipId: record.equip_id });
    created++;
  }
  showToast(created + ' work orders created ✓');
  return created;
}


export function toggleBulkWO() {
  let modal = document.getElementById('bulk-wo-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bulk-wo-modal';
    modal.className = 'modal-backdrop';
    document.body.appendChild(modal);
  }

  const equipment = (window.state.equipment || []);
  modal.innerHTML = `
    <div class="modal" style="max-width:620px">
      <div class="modal-header">
        <span class="modal-title">Create Bulk Work Orders</span>
        <button class="modal-close" onclick="window.closeModal('bulk-wo-modal')">✕</button>
      </div>
      <div class="form-grid">
        <div class="form-group full"><label class="form-label">Work Order Name *</label><input class="form-input" id="bulk-wo-name" placeholder="e.g. Grease equipment"></div>
        <div class="form-group"><label class="form-label">Priority</label><select class="form-select" id="bulk-wo-priority"><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option></select></div>
        <div class="form-group"><label class="form-label">Due Date</label><input class="form-input" id="bulk-wo-due" type="date"></div>
        <div class="form-group full"><label class="form-label">Notes</label><textarea class="form-textarea" id="bulk-wo-notes"></textarea></div>
        <div class="form-group full">
          <label class="form-label">Equipment</label>
          <div style="max-height:260px; overflow:auto; border:1px solid var(--border); border-radius:10px; padding:8px">
            ${equipment.map(e => `<label style="display:flex;gap:9px;align-items:center;padding:7px 5px;cursor:pointer"><input type="checkbox" class="bulk-equip-check" value="${e.id}"><span>${e.name}</span></label>`).join('') || '<div class="empty-text">No equipment available</div>'}
          </div>
        </div>
      </div>
      <div class="form-row">
        <button class="btn btn-secondary" onclick="window.closeModal('bulk-wo-modal')">Cancel</button>
        <button class="btn btn-primary" onclick="window.submitBulkWO()">Create Work Orders</button>
      </div>
    </div>`;
  modal.style.display = 'flex';
  modal.classList.add('open');
}

export async function submitBulkWO() {
  const name = document.getElementById('bulk-wo-name')?.value.trim() || '';
  const ids = [...document.querySelectorAll('.bulk-equip-check:checked')].map(el => el.value);
  const priority = document.getElementById('bulk-wo-priority')?.value || 'Medium';
  const due = document.getElementById('bulk-wo-due')?.value || '';
  const notes = document.getElementById('bulk-wo-notes')?.value || '';
  if (!name) return showToast('Enter a work order name');
  if (!ids.length) return showToast('Select at least one machine');

  const created = await createBulkWO(name, ids, priority, due, notes, window.state);
  if (created > 0) {
    window.closeModal('bulk-wo-modal');
    if (typeof window.renderTasksTable === 'function') window.renderTasksTable();
    if (typeof window.refreshDashboard === 'function') window.refreshDashboard();
  }
}
