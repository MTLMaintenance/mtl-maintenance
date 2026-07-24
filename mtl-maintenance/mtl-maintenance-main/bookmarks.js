// bookmarks.js - Component-scoped document/manual page bookmarks
import { supabase } from './db.js';

let bmCurrentDocId = null;
let bmCurrentPage = 1;
let bmTotalPages = 1;
let bmPdfDoc = null; // pdf.js document instance, null for images

// pdf.js is loaded lazily from a CDN the first time it's needed,
// rather than requiring a <script> tag in your main HTML.
export function ensurePdfJsLoaded() {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) return resolve();
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Pulls every bookmark row into local state, same pattern as fetchWiki.
export async function fetchDocumentBookmarks() {
    try {
        const { data, error } = await supabase.from('document_bookmarks').select('*');
        if (error) throw error;
        window.state.documentBookmarks = data || [];
    } catch (err) {
        console.error("Error fetching document bookmarks:", err);
    }
}

// Opens the bookmark manager modal for a given document: a PDF page
// viewer (or image preview) with a "bookmark this page" button, a
// page-range input for bulk bookmarking, and a list of existing
// bookmarks for that doc.
export async function openBookmarkManager(docId) {
    const doc = (window.state.documents || []).find(d => d.id === docId);
    if (!doc || !doc.file_data) return alert("No file attached to this document.");

    bmCurrentDocId = docId;
    document.getElementById('bm-document-id').value = docId;
    document.getElementById('bookmark-modal-title').textContent = `Bookmark Pages — ${doc.name}`;

    const isPdf = doc.file_type === 'application/pdf' || doc.file_data.includes('application/pdf');

    // Populate the component dropdown from this doc's linked equipment
    const equip = (window.state.equipment || []).find(e => e.id === doc.equip_id);
    const components = (equip && Array.isArray(equip.components)) ? equip.components : ['engine', 'hydraulics', 'tracks'];
    const compSelect = document.getElementById('bm-component');
    compSelect.innerHTML = components
        .map(c => `<option value="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</option>`)
        .join('');

    if (isPdf) {
        document.getElementById('bm-pdf-viewer').style.display = 'block';
        document.getElementById('bm-image-viewer').style.display = 'none';

        await ensurePdfJsLoaded();
        const loadingTask = window.pdfjsLib.getDocument(doc.file_data);
        bmPdfDoc = await loadingTask.promise;
        bmTotalPages = bmPdfDoc.numPages;
        bmCurrentPage = 1;
        await renderBmPage();
    } else {
        // Images are single-page — no viewer navigation needed
        document.getElementById('bm-pdf-viewer').style.display = 'none';
        document.getElementById('bm-image-viewer').style.display = 'block';
        document.getElementById('bm-image-preview').src = doc.file_data;
        bmPdfDoc = null;
        bmCurrentPage = 1;
        bmTotalPages = 1;
    }

    renderBookmarkList(docId);
    window.openModal('bookmark-modal');
}

