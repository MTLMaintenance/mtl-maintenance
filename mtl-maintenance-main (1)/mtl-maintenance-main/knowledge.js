// knowledge.js - The Shop Wiki & Memory logic
import { uid, showToast } from './utils.js';

// 1. Function to add a new tip
export async function addWikiTip(equipId, component = 'general') {
    const tipBody = prompt(`Enter a Pro-Tip for this ${component}: \n(e.g., "Use a 15mm deep socket")`);
    
    if (!tipBody || tipBody.trim() === "") return;

    const newTip = {
        id: uid(),
        equip_id: equipId,
        component: component.toLowerCase(),
        author: window.currentUser.name,
        body: tipBody.trim(),
        created_at: new Date().toISOString()
    };

    try {
        const { error } = await window._mpdb.from('shop_wiki').insert([newTip]);
        if (error) throw error;

        // Add to local memory so it shows up instantly
        if (!window.state.wiki) window.state.wiki = [];
        window.state.wiki.push(newTip);

        showToast("Knowledge saved to Shop Wiki ✓");
        
        // Refresh the current view
        if (window.currentPanel === 'machine-profile') {
            window.renderPerfectCard(equipId);
        }
    } catch (e) {
        console.error("Wiki Error:", e);
        showToast("Failed to save tip");
    }
}

// 2. Function to load all wiki tips (Add this to your init.js loadState later)
export async function fetchWiki() {
    try {
        const { data } = await window._mpdb.from('shop_wiki').select('*');
        window.state.wiki = data || [];
    } catch (e) { console.error(e); }
}
