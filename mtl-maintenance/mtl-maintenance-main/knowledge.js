// knowledge.js - The Shop Wiki & Memory logic
import { uid, showToast } from './utils.js';

// 1. Function to add a new tip
export async function addWikiTip(equipId, component = 'general') {
    // Guard: if this fires, the caller isn't passing a real equip id —
    // check what's calling addWikiTip and what it's passing in.
    if (!equipId) {
        console.error("addWikiTip called with no equipId:", equipId);
        window.showToast("Couldn't save tip: missing machine ID", "error");
        return;
    }

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
        // FIX: was querying 'shop_wiki', but addWikiTip inserts into 'wiki' —
        // two different tables, so fetched data never matched what was saved.
        const { data, error } = await window._mpdb.from('wiki').select('*');
        if (error) throw error;
        window.state.wiki = data || [];
    } catch (e) { console.error(e); }
}

// 3. Edit an existing tip
export async function editWikiTip(equipId, tipId) {
    const allTips = window.state.wiki || [];
    const tip = allTips.find(t => t.id === tipId);
    if (!tip) return;

    const newBody = prompt("Edit Shop Wisdom / Maintenance Tip:", tip.body);
    if (newBody === null) return;      // cancelled
    if (!newBody.trim()) return;       // ignore empty saves

    try {
        const { error } = await supabase
            .from('wiki')
            .update({ body: newBody })
            .eq('id', tipId);
        if (error) throw error;

        window.showToast("Tip updated!", "success");

        if (window.fetchWiki) await window.fetchWiki();

        const wikiContainer = document.getElementById('shop-wiki-list');
        if (wikiContainer) {
            wikiContainer.innerHTML = renderWikiSection(equipId);
        }
    } catch (err) {
        console.error("Error updating tip:", err);
    }
}

// 4. Delete a tip
export async function deleteWikiTip(equipId, tipId) {
    if (!confirm("Delete this tip? This cannot be undone.")) return;

    try {
        const { error } = await supabase
            .from('wiki')
            .delete()
            .eq('id', tipId);
        if (error) throw error;

        window.showToast("Tip deleted", "success");

        if (window.fetchWiki) await window.fetchWiki();

        const wikiContainer = document.getElementById('shop-wiki-list');
        if (wikiContainer) {
            wikiContainer.innerHTML = renderWikiSection(equipId);
        }
    } catch (err) {
        console.error("Error deleting tip:", err);
    }
}
