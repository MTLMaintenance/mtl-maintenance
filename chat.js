// chat.js - The Chat & Messaging Module
import { supabase } from './db.js';
import { uid, showToast, fmtDate } from './utils.js';

// We need to know who is logged in and what channel we are in
// These usually come from your state.js
import * as State from './state.js';

// 1. Initialize Realtime Chat
export async function initChat() {
    try {
        if (window.chatSub) supabase.removeChannel(window.chatSub);
        
        window.chatSub = supabase.channel('chat-sync');

        window.chatSub.on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages'
        }, payload => {
            const msg = payload.new;
            // Don't show our own message twice
            if (State.currentUser && msg.author === State.currentUser.username) return;
            
            // If we are looking at this channel, show it live
            if (msg.channel === window.currentChannel) {
                appendChatMessage(msg);
                markChannelRead(msg.channel);
            } else {
                updateUnreadBadge();
            }
        }).subscribe();
    } catch (e) { console.error("Chat init error:", e); }
}

// 2. Send a Message
export async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const body = input.value.trim();
    if (!body || !State.currentUser) return;

    const msg = {
        id: uid(),
        channel: window.currentChannel || 'general',
        author: State.currentUser.username,
        author_name: State.currentUser.name,
        body: body,
        created_at: new Date().toISOString()
    };

    // UI: Show it immediately (Makes the app feel fast!)
    input.value = ''; 
    appendChatMessage(msg);

    // DB: Save it to Supabase
    try {
        const { error } = await supabase.from('chat_messages').insert(msg);
        if (error) throw error;
    } catch (e) {
        showToast("Message failed to sync");
    }
}

// 3. The HTML "Builder" for a message bubble
export function buildChatMsgHtml(msg) {
    const isMe = State.currentUser && msg.author === State.currentUser.username;
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return `
    <div class="chat-bubble-row ${isMe ? 'me' : 'them'}">
        <div class="chat-bubble">
            <div class="chat-meta"><b>${msg.author_name || msg.author}</b> • ${time}</div>
            <div class="chat-text">${msg.body}</div>
        </div>
    </div>`;
}

// 4. Helper to push a bubble onto the screen
function appendChatMessage(msg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML += buildChatMsgHtml(msg);
    container.scrollTop = container.scrollHeight;
}
