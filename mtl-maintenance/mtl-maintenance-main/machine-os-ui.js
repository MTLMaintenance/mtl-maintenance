// machine-os-ui.js - The "Perfect Card" Builder

export function renderPerfectCard(equipId) {
    const state = window.state;
    // Find the equipment object
    const e = state.equipment.find(x => x.id === equipId);
    
    // If the machine doesn't exist, go back to the fleet list
    if (!e) return window.showPanel('equipment');

    const container = document.getElementById('panel-machine-profile');
    if (!container) return;

    // Set global trackers so other files know which machine we are looking at
    window.currentMachineId = equipId; 
    window.currentOsComponent = 'all';

    const healthScore = typeof window.calcHealth === 'function' ? window.calcHealth(e.id, state.tasks, state.equipment) : 100;
    const faultCount = typeof window.getActiveFaultsCount === 'function' ? window.getActiveFaultsCount(e.id) : 0;
    const faultBoxColor = faultCount > 0 ? '#ef4444' : '#22c55e'; 
    
    container.innerHTML = `
        <div class="mtl-os-container" style="padding-top: 20px;">
            <button onclick="window.showPanel('equipment')" class="os-back-btn">← Back to Fleet</button>

            <div class="mtl-main-card">
                
                <!-- HEADER SECTION -->
                <div class="os-section header" style="background:#fafafa;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                        <div>
                            <h1 style="margin:0; color:#1a1a1a; cursor:pointer;" onclick="window.renameEquipment('${equipId}')" title="Click to rename">${e.name || 'Unnamed Machine'} ✏️</h1>
                            <span class="mtl-status-tag operational" style="margin-top:8px; display:inline-block; cursor:pointer;" onclick="window.editEquipStatusInline('${equipId}')" title="Click to change status">${e.status || 'OPERATIONAL'}</span>
                            <span class="badge bg" style="margin-left:10px; cursor:pointer;" onclick="window.quickLogHours('${equipId}')" title="Click to log new hours">⏱ ${(e.hours || 0).toLocaleString()} HRS ✏️</span>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-secondary btn-sm" onclick="window.openEquipQRModal('${equipId}')">🏷️ QR Code</button>
                            <button class="btn btn-danger btn-sm" onclick="window.deleteEquip('${equipId}')">🗑 Delete</button>
                        </div>
                    </div>
                    
                    <div class="mtl-vitals" style="margin-top:25px; display:grid; grid-template-columns: repeat(2, 1fr); gap:15px;">
                        <div class="v-item"><span>HEALTH</span><b>${healthScore}%</b></div>
                        <div class="v-item" onclick="window.openFaultList('${equipId}')" style="cursor:pointer; border-bottom: 3px solid ${faultBoxColor};">
                            <span>ACTIVE FAULTS</span>
                            <b style="color: ${faultBoxColor};">${faultCount} ACTIVE</b>
                        </div>
                    </div>
                </div>

                <!-- JOB HUB -->
                <div class="os-section">
                    <h3 class="os-label-dark">Job Hub</h3>
                    <div class="os-job-grid" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px;">
                        <button class="job-btn-dark" onclick="window.openJobWorkflow('repair', '${equipId}')">🛠 Repair</button>
                        <button class="job-btn-dark" onclick="window.openJobWorkflow('inspect', '${equipId}')">🔍 Inspect</button>
                        <button class="job-btn-dark" onclick="window.openJobWorkflow('replace', '${equipId}')">🔄 Replace</button>
                        <button class="job-btn-dark" onclick="window.openJobWorkflow('test', '${equipId}')">⚡ Test</button>
                    </div>
                </div>

                <!-- COMPONENTS -->
                <div class="os-section">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <h3 class="os-label-dark" style="margin:0;">Components</h3>
                        <button onclick="window.openComponentManager()" class="btn-add-spec" style="font-size:10px;">⚙️ Edit Components</button>
                    </div>

                    <div id="os-component-pills" style="display:flex; flex-wrap:wrap; gap:10px; padding-bottom:10px;">
                        <!-- Pills injected by window.renderComponentPills -->
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
                        <h3 class="os-label-dark" id="os-spec-title" style="margin:0;">SPECIFICATIONS FOR ALL</h3>
                        <button class="btn-add-spec" onclick="window.openSpecModal()">+ Add Spec</button>
                    </div>

                    <div id="mtl-zerk-os-area" style="display:none; margin-top:20px;"></div>
                    <div id="os-spec-list" class="os-spec-grid" style="margin-top:15px;">
                        <!-- Specs injected by window.renderMachineSpecs -->
                    </div>
                </div>

                <!-- SHOP WISDOM -->
                <div class="os-section" style="background:#fffcf5;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3 class="os-label-dark" style="margin:0;">Shop Wisdom</h3>
                        <button class="btn-add-spec" onclick="window.addWikiTip('${equipId}', 'general')">+ Add Tip</button>
                    </div>
                    <div id="shop-wiki-list">
                        ${renderWikiSection(equipId)}
                    </div>
                </div>

                <!-- DOCUMENTS -->
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

    // Trigger sub-renders after the HTML is applied to the DOM
    setTimeout(() => {
        if (window.renderComponentPills) window.renderComponentPills(equipId);
        if (window.renderMachineSpecs) window.renderMachineSpecs(equipId, 'all');
        if (window.renderMachineTimeline) window.renderMachineTimeline(equipId);
        if (window.renderDocsList) window.renderDocsList(equipId);
    }, 50);
}

export function renderWikiSection(equipId) {
    const allTips = window.state.wiki || [];
    
    // THE KEY: Filter by BOTH machine ID and the current active pill
    const machineTips = allTips.filter(t => {
        const matchesMachine = t.equip_id === equipId;
        
        if (window.currentOsComponent === 'all') {
            return matchesMachine; // Show everything if 'All' is selected
        } else {
            // Show only if it matches the current pill ID
            return matchesMachine && t.component_id === window.currentOsComponent;
        }
    });
    
    if (machineTips.length === 0) {
        return `<p style="color:#888; font-size:13px; font-style:italic; padding:10px 0;">No tips found for this section.</p>`;
    }

    machineTips.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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

window.currentOsComponent = "all";

/**
 * Loads the pills for the machine.
 */
window.renderComponentPills = async function(machineId) {
    const container = document.getElementById('os-component-pills');
    if (!container) return;

    // 1. Initialize the HTML string at the very top level
    let html = '';

    try {
        // 2. Fetch components
        let { data: comps, error: fetchError } = await supabase
            .from('machine_components')
            .select('*')
            .eq('machine_id', machineId)
            .order('created_at', { ascending: true });

        // 3. SEEDING logic
        if (!comps || comps.length === 0) {
            const defaults = [
                { machine_id: machineId, name: 'Engine', icon: '⚙️' },
                { machine_id: machineId, name: 'Hydraulics', icon: '💧' },
                { machine_id: machineId, name: 'Grease Map', icon: '⛽' },
                { machine_id: machineId, name: 'Tracks', icon: '🚜' }
            ];
            
            const { data: seeded, error: seedError } = await supabase
                .from('machine_components')
                .insert(defaults)
                .select();

            if (seedError) {
                console.error("Seeding failed (Check RLS):", seedError);
                comps = []; 
            } else {
                comps = seeded || [];
            }
        }

        // 5. Build the Dynamic Pills
        if (comps && Array.isArray(comps)) {
            comps.forEach(c => {
                const isSelected = window.currentOsComponent === c.id ? 'active-os' : '';
                const isGrease = c.name && c.name.toLowerCase().includes('grease');
                
                const clickAction = isGrease 
                    ? `window.openZerkOS('${machineId}', this)` 
                    : `selectOsComponent('${c.id}', '${c.name.toUpperCase()}')`;

                html += `
                    <div class="comp-card-grey ${isSelected}" onclick="${clickAction}">
                        ${c.icon || '⚙️'} ${c.name}
                    </div>`;
            });
        }

        // 6. Apply to the DOM
        container.innerHTML = html;

    } catch (err) {
        console.error("Critical error in renderComponentPills:", err);
        container.innerHTML = `<p style="color:red">Error loading components</p>`;
    }
};
/**
 * Handles pill clicks: Updates the label and filters the specs
 */
window.selectOsComponent = function(id, name) {
    window.currentOsComponent = id;
    
    // 1. Update the UI Title
    document.getElementById('os-spec-title').innerText = `SPECIFICATIONS FOR ${name}`;
    
    // 2. Refresh the Pills (to show the blue active state)
    window.renderComponentPills(window.currentMachineId);
    
    // 3. REFRESH SPECS
    window.renderMachineSpecs(window.currentMachineId, id);
    
    // 4. REFRESH SHOP WISDOM
    // We update the innerHTML of the wiki container dynamically
    const wikiContainer = document.getElementById('shop-wiki-list');
    if (wikiContainer) {
        wikiContainer.innerHTML = renderWikiSection(window.currentMachineId);
    }
};

/**
 * Manager: Renaming & Adding
 */
window.openComponentManager = async function() {
    const list = document.getElementById('comp-manage-list');
    const { data: comps } = await supabase.from('machine_components').select('*').eq('machine_id', window.currentMachineId);

    list.innerHTML = comps?.map(c => `
        <div style="display:flex; gap:10px; margin-bottom:10px;">
            <input type="text" class="form-input" value="${c.name}" 
                   style="border:1px solid #ddd; color:black;"
                   onchange="renameComponent('${c.id}', this.value)">
            <button class="btn btn-danger" onclick="deleteComponent('${c.id}')">🗑️</button>
        </div>
    `).join('') || '<p style="color:#999; text-align:center;">Add your first component below</p>';

    window.openModal('component-manager-modal');
};

window.addNewComponent = async function() {
    const nameInput = document.getElementById('new-comp-name');
    if (!nameInput.value) return;

    await supabase.from('machine_components').insert({
        machine_id: window.currentMachineId,
        name: nameInput.value
    });

    nameInput.value = '';
    window.openComponentManager(); // Refresh Modal
    window.renderComponentPills(window.currentMachineId); // Refresh Bar
};

window.renameComponent = async function(id, newName) {
    await supabase.from('machine_components').update({ name: newName }).eq('id', id);
    window.renderComponentPills(window.currentMachineId); // Updates pill names immediately
    window.showToast("Renamed successfully", "success");
};

window.deleteComponent = async function(id) {
    if (!confirm("Delete this component?")) return;
    await supabase.from('machine_components').delete().eq('id', id);
    window.openComponentManager();
    window.renderComponentPills(window.currentMachineId);
};

window.saveNewSpec = async function() {
    // 1. First thing: Signal that the function started
    alert("Function started!"); 
    console.log("DEBUG: saveNewSpec initiated");

    // 2. Check for UI elements
    const nameEl = document.getElementById('spec-name-input');
    const valEl = document.getElementById('spec-value-input');

    if (!nameEl || !valEl) {
        alert("CRITICAL ERROR: Input fields not found in HTML. Check your IDs.");
        return;
    }

    const name = nameEl.value.trim();
    const val = valEl.value.trim();
    
    console.log("DEBUG: Input values are:", name, val);

    if (!name || !val) {
        alert("STOP: Name or Value is empty.");
        return;
    }

    // 3. Check for Global variables
    console.log("DEBUG: currentMachineId is:", window.currentMachineId);
    console.log("DEBUG: currentOsComponent is:", window.currentOsComponent);

    if (!window.currentMachineId) {
        alert("STOP: No Machine ID found in memory.");
        return;
    }

    try {
        alert("Sending to Database...");
        
        const { error } = await supabase
            .from('specs')
            .insert({
                machine_id: window.currentMachineId,
                component_id: window.currentOsComponent === 'all' ? null : window.currentOsComponent,
                name: name,
                value: val
            });

        if (error) {
            alert("DATABASE ERROR: " + error.message);
            console.error(error);
            return;
        }

        alert("SUCCESS: Saved to Supabase!");
        
        window.closeModal('spec-modal');
        
        if (window.renderMachineSpecs) {
            window.renderMachineSpecs(window.currentMachineId, window.currentOsComponent);
        }

    } catch (err) {
        alert("CRASH: " + err.message);
        console.error(err);
    }
};
// --- SAVING A SHOP TIP ---
// Assuming you have a function that opens the prompt/modal for a tip
window.saveWikiTip = async function(tipBody) {
    const activePillId = window.currentOsComponent === 'all' ? null : window.currentOsComponent;

    await supabase.from('wiki').insert({
        equip_id: window.currentMachineId,
        component_id: activePillId, // Links tip to the pill (Engine, Tracks, etc)
        body: tipBody,
        author: window.state.currentUser?.full_name || 'Staff'
    });

    // Refresh only the tips for this view
    window.renderWikiSection(window.currentMachineId); 
};
