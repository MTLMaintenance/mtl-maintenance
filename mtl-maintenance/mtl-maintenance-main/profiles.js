// profiles.js - User Identity and Profiles
import { supabase } from './db.js';
import { showToast } from './utils.js';
import { closeModal } from './ui.js';

// 1. Update user's "Last Seen" timestamp (Online status)
export async function updateLastSeen(username) {
  try {
    await supabase.from('profiles')
      .update({ last_seen: new Date().toISOString() })
      .eq('username', username);
  } catch(e) {}
}

// 4. Avatar Preview Logic (Visual feedback in settings)
export function updateAvatarPreview() {
    const preview = document.getElementById('p-preview-avatar');
    const name = document.getElementById('p-name')?.value || "U";
    const style = document.getElementById('p-avatar-style')?.value;
    const color = document.getElementById('p-accent-color')?.value || '#3b82f6';

    if (!preview) return;
    preview.textContent = name.charAt(0).toUpperCase();
    preview.style.borderRadius = (style === 'avatar-style-square') ? "12px" : "50%";

    if (style === 'avatar-style-border') {
        preview.style.background = 'transparent';
        preview.style.border = `3px solid ${color}`;
        preview.style.color = color;
    } else {
        preview.style.background = color;
        preview.style.border = 'none';
        preview.style.color = 'white';
    }
}

// 1. Fetch team member profiles
export async function fetchAllProfiles() {
    // 1. Grab the master folder from the window
    const state = window.state; 
    
    if (!state) {
        console.error("Global state not found while fetching profiles.");
        return [];
    }

    try {
        const { data, error } = await window._mpdb
            .from('profiles')
            .select('id, username, full_name, preferences');
        
        if (error) throw error;

        // 2. This line now works because 'state' is defined above!
        state.profiles = data || [];
        
        console.log(`Team profiles synced: ${state.profiles.length} members.`);
        return state.profiles;
    } catch (e) {
        console.error("Error loading team profiles:", e);
        return [];
    }
}
export function openProfileModal() {
    if (!window.currentUser) return;
    const p = window.currentUser.preferences || {};

    // 1. Fill all the input fields in the modal
    const fields = {
        'p-name': window.currentUser.name || "",
        'p-status': p.status || 'Available',
        'p-start-page': p.startPage || 'dashboard',
        'p-accent-color': p.accentColor || '#3b82f6',
        'p-avatar-style': p.avatarStyle || 'avatar-style-initial',
        'p-notes': p.notes || ''
    };

    for (const [id, val] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }

    // 2. Set the color picker hidden input
    const customColor = document.getElementById('p-custom-color');
    if (customColor) customColor.value = p.accentColor || '#3b82f6';

    // 3. Update the preview name in the header
    const previewName = document.getElementById('p-preview-name');
    if (previewName) previewName.textContent = window.currentUser.name;

    // 4. Update the avatar circles
    if (typeof updateAvatarPreview === 'function') {
        updateAvatarPreview();
    }

    // 5. Open the modal
    if (typeof window.openModal === 'function') {
        window.openModal('profile-modal');
    }
}
