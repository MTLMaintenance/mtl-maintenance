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
