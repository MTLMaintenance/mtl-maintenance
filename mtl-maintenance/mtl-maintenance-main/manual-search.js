// manual-search.js - Extracts and caches searchable text from PDF manuals,
// so a symptom's keywords can later be matched to the right page without
// re-parsing the PDF every time (see refreshAnalytics-era step 2 in the
// troubleshooting-tree build). Rendering-to-canvas (bookmarks.js) and
// text-extraction (this file) both need pdf.js, so we reuse the same
// lazy-loader rather than loading the CDN script twice.
import { supabase } from './db.js';
import { ensurePdfJsLoaded } from './bookmarks.js';

// Below this many total non-whitespace characters across the whole
// document, we treat it as "no real text layer" (e.g. a scanned page
// saved as PDF) rather than a document that's just genuinely short.
const MIN_TEXT_LENGTH_FOR_REAL_LAYER = 40;

// Runs once per document — call this right after a PDF finishes
// uploading. Extracts text per page via pdf.js's getTextContent()
// (much cheaper than rendering, since it doesn't touch a canvas), caches
// each page's text in document_page_text, and marks documents.has_text_layer
// so later steps know whether this doc is searchable or should just be
// opened as-is.
export async function extractAndCacheDocumentText(documentId) {
    const doc = (window.state.documents || []).find(d => d.id === documentId);
    if (!doc || !doc.file_data) return;

    const isPdf = doc.file_type === 'application/pdf' || doc.file_data.includes('application/pdf');
    if (!isPdf) {
        // Images have no pages/text to extract — nothing to do here.
        await markTextLayer(documentId, false);
        return;
    }

    try {
        await ensurePdfJsLoaded();
        const loadingTask = window.pdfjsLib.getDocument(doc.file_data);
        const pdfDoc = await loadingTask.promise;

        let totalTextLength = 0;
        const pageRows = [];

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ').trim();
            totalTextLength += pageText.replace(/\s/g, '').length;

            pageRows.push({
                document_id: documentId,
                page_number: pageNum,
                text_content: pageText
            });
        }

        // Batch upsert — one round trip instead of one per page, important
        // for manuals that can easily run 100-300+ pages.
        const { error } = await window._mpdb
            .from('document_page_text')
            .upsert(pageRows, { onConflict: 'document_id,page_number' });
        if (error) throw error;

        const hasTextLayer = totalTextLength >= MIN_TEXT_LENGTH_FOR_REAL_LAYER;
        await markTextLayer(documentId, hasTextLayer);

        if (typeof window.showToast === 'function') {
            window.showToast(hasTextLayer
                ? `"${doc.name}" indexed — ${pdfDoc.numPages} pages searchable ✓`
                : `"${doc.name}" appears to be a scanned copy — no searchable text found`);
        }
    } catch (e) {
        console.error('Failed to extract document text:', e);
        // Don't leave has_text_layer stuck at null on failure — treat as
        // "not searchable" so later steps fail gracefully instead of
        // silently waiting forever on an extraction that never finished.
        await markTextLayer(documentId, false);
    }
}

async function markTextLayer(documentId, hasTextLayer) {
    try {
        const { error } = await window._mpdb
            .from('documents')
            .update({ has_text_layer: hasTextLayer })
            .eq('id', documentId);
        if (error) throw error;

        const doc = (window.state.documents || []).find(d => d.id === documentId);
        if (doc) doc.has_text_layer = hasTextLayer;
    } catch (e) {
        console.error('Failed to update has_text_layer:', e);
    }
}
