// troubleshoot.js - Guided Troubleshooting
// Step 3 of the troubleshooting-tree build: a tech picks a symptom on a
// specific machine, and sees likely causes ranked by how often each
// root_cause has actually fixed THIS symptom on THIS machine before
// (root_cause is tagged at tech sign-off - see verifyTaskPinAction in
// tasks.js). No repair history yet just means an empty, honest list -
// step 4 will add a manual-page fallback here for the cold-start case.
import { findBestManualMatch } from './manual-search.js';
import { PREDEFINED_SYMPTOMS } from './tasks.js';
import { openModal, closeModal } from './ui.js';

function getAllSymptomOptions() {
    const approvedCustoms = (window.state.customSymptoms || []).filter(c => c.status === 'approved');
    return [
        ...Object.entries(PREDEFINED_SYMPTOMS),
        ...approvedCustoms.map(c => [c.normalized_text, c.raw_text.charAt(0).toUpperCase() + c.raw_text.slice(1)])
    ];
}

function symptomLabel(value) {
    const match = getAllSymptomOptions().find(([v]) => v === value);
    return match ? match[1] : value;
}

export function openTroubleshootModal(equipId) {
    window._troubleshootEquipId = equipId;
    renderSymptomPicker(equipId);
    openModal('troubleshoot-modal');
}

function renderSymptomPicker(equipId) {
    const container = document.getElementById('troubleshoot-body');
    if (!container) return;

    const e = (window.state.equipment || []).find(x => x.id === equipId);
    document.getElementById('troubleshoot-title').textContent = `Troubleshoot — ${e ? e.name : 'Machine'}`;

    const options = getAllSymptomOptions();

    container.innerHTML = `
        <p style="color:#666; font-size:13px; margin-bottom:15px;">What's the machine doing?</p>
        <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:10px;">
            ${options.map(([value, label]) => `
                <button onclick="window.selectTroubleshootSymptom('${value}')" style="text-align:left; padding:14px; background:#1a1a1a !important; color:#fff !important; border:none; border-radius:8px; font-weight:600; cursor:pointer;">${label}</button>
            `).join('')}
        </div>
    `;
}

export async function selectTroubleshootSymptom(symptomValue) {
    const equipId = window._troubleshootEquipId;
    const container = document.getElementById('troubleshoot-body');
    if (!container || !equipId) return;

    const e = (window.state.equipment || []).find(x => x.id === equipId);
    const label = symptomLabel(symptomValue);
    document.getElementById('troubleshoot-title').textContent = `${label} — ${e ? e.name : 'Machine'}`;

    // Rank causes by how often they've fixed this exact symptom on this
    // exact machine, using the symptom/root_cause tags captured back in
    // step 1 (saveTask on creation, verifyTaskPinAction on sign-off).
    const matches = (window.state.tasks || []).filter(t =>
        (t.equipId === equipId || t.equip_id === equipId) &&
        t.symptom === symptomValue &&
        t.root_cause && t.root_cause.trim()
    );

    const causeCounts = {};
    matches.forEach(t => {
        const key = t.root_cause.trim();
        causeCounts[key] = (causeCounts[key] || 0) + 1;
    });
    const ranked = Object.entries(causeCounts).sort((a, b) => b[1] - a[1]);
    const totalRepairs = matches.length;

    container.innerHTML = `
        <button onclick="window.openTroubleshootModal('${equipId}')" style="margin-bottom:14px; background:#f1f5f9 !important; color:#1e293b !important; border:none; border-radius:6px; padding:8px 14px; font-size:12px; cursor:pointer;">← Back to symptoms</button>
        <h4 style="margin:0 0 4px;">Likely Causes</h4>
        <p style="color:#999; font-size:11px; margin:0 0 12px;">Ranked by this machine's own repair history${totalRepairs ? ` (${totalRepairs} past repair${totalRepairs === 1 ? '' : 's'} with this symptom)` : ''}</p>
        ${ranked.length ? `
            <div style="display:flex; flex-direction:column; gap:8px;">
                ${ranked.map(([cause, count]) => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#f8fafc; border-radius:8px; border-left:3px solid #2563eb;">
                        <span style="font-size:13px; color:#1e293b;">${cause}</span>
                        <span class="badge bg" style="font-size:10px; white-space:nowrap; margin-left:10px;">${count}x fixed this</span>
                    </div>
                `).join('')}
            </div>
        ` : `
            <div style="padding:15px; background:#fffbeb; border-radius:8px; border-left:3px solid #f59e0b;">
                <p style="color:#92400e; font-size:13px; margin:0;">No repair history for this symptom on this machine yet.</p>
                <p style="color:#b45309; font-size:11px; margin:6px 0 0;">Once a work order with this symptom gets signed off with a root cause noted, it'll show up here — and future repairs will get ranked against it.</p>
            </div>
        `}
        <div id="troubleshoot-manual-area" style="margin-top:15px;">
            <p style="color:#aaa; font-size:11px;">Checking linked manuals...</p>
        </div>
    `;

    renderManualMatch(equipId, symptomValue, label);
}

// Step 4: searches this machine's linked, searchable manuals for pages
// matching the chosen symptom, and renders whichever of three honest
// outcomes actually applies — a real match, docs that exist but can't be
// searched (e.g. scanned copies), or nothing attached at all. Kept as its
// own function (rather than inline in selectTroubleshootSymptom) so the
// ranked-causes list renders and is usable immediately, without waiting
// on the manual search to finish first.
async function renderManualMatch(equipId, symptomValue, label) {
    const area = document.getElementById('troubleshoot-manual-area');
    if (!area) return; // user already navigated away

    const result = await findBestManualMatch(equipId, symptomValue, label);
    // Bail if the modal moved on to a different symptom while this was in flight
    if (window._troubleshootEquipId !== equipId || !document.getElementById('troubleshoot-manual-area')) return;

    if (result.status === 'match') {
        area.innerHTML = `
            <div style="padding:12px; background:#eff6ff; border-radius:8px; border-left:3px solid #2563eb; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <div>
                    <div style="font-size:12px; font-weight:600; color:#1e40af;">📖 Found in manual</div>
                    <div style="font-size:12px; color:#3b5998;">${result.docName} — Page ${result.pageNumber}</div>
                </div>
                <button onclick="window.openDocAtPage('${result.documentId}', ${result.pageNumber})" style="background:#2563eb !important; color:#fff !important; border:none; border-radius:6px; padding:8px 14px; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap;">Open Page</button>
            </div>
        `;
    } else if (result.status === 'no_match') {
        area.innerHTML = `<p style="color:#999; font-size:11px; font-style:italic;">No matching section found in the linked manual for "${label}."</p>`;
    } else if (result.status === 'no_searchable_docs' && result.linkedDocs && result.linkedDocs.length) {
        // Docs are attached but none have a real text layer (scanned/paper copies)
        const doc = result.linkedDocs[0];
        area.innerHTML = `
            <div style="padding:12px; background:#f8fafc; border-radius:8px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <div style="font-size:12px; color:#666;">Manual attached but not searchable (scanned copy) — you can still open and browse it.</div>
                <button onclick="window.openDocDetail(window.state.documents.find(d => d.id === '${doc.id}'))" style="background:#f1f5f9 !important; color:#1e293b !important; border:none; border-radius:6px; padding:8px 14px; font-size:12px; cursor:pointer; white-space:nowrap;">Open Manual</button>
            </div>
        `;
    } else {
        // No documents linked to this machine at all — stay quiet rather
        // than nag; "+ Add Document" on the machine profile already covers this.
        area.innerHTML = '';
    }
}
