// machine-os-ui.js - The "Perfect Card" Builder

export function renderPerfectCard(equipId) {
    const state = window.state;
    const e = state.equipment.find(x => String(x.id) === String(equipId));
    
    if (!e) return window.showPanel('equipment');

    const container = document.getElementById('panel-machine-profile');
    if (!container) return;

    // Use window.calcHealth since it's bridged
    const healthScore = typeof window.calcHealth === 'function' ? window.calcHealth(e.id, state.tasks, state.equipment) : 100;
const faultCount = typeof window.getActiveFaultsCount === 'function' ? window.getActiveFaultsCount(e.id) : 0;
    const related = (state.tasks || []).filter(t => String(t.equip_id || t.equipId) === String(e.id));
    const isOpen = t => !['Completed', 'Cancelled'].includes(t.status);
    const pending = related.filter(isOpen);
    const overdue = pending.filter(t => t.due && new Date(`${t.due}T23:59:59`) < new Date());
    const nextJob = pending.filter(t => t.due).sort((a,b) => new Date(a.due) - new Date(b.due))[0];
    const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const actionJobs = pending.slice().sort((a,b) => new Date(a.due || '9999-12-31') - new Date(b.due || '9999-12-31')).slice(0, 4);
  const faultBoxColor = faultCount > 0 ? '#ef4444' : '#22c55e'; 
    
    // START OF HTML STRING (Backtick)
    container.innerHTML = `
        <div class="mtl-os-container" style="padding-top: 20px;">
            <button onclick="window.showPanel('equipment')" class="os-back-btn">← Back to Fleet</button>

            <div class="mtl-main-card">
                
                <!-- HEADER SECTION -->
                <div class="os-section header" style="background:#fafafa;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                        <div>
                            <h1 style="margin:0; color:#1a1a1a; cursor:pointer;" onclick="window.renameEquipment('${e.id}')" title="Click to rename">${e.name || 'Unnamed Machine'} ✏️</h1>
                            <span class="mtl-status-tag operational" style="margin-top:8px; display:inline-block; cursor:pointer;" onclick="window.editEquipStatusInline('${e.id}')" title="Click to change status">${e.status || 'OPERATIONAL'}</span>
                            <span class="badge bg" style="margin-left:10px; cursor:pointer;" onclick="window.quickLogHours('${e.id}')" title="Click to log new hours">⏱ ${(e.hours || 0).toLocaleString()} HRS ✏️</span>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-secondary btn-sm" onclick="window.openEquipQRModal('${e.id}')">🏷️ QR Code</button>
                            <button class="btn btn-secondary btn-sm" onclick="window.toggleMachineManagerActions()" title="Equipment settings">⚙ Settings</button>
                        </div>
                    </div>
                    
                    <div id="machine-manager-actions" hidden class="mechanic-settings"><button class="btn btn-danger btn-sm" onclick="window.deleteEquip('${e.id}')">🗑 Delete equipment</button></div>
                    <div class="mtl-vitals" style="margin-top:25px; display:grid; grid-template-columns: repeat(2, 1fr); gap:15px;">
                        <div class="v-item"><span>HEALTH</span><b>${healthScore}%</b></div>
                        <div class="v-item" onclick="window.openFaultList('${e.id}')" style="cursor:pointer; border-bottom: 3px solid ${faultBoxColor};">
                            <span>ACTIVE FAULTS</span>
                            <b style="color: ${faultBoxColor};">${faultCount} ACTIVE</b>
                        </div>
                    </div>
                </div>

                <!-- MACHINE WORK QUEUE -->
                <div class="os-section mechanic-work-queue">
                    <h3 class="os-label-dark">Needs Attention</h3>
                    <div class="mechanic-summary-grid">
                        <div><span>OPEN WORK ORDERS</span><strong>${pending.length}</strong></div>
                        <div><span>OVERDUE</span><strong class="${overdue.length ? 'mechanic-alert' : ''}">${overdue.length}</strong></div>
                        <div><span>NEXT SCHEDULED JOB</span><strong class="mechanic-next">${nextJob ? escapeHtml(nextJob.due) : 'None scheduled'}</strong></div>
                    </div>
                    <div class="mechanic-open-jobs">${actionJobs.length ? actionJobs.map(t => `<button type="button" onclick="window.openTaskDetail('${escapeHtml(t.id)}')"><span>${escapeHtml(t.name)}</span><small>${escapeHtml(t.status || 'Open')}${t.due ? ' · ' + escapeHtml(t.due) : ''}</small></button>`).join('') : '<p>No open work orders for this machine.</p>'}</div>
                </div>

                <!-- JOB HUB -->
                <div class="os-section">
                    <h3 class="os-label-dark">Mechanic Actions</h3>
                    <p class="mechanic-hint">Start a work order for a planned job, or quickly record a repair already finished.</p>
                    <button type="button" class="mechanic-quick-btn" onclick="window.openQuickRepairLog('${e.id}')">✓ Quick Repair Log — Completed Job</button>
                    <div class="os-job-grid" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:10px;">
                        <button class="job-btn-dark" onclick="window.openJobWorkflow('repair', '${e.id}')">🛠 Repair</button>
                        <button class="job-btn-dark" onclick="window.openJobWorkflow('inspect', '${e.id}')">🔍 Inspect</button>
                        <button class="job-btn-dark" onclick="window.openJobWorkflow('replace', '${e.id}')">🔄 Replace</button>
                        <button class="job-btn-dark" onclick="window.openJobWorkflow('test', '${e.id}')">⚡ Test</button>
                        <button class="job-btn-dark" onclick="window.openTroubleshootModal('${e.id}')" style="background:#7c2d12;">🧭 Troubleshoot</button>
                    </div>
                </div>

                <!-- COMPONENTS -->
                <div class="os-section">
                    <h3 class="os-label-dark">Components & Machine Reference</h3>
                    <div class="os-comp-scroll" id="mtl-comp-chip-area" style="display:flex; flex-wrap:wrap; gap:10px; padding-bottom:10px;"></div>
                       <div id="mtl-zerk-os-area" style="display:none; margin-top:20px;"></div>
                    <div id="mtl-component-specs" style="margin-top:15px;"></div>
                    <div id="mtl-component-bookmarks" style="margin-top:15px; display:none;"></div>
                </div>

                  
                   <!-- 4. SHOP WISDOM AREA -->
                  <div class="os-section" style="background:#fffcf5;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h3 class="os-label-dark" style="margin:0;">Shop Wisdom</h3>
            <button class="btn-add-spec" onclick="window.addWikiTip('${e.id}', 'general')">+ Add Tip</button>
        </div>
        <div id="shop-wiki-list">
            ${renderWikiSection(e.id)} <!-- THIS IS THE CALL -->
        </div>
    </div>

                   <!-- 5. DOCUMENTS & MANUALS -->
                  <div class="os-section" style="background:#f8fafc;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h3 class="os-label-dark" style="margin:0;">Documents & Manuals</h3>
            <button class="btn-add-spec" id="add-doc-btn" onclick="window.openEditDocModal()">+ Add Document</button>
        </div>
        <div id="mtl-docs-list"></div>
    </div>

                <!-- TIMELINE -->
                <div class="os-section no-border">
                    <h3 class="os-label-dark">Machine Timeline</h3>
                    <div id="mtl-timeline-stream"></div>
                </div>

            </div>
        </div>
    `; 

    // Trigger sub-renders after a tiny delay
    setTimeout(async () => {
        if (typeof window.renderMachineTimeline === 'function') window.renderMachineTimeline(e.id);
        if (typeof window.renderComponentSpecs === 'function') window.renderComponentSpecs(e.id, 'all');
        if (typeof window.renderDocsList === 'function') window.renderDocsList(e.id);
        if (typeof window.renderComponentChips === 'function') window.renderComponentChips(e.id);

        // Fetch wiki tips fresh and re-render, since the initial
        // renderWikiSection() call above only had whatever was
        // already (possibly stale/empty) in window.state.wiki.
        if (typeof window.fetchWiki === 'function') {
            await window.fetchWiki();
            const wikiContainer = document.getElementById('shop-wiki-list');
            if (wikiContainer) wikiContainer.innerHTML = renderWikiSection(e.id);
        }

        // Fetch document bookmarks too. Nothing renders from this on
        // initial load (component filter starts at 'all', where the
        // bookmarks section stays hidden) but it needs to be loaded
        // before switching to a component tab.
        if (typeof window.fetchDocumentBookmarks === 'function') {
            await window.fetchDocumentBookmarks();
        }
    }, 50);
}

