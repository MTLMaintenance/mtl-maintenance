// profiles.js - User Identity, Presence, and DMs
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

// 2. Render the list of team members for DMs
export async function renderDmList(currentUser, state) {
    const el = document.getElementById('dm-list');
    if (!el) return;
    
    const otherUsers = (state.users_list_cache || []).filter(u => u.username !== currentUser.username);
    
    el.innerHTML = otherUsers.map(u => {
        const ch = 'dm-' + [currentUser.username, u.username].sort().join('-');
        const status = u.preferences?.status || 'Available';
        const dotClass = `dot-${status.replace(/\s+/g, '-')}`;

        return `
        <button class="chat-channel-btn" data-channel="${ch}" onclick="window.switchChannel('${ch}', this)">
            <span class="dm-status-dot ${dotClass}"></span>
            <span style="flex:1; text-align:left;">${u.full_name || u.username}</span>
            <span class="unread-dot" id="dot-dm-${ch}" style="display:none"></span>
        </button>`;
    }).join('') || '<div class="empty-text">No users found</div>';
}

// 3. Render the "Online Now" list for the sidebar
export async function renderOnlineUsers(currentUser) {
  const el = document.getElementById('online-users-list');
  if(!el) return;
  try {
    const { data: profiles } = await supabase.from('profiles').select('full_name,username,last_seen').eq('status','approved');
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    el.innerHTML = (profiles || []).map(p => {
      const isMe = p.username === currentUser.username;
      const isOnline = isMe || (p.last_seen && new Date(p.last_seen) > fiveMinAgo);
      return `
        <div class="online-user-row">
          <div class="status-indicator" style="background:${isOnline ? '#3B6D11' : 'rgba(255,255,255,0.2)'}"></div>
          ${p.full_name}${isMe ? ' (you)' : ''}
        </div>`;
    }).join('');
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

// 1. Fetch every team member (for chat status dots)
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
export function handleChatInput(el, state, showMentionDropdown, hideMentionDropdown) {
    // 1. Auto-resize the chat box height
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';

    const val = el.value;
    const cursor = el.selectionStart;
    const lastAt = val.lastIndexOf('@', cursor - 1);

    // 2. Check if user is typing a @mention
    if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
        const query = val.substring(lastAt + 1, cursor).toLowerCase();
        
        // Find users matching the typed name
        const users = (state.users_list_cache || []).filter(u => 
            u.full_name.toLowerCase().includes(query) || 
            u.username.toLowerCase().includes(query)
        );

        if (users.length > 0) {
            showMentionDropdown(users, lastAt);
        } else {
            hideMentionDropdown();
        }
    } else {
        hideMentionDropdown();
    }
}
export function showMentionDropdown(users, atPos) {
    const dd = document.getElementById('mention-dropdown');
    if (!dd) return;
    
    dd.innerHTML = users.map(u => `
        <div class="mention-item" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--border); font-size:13px" 
             onclick="window.insertMention('${u.username}', ${atPos})">
            <b>${u.full_name}</b> <span style="font-size:11px; color:var(--text3)">@${u.username}</span>
        </div>
    `).join('');
    dd.style.display = 'block';
}

export function hideMentionDropdown() {
    const dd = document.getElementById('mention-dropdown');
    if (dd) dd.style.display = 'none';
}

export function insertMention(username, atPos) {
    const input = document.getElementById('chat-input');
    if (!input) return;
    
    const val = input.value;
    const before = val.substring(0, atPos);
    const after = val.substring(input.selectionStart);
    
    input.value = before + '@' + username + ' ' + after;
    hideMentionDropdown();
    input.focus();
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

