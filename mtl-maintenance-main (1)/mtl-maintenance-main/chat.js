// chat.js - The Chat & Messaging Module
import { supabase } from './db.js';
import { uid, showToast, fmtDate } from './utils.js';

// We need to know who is logged in and what channel we are in
// These usually come from your state.js
import * as State from './state.js';

// 1. Initialize Realtime Chat

export function initChat() {
    console.log("👂 Real-time Chat Listener starting...");

    if (window.chatSub) window._mpdb.removeChannel(window.chatSub);

    window.chatSub = window._mpdb.channel('any')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'chat_messages' 
        }, payload => {
            // --- THE FIX IS HERE ---
            const msg = payload.new; // We must define 'msg' from the payload
            console.log("📬 NEW MESSAGE ARRIVED!", msg);

            // Only draw if it's from someone else
            const isMe = window.currentUser && (msg.author === window.currentUser.username);
            
            // Default to 'general' if currentChannel is empty
            const currentRoom = window.currentChannel || 'general';

            if (!isMe && msg.channel === currentRoom) {
                console.log("📝 Drawing bubble for receiver...");
                appendChatMessage(msg);
            }
        })
        .subscribe();
}


// 3. The HTML "Builder" for a message bubble
export function buildChatMsgHtml(msg) {
    const state = window.state;
    const currentUser = window.currentUser;

    // THE FIX: We check the ID or the Username directly from the global window
    const isMe = currentUser && (msg.author === currentUser.username);
    
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const initials = (msg.author_name || msg.author || "?").split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    return `
    <div class="chat-row ${isMe ? 'me' : 'them'}">
        <div class="chat-avatar">${initials}</div>
        <div class="chat-content">
            <div class="chat-info">
                <span class="chat-author">${msg.author_name || msg.author}</span>
                <span class="chat-time">${time}</span>
            </div>
            <div class="chat-bubble">${msg.body}</div>
        </div>
    </div>`;
}

// 4. Helper to push a bubble onto the screen
export function appendChatMessage(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    // Call the builder and add it to the list
    container.innerHTML += buildChatMsgHtml(msg);
    container.scrollTop = container.scrollHeight;
}


// 2. The actual Send Logic (Updated to be self-sufficient)
export async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const user = window.currentUser;
    const channel = window.currentChannel || 'general';

    if (!input || !input.value.trim() || !user) return;

    const msg = {
        id: uid(),
        channel: channel,
        author: user.username,
        author_name: user.name,
        body: input.value.trim(),
        created_at: new Date().toISOString()
    };

    // UI: Add to screen locally FIRST
    appendChatMessage(msg);
    input.value = '';

    // DB: Save to cloud
    try {
        const { error } = await window._mpdb.from('chat_messages').insert(msg);
        if (error) throw error;
    } catch (e) {
        console.error("Chat sync failed:", e);
        showToast("Message not saved (Offline)");
    }
}
export function renderChatMessages(msgs,container){
  if(!msgs.length){container.innerHTML='<div style="color:var(--text3);font-size:13px;text-align:center;padding:40px 20px">No messages yet — say hello! 👋</div>';return;}
   msgs.forEach(msg=>{const msgDate=new Date(msg.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});if(msgDate!==lastDate){html+=`<div style="text-align:center;font-size:11px;color:var(--text3);padding:8px 0;display:flex;align-items:center;gap:8px"><div style="flex:1;height:1px;background:var(--border)"></div>${msgDate}<div style="flex:1;height:1px;background:var(--border)"></div></div>`;lastDate=msgDate;}html+=buildChatMsgHtml(msg);});
  container.innerHTML=html;
}

export async function sendDM(fullName, text) {
    const { data: p } = await window._mpdb.from('profiles').select('username').eq('full_name', fullName).single();
    if (p) await sendDMToUsername(p.username, text);
}

export async function sendDMToUsername(username, text) {
    const ch = 'dm-' + [currentUser.username, username].sort().join('-');
    await window._mpdb.from('chat_messages').insert({ id: uid(), channel: ch, author: 'System', author_name: 'Tool Monitor', body: text, created_at: new Date().toISOString() });
}

export async function loadChatMessages(channel) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    // Show a loading message so the user knows it's working
    container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text3);">Loading messages...</div>';

    try {
        // Fetch the last 50 messages for this channel
        const { data, error } = await window._mpdb
            .from('chat_messages')
            .select('*')
            .eq('channel', channel)
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) throw error;

        if (data && data.length > 0) {
            // Build the HTML for all messages
            container.innerHTML = data.map(msg => buildChatMsgHtml(msg, window.currentUser, window.state)).join('');
            // Scroll to the very bottom
            container.scrollTop = container.scrollHeight;
        } else {
            container.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text3);">No messages yet. Say hello! 👋</div>';
        }
    } catch (e) {
        console.error("Chat load error:", e);
        container.innerHTML = '<div style="padding:20px; color:red;">Failed to load chat history.</div>';
    }
}
export async function renderChat() {
    const channel = window.currentChannel || 'general';
    console.log("🎨 Rendering Chat for channel:", channel);
    
    // 1. Force a reload from the Database to be sure we have the latest
    await loadChatMessages(channel);
    
    // 2. Refresh the user list on the left
    if (typeof window.renderDmList === 'function') window.renderDmList();
}

export function chatKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); 
        sendChatMessage();
    }
}

export async function deleteChatMessage(msgId,channel,author){
  if(!confirm('Delete this message?')) return;
  try{
    const{data:msgs}=await window._mpdb.from('chat_messages').select('*').eq('id',msgId);
    const msg=msgs?.[0];
    if(msg){await window._mpdb.from('deleted_messages').insert({id:uid(),original_id:msgId,channel:msg.channel,author:msg.author,author_name:msg.author_name,body:msg.body,photo:msg.photo,deleted_by:currentUser.username,deleted_at:new Date().toISOString(),expires_at:new Date(Date.now()+30*24*60*60*1000).toISOString()});}
    await window._mpdb.from('chat_messages').delete().eq('id',msgId);
    state.chatMessages=state.chatMessages.filter(m=>m.id!==msgId);
    await loadChatMessages(currentChannel);
    showToast('Message deleted');
  }catch(e){showToast('Failed to delete');}
}

export async function permanentDeleteMessage(deletedId) {
  if(!confirm('Permanently delete this message? This cannot be undone.')) return;
  try {
    await window._mpdb.from('deleted_messages').delete().eq('id', deletedId);
    showToast('Message permanently deleted');
    renderDeletedMessages();
  } catch(e) {
    showToast('Failed to delete');
  }
}