export function renderWikiSection(equipId, componentFilter = 'all') {
    // 1. Get the tips from the global state
    const allTips = window.state.wiki || [];

    // 2. Filter for this machine, and (unless 'all') this exact component only —
    // same isolation pattern as specs, so a tip added under Engine only shows
    // under Engine, not leaking into Hydraulics/Tracks/etc.
    const machineTips = allTips.filter(t => {
        if (t.equip_id !== equipId) return false;
        if (componentFilter === 'all') return true;
        return t.component_id === componentFilter;
    });

    if (machineTips.length === 0) {
        const label = componentFilter === 'all' ? 'this machine' : componentFilter;
        return `<p style="color:#888; font-size:13px; font-style:italic; padding:10px 0;">No shop wisdom logged for ${label} yet.</p>`;
    }

    // 3. Sort by newest first
    machineTips.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // 4. Build the HTML cards
    return machineTips.map(t => `
        <div class="wiki-note-card" style="background:#fffbeb; border-left:4px solid #f59e0b; padding:12px; border-radius:8px; margin-bottom:10px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <span style="font-weight:bold; font-size:12px; color:#92400e;">👤 ${t.author}</span>
                <span style="font-size:10px; color:#b45309; background:#fef3c7; padding:2px 6px; border-radius:4px; font-weight:bold; text-transform:uppercase;">${t.component_id || 'General'}</span>
            </div>
            <div style="font-size:13px; color:#451a03; line-height:1.4;">"${t.body}"</div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                <div style="font-size:10px; color:#d97706;">${new Date(t.created_at).toLocaleDateString()}</div>
                <div style="display:flex; gap:8px;">
                    <button class="btn-sm" onclick="window.editWikiTip('${equipId}', '${t.id}')" style="font-size:10px; padding:2px 8px;">Edit</button>
                    <button class="btn-sm btn-danger" onclick="window.deleteWikiTip('${equipId}', '${t.id}')" style="font-size:10px; padding:2px 8px;">✕</button>
                  </div>
                  </div>
            </div>
        </div>
    `).join('');
}
      
   


