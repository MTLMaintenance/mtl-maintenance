// checklists.js - Checklist Template Management
import { supabase } from './db.js';
import { uid, showToast } from './utils.js';
import { openModal, closeModal } from './ui.js';

// 1. Save or Update a Template
export async function saveTpl(formData, state) {
  const record = {
    ...formData,
    id: formData.id || 'tpl-' + uid(),
    created_at: new Date().toISOString()
  };

  try {
    await supabase.from('checklist_templates').upsert(record);

    // Update state memory
    const idx = state.checklistTemplates.findIndex(t => t.id === record.id);
    if(idx > -1) state.checklistTemplates[idx] = record;
    else state.checklistTemplates.push(record);

    closeModal('tpl-modal');
    showToast('Template saved ✓');
    return true;
  } catch(e) {
    showToast('Failed to save template');
    return false;
  }
}

// 2. Delete a Template
export async function deleteTpl(id, state) {
    if(!confirm('Delete this template?')) return;
    try {
        await supabase.from('checklist_templates').delete().eq('id', id);
        state.checklistTemplates = state.checklistTemplates.filter(t => t.id !== id);
        showToast('Template deleted');
        return true;
    } catch(e) { return false; }
}
