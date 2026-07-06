// machine-os-ui.js - The "Perfect Card" Builder

export function renderPerfectCard(equipId) {
    const e = window.state.equipment.find(x => x.id === equipId);
    if (!e) return window.showPanel('equipment');

    const container = document.getElementById('panel-machine-profile');
    container.innerHTML = `
        <div class="mtl-os-container">
            <button onclick="window.showPanel('equipment')" class="os-back-btn">← Back to Fleet</button>

            <div class="mtl-header" style="background:white; color:black; border-radius:15px; padding:25px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h1 style="margin:0;">${e.name || 'Unnamed Machine'}</h1>
                        <span class="badge bs" style="margin-top:8px;">${e.status || 'OPERATIONAL'}</span>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button class="btn btn-secondary btn-sm" onclick="window.openEquipDetailLegacy('${e.id}')">⚙️ Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="window.deleteEquip('${e.id}')">🗑 Delete</button>
                    </div>
                </div>
                
                <div class="mtl-vitals" style="margin-top:25px; display:grid; grid-template-columns: repeat(3, 1fr); gap:15px;">
                    <div class="v-item"><span>FUEL</span><b>${e.fuel_level || 0}%</b></div>
                    <div class="v-item"><span>HOURS</span><b>${(e.hours || 0).toLocaleString()}</b></div>
                    <div class="v-item" style="border-left:4px solid #f59e0b"><span>PM DUE</span><b>42h</b></div>
                </div>
            </div>

            <div class="os-job-grid" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin:25px 0;">
                <button class="job-btn" onclick="window.openJobWorkflow('repair', '${e.id}')">🛠 Repair</button>
                <button class="job-btn" onclick="window.openJobWorkflow('inspect', '${e.id}')">🔍 Inspect</button>
                <button class="job-btn" onclick="window.openJobWorkflow('replace', '${e.id}')">🔄 Replace</button>
                <button class="job-btn" onclick="window.openJobWorkflow('test', '${e.id}')">⚡ Test</button>
            </div>

            <div class="os-comp-scroll" style="display:flex; gap:10px; overflow-x:auto; margin-bottom:20px;">
                <div class="comp-card" onclick="window.filterOS('all', this)">🌍 All</div>
                <div class="comp-card" onclick="window.filterOS('engine', this)">⚙️ Engine</div>
                <div class="comp-card" onclick="window.filterOS('hydraulics', this)">💧 Hydraulics</div>
            </div>

            <div id="mtl-component-specs"></div>
            <h3 class="os-label" style="color:white; margin-top:30px;">Unified Timeline</h3>
            <div id="mtl-timeline-stream"></div>
        </div>
    `;

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