// Small, already-finished fixes enter the existing approval queue, rather than
// bypassing the mechanic sign-off / manager approval workflow.
export function openQuickRepairLog(equipId) {
    const equip = (window.state?.equipment || []).find(e => String(e.id) === String(equipId));
    if (!equip) return;
    let modal = document.getElementById('mechanic-quick-log-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'mechanic-quick-log-modal';
        modal.className = 'mechanic-quick-modal';
        modal.innerHTML = `<form id="mechanic-quick-form" class="mechanic-quick-dialog">
            <h2>Quick Repair Log</h2>
            <p>For a repair that's already finished. Sends it to manager approval.</p>
            <label>Equipment<input id="mql-machine" readonly></label>
            <label>What was repaired? <span>*</span><input id="mql-title" maxlength="200" required placeholder="e.g. Replaced broken grease fitting"></label>
            <label>Work performed <span>*</span><textarea id="mql-notes" rows="4" required placeholder="Describe the repair and result"></textarea></label>
            <label>Date completed<input type="date" id="mql-date" required></label>
            <div class="mechanic-quick-actions"><button type="button" class="btn btn-secondary" id="mql-cancel">Cancel</button><button type="submit" class="btn btn-primary" id="mql-submit">Submit for Approval</button></div>
        </form>`;
        document.body.appendChild(modal);
        modal.querySelector('#mql-cancel').onclick = () => { modal.hidden = true; };
        modal.addEventListener('click', event => { if (event.target === modal) modal.hidden = true; });
        modal.querySelector('form').addEventListener('submit', saveQuickRepairLog);
    }
    modal.dataset.equipmentId = equip.id;
    modal.querySelector('#mql-machine').value = equip.name || 'Equipment';
    modal.querySelector('#mql-title').value = '';
    modal.querySelector('#mql-notes').value = '';
    modal.querySelector('#mql-date').value = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
    modal.hidden = false;
    modal.querySelector('#mql-title').focus();
}

async function saveQuickRepairLog(event) {
    event.preventDefault();
    const modal = document.getElementById('mechanic-quick-log-modal');
    if (!modal || modal.hidden) return;
    const equipId = modal.dataset.equipmentId;
    const equip = (window.state?.equipment || []).find(e => String(e.id) === String(equipId));
    const title = modal.querySelector('#mql-title').value.trim();
    const notes = modal.querySelector('#mql-notes').value.trim();
    const date = modal.querySelector('#mql-date').value;
    if (!equip || !title || !notes || !date) return;
    const button = modal.querySelector('#mql-submit');
    button.disabled = true;
    try {
        if (!window._mpdb) throw new Error('Database is not connected');
        const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `qr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const record = {
            id, name: `REPAIR: ${title}`, equip_id: equip.id,
            due: date, priority: 'Low',
            assign: window.currentUser?.name || 'Unassigned',
            notes: `Completed on ${date} by ${window.currentUser?.name || 'Mechanic'}.\n${notes}`,
            status: 'Pending Approval', checklist: [], created_at: new Date().toISOString()
        };
        const {error} = await window._mpdb.from('tasks').insert(record);
        if (error) throw error;
        window.state.tasks = window.state.tasks || [];
        window.state.tasks.push({...record, equipId: equip.id});
        modal.hidden = true;
        if (typeof window.renderPerfectCard === 'function') window.renderPerfectCard(equip.id);
        if (typeof window.renderTasksTable === 'function') window.renderTasksTable();
        if (typeof window.updateMetrics === 'function') window.updateMetrics();
        if (typeof window.showToast === 'function') window.showToast('Quick repair sent for approval');
    } catch (error) {
        console.error('Quick repair save failed', error);
        if (typeof window.showToast === 'function') window.showToast(`Could not save repair: ${error.message || 'Please retry'}`);
    } finally { button.disabled = false; }
}

export function toggleMachineManagerActions() {
    const node = document.getElementById('machine-manager-actions');
    if (node) node.hidden = !node.hidden;
}
