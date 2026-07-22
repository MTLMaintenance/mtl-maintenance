// settings.js - User Preferences & Personalization
import { supabase } from './db.js';
import { showToast } from './utils.js';
import { openModal, closeModal } from './ui.js';
import { logAuditAction } from './admin.js';

// 1. Apply user's saved theme and status across the app
export function applyUserPreferences(currentUser) {
    if (!currentUser) return;
    const p = currentUser.preferences || {};

    // Apply Accent Color
    if (p.accentColor) {
        document.documentElement.style.setProperty('--accent', p.accentColor);
    }

    // Update Topbar Identity
    const nameEl = document.getElementById('p-topbar-name');
    const emojiEl = document.getElementById('p-status-emoji');
    
    if (nameEl) nameEl.textContent = currentUser.name;
    if (emojiEl) {
        const emojiMap = { 
            'Available':'🟢', 'In the Field':'🚜', 'At the Shop':'🔧', 'On Lunch':'🍔', 'Busy':'🔴' 
        };
        emojiEl.textContent = emojiMap[p.status] || '🟢';
    }

    // Update Private Dashboard Note
    const noteContainer = document.getElementById('personal-note-widget');
    if (noteContainer) {
        noteContainer.innerHTML = (p.notes && p.notes.trim() !== "") ? `
            <div class="private-note-card" style="background:var(--accent);">
                <div style="font-size:10px; text-transform:uppercase; font-weight:bold;">Private Note</div>
                <div style="font-size:14px;">${p.notes}</div>
            </div>` : '';
    }
}

// 2. Save Profile Changes to Database
export async function saveUserProfile(newName, newPrefs, currentUser) {
    try {
        const { error } = await supabase.from('profiles')
            .update({ full_name: newName, preferences: newPrefs })
            .eq('id', currentUser.id);

        if (error) throw error;

        // Update local memory
        currentUser.name = newName;
        currentUser.preferences = newPrefs;
        localStorage.setItem('mp_session', JSON.stringify(currentUser));

        applyUserPreferences(currentUser);
        closeModal('profile-modal');
        showToast("Settings applied! ✓");
        logAuditAction("Profile Update", "Personalized app settings.", currentUser);
        return true;
    } catch (e) {
        console.error(e);
        showToast("Error saving profile");
        return false;
    }
}

// 3. Toggle Dark Mode
export function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('mp_darkmode', isDark ? '1' : '0');
  return isDark;
}
/**
 * 1. setAccent: Updates the theme color live across the app
 */
window.setAccent = function(color) {
    // Update the CSS variable on the fly
    document.documentElement.style.setProperty('--accent', color);
    
    // Store the color in the hidden input so it's ready for saving
    const hiddenInput = document.getElementById('p-accent-color');
    if (hiddenInput) hiddenInput.value = color;

    // Update the rainbow swatch border/visual
    const visualSwatch = document.getElementById('custom-swatch-visual');
    if (visualSwatch) visualSwatch.style.borderColor = color;

    // Re-run preview to update border styles if active
    window.updateAvatarPreview();
};

/**
 * 2. updateAvatarPreview: Makes the modal preview box interactive
 */
window.updateAvatarPreview = function() {
    const nameInput = document.getElementById('p-name')?.value || "User";
    const styleSelect = document.getElementById('p-avatar-style')?.value;
    const previewBox = document.getElementById('p-preview-avatar');
    const previewName = document.getElementById('p-preview-name');

    if (!previewBox) return;

    // Update the Letter (First character of the name)
    previewBox.innerText = nameInput.charAt(0).toUpperCase();
    if (previewName) previewName.innerText = nameInput;

    // Switch CSS classes
    previewBox.className = styleSelect;

    // Special logic for the 'Border' style to use the current accent color
    if (styleSelect === 'avatar-style-border') {
        const currentAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent');
        previewBox.style.borderColor = currentAccent;
        previewBox.style.color = currentAccent;
    } else {
        previewBox.style.borderColor = '';
        previewBox.style.color = '';
    }
};

/**
 * 3. saveUserProfile: Updates Supabase and the Local UI
 */
window.saveUserProfile = async function() {
    const updatedData = {
        full_name: document.getElementById('p-name').value,
        status: document.getElementById('p-status').value,
        start_page: document.getElementById('p-start-page').value,
        accent_color: document.getElementById('p-accent-color').value || '#185FA5',
        avatar_style: document.getElementById('p-avatar-style').value,
        private_notes: document.getElementById('p-notes').value
    };

    // 1. Try to get user from global state
    let currentUser = window.state?.currentUser;

    // 2. FALLBACK: If state is empty (hardcoded admin), try to get from Supabase Auth directly
    if (!currentUser) {
        console.warn("User not in state, checking Supabase Auth...");
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
            currentUser = data.user;
        }
    }

    // 3. IF STILL NOT FOUND
    if (!currentUser || !currentUser.id) {
        console.error("CRITICAL: No User ID found. Cannot save to database.");
        alert("Error: Your account session is missing. Please log in properly or check your hardcoded Admin ID.");
        return;
    }

    try {
        const { error } = await supabase
            .from('profiles')
            .update(updatedData)
            .eq('id', currentUser.id);

        if (error) throw error;

        // Sync local state so it doesn't fail next time
        window.state.currentUser = { ...currentUser, ...updatedData };
        
        // Update UI
        if (document.getElementById('p-topbar-name')) {
            document.getElementById('p-topbar-name').innerText = updatedData.full_name;
        }

        if (window.showToast) window.showToast("Settings Saved!", "success");
        window.closeModal('profile-modal');

    } catch (err) {
        console.error("Database Update Failed:", err);
        if (window.showToast) window.showToast("Database Error", "danger");
    }
};

window.renderMachineSpecs = async function(machineId, compId) {
    const container = document.getElementById('os-spec-list');
    if (!container) return;

    try {
        // 1. Fetch specs for this machine
        let query = supabase
            .from('specs')
            .select('*')
            .eq('machine_id', machineId);

        // 2. If a specific pill is selected (not 'all'), filter by that component ID
        if (compId !== 'all') {
            query = query.eq('component_id', compId);
        }

        const { data: specs, error } = await query;

        if (error) throw error;

        // 3. If no specs found, show a clean "Empty" message
        if (!specs || specs.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; padding: 40px; text-align: center; color: #999; background: #fafafa; border-radius: 12px; border: 1px dashed #ddd;">
                    No specifications logged for this section yet.
                </div>`;
            return;
        }

        // 4. Draw the spec cards
        container.innerHTML = specs.map(s => `
            <div class="spec-card-os">
                <label>${s.name.toUpperCase()}</label>
                <b>${s.value}</b>
            </div>
        `).join('');

    } catch (err) {
        console.error("Error rendering specs:", err);
        container.innerHTML = `<p style="color:red">Failed to load specifications.</p>`;
    }
};
