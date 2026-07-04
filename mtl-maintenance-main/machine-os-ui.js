// machine-os-ui.js - The "Perfect Card" Builder

export function renderPerfectCard(equipId) {
    const state = window.state;
    const e = state.equipment.find(x => x.id === equipId);
    if (!e) return window.showPanel('equipment');

    const container = document.getElementById('panel-machine-profile');

    // Build the "Digital Twin" Vitals
    const fuel = e.fuel_level || e.vitals?.fuel || 0;
    const health = window.calcHealth(e.id, state.tasks, state.equipment);

    container.innerHTML = `
        <div class="mtl-os-container">
            <div class="os-nav-header">
                <button onclick="window.showPanel('equipment')" class="os-back-btn">← Back to Fleet</button>
                <div class="os-admin-btns">
                    <button class="btn-secondary" onclick="window.openEquipDetailLegacy('${e.id}')">⚙️ Edit Info</button>
                    <button class="btn-danger" onclick="window.deleteEquip('${e.id}')">🗑 Delete</button>
                </div>
            </div>

            <!-- 1. HERO & VITALS -->
            <div class="os-hero-card">
                <div class="os-hero-main">
                    <h1>${e.name || 'Unnamed Machine'}</h1>
                    <div class="os-badge-row">
                        <span class="badge ${e.status === 'Down' ? 'bd' : 'bs'}">${e.status}</span>
                        <span class="badge bg">⏱ ${e.hours.toLocaleString()} hrs</span>
                    </div>
                </div>
                <div class="os-vitals-grid">
                    <div class="os-vital">
                        <label>FUEL</label>
                        <div class="os-progress"><div class="fill" style="width:${fuel}%"></div></div>
                        <b>${fuel}%</b>
                    </div>
                    <div class="os-vital">
                        <label>FLEET HEALTH</label>
                        <div class="os-progress"><div class="fill" style="width:${health}%; background:green;"></div></div>
                        <b>${health}%</b>
                    </div>
                </div>
            </div>

            <!-- 2. JOB HUB (The One-Tap Actions) -->
            <h3 class="os-label">Job Hub</h3>
            <div class="os-job-grid">
                <button onclick="window.openJobWorkflow('repair', '${e.id}')">🛠 Repair</button>
                <button onclick="window.openJobWorkflow('inspect', '${e.id}')">🔍 Inspect</button>
                <button onclick="window.openJobWorkflow('replace', '${e.id}')">🔄 Replace</button>
                <button onclick="window.openJobWorkflow('test', '${e.id}')">⚡ Test</button>
            </div>

            <!-- 3. COMPONENT DEEP DIVE -->
            <h3 class="os-label">Components</h3>
            <div class="os-comp-scroll">
                <div class="comp-card" onclick="window.openComponentOS('engine', '${e.id}')">⚙️ Engine</div>
                <div class="comp-card" onclick="window.openComponentOS('hydraulics', '${e.id}')">💧 Hydraulics</div>
                <div class="comp-card" onclick="window.openComponentOS('electrical', '${e.id}')">⚡ Electrical</div>
                <div class="comp-card" onclick="window.openComponentOS('tracks', '${e.id}')">🚜 Under Carriage</div>
            </div>

            <!-- 4. THE UNIFIED TIMELINE -->
            <h3 class="os-label">Unified Machine Timeline</h3>
            <div id="mtl-timeline-stream" class="os-timeline">
                <!-- Data injected by renderMachineTimeline -->
            </div>
        </div>
    `;

    // Trigger the automated logic
    setTimeout(() => {
        if (window.renderMachineTimeline) window.renderMachineTimeline(e.id);
        if (window.renderQuickSpecs) window.renderQuickSpecs(e.id);
    }, 20);
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
