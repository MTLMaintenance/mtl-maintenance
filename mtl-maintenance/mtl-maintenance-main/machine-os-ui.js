// machine-os-ui.js - The "Perfect Card" Builder

export function renderPerfectCard(equipId) {
    const state = window.state;
    const e = state.equipment.find(x => x.id === equipId);
    if (!e) return window.showPanel('equipment');

    const container = document.getElementById('panel-machine-profile');
    
    // --- FORCE PANEL TO TOP ---
    container.style.display = 'block';
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.paddingTop = '20px';

    container.innerHTML = `
        <div class="mtl-os-container" style="margin-top:0 !important; padding-top:0 !important;">
            <button onclick="window.showPanel('equipment')" class="os-back-btn">← Back to Fleet</button>

            <div class="mtl-header">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div class="mtl-title">
                        <h1 style="margin:0;">${e.name || 'test'}</h1>
                        <span class="mtl-status-tag operational">${e.status || 'OPERATIONAL'}</span>
                        <span class="badge bg" style="margin-left:10px;">⏱ ${(e.hours || 0).toLocaleString()} HRS</span>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button class="btn btn-secondary btn-sm" onclick="window.openEquipDetailLegacy('${e.id}')">⚙️ Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="window.deleteEquip('${e.id}')">🗑 Delete</button>
                    </div>
                </div>
                
               <div class="mtl-vitals" style="margin-top:20px; display:flex; gap:15px;">
    <div class="v-item"><span>FUEL</span><b>${e.fuel_level || 0}%</b></div>
    <div class="v-item"><span>FLEET HEALTH</span><b>${window.calcHealth(e.id, state.tasks, state.equipment)}%</b></div>
    
    <!-- NEW: FAULT CODES VITAL -->
    <div class="v-item" onclick="window.openFaultCodeDetail('3252-0')" style="cursor:pointer; border-bottom: 3px solid ${e.active_faults ? 'red' : 'green'}">
        <span>ACTIVE FAULTS</span>
        <b style="color: ${e.active_faults ? 'red' : 'green'}">${e.active_faults || 'NONE'}</b>
    </div>
    
    <div class="v-item warning"><span>PM DUE</span><b>42h</b></div>
</div>
            </div>

            <h3 class="os-label">Job Hub</h3>
            <div class="os-job-grid">
                <button class="job-btn" onclick="window.openJobWorkflow('repair', '${e.id}')">🛠 Repair</button>
                <button class="job-btn" onclick="window.openJobWorkflow('inspect', '${e.id}')">🔍 Inspect</button>
                <button class="job-btn" onclick="window.openJobWorkflow('replace', '${e.id}')">🔄 Replace</button>
                <button class="job-btn" onclick="window.openJobWorkflow('test', '${e.id}')">⚡ Test</button>
            </div>

            <h3 class="os-label">Components</h3>
            <div class="os-comp-scroll">
                <div class="comp-card" id="card-all" onclick="window.filterOS('all', this)">🌍 All</div>
                <div class="comp-card" id="card-engine" onclick="window.filterOS('Engine', this)">⚙️ Engine</div>
                <div class="comp-card" id="card-hyd" onclick="window.filterOS('Hydraulic', this)">💧 Hydraulics</div>
                <div class="comp-card" id="card-elec" onclick="window.filterOS('Electrical', this)">⚡ Electrical</div>
                <div class="comp-card" id="card-tracks" onclick="window.filterOS('Track', this)">🚜 Tracks</div>
            </div>

            <!-- THE SPEC AREA (Added a border so we can see it) -->
            <div id="mtl-component-specs" style="margin-bottom:20px; min-height:10px;"></div>

            <h3 class="os-label">Unified Machine Timeline</h3>
            <div id="mtl-timeline-stream" class="os-timeline"></div>
        </div>
    `;

    // Trigger sub-renders
    setTimeout(() => {
        if (window.renderMachineTimeline) window.renderMachineTimeline(e.id);
        if (window.renderComponentSpecs) window.renderComponentSpecs(e.id, 'all');
    }, 50);
}


export function renderWikiSection(equipId) {
    // 1. Get the tips from the global state
    const allTips = window.state.wiki || [];
    
    // 2. Filter for this machine only
    const machineTips = allTips.filter(t => t.equip_id === equipId);
    
    if (machineTips.length === 0) {
        return `
            <div class="wiki-empty-state">
                <p>No shop wisdom logged for this machine yet.</p>
            </div>`;
    }

    // 3. Sort by newest first
    machineTips.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // 4. Build the HTML cards
    return machineTips.map(t => `
        <div class="wiki-note-card">
            <div class="wiki-note-header">
                <span class="wiki-author">👤 ${t.author}</span>
                <span class="wiki-comp-tag">${t.component.toUpperCase()}</span>
            </div>
            <div class="wiki-note-body">"${t.body}"</div>
            <div class="wiki-note-date">${new Date(t.created_at).toLocaleDateString()}</div>
        </div>
    `).join('');
}
