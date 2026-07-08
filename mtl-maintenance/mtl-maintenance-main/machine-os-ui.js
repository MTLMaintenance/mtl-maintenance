// machine-os-ui.js - The "Perfect Card" Builder

export function renderPerfectCard(equipId) {
    const state = window.state;
    const e = state.equipment.find(x => x.id === equipId);
    if (!e) return window.showPanel('equipment');

    const container = document.getElementById('panel-machine-profile');

    container.innerHTML = `
        <div class="mtl-os-container">
            <!-- BACK BUTTON -->
            <button onclick="window.showPanel('equipment')" class="os-back-btn" style="margin-bottom:15px;">← Back to Fleet</button>

            <!-- THE ONE BIG CARD -->
            <div class="mtl-main-card">
                
                <!-- 1. HEADER AREA -->
                <div class="os-section header">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                        <div>
                            <h1 style="margin:0; font-size:32px; font-weight:800; color:#1a1a1a;">${e.name || 'test'}</h1>
                            <span class="mtl-status-tag operational" style="margin-top:8px; display:inline-block;">${e.status || 'OPERATIONAL'}</span>
                            <span class="badge bg" style="margin-left:10px;">⏱ ${(e.hours || 0).toLocaleString()} HRS</span>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-secondary btn-sm" onclick="window.openEquipDetailLegacy('${e.id}')">⚙️ Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="window.deleteEquip('${e.id}')">🗑 Delete</button>
                        </div>
                    </div>
                    
                   <div class="mtl-vitals" style="margin-top:25px; display:grid; grid-template-columns: repeat(4, 1fr); gap:15px;">
    
    <!-- 1. FUEL -->
    <div class="v-item">
        <span>FUEL</span>
        <b>${e.fuel_level || 0}%</b>
    </div>

    <!-- 2. HEALTH -->
    <div class="v-item">
        <span>FLEET HEALTH</span>
        <b>${window.calcHealth(e.id, state.tasks, state.equipment)}%</b>
    </div>

    <!-- 3. FAULTS (Clickable) -->
    <div class="v-item" 
         onclick="window.openFaultCodeDetail('3252-0')" 
         style="cursor:pointer; border-bottom: 3px solid ${e.active_faults ? '#ef4444' : '#22c55e'}; transition: all 0.2s;">
        <span>ACTIVE FAULTS</span>
        <b style="color: ${e.active_faults ? '#ef4444' : '#22c55e'};">
            ${e.active_faults || 'NONE'}
        </b>
    </div>

    <!-- 4. PM DUE -->
    <div class="v-item warning" style="border-left:4px solid #f59e0b">
        <span>PM DUE</span>
        <b style="color:#f59e0b;">42h</b>
    </div>

</div>
    setTimeout(() => {
        window.renderMachineTimeline(e.id);
        window.renderComponentSpecs(e.id, 'all');
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
