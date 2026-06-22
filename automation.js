// automation.js - Recurrence Engine & Bulk Actions
import { supabase } from './db.js';
import { uid, showToast } from './utils.js';

// 1. The Recurrence Engine (Auto-generates 500hr services, etc.)
export async function runRecurrenceEngine() {
   const s = window.state; 
  if (!state || !s.recurrenceRules) return;
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
        equipId: rule.equip_id,
        assign: rule.template?.assign || '',
        priority: rule.priority || 'High',
        due: nextDue.toISOString().slice(0,10),
        status: 'Open',
        notes: (rule.notes || '') + '\n[Auto-generated]',
        photos: [], checklist: []
      };

      // Prevent duplicates for the same day
      const exists = state.tasks.find(t => t.name === rule.name && t.due === wo.due && t.equipId === rule.equip_id);
      if (!exists) {
        state.tasks.push(wo);
        await supabase.from('tasks').upsert(wo);
        
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
        id: uid(), name, equipId, assign:'', priority, due, 
        cost: 0, status: 'Open', notes, photos: [], checklist: [] 
    };
    state.tasks.push(record);
    await supabase.from('tasks').upsert(record);
    created++;
  }
  showToast(created + ' work orders created ✓');
  return created;
}
