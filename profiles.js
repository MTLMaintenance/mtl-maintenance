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
