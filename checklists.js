// checklists.js - Checklist Template Management
import { supabase } from './db.js';
import { uid, showToast } from './utils.js';
import { openModal, closeModal } from './ui.js';

// 1. Save or Update a Template
export async function saveTpl() {
  // 1. Grab the Global State
  const state = window.state;

  // 2. Grab values from the HTML fields
  const idField = document.getElementById('tpl-edit-id');
  const nameField = document.getElementById('tpl-name');
  const modelField = document.getElementById('tpl-model');
  const typeField = document.getElementById('tpl-type');
  const itemsField = document.getElementById('tpl-items');

  // 3. Simple Validation
  if (!nameField.value.trim()) return showToast("Enter a template name");
  
  const items = itemsField.value.split('\n').filter(s => s.trim() !== '');
  if (items.length === 0) return showToast("Add at least one item");

  // 4. Build the record
  const record = {
    id: (idField.value && idField.value !== "") ? idField.value : 'tpl-' + uid(),
    name: nameField.value.trim(),
    model: modelField.value.trim(),
    type: typeField.value.trim(),
    items: items,
    created_at: new Date().toISOString()
  };

  try {
    // 5. Save to Supabase (using the global connection)
    const { error } = await window._mpdb.from('checklist_templates').upsert(record);
    if (error) throw error;

    // 6. Update local memory
    const idx = state.checklistTemplates.findIndex(t => t.id === record.id);
    if (idx > -1) state.checklistTemplates[idx] = record;
    else state.checklistTemplates.push(record);

    // 7. Success!
    closeModal('tpl-modal');
    showToast('Template saved ✓');

     if (typeof window.renderChecklistTemplates === 'function') {
        window.renderChecklistTemplates(); // This triggers the screen update
    }
    // Refresh the list on screen if you have the renderer
    if (typeof window.renderChecklistTemplates === 'function') {
        window.renderChecklistTemplates();
    }
    
    return true;
  } catch(e) {
    console.error(e);
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
