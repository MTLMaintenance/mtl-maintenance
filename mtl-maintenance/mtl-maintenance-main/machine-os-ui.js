// machine-os-ui.js - The "Perfect Card" Builder

export function renderPerfectCard(equipId) {
    const state = window.state;
    const e = state.equipment.find(x => x.id === equipId);
    
    if (!e) return window.showPanel('equipment');

    const container = document.getElementById('panel-machine-profile');
    if (!container) return;

    // Use window.calcHealth since it's bridged
    const healthScore = typeof window.calcHealth === 'function' ? window.calcHealth(e.id, state.tasks, state.equipment) : 100;

    // START OF HTML STRING (Backtick)
    container.innerHTML = `
        <div class="mtl-os-container" style="padding-top: 20px;">
            <button onclick="window.showPanel('equipment')" class="os-back-btn">← Back to Fleet</button>

            <div class="mtl-main-card">
                
                <!-- HEADER SECTION -->
                <div class="os-section header" style="background:#fafafa;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                        <div>
                            <h1 style="margin:0; color:#1a1a1a;">${e.name || 'Unnamed Machine'}</h1>
                            <span class="mtl-status-tag operational" style="margin-top:8px; display:inline-block;">${e.status || 'OPERATIONAL'}</span>
                            <span class="badge bg" style="margin-left:10px;">⏱ ${(e.hours || 0).toLocaleString()} HRS</span>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-secondary btn-sm" onclick="window.openEquipDetailLegacy('${e.id}')">⚙️ Edit Info</button>
                            <button class="btn btn-danger btn-sm" onclick="window.deleteEquip('${e.id}')">🗑 Delete</button>
                        </div>
                    </div>
                    
                    <div class="mtl-vitals" style="margin-top:25px; display:grid; grid-template-columns: repeat(4, 1fr); gap:15px;">
                        <div class="v-item"><span>FUEL</span><b>${e.fuel_level || 0}%</b></div>
                        <div class="v-item"><span>HEALTH</span><b>${healthScore}%</b></div>
                        
                        <div class="v-item" onclick="window.openFaultCodeDetail('3252-0')" style="cursor:pointer; border-bottom: 3px solid ${e.active_faults ? '#ef4444' : '#22c55e'};">
                            <span>ACTIVE FAULTS</span>
                            <b style="color: ${e.active_faults ? '#ef4444' : '#22c55e'};">${e.active_faults || 'NONE'}</b>
                        </div>

                        <div class="v-item warning"><span>PM DUE</span><b>42h</b></div>
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
                <div class="os-section">
                    <h3 class="os-label-dark">Components</h3>
                    <div class="os-comp-scroll" style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px;">
                        <div class="comp-card-grey" onclick="window.filterOS('all', this)">🌍 All</div>
                        <div class="comp-card-grey" onclick="window.filterOS('engine', this)">⚙️ Engine</div>
                        <div class="comp-card-grey" onclick="window.filterOS('hydraulics', this)">💧 Hydraulics</div>
                        <div class="comp-card-grey" onclick="window.filterOS('tracks', this)">🚜 Tracks</div>
                    </div>
                    <div id="mtl-component-specs" style="margin-top:15px;"></div>
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
    }, 50);
}
