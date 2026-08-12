// docs.js - Document & File Management
import { supabase } from './db.js';
import { uid, showToast, fmtDate } from './utils.js'; 
import { closeModal, openModal } from './ui.js';
import { renderDocuments } from './views.js';
import { extractAndCacheDocumentText } from './manual-search.js';

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
    // 3. WIPE THE FILE FROM STORAGE (best-effort — a failure here shouldn't
    // block deleting the DB row, it'd just leave an orphaned file in the
    // bucket rather than a broken app).
    const docBeingDeleted = state.documents.find(d => d.id === id);
    if (docBeingDeleted && docBeingDeleted.file_path) {
        const { error: storageErr } = await window._mpdb.storage.from('manuals').remove([docBeingDeleted.file_path]);
        if (storageErr) console.error("Failed to remove file from storage:", storageErr);
    }

    // 4. WIPE FROM DATABASE
    const { error } = await window._mpdb.from('documents').delete().eq('id', id);
    if (error) throw error;

    // Cascade: this doc's cached page text (and any bookmarks pointing at
    // it) are otherwise orphaned forever — same class of leak as the
    // part_usage/task cascade fixed earlier.
    const { error: textErr } = await window._mpdb.from('document_page_text').delete().eq('document_id', id);
    if (textErr) console.error("Failed to clean up document_page_text for deleted doc:", textErr);

    const { error: bmErr } = await window._mpdb.from('document_bookmarks').delete().eq('document_id', id);
    if (bmErr) console.error("Failed to clean up document_bookmarks for deleted doc:", bmErr);

    if (window.state.documentBookmarks) {
        window.state.documentBookmarks = window.state.documentBookmarks.filter(b => b.document_id !== id);
    }

    // 5. WIPE FROM LOCAL MEMORY
    // This is where it was crashing because 'state' was undefined
    state.documents = state.documents.filter(d => d.id !== id);

    // 6. UPDATE UI
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
    if (!doc.file_url) return alert("No file attached.");

    const newWindow = window.open();

    // A Storage URL doesn't carry a MIME string like a base64 data URI
    // did, so PDF detection now relies on file_type (or the extension as
    // a fallback for older/edge-case rows).
    const isPdf = doc.file_type === 'application/pdf' || /\.pdf($|\?)/i.test(doc.file_url);

    // If it's a PDF
    if (isPdf) {
        newWindow.document.write(`
            <title>${doc.name}</title>
            <body style="margin:0"><embed src="${doc.file_url}" width="100%" height="100%" type="application/pdf"></body>
        `);
    } 
    // If it's an image
    else {
        newWindow.document.write(`
            <title>${doc.name}</title>
            <body style="margin:0; background:#222; display:flex; align-items:center; justify-content:center">
                <img src="${doc.file_url}" style="max-width:100%; max-height:100%; object-fit:contain">
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
    file_url: window._tempFileUrl || null,
    file_path: window._tempFilePath || null, // storage object path, used to delete the file later
    file_type: window._tempFileType || null // We added this in handleDocUpload
  };

  // Capture this before the "keep old file on edit" fallback below can
  // overwrite record.file_url — extraction should only run when a genuinely
  // new file was uploaded this save, not on every unrelated edit.
  const isNewFileUpload = !!record.file_url;

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
        // If we are editing, and didn't upload a new file, keep the old file
        if (!record.file_url) {
            record.file_url = window.state.documents[idx].file_url;
            record.file_path = window.state.documents[idx].file_path;
            record.file_type = window.state.documents[idx].file_type;
        }
        window.state.documents[idx] = record;
    } else {
        window.state.documents.push(record);
    }

    // 5. Cleanup UI
    closeModal('doc-modal'); 
    window._currentDocEditId = null;
    window._tempFileUrl = null;
    window._tempFilePath = null;
    window._tempFileType = null;
    
    // 6. Refresh the list on screen
    if (typeof renderDocuments === 'function') {
        renderDocuments(); 
    }
    if (window._currentDetailEquipId && typeof window.renderDocsList === 'function') {
        window.renderDocsList(window._currentDetailEquipId);
    }
    
    showToast("Document Saved ✓");

    // Fire-and-forget: extraction can take a few seconds on a long manual,
    // and there's no reason to make the tech wait on the modal for it.
    // extractAndCacheDocumentText shows its own toast when it finishes.
    if (isNewFileUpload) {
        extractAndCacheDocumentText(docId);
    }
  } catch (e) {
    console.error("💥 Function crashed:", e);
  }
}
// Renders a machine's linked documents onto its profile card. This was
// already being called by deleteDoc() below, but never actually existed
// anywhere - which is why per-machine documents never showed up.
export function renderDocsList(equipId) {
    const container = document.getElementById('mtl-docs-list');
    if (!container) return;

    const state = window.state;
    const docs = (state.documents || []).filter(d => d.equip_id === equipId);

    container.innerHTML = docs.map(d => `
        <div class="doc-item" onclick="window.openDocDetail(${JSON.stringify(d).replace(/"/g, '&quot;')})" style="cursor:pointer; padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-weight:600; font-size:13px;">${d.name}</div>
                <div style="font-size:11px; color:#666;">${d.type || 'Document'}${d.expiry_date ? ' · Expires: ' + fmtDate(d.expiry_date) : ''}</div>
            </div>
            <div style="display:flex; gap:5px;">
                <button class="btn-sm" onclick="event.stopPropagation(); window.openBookmarkManager('${d.id}')">🔖 Bookmarks</button>
                <button class="btn-sm" onclick="event.stopPropagation(); window.openEditDocModal('${d.id}')">Edit</button>
                <button class="btn-sm btn-danger" onclick="event.stopPropagation(); window.deleteDoc('${d.id}')">✕</button>
            </div>
        </div>`).join('') || '<div style="padding:15px; color:#999; text-align:center; font-size:13px;">No documents linked to this machine yet.</div>';
}

// Lists all documents linked to a machine so the user can pick one to
// browse and bookmark pages from, while viewing a specific component tab.
// Unlike renderDocsList, this offers no Edit/Delete — documents can only
// be added/edited/deleted from the "All" tab. Clicking a row opens the
// bookmark manager directly, pre-set to the active component.
export function renderComponentDocPicker(equipId, componentFilter) {
    const container = document.getElementById('mtl-docs-list');
    if (!container) return;

    const docs = (window.state.documents || []).filter(d => d.equip_id === equipId);

    container.innerHTML = docs.map(d => `
        <div class="doc-item" style="cursor:pointer; padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;"
             onclick="window.openBookmarkManager('${d.id}', '${componentFilter}')">
            <div>
                <div style="font-weight:600; font-size:13px;">${d.name}</div>
                <div style="font-size:11px; color:#666;">${d.type || 'Document'}</div>
            </div>
            <div style="font-size:11px; color:#2563eb; font-weight:600;">🔖 Bookmark Pages</div>
        </div>
    `).join('') || '<div style="padding:15px; color:#999; text-align:center; font-size:13px;">No documents linked to this machine yet. Add one from the "All" tab.</div>';
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


export async function handleDocUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const preview = document.getElementById('doc-file-preview');
  if (preview) preview.textContent = 'Uploading ' + file.name + '…';

  try {
    // 1. Push the raw bytes to the 'manuals' Storage bucket instead of
    // reading them as base64 into memory. Path is unique per upload so
    // re-uploading a file with the same name never collides.
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = `${uid()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('manuals')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    // 2. Get the public URL for that path — this is what gets stored on
    // the document row and what the viewer/bookmarking code will fetch.
    const { data } = supabase.storage.from('manuals').getPublicUrl(path);

    // 3. Save the URL, storage path, and type to the global hallway
    // (window) so saveDoc() can find it later. file_path is kept
    // separately (not just parsed from the URL) so deleteDoc() can
    // remove the object cleanly.
    window._tempFileUrl = data.publicUrl;
    window._tempFilePath = path;
    window._tempFileType = file.type;

    if (preview) preview.textContent = '📎 ' + file.name;
    console.log("📄 File uploaded to storage:", path);
  } catch (err) {
    console.error("Upload failed:", err);
    window.showToast('File upload failed: ' + (err.message || 'Unknown error'));
    if (preview) preview.textContent = '';
    window._tempFileUrl = null;
    window._tempFilePath = null;
    window._tempFileType = null;
  } finally {
    // Reset the input so the same file can be picked again if needed
    input.value = '';
  }
}