export async function renderBmPage() {
    if (!bmPdfDoc) return;
    const page = await bmPdfDoc.getPage(bmCurrentPage);
    const viewport = page.getViewport({ scale: 1.2 });
    const canvas = document.getElementById('bm-pdf-canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    document.getElementById('bm-page-indicator').textContent = `Page ${bmCurrentPage} / ${bmTotalPages}`;
}

export function bmNextPage() {
    if (!bmPdfDoc || bmCurrentPage >= bmTotalPages) return;
    bmCurrentPage++;
    renderBmPage();
}

export function bmPrevPage() {
    if (!bmPdfDoc || bmCurrentPage <= 1) return;
    bmCurrentPage--;
    renderBmPage();
}

// "Bookmark This Page" — for the page currently shown in the viewer
// (or the single page of an image).
export async function bmBookmarkCurrentPage() {
    const componentId = document.getElementById('bm-component').value;
    await addBookmark(bmCurrentDocId, componentId, bmCurrentPage, bmCurrentPage);
}

// Bulk range bookmark, e.g. "page 30 to page 50" in one go.
export async function bmAddRangeBookmark() {
    const componentId = document.getElementById('bm-component').value;
    const from = parseInt(document.getElementById('bm-page-from').value, 10);
    const to = parseInt(document.getElementById('bm-page-to').value, 10) || from;

    if (!from) {
        alert('Enter a starting page.');
        return;
    }

    await addBookmark(bmCurrentDocId, componentId, from, to);

    document.getElementById('bm-page-from').value = '';
    document.getElementById('bm-page-to').value = '';
}

export async function addBookmark(documentId, componentId, pageStart, pageEnd) {
    const doc = (window.state.documents || []).find(d => d.id === documentId);
    if (!doc) return;

    const record = {
        id: crypto.randomUUID(),
        document_id: documentId,
        equip_id: doc.equip_id,
        component_id: componentId,
        page_start: pageStart,
        page_end: pageEnd
    };

    try {
        const { error } = await supabase.from('document_bookmarks').insert(record);
        if (error) throw error;

        window.showToast('Bookmark added!', 'success');

        if (!window.state.documentBookmarks) window.state.documentBookmarks = [];
        window.state.documentBookmarks.push(record);

        renderBookmarkList(documentId);

        // If the machine card is currently showing this exact component,
        // refresh that section too so the new bookmark shows immediately.
        if (window.currentOsComponent === componentId && typeof window.renderComponentBookmarks === 'function') {
            const container = document.getElementById('mtl-component-bookmarks');
            if (container) container.innerHTML = window.renderComponentBookmarks(doc.equip_id, componentId);
        }
    } catch (err) {
        console.error('Error adding bookmark:', err);
        window.showToast(`Failed to add bookmark: ${err.message || 'Unknown error'}`, 'error');
    }
}

export async function deleteBookmark(bookmarkId) {
    if (!confirm('Delete this bookmark?')) return;

    try {
        const { error } = await supabase.from('document_bookmarks').delete().eq('id', bookmarkId);
        if (error) throw error;

        window.state.documentBookmarks = (window.state.documentBookmarks || []).filter(b => b.id !== bookmarkId);

        window.showToast('Bookmark deleted', 'success');
        renderBookmarkList(bmCurrentDocId);

        const filter = window.currentOsComponent;
        if (filter && filter !== 'all' && window._currentDetailEquipId && typeof window.renderComponentBookmarks === 'function') {
            const container = document.getElementById('mtl-component-bookmarks');
            if (container) container.innerHTML = window.renderComponentBookmarks(window._currentDetailEquipId, filter);
        }
    } catch (err) {
        console.error('Error deleting bookmark:', err);
        window.showToast(`Failed to delete bookmark: ${err.message || 'Unknown error'}`, 'error');
    }
}

export function renderBookmarkList(documentId) {
    const container = document.getElementById('bm-bookmark-list');
    if (!container) return;

    const bookmarks = (window.state.documentBookmarks || []).filter(b => b.document_id === documentId);

    container.innerHTML = bookmarks.map(b => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #f0f0f0; font-size:12px;">
            <span>${b.component_id.charAt(0).toUpperCase() + b.component_id.slice(1)} — ${b.page_start === b.page_end ? `Page ${b.page_start}` : `Pages ${b.page_start}-${b.page_end}`}</span>
            <button class="btn-sm btn-danger" onclick="window.deleteBookmark('${b.id}')">✕</button>
        </div>
    `).join('') || '<p style="color:#999; font-size:12px;">No bookmarks yet.</p>';
}

// Renders bookmark links for a specific component tab. Returns '' for
// 'all' since the full document list already covers that case elsewhere.
export function renderComponentBookmarks(equipId, componentFilter) {
    if (componentFilter === 'all') return '';

    const bookmarks = (window.state.documentBookmarks || []).filter(
        b => b.equip_id === equipId && b.component_id === componentFilter
    );

    if (bookmarks.length === 0) {
        return `<p style="color:#888; font-size:13px; font-style:italic; padding:10px 0;">No bookmarked manual pages for ${componentFilter} yet.</p>`;
    }

    return bookmarks.map(b => {
        const doc = (window.state.documents || []).find(d => d.id === b.document_id);
        const docName = doc ? doc.name : 'Unknown Document';
        const label = b.page_start === b.page_end ? `Page ${b.page_start}` : `Pages ${b.page_start}-${b.page_end}`;
        return `
            <button class="btn-add-spec" style="margin:4px 4px 4px 0;" onclick="window.openDocAtPage('${b.document_id}', ${b.page_start})">
                📄 ${docName} — ${label}
            </button>
        `;
    }).join('');
}

// Opens a document jumped to a specific page. PDFs are converted from
// the stored base64 data URI to a Blob URL so the "#page=N" fragment
// is respected — data: URIs don't reliably support page navigation in
// embedded PDF viewers. Images just open normally (single page).
export function openDocAtPage(documentId, page) {
    const doc = (window.state.documents || []).find(d => d.id === documentId);
    if (!doc || !doc.file_data) return alert("No file attached.");

    const isPdf = doc.file_type === 'application/pdf' || doc.file_data.includes('application/pdf');

    if (!isPdf) {
        return window.openDocDetail(doc);
    }

    fetch(doc.file_data)
        .then(res => res.blob())
        .then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            const newWindow = window.open();
            newWindow.document.write(`
                <title>${doc.name} — Page ${page}</title>
                <body style="margin:0"><embed src="${blobUrl}#page=${page}" width="100%" height="100%" type="application/pdf"></body>
            `);
        })
        .catch(err => {
            console.error("Error opening document at page:", err);
            window.openDocDetail(doc);
        });
}
