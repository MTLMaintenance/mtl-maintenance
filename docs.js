// docs.js - Document & File Management
import { supabase, persist } from './db.js';
import { showToast } from './utils.js';

// 1. Delete a Document (Merged version of your duplicates)
export async function deleteDoc(id, state) {
  if (!confirm("Are you sure you want to permanently delete this document?")) return;

  // WIPE FROM MEMORY
  if (state.documents) {
    state.documents = state.documents.filter(d => d.id !== id);
  }

  // WIPE FROM DATABASE
  try {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw error;
    
    showToast("Deleted from server ✓");
    return true; // Success
  } catch (e) {
    console.error("Delete failed:", e);
    showToast("Delete failed");
    return false;
  }
}

// 2. Open a Document Detail (PDF vs Image logic)
export function openDocDetail(doc) {
    if (!doc.file_data) return alert("No file attached.");

    const newWindow = window.open();
    
    // If it's a PDF
    if (doc.file_data.includes('application/pdf') || doc.file_type === 'application/pdf') {
        newWindow.document.write(`
            <title>${doc.name}</title>
            <body style="margin:0"><embed src="${doc.file_data}" width="100%" height="100%" type="application/pdf"></body>
        `);
    } 
    // If it's an image
    else {
        newWindow.document.write(`
            <title>${doc.name}</title>
            <body style="margin:0; background:#222; display:flex; align-items:center; justify-content:center">
                <img src="${doc.file_data}" style="max-width:100%; max-height:100%; object-fit:contain">
            </body>
        `);
    }
}

// 3. Save/Update a Document
export async function saveDoc(record) {
    try {
        const { error } = await supabase.from('documents').upsert(record);
        if (error) throw error;
        showToast("Document saved ✓");
        return true;
    } catch (e) {
        console.error(e);
        showToast("Save failed");
        return false;
    }
}
