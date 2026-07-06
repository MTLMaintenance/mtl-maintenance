// machine-os-ui.js - The "Perfect Card" Builder

export function renderPerfectCard(equipId) {
    const state = window.state;
    const e = state.equipment.find(x => x.id === equipId);
    
    if (!e) return window.showPanel('equipment');

    const container = document.getElementById('panel-machine-profile');
    if (!container) return;

    // 1. CLEANUP STYLES: Remove any conflicting "Absolute" styles
    container.style.position = "relative";
    container.style.top = "0";
    container.style.display = "block";
    container.style.width = "100%";
    container.style.minHeight = "100vh";
    container.style.background = "transparent"; // Let the app background show through

    // 2. Build the HTML
    container.innerHTML = `
        <div class="mtl-os-container" style="padding-top: 20px;">
            <button onclick="window.showPanel('equipment')" class="os-back-btn">← Back to Fleet</button>

            <!-- WHITE CARD -->
            <div class="mtl-header" style="background: white !important; color: black !important; border-radius: 16px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div class="mtl-title">
                        <h1 style="margin:0; color: black !important;">${e.name || 'test'}</h1>
                        <span class="mtl-status-tag operational" style="margin-top:5px; display:inline-block;">${e.status || 'OPERATIONAL'}</span>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button class="btn btn-secondary btn-sm" onclick="window.openEquipDetailLegacy('${e.id}')">⚙️ Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="window.deleteEquip('${e.id}')">🗑 Delete</button>
                    </div>
                </div>
                
                <div class="mtl-vitals" style="margin-top:25px; display:flex; gap:15px; color: black !important;">
                    <div class="v-item" style="background:#f5f5f5;"><span>FUEL</span><b>${e.fuel_level || 0}%</b></div>
                    <div class="v-item" style="background:#f5f5f5;"><span>FLEET HEALTH</span><b>${window.calcHealth(e.id, state.tasks, state.equipment)}%</b></div>
                    <div class="v-item warning" style="background:#fff3e0;"><span>PM DUE</span><b>42h</b></div>
                </div>
            </div>

            <!-- JOB HUB -->
            <h3 class="os-label" style="color: white !important; margin-top: 25px;">Job Hub</h3>
            <div class="os-job-grid">
                <button class="job-btn" onclick="window.openJobWorkflow('repair', '${e.id}')">🛠 Repair</button>
                <button class="job-btn" onclick="window.openJobWorkflow('inspect', '${e.id}')">🔍 Inspect</button>
                <button class="job-btn" onclick="window.openJobWorkflow('replace', '${e.id}')">🔄 Replace</button>
                <button class="job-btn" onclick="window.openJobWorkflow('test', '${e.id}')">⚡ Test</button>
            </div>

            <!-- COMPONENTS -->
            <h3 class="os-label" style="color: white !important;">Components</h3>
            <div class="os-comp-scroll">
                <div class="comp-card" onclick="window.filterOS('all', this)">🌍 All</div>
                <div class="comp-card" onclick="window.filterOS('Engine', this)">⚙️ Engine</div>
                <div class="comp-card" onclick="window.filterOS('Hydraulic', this)">💧 Hydraulics</div>
                <div class="comp-card" onclick="window.filterOS('Electrical', this)">⚡ Electrical</div>
                <div class="comp-card" onclick="window.filterOS('Track', this)">🚜 Tracks</div>
            </div>

            <div id="mtl-component-specs"></div>

            <h3 class="os-label" style="color: white !important;">Unified Machine Timeline</h3>
            <div id="mtl-timeline-stream"></div>
        </div>
    `;

    // 3. Trigger secondary painters
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
