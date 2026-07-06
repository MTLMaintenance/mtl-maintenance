// docs.js - Document & File Management
import { supabase } from './db.js';
import { uid, showToast, fmtDate } from './utils.js'; 
import { closeModal, openModal } from './ui.js';
import { renderDocuments } from './views.js';

// 1. Delete a Document (Merged version of your duplicates)
export async function deleteDoc(id) {
  // 1. CONFIRMATION
  if (!confirm("Are you sure you want to permanently delete this document?")) return;

  // 2. THE FIX: Look at the global window directly
  const state = window.state;
  if (!state || !state.documents) {
    console.error("Master folder or documents list missing!");
    return;
  }

  try {
    // 3. WIPE FROM DATABASE
    const { error } = await window._mpdb.from('documents').delete().eq('id', id);
    if (error) throw error;

    // 4. WIPE FROM LOCAL MEMORY
    // This is where it was crashing because 'state' was undefined
    state.documents = state.documents.filter(d => d.id !== id);

    // 5. UPDATE UI
    if (typeof window.renderDocuments === 'function') {
        window.renderDocuments();
    }
    
    // If you are looking at a machine card, refresh its specific doc list too
    if (window._currentDetailEquipId && typeof window.renderDocsList === 'function') {
        window.renderDocsList(window._currentDetailEquipId);
    }

    window.showToast("Document deleted ✓");
    return true;
  } catch (e) {
    console.error("Delete failed:", e);
    window.showToast("Delete failed");
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
export async function saveDoc() {
  // 1. Grab values directly from the modal IDs
  const name = document.getElementById('d-name').value.trim(); 
  const type = document.getElementById('d-type').value;
  const equipId = document.getElementById('d-equip').value || null;
  const expiry = document.getElementById('d-expiry').value || null;
  const notes = document.getElementById('d-notes').value;

  if (!name) {
      showToast('Please enter a name');
      return;
  }

  // 2. Use the Global ID for editing, or a new UID for adding
  // IMPORTANT: We use uid() directly now, not window.utils.uid()
  const docId = window._currentDocEditId || uid();

  const record = {
    id: docId, 
    name: name,
    type: type,
    equip_id: equipId,
    expiry_date: expiry,
    notes: notes,
    file_data: window._tempFileData || null,
    file_type: window._tempFileType || null // We added this in handleDocUpload
  };

  console.log("🚀 Attempting to save Document:", record);

  try {
    // 3. Send to Supabase
    const { error } = await supabase.from('documents').upsert(record);
    
    if (error) {
        console.error("❌ Supabase Error:", error);
        alert("Database Error: " + error.message);
        return;
    }

    // 4. Update Local memory
    if (!window.state.documents) window.state.documents = [];
    const idx = window.state.documents.findIndex(d => d.id === docId);
    if (idx !== -1) {
        // If we are editing, and didn't upload a new file, keep the old file data
        if (!record.file_data) {
            record.file_data = window.state.documents[idx].file_data;
            record.file_type = window.state.documents[idx].file_type;
        }
        window.state.documents[idx] = record;
    } else {
        window.state.documents.push(record);
    }

    // 5. Cleanup UI
    closeModal('doc-modal'); 
    window._currentDocEditId = null;
    window._tempFileData = null;
    
    // 6. Refresh the list on screen
    if (typeof renderDocuments === 'function') {
        renderDocuments(); 
    }
    
    showToast("Document Saved ✓");
  } catch (e) {
    console.error("💥 Function crashed:", e);
  }
}
export function openEditDocModal(docId = null) {
  // 1. THE FIX: Use window. so the ID is saved globally
  window._currentDocEditId = docId;
  window._tempFileData = null; 
  
  const state = window.state;
  const equipSelect = document.getElementById('d-equip');
  if (equipSelect) {
      equipSelect.innerHTML = '<option value="">— None —</option>' + 
        state.equipment.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
  }

  if (docId) {
    // EDIT MODE: Find doc and fill modal
    const doc = state.documents.find(d => d.id === docId);
    if (!doc) return;
    
    document.getElementById('d-name').value = doc.name;
    document.getElementById('d-type').value = doc.type;
    document.getElementById('d-equip').value = doc.equip_id || '';
    document.getElementById('d-expiry').value = doc.expiry_date || '';
    document.getElementById('d-notes').value = doc.notes || '';
    document.getElementById('doc-file-preview').textContent = "Current file attached";
  } else {
    // ADD MODE: Clear modal
    ['d-name','d-expiry','d-notes'].forEach(id => {
        const el = document.getElementById(id); if(el) el.value = '';
    });
    if (window._currentDetailEquipId) {
        document.getElementById('d-equip').value = window._currentDetailEquipId;
    }
  }

  window.openModal('doc-modal');
}


export function openDocModal(docId = null) {
  _currentDocEditId = docId;
  _tempFileData = null;
  
  // 1. Populate the "Linked Equipment" dropdown
  const equipSelect = document.getElementById('d-equip');
  equipSelect.innerHTML = '<option value="">— None —</option>' + 
    state.equipment.map(e => `<option value="${e.id}">${e.name}</option>`).join('');

  // 2. Clear form
  document.getElementById('d-name').value = '';
  document.getElementById('d-expiry').value = '';
  document.getElementById('d-notes').value = '';
  document.getElementById('doc-file-preview').innerText = '';

  if (docId) {
    // EDIT MODE: Fill data
    const doc = state.documents.find(d => d.id === docId);
    document.getElementById('d-name').value = doc.name;
    document.getElementById('d-type').value = doc.type;
    document.getElementById('d-equip').value = doc.equip_id;
    document.getElementById('d-expiry').value = doc.expiry;
    document.getElementById('d-notes').value = doc.notes;
  } else if (window._currentDetailEquipId) {
    // NEW DOC from Equipment Tab: Auto-select current machine
    document.getElementById('d-equip').value = window._currentDetailEquipId;
  }

  openModal('doc-modal');
}

export function openAddDocModal() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,image/*,.doc,.docx';
    
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const newDoc = {
                id: 'doc-' + Date.now(),
                equip_id: window._currentDetailEquipId,
                name: file.name,
                type: file.type || 'Unknown',
                file_data: event.target.result,
                date_added: new Date().toISOString()
            };

            state.documents.push(newDoc);
            renderDocsList(window._currentDetailEquipId);
        };
        reader.readAsDataURL(file);
    };
    
    input.click();
}

export function handleDocUpload(input) {
  const file = input.files[0]; 
  if(!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    // 1. Save the file data and type to the global hallway (window)
    // so that the saveDoc function can find it later.
    window._tempFileData = e.target.result;
    window._tempFileType = file.type;
    
    // 2. Update the UI to show the user the file was received
    const preview = document.getElementById('doc-file-preview');
    if (preview) {
        preview.textContent = '📎 ' + file.name;
    }
    
    console.log("📄 File prepared for upload:", file.name);
  };
  
  reader.readAsDataURL(file);
  // Reset the input so the same file can be picked again if needed
  input.value = ''; 
}
