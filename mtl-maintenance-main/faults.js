// faults.js

export async function openFaultCodeDetail(code) {
    const modal = document.getElementById('detail-modal');
    
    // We simulate a database of "Shop Wisdom" fixes
    const library = {
        '3252-0': {
            desc: "DPF Inlet Temperature Sensor - Erratic Data",
            cause: "Damaged harness in the boom or loose pin at connector J2.",
            fix: "Check pin tension on J2. Clean with contact cleaner. Replace sensor only if voltage is > 5V.",
            parts: "DPF Sensor (Part #422-5501)"
        }
    };

    const info = library[code] || { desc: "Unknown Code", cause: "Not yet in Shop Wiki", fix: "Refer to manual", parts: "N/A" };

    document.getElementById('detail-title').textContent = "Fault Diagnostic: " + code;
    document.getElementById('detail-body').innerHTML = `
        <div class="fault-layout">
            <div class="fault-box urgent"><h4>Issue</h4><p>${info.desc}</p></div>
            <div class="fault-box"><h4>Why it happens</h4><p>${info.cause}</p></div>
            <div class="fault-box success"><h4>How we fix it in this shop</h4><p>${info.fix}</p></div>
            <div class="fault-box"><h4>Parts Needed</h4><p>${info.parts}</p></div>
            <button class="btn-primary" onclick="window.openJobWorkflow('repair', window._currentDetailEquipId)">Create Repair Order</button>
        </div>
    `;

    window.openModal('detail-modal');
}
