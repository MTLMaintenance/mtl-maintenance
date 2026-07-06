// machine-os-ui.js - The "Perfect Card" Builder

export function renderPerfectCard(equipId) {
    const e = window.state.equipment.find(x => x.id === equipId);
     const container = document.getElementById('panel-machine-profile');
    const currentStatus = e.status || 'Operational'; 
    const statusClass = currentStatus.toLowerCase().replace(/\s+/g, '-');
    
    container.innerHTML = `
        <div class="mtl-os-container">
            <button onclick="window.showPanel('equipment')" class="os-back-btn">
                ← Back to Fleet
            </button>
          <div style="display:flex; gap:8px;">
                    <button class="btn btn-secondary btn-sm" onclick="window.openEquipDetailLegacy('${e.id}')">⚙️ Edit Info</button>
                    <button class="btn btn-danger btn-sm" onclick="window.deleteEquip('${e.id}')">🗑 Delete Machine</button>
                </div>
            </div>

            <div class="mtl-header">
                <div class="mtl-title">
                    <h1>${e.name}</h1>
                    <!-- USE OUR SAFETY VARIABLE HERE -->
                    <span class="mtl-status-tag ${statusClass}">${currentStatus}</span>
                </div>
                <div class="mtl-vitals">
                    <div class="v-item"><span>FUEL</span><b>${e.fuel_level || 0}%</b></div>
                    <div class="v-item"><span>HOURS</span><b>${(e.hours || 0).toLocaleString()}</b></div>
                    <div class="v-item warning"><span>PM DUE</span><b>42h</b></div>
                </div>
            </div>
            <!-- THE JOB HUB: "What do you want to do?" -->
            <div class="mtl-section">
                <h3 class="section-label">Job Hub</h3>
                <div class="job-grid">
                    <button class="job-btn" onclick="window.openJobWorkflow('repair', '${e.id}')">🛠 Repair</button>
                    <button class="job-btn" onclick="window.openJobWorkflow('inspect', '${e.id}')">🔍 Inspect</button>
                    <button class="job-btn" onclick="window.openJobWorkflow('replace', '${e.id}')">🔄 Replace</button>
                    <button class="job-btn" onclick="window.openJobWorkflow('test', '${e.id}')">⚡ Test</button>
                </div>
            </div>

            <!-- COMPONENT SELECTOR: "Where is the problem?" -->
            <div class="mtl-section">
                <h3 class="section-label">Components</h3>
                <div class="component-scroll">
                    <div class="comp-card" onclick="window.openComponentOS('engine', '${e.id}')">
                        <div class="comp-icon">⚙️</div>
                        <span>Engine</span>
                    </div>
                    <div class="comp-card" onclick="window.openComponentOS('hydraulics', '${e.id}')">
                        <div class="comp-icon">💧</div>
                        <span>Hydraulics</span>
                    </div>
                    <div class="comp-card" onclick="window.openComponentOS('electrical', '${e.id}')">
                        <div class="comp-icon">⚡</div>
                        <span>Electrical</span>
                    </div>
                </div>
            </div>

            <div class="sidebar-block knowledge">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h3>Shop Wisdom</h3>
        <button class="btn-primary btn-sm" onclick="window.addWikiTip('${e.id}')">+</button>
    </div>
    
    <div id="shop-wiki-list" class="wiki-container">
        ${renderWikiSection(e.id)} <!-- THE CALL -->
    </div>
</div>
            <!-- THE TIMELINE: "The Machine's Life" -->
            <div class="mtl-section">
                <h3 class="section-label">Machine Timeline</h3>
                <div id="mtl-timeline-stream">
                    <!-- History and Wiki Tips merged here -->
                </div>
            </div>
        </div>
    `;
 setTimeout(() => {
        if (typeof window.renderMachineTimeline === 'function') {
            window.renderMachineTimeline(equipId);
        }
        if (typeof window.renderQuickSpecs === 'function') {
            window.renderQuickSpecs(equipId);
        }
    }, 10);
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
