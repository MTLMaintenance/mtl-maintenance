// machine-os-ui.js - The "Perfect Card" Builder

export function renderPerfectCard(equipId) {
    const state = window.state;
    const e = state.equipment.find(x => x.id === equipId);
    
    if (!e) return window.showPanel('equipment');

    const container = document.getElementById('panel-machine-profile');
    if (!container) return;

    // Use window.calcHealth since it's bridged
    const healthScore = typeof window.calcHealth === 'function' ? window.calcHealth(e.id, state.tasks, state.equipment) : 100;
const faultCount = window.getActiveFaultsCount(e.id);
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
                            <button class="btn btn-danger btn-sm" onclick="window.deleteEquip('${e.id}')">🗑 Delete</button>
                        </div>
                    </div>
                    
                    <div class="mtl-vitals" style="margin-top:25px; display:grid; grid-template-columns: repeat(2, 1fr); gap:15px;">
                        <div class="v-item"><span>HEALTH</span><b>${healthScore}%</b></div>
                        <div class="v-item" onclick="window.openFaultList('${e.id}')" style="cursor:pointer; border-bottom: 3px solid ${faultBoxColor};">
                            <span>ACTIVE FAULTS</span>
                            <b style="color: ${faultBoxColor};">${faultCount} ACTIVE</b>
                        </div>
                    </div>
                </div>

                <!-- JOB HUB -->
                <div class="os-section">
                    <h3 class="os-label-dark">Job Hub</h3>
                    <div class="os-job-grid" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px;">
                        <button class="job-btn-dark" onclick="window.openJobWorkflow('repair', '${e.id}')">🛠 Repair</button>
                        <button class="job-btn-dark" onclick="window.openJobWorkflow('inspect', '${e.id}')">🔍 Inspect</button>
                        <button class="job-btn-dark" onclick="window.openJobWorkflow('replace', '${e.id}')">🔄 Replace</button>
                        <button class="job-btn-dark" onclick="window.openJobWorkflow('test', '${e.id}')">⚡ Test</button>
                    </div>
                </div>

                <!-- COMPONENTS -->
               <div class="os-section no-border">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <label class="os-label-dark">Components</label>
        <button onclick="openComponentManager()" class="btn-add-spec" style="font-size:10px;">⚙️ Edit Components</button>
    </div>

    <!-- This is where the pills (All, Engine, etc.) will appear -->
    <div id="os-component-pills" style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px;">
        <!-- Injected by JS -->
    </div>

    <!-- THE DYNAMIC TITLE YOU WANTED -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
        <label class="os-label-dark" id="os-spec-title">SPECIFICATIONS FOR ALL</label>
        <button class="btn-add-spec" onclick="openSpecModal()">+ Add Spec</button>
    </div>
    
    <div id="os-spec-list" class="os-spec-grid">
        <!-- Specs injected by JS -->
    </div>
</div>

<!-- COMPONENT MANAGER MODAL -->
<div id="component-manager-modal" class="modal-backdrop" style="display:none;">
    <div class="modal" style="max-width:400px; background:white; color:black;">
        <div class="modal-header">
            <span class="modal-title">Edit Components</span>
            <button class="modal-close" onclick="closeModal('component-manager-modal')">✕</button>
        </div>
        
        <p style="font-size:12px; color:#666; margin-bottom:15px;">Edit names below or add new ones to this machine.</p>
        
        <div id="comp-manage-list" style="max-height:300px; overflow-y:auto; margin-bottom:20px;">
            <!-- Rename inputs go here -->
        </div>

        <div style="border-top:1px solid #eee; padding-top:15px;">
            <label class="os-label-dark">Add New Component</label>
            <div style="display:flex; gap:8px;">
                <input type="text" id="new-comp-name" class="form-input" placeholder="e.g. Bucket" style="border:1px solid #ddd; color:black;">
                <button class="btn btn-primary" onclick="addNewComponent()">Add</button>
            </div>
        </div>
    </div>
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
            <button class="btn-add-spec" onclick="window.openEditDocModal()">+ Add Document</button>
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
    setTimeout(() => {
        if (typeof window.renderMachineTimeline === 'function') window.renderMachineTimeline(e.id);
        if (typeof window.renderComponentSpecs === 'function') window.renderComponentSpecs(e.id, 'all');
        if (typeof window.renderDocsList === 'function') window.renderDocsList(e.id);
    }, 50);
}

export function renderWikiSection(equipId) {
    // 1. Get the tips from the global state
    const allTips = window.state.wiki || [];
    
    // 2. Filter for this machine only
    const machineTips = allTips.filter(t => t.equip_id === equipId);
    
    if (machineTips.length === 0) {
        return `<p style="color:#888; font-size:13px; font-style:italic; padding:10px 0;">No shop wisdom logged for this machine yet.</p>`;
    }

    // 3. Sort by newest first
    machineTips.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // 4. Build the HTML cards
    return machineTips.map(t => `
        <div class="wiki-note-card" style="background:#fffbeb; border-left:4px solid #f59e0b; padding:12px; border-radius:8px; margin-bottom:10px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <span style="font-weight:bold; font-size:12px; color:#92400e;">👤 ${t.author}</span>
                <span style="font-size:10px; color:#b45309; background:#fef3c7; padding:2px 6px; border-radius:4px; font-weight:bold; text-transform:uppercase;">${t.component}</span>
            </div>
            <div style="font-size:13px; color:#451a03; line-height:1.4;">"${t.body}"</div>
            <div style="font-size:10px; color:#d97706; margin-top:5px; text-align:right;">${new Date(t.created_at).toLocaleDateString()}</div>
        </div>
    `).join('');
}
