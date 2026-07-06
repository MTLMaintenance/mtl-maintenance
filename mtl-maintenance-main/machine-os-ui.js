// machine-os-ui.js - The "Perfect Card" Builder

export function renderPerfectCard(equipId) {
    console.log("🚀 renderPerfectCard started for ID:", equipId);
    
    const container = document.getElementById('panel-machine-profile');
    if (!container) return console.error("❌ Container 'panel-machine-profile' missing!");

    try {
        const state = window.state;
        const e = state.equipment.find(x => x.id === equipId);
        
        if (!e) {
            alert("Machine not found!");
            window.showPanel('equipment');
            return;
        }

        // --- LAYOUT SNAP ---
        container.style.display = 'block';
        container.style.minHeight = '100vh';
        container.style.paddingTop = '10px';

        // --- HTML BUILDER ---
        container.innerHTML = `
            <div class="mtl-os-container" style="padding: 20px; max-width: 1100px; margin: 0 auto;">
                <button onclick="window.showPanel('equipment')" class="os-back-btn" style="margin-bottom:15px; cursor:pointer;">← Back to Fleet</button>

                <div class="mtl-header" style="background:white; color:black; padding:25px; border-radius:20px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); margin-bottom:25px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h1 style="margin:0; font-size:32px; font-weight:800;">${e.name || 'test'}</h1>
                            <span class="badge bs" style="margin-top:8px; display:inline-block;">${e.status || 'OPERATIONAL'}</span>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-secondary" onclick="window.openEquipDetailLegacy('${e.id}')">⚙️ Edit</button>
                            <button class="btn btn-danger" onclick="window.deleteEquip('${e.id}')">🗑 Delete</button>
                        </div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap:15px; margin-top:25px; border-top:1px solid #eee; padding-top:20px;">
                        <div class="v-item" style="text-align:center;">
                            <label style="display:block; font-size:10px; color:#888; font-weight:bold;">FUEL</label>
                            <b style="font-size:20px;">${e.fuel_level || 0}%</b>
                        </div>
                        <div class="v-item" style="text-align:center;">
                            <label style="display:block; font-size:10px; color:#888; font-weight:bold;">HOURS</label>
                            <b style="font-size:20px;">${(e.hours || 0).toLocaleString()}</b>
                        </div>
                        <div class="v-item" style="text-align:center; border-left:3px solid #ff9800;">
                            <label style="display:block; font-size:10px; color:#888; font-weight:bold;">PM DUE</label>
                            <b style="font-size:20px; color:#f59e0b;">42h</b>
                        </div>
                    </div>
                </div>

                <h3 class="os-label" style="color:#aaa; font-size:11px; margin-bottom:12px; font-weight:bold; letter-spacing:1px;">JOB HUB</h3>
                <div class="os-job-grid" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:30px;">
                    <button class="job-btn" onclick="window.openJobWorkflow('repair', '${e.id}')" style="background:#1a1a1a; color:white; padding:15px; border:none; border-radius:12px; font-weight:bold; cursor:pointer;">🛠 Repair</button>
                    <button class="job-btn" onclick="window.openJobWorkflow('inspect', '${e.id}')" style="background:#1a1a1a; color:white; padding:15px; border:none; border-radius:12px; font-weight:bold; cursor:pointer;">🔍 Inspect</button>
                    <button class="job-btn" onclick="window.openJobWorkflow('replace', '${e.id}')" style="background:#1a1a1a; color:white; padding:15px; border:none; border-radius:12px; font-weight:bold; cursor:pointer;">🔄 Replace</button>
                    <button class="job-btn" onclick="window.openJobWorkflow('test', '${e.id}')" style="background:#1a1a1a; color:white; padding:15px; border:none; border-radius:12px; font-weight:bold; cursor:pointer;">⚡ Test</button>
                </div>

                <h3 class="os-label" style="color:#aaa; font-size:11px; margin-bottom:12px; font-weight:bold; letter-spacing:1px;">COMPONENTS</h3>
                <div class="os-comp-scroll" style="display:flex; gap:10px; overflow-x:auto; padding-bottom:15px; margin-bottom:25px;">
                    <div class="comp-card" onclick="window.filterOS('all', this)" style="min-width:130px; background:white; padding:15px; border-radius:12px; text-align:center; box-shadow:0 4px 10px rgba(0,0,0,0.1); cursor:pointer; color:black;">🌍 All</div>
                    <div class="comp-card" onclick="window.filterOS('engine', this)" style="min-width:130px; background:white; padding:15px; border-radius:12px; text-align:center; box-shadow:0 4px 10px rgba(0,0,0,0.1); cursor:pointer; color:black;">⚙️ Engine</div>
                    <div class="comp-card" onclick="window.filterOS('hydraulics', this)" style="min-width:130px; background:white; padding:15px; border-radius:12px; text-align:center; box-shadow:0 4px 10px rgba(0,0,0,0.1); cursor:pointer; color:black;">💧 Hydraulics</div>
                </div>

                <div id="mtl-component-specs"></div>

                <h3 class="os-label" style="color:#aaa; font-size:11px; margin-bottom:12px; font-weight:bold; letter-spacing:1px;">UNIFIED TIMELINE</h3>
                <div id="mtl-timeline-stream"></div>
            </div>
        `;

        console.log("✅ HTML Built Successfully.");

        // 3. Trigger Sub-Renders
        setTimeout(() => {
            if (typeof window.renderMachineTimeline === 'function') {
                window.renderMachineTimeline(e.id);
            }
        }, 50);

    } catch (err) {
        console.error("💥 CRASH IN RENDERER:", err);
    }
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
