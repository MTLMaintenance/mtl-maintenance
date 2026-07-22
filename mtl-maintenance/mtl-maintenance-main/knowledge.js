// knowledge.js - The Shop Wiki & Memory logic
import { uid, showToast } from './utils.js';

// 1. Function to add a new tip
export async function addWikiTip(equipId, component = 'general') {
    const body = prompt("Enter Shop Wisdom / Maintenance Tip:");
    if (!body) return;

    // THE KEY: Link it to the pill currently selected
    // If 'all' is selected, we save it as null (General machine tip)
    const activePillId = window.currentOsComponent === 'all' ? null : window.currentOsComponent;

    try {
        const { error } = await supabase
            .from('wiki')
            .insert({
                equip_id: equipId,
                component_id: activePillId, // This makes it specific to the pill!
                body: body,
                author: window.state.currentUser?.full_name || 'Staff'
            });

        if (error) throw error;

        window.showToast("Tip added!", "success");

        // IMPORTANT: Update your local state so the UI refreshes immediately
        // Fetch the new list or manually push to window.state.wiki
        if (window.fetchWiki) await window.fetchWiki(); 
        
        // Refresh the UI area
        const wikiContainer = document.getElementById('shop-wiki-list');
        if (wikiContainer) {
            wikiContainer.innerHTML = renderWikiSection(equipId);
        }

    } catch (err) {
        console.error("Error saving tip:", err);
    }
};

// 2. Function to load all wiki tips (Add this to your init.js loadState later)
export async function fetchWiki() {
    try {
        const { data } = await window._mpdb.from('shop_wiki').select('*');
        window.state.wiki = data || [];
    } catch (e) { console.error(e); }
}
