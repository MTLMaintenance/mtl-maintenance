// components.js - Sub-system logic (Engine, Hydraulics, etc.)
import { badge, fmtDate, equipName } from './utils.js';

export function openComponentOS(componentName, equipId) {
    const state = window.state;
    const e = state.equipment.find(x => x.id === equipId);
    if (!e) return;

    // 1. Filter Timeline for ONLY this component
    // It searches for work orders that mention "Engine" or "Hydraulic" in the name or notes
    const compHistory = state.tasks.filter(t => 
        (t.equipId === equipId || t.equip_id === equipId) && 
        (t.name.toLowerCase().includes(componentName) || t.notes?.toLowerCase().includes(componentName))
    );

    // 2. Filter Documents/Manuals for this component
    const compDocs = state.documents.filter(d => 
        d.equip_id === equipId && d.name.toLowerCase().includes(componentName)
    );

    // 3. Get specific Specs (from our Custom Fields)
    const allSpecs = e.custom_fields || {};
    const compSpecs = Object.entries(allSpecs).filter(([key]) => 
        key.toLowerCase().includes(componentName)
    );

    // 4. Draw the Detail Modal
    document.getElementById('detail-title').textContent = `${e.name} — ${componentName.toUpperCase()}`;
    
    document.getElementById('detail-body').innerHTML = `
        <div class="comp-detail-layout">
            <div class="comp-section">
                <h4>Specific Specs</h4>
                <div class="spec-list">
                    ${compSpecs.map(([k, v]) => `<div class="spec-item"><span>${k}</span><b>${v}</b></div>`).join('') || '<p class="empty">No specs tagged to this component.</p>'}
                </div>
            </div>

            <div class="comp-section">
                <h4>Previous Work</h4>
                <div class="comp-history-list">
                    ${compHistory.map(h => `
                        <div class="history-card">
                            <b>${h.name}</b>
                            <span>${fmtDate(h.completed_at || h.due)} · ${h.assign}</span>
                        </div>
                    `).join('') || '<p class="empty">No repair history found.</p>'}
                </div>
            </div>

            <div class="comp-section">
                <h4>Component Knowledge (Wiki)</h4>
                <div class="wiki-box">
                    <p style="font-style:italic; color:#666;">"Don't forget to bleed the air from the top valve after a filter change."</p>
                    <button class="btn-sm" onclick="window.addWikiTip('${equipId}', '${componentName}')">+ Add Tip</button>
                </div>
            </div>
        </div>
    `;

    window.openModal('detail-modal');
}
