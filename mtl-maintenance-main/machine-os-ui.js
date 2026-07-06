// machine-os-ui.js - The "Perfect Card" Builder

export function renderPerfectCard(equipId) {
    console.log("🚀 renderPerfectCard started for ID:", equipId);

    try {
        const state = window.state;
        const e = state.equipment.find(x => x.id === equipId);
        
        if (!e) {
            alert("Machine not found!");
            window.showPanel('equipment');
            return;
        }

        const container = document.getElementById('panel-machine-profile');
        if (!container) {
            alert("HTML Container 'panel-machine-profile' is missing!");
            return;
        }

        // --- THE VITAL PART: BUILD PIECE BY PIECE TO AVOID CRASHING ---
        
        // 1. Check if health calculator exists
        let health = 0;
        if (typeof window.calcHealth === 'function') {
            health = window.calcHealth(e.id, state.tasks, state.equipment);
        } else {
            console.warn("⚠️ window.calcHealth is missing!");
        }

        // 2. Safely build the HTML
        console.log("🛠️ Attempting to inject HTML into container...");
        
        container.style.display = 'block';
        container.style.opacity = '1';
        container.style.visibility = 'visible';

        container.innerHTML = `
            <div class="mtl-os-container" style="color:white !important; padding: 20px;">
                <button onclick="window.showPanel('equipment')" class="os-back-btn">← Back to Fleet</button>

                <div class="mtl-header" style="background:white; color:black; padding:20px; border-radius:15px; margin-top:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h1 style="margin:0; font-size:24px;">${e.name || 'test'}</h1>
                            <span class="badge bs">${e.status || 'OPERATIONAL'}</span>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button class="btn btn-secondary btn-sm" onclick="window.openEquipDetailLegacy('${e.id}')">⚙️ Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="window.deleteEquip('${e.id}')">🗑 Delete</button>
                        </div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-top:20px;">
                        <div style="background:#f0f0f0; padding:10px; border-radius:10px; text-align:center;">
                            <label style="font-size:10px; color:#888;">FUEL</label><br><b>${e.fuel_level || 0}%</b>
                        </div>
                        <div style="background:#f0f0f0; padding:10px; border-radius:10px; text-align:center;">
                            <label style="font-size:10px; color:#888;">HEALTH</label><br><b>${health}%</b>
                        </div>
                        <div style="background:#f0f0f0; padding:10px; border-radius:10px; text-align:center;">
                            <label style="font-size:10px; color:#888;">HOURS</label><br><b>${(e.hours || 0).toLocaleString()}</b>
                        </div>
                    </div>
                </div>

                <div style="margin-top:20px;">
                    <h3 style="font-size:12px; color:#888;">UNIFIED TIMELINE</h3>
                    <div id="mtl-timeline-stream">
                        <!-- History injected here -->
                    </div>
                </div>
            </div>
        `;

        console.log("✅ HTML Injected. Now triggering sub-renders...");

        // 3. Trigger Timeline
        setTimeout(() => {
            if (typeof window.renderMachineTimeline === 'function') {
                window.renderMachineTimeline(e.id);
            }
        }, 50);

    } catch (err) {
        // --- THIS WILL FINALLY SHOW THE ERROR ---
        console.error("💥 CRASH IN RENDERER:", err);
        alert("Render Error: " + err.message);
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
