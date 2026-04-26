/**
 * MTL MAINTENANCE CORE ENGINE v2.0
 * Refactored for Stability, Speed, and State-Sync
 */

// ============================================================
// 1. GLOBAL STATE & CONSTANTS
// ============================================================
window.state = {
    equipment: [],
    tasks: [],
    schedules: [],
    parts: [],
    suppliers: [],
    documents: [],
    partUsage: [],
    recurrenceRules: [],
    tools: [],
    wishlist: [],
    observations: [],
    consumables: [],
    users_list_cache: []
};

const APP_CONFIG = {
    ADMIN_USER: 'tangal99',
    SYNC_INTERVAL: 30000, // 30 seconds
    MONTHS: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    ICONS: { Excavator:'🦾', Tractor:'🚜', 'Wheel Loader':'⚙', 'Skid Steer':'🔧', Compressor:'💨', Crane:'🏗', Truck:'🚛', Forklift:'🏭' }
};

let currentUser = null;
let currentChannel = 'general';
let calDate = new Date();

// ============================================================
// 2. UTILITIES (Formatting, Toasts, Auth Helpers)
// ============================================================
const Utils = {
    uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    
    showToast: (msg) => {
        const t = document.getElementById('toast');
        if (t) {
            t.textContent = msg;
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 3000);
        }
    },

    fmtDate: (d) => {
        if (!d) return '—';
        const date = new Date(d);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    badge: (status) => {
        const maps = {
            'Operational': 'bs', 'Completed': 'bs',
            'Open': 'bi', 'In Progress': 'b-progress',
            'Down': 'bd', 'Critical': 'bd', 'Overdue': 'bd',
            'Waiting for Parts': 'b-parts', 'High': 'bw'
        };
        return `<span class="badge ${maps[status] || 'bg'}">${status}</span>`;
    }
};

// ============================================================
// 3. DATABASE LAYER (Supabase Communication)
// ============================================================
const Data = {
    async fetchAll() {
        setSyncStatus('syncing');
        try {
            const [eq, tk, sc, pt, sup, tl, wl, obs, cons] = await Promise.all([
                window._mpdb.from('equipment').select('*'),
                window._mpdb.from('tasks').select('*'),
                window._mpdb.from('schedules').select('*'),
                window._mpdb.from('parts').select('*'),
                window._mpdb.from('suppliers').select('*'),
                window._mpdb.from('tool_requests').select('*'), // Unified tool table
                window._mpdb.from('tool_requests').select('*').eq('status', 'requested'),
                window._mpdb.from('observations').select('*').order('created_at', {ascending: false}),
                window._mpdb.from('consumables').select('*')
            ]);

            state.equipment = eq.data || [];
            state.tasks = tk.data || [];
            state.schedules = sc.data || [];
            state.parts = pt.data || [];
            state.suppliers = sup.data || [];
            state.tools = tl.data || [];
            state.wishlist = wl.data || [];
            state.observations = obs.data || [];
            state.consumables = cons.data || [];

            setSyncStatus('online');
        } catch (e) {
            console.error("Critical Load Error", e);
            setSyncStatus('offline');
        }
    },

    async save(table, record) {
        try {
            const { error } = await window._mpdb.from(table).upsert(record);
            if (error) throw error;
            Utils.showToast("Saved to Database ✓");
            return true;
        } catch (e) {
            console.error(`Save Error [${table}]:`, e.message);
            return false;
        }
    },

    async delete(table, id) {
        if (!confirm("Are you sure you want to delete this?")) return;
        try {
            const { error } = await window._mpdb.from(table).delete().eq('id', id);
            if (error) throw error;
            Utils.showToast("Deleted Successfully");
            await this.fetchAll(); // Refresh everything
            return true;
        } catch (e) {
            alert("Delete failed: " + e.message);
            return false;
        }
    }
};

// ============================================================
// 4. UI CONTROLLER (Panel Switching, Modals)
// ============================================================
const UI = {
    showPanel(id) {
        document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
        const activePanel = document.getElementById('panel-' + id);
        if (activePanel) {
            activePanel.style.display = (id === 'chat') ? 'flex' : 'block';
            activePanel.classList.add('active');
        }
        
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        // Logic to highlight the correct nav button...
        
        this.refreshContext(id);
    },

    refreshContext(panelId) {
        switch(panelId) {
            case 'dashboard': renderDashboard(); break;
            case 'calendar': renderCalendar(); break;
            case 'equipment': renderEquipmentTable(); break;
            case 'parts': renderParts(); break;
            case 'tools': renderTools(); break;
            case 'chat': renderChat(); break;
        }
    }
};

// ============================================================
// 5. AUTH & SESSION
// ============================================================
async function verifyUserPin() {
    const pin = enteredPin; // From your PIN pad logic
    const { data, error } = await window._mpdb
        .from('profiles')
        .select('*')
        .eq('id', selectedLoginUser.id)
        .eq('pin_code', pin)
        .single();

    if (data) {
        currentUser = data;
        localStorage.setItem('mp_session', JSON.stringify(data));
        await Data.fetchAll();
        enterApp();
    } else {
        alert("Incorrect PIN");
        enteredPin = "";
    }
}

// ============================================================
// 6. TOOL CRIB LOGIC (Unified)
// ============================================================
async function saveTool() {
    const id = document.getElementById('tool-edit-id').value;
    const tool = {
        id: id || Utils.uid(),
        tool_name: document.getElementById('tool-name').value.trim(),
        category: document.getElementById('tool-cat').value,
        location: document.getElementById('tool-loc').value,
        health: parseInt(document.getElementById('tool-health').value),
        status: 'available',
        last_updated: new Date().toISOString()
    };

    const success = await Data.save('tool_requests', tool);
    if (success) {
        closeModal('tool-modal');
        await Data.fetchAll();
        renderTools();
    }
}
// ============================================================
// 7. CALENDAR & ADAPTIVE FORECASTING
// ============================================================
const Calendar = {
    async render() {
        const year = calDate.getFullYear();
        const month = calDate.getMonth();
        const daysEl = document.getElementById('cal-days');
        const titleEl = document.getElementById('cal-title');
        if (!daysEl) return;

        titleEl.textContent = `${APP_CONFIG.MONTHS[month]} ${year}`;
        
        // 1. Calculate Padding & Month Days
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrev = new Date(year, month, 0).getDate();
        
        let html = '';

        // 2. Add Prev Month Padding
        for (let i = firstDay - 1; i >= 0; i--) {
            html += `<div class="cal-day other-month"><div class="cal-day-num">${daysInPrev - i}</div></div>`;
        }

        // 3. Render Actual Days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            
            // Filter events for this specific day
            const dayTasks = state.tasks.filter(t => t.due === dateStr);
            const dayAbsences = staffAbsences.filter(a => a.start_date.split('T')[0] === dateStr);

            html += `
                <div class="cal-day ${isToday ? 'today' : ''}" onclick="Calendar.handleDayClick('${dateStr}')">
                    <div class="cal-day-num">${d}</div>
                    <div class="cal-event-container">
                        ${dayTasks.map(t => `<div class="cal-event work-order ${t.status.toLowerCase()}">${t.name}</div>`).join('')}
                        ${dayAbsences.map(a => `<div class="cal-event staff-absence">👤 ${a.user_name}</div>`).join('')}
                        <div id="forecast-${dateStr}"></div> <!-- Target for Adaptive Forecasts -->
                    </div>
                </div>`;
        }
        daysEl.innerHTML = html;
        this.runAdaptiveForecasting(year, month);
    },

    async runAdaptiveForecasting(year, month) {
        // Predicts service dates based on previous hour-logs
        for (let e of state.equipment) {
            const pred = await this.getPrediction(e.id);
            if (pred && pred.status === 'ACTIVE') {
                const dateStr = pred.predictedDate.toISOString().split('T')[0];
                const box = document.getElementById(`forecast-${dateStr}`);
                if (box) box.innerHTML += `<div class="cal-event forecast">📈 Forecast: ${e.name}</div>`;
            }
        }
    },

    async getPrediction(equipId) {
        const e = state.equipment.find(x => x.id === equipId);
        const { data: history } = await window._mpdb.from('meter_history')
            .select('reading, created_at').eq('equip_id', equipId)
            .order('created_at', { ascending: false }).limit(5);

        if (!history || history.length < 2) return null;

        // Math: (Newest Hours - Oldest Hours) / Days Elapsed = Hours Per Day
        const hoursDelta = history[0].reading - history[history.length - 1].reading;
        const daysDelta = (new Date(history[0].created_at) - new Date(history[history.length - 1].created_at)) / 86400000;
        const burnRate = hoursDelta / (daysDelta || 1);

        const rule = state.recurrenceRules.find(r => r.equip_id === equipId && r.type === 'hours');
        if (!rule) return null;

        const hoursLeft = (rule.last_generated_hours + rule.runtime_hours) - e.hours;
        if (hoursLeft > 40 || hoursLeft < 0) return null;

        return {
            status: 'ACTIVE',
            predictedDate: new Date(Date.now() + (hoursLeft / burnRate) * 86400000)
        };
    },

    handleDayClick(dateStr) {
        lastClickedDate = dateStr;
        // Logic to open the "Day Action" modal showing all items for that date
        openModal('cal-action-modal');
        // ... (Render list of items in modal)
    }
};

// ============================================================
// 8. WORK ORDER MODULE
// ============================================================
const WorkOrders = {
    async markComplete(taskId) {
        const t = state.tasks.find(x => x.id === taskId);
        const equip = state.equipment.find(e => e.id === t.equipId);
        
        const newHours = prompt(`Enter current meter for ${equip?.name || 'machine'}:`, equip?.hours);
        if (newHours && parseInt(newHours) >= (equip?.hours || 0)) {
            equip.hours = parseInt(newHours);
            await Data.save('equipment', equip);
            // Log history for adaptive math
            await window._mpdb.from('meter_history').insert({ equip_id: equip.id, reading: equip.hours });
        }

        t.status = 'Completed';
        t.completed_at = new Date().toISOString();
        
        await Data.save('tasks', t);
        Utils.showToast("Work Order Completed ✓");
        closeModal('detail-modal');
        UI.refreshContext('dashboard');
    },

    renderList() {
        const container = document.getElementById('tasks-table-body');
        if (!container) return;

        container.innerHTML = state.tasks.map(t => `
            <tr onclick="openTaskDetail('${t.id}')">
                <td><b>${t.name}</b></td>
                <td>${state.equipment.find(e => e.id === t.equipId)?.name || '—'}</td>
                <td>${Utils.badge(t.priority)}</td>
                <td>${t.assign || 'Unassigned'}</td>
                <td>${Utils.badge(t.status)}</td>
                <td style="text-align:right">$${(t.cost || 0).toLocaleString()}</td>
            </tr>
        `).join('');
    }
};

// ============================================================
// 9. ZERK MAP MODULE (Interactive Image Mapping)
// ============================================================
const ZerkMap = {
    async refresh(equipId) {
        const e = state.equipment.find(x => x.id === equipId);
        const img = document.getElementById('zerk-map-img');
        if (!e || !e.zerk_photos || !img) return;

        const viewIndex = parseInt(currentZerkView.split('_')[1]) - 1;
        img.src = e.zerk_photos[viewIndex] || "";

        const { data: points } = await window._mpdb.from('grease_points').select('*').eq('equip_id', equipId);
        this.renderPoints(points || []);
    },

    renderPoints(points) {
        const overlay = document.getElementById('zerk-dots-overlay');
        const svg = document.getElementById('zerk-svg-layer');
        if (!overlay || !svg) return;

        overlay.innerHTML = "";
        svg.innerHTML = "";

        const visible = points.filter(p => p.view_name === currentZerkView);

        visible.forEach((p, i) => {
            // Draw SVG Line if it's a pointer
            if (p.x_target !== p.x_pos) {
                svg.innerHTML += `<line x1="${p.x_target}" y1="${p.y_target}" x2="${p.x_pos}" y2="${p.y_pos}" class="zerk-line" />`;
            }
            // Add Interactive Dot
            overlay.innerHTML += `
                <div class="zerk-dot" style="left:${p.x_pos}%; top:${p.y_pos}%" onclick="ZerkMap.showInfo('${p.id}')">
                    ${i + 1}
                </div>`;
        });
    },

    async handleMapClick(e) {
        if (currentUser.role !== 'admin') return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        if (zerkPinMode === 'dot') {
            const label = prompt("Point Name (e.g. 'Main Slew Bearing'):");
            if (label) {
                const point = {
                    id: Utils.uid(),
                    equip_id: window._currentDetailEquipId,
                    view_name: currentZerkView,
                    label: label,
                    x_pos: x, y_pos: y,
                    x_target: x, y_target: y
                };
                await Data.save('grease_points', point);
                this.refresh(window._currentDetailEquipId);
            }
        }
    }
};
// ============================================================
// 10. REAL-TIME CHAT MODULE
// ============================================================
const Chat = {
    // Stores the last time the user checked each channel to show red dots
    lastRead: JSON.parse(localStorage.getItem('mp_chat_read') || '{}'),

    init() {
        // Subscribe to Supabase Realtime for instant messages
        window._mpdb.channel('global-chat').on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages'
        }, payload => {
            const msg = payload.new;
            state.chatMessages.unshift(msg);

            if (msg.channel === currentChannel) {
                this.appendMessage(msg);
                this.markRead(currentChannel);
            } else {
                this.updateUnreadBadges();
            }

            // Simple browser notification if mentioned
            if (msg.body.includes(`@${currentUser.username}`)) {
                Utils.showToast(`🔔 Mentioned by ${msg.author_name} in #${msg.channel}`);
            }
        }).subscribe();
    },

    async switchChannel(channelId, btnEl) {
        currentChannel = channelId;
        
        // UI Updates
        document.querySelectorAll('.chat-channel-btn').forEach(b => b.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');
        document.getElementById('chat-header-title').textContent = channelId.startsWith('dm-') ? "@ Direct Message" : `# ${channelId}`;

        // Load messages from DB
        const { data } = await window._mpdb.from('chat_messages')
            .select('*').eq('channel', channelId)
            .order('created_at', { ascending: true }).limit(50);
        
        this.render(data || []);
        this.markRead(channelId);
    },

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const body = input.value.trim();
        if (!body && !chatPhotoData) return;

        const msg = {
            id: Utils.uid(),
            channel: currentChannel,
            author: currentUser.username,
            author_name: currentUser.name,
            body: body,
            photo: chatPhotoData || null,
            equip_id: chatTagEquipId || null,
            task_id: chatTagTaskId || null,
            created_at: new Date().toISOString()
        };

        const success = await Data.save('chat_messages', msg);
        if (success) {
            input.value = "";
            chatPhotoData = null;
            this.appendMessage(msg);
        }
    },

    render(msgs) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        container.innerHTML = msgs.map(m => this.buildMessageHTML(m)).join('');
        container.scrollTop = container.scrollHeight;
    },

    appendMessage(msg) {
        const container = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.innerHTML = this.buildMessageHTML(msg);
        container.appendChild(div.firstElementChild);
        container.scrollTop = container.scrollHeight;
    },

    markRead(channel) {
        this.lastRead[channel] = new Date().toISOString();
        localStorage.setItem('mp_chat_read', JSON.stringify(this.lastRead));
        this.updateUnreadBadges();
    },

    updateUnreadBadges() {
        // Calculates unread counts by comparing message timestamps to "lastRead"
        const channels = ['general', 'outside', 'production'];
        channels.forEach(ch => {
            const last = new Date(this.lastRead[ch] || 0);
            const count = state.chatMessages.filter(m => m.channel === ch && new Date(m.created_at) > last).length;
            const dot = document.getElementById(`dot-ch-${ch}`);
            if (dot) dot.style.display = count > 0 ? 'block' : 'none';
        });
    }
};

// ============================================================
// 11. INVENTORY MODULE (Parts & Consumables)
// ============================================================
const Inventory = {
    renderParts() {
        const container = document.getElementById('parts-table-body');
        if (!container) return;

        container.innerHTML = state.parts.map(p => {
            const isLow = p.qty <= p.reorder;
            return `
                <tr onclick="editPart('${p.id}')">
                    <td><b>${p.name}</b><br><small>${p.num || ''}</small></td>
                    <td>${state.suppliers.find(s => s.id === p.supplier_id)?.name || '—'}</td>
                    <td style="color:${isLow ? 'var(--danger)' : 'inherit'}; font-weight:700">${p.qty}</td>
                    <td>${p.reorder}</td>
                    <td>$${parseFloat(p.cost || 0).toFixed(2)}</td>
                    <td>${isLow ? '<span class="badge bw">LOW STOCK</span>' : '<span class="badge bs">OK</span>'}</td>
                </tr>`;
        }).join('');
    },

    renderConsumables() {
        const container = document.getElementById('consumables-table-body');
        if (!container) return;

        container.innerHTML = state.consumables.map(c => `
            <tr onclick="editConsumable('${c.id}')">
                <td><b>${c.name}</b></td>
                <td>${c.qty}</td>
                <td>${c.reorder}</td>
                <td>${c.qty <= c.reorder ? '<span class="badge bd">REORDER</span>' : '<span class="badge bs">OK</span>'}</td>
            </tr>
        `).join('');
    },

    async logUsage(partId, taskId, qty) {
        const part = state.parts.find(p => p.id === partId);
        if (!part || part.qty < qty) {
            alert("Insufficient stock!");
            return;
        }

        // 1. Deduct from stock
        part.qty -= qty;
        await Data.save('parts', part);

        // 2. Create usage record
        const usage = {
            id: Utils.uid(),
            part_id: partId,
            task_id: taskId,
            qty_used: qty,
            used_by: currentUser.name,
            used_at: new Date().toISOString()
        };
        await Data.save('part_usage', usage);
        
        Utils.showToast(`${qty} ${part.name} deducted from inventory.`);
        this.renderParts();
    }
};

// ============================================================
// 12. WISHLIST MODULE
// ============================================================
const Wishlist = {
    render() {
        const container = document.getElementById('wishlist-container');
        if (!container) return;

        const pending = state.wishlist.filter(w => w.status === 'requested');

        container.innerHTML = pending.map(w => `
            <div class="card" style="border-left: 4px solid var(--warning)">
                <div style="display:flex; justify-content:space-between">
                    <b>${w.tool_name}</b>
                    <span class="badge bw">REQUESTED</span>
                </div>
                <div style="font-size:12px; margin-top:5px; color:var(--text2)">
                    Requested by ${w.requested_by}
                </div>
                <div style="margin-top:10px; display:flex; gap:8px">
                    ${currentUser.role === 'admin' ? `
                        <button class="btn btn-success btn-sm" onclick="Wishlist.approve('${w.id}')">Approve</button>
                        <button class="btn btn-danger btn-sm" onclick="Wishlist.deny('${w.id}')">Deny</button>
                    ` : ''}
                </div>
            </div>
        `).join('') || '<div style="color:var(--text3); padding:20px; text-align:center">No pending requests.</div>';
    },

    async approve(id) {
        const wish = state.wishlist.find(w => w.id === id);
        // Move to ordered status
        wish.status = 'ordered';
        await Data.save('tool_requests', wish);
        Utils.showToast("Item approved and moved to 'Ordered'");
        this.render();
    }
};
// ============================================================
// 13. ANALYTICS ENGINE
// ============================================================
const Analytics = {
    render() {
        if (!can('canViewReports')) return;

        // 1. Calculate Core KPIs
        const totalSpend = state.tasks.reduce((sum, t) => sum + (t.cost || 0), 0);
        const invValue = state.parts.reduce((sum, p) => sum + (p.qty * p.cost), 0);
        const fleetHealth = state.equipment.length ? 
            Math.round(state.equipment.reduce((a, e) => a + calcHealth(e.id), 0) / state.equipment.length) : 100;

        // 2. Update UI Cards
        document.getElementById('r-ytd').textContent = `$${totalSpend.toLocaleString()}`;
        document.getElementById('r-inv').textContent = `$${invValue.toLocaleString()}`;
        document.getElementById('r-health').textContent = `${fleetHealth}%`;

        this.renderCostByEquip();
        this.renderDowntimeStats();
        this.renderTaskBreakdown();
    },

    renderCostByEquip() {
        const container = document.getElementById('cost-by-equip');
        if (!container) return;

        // Sort machines by most expensive maintenance
        const data = state.equipment.map(e => ({
            name: e.name,
            cost: state.tasks.filter(t => t.equipId === e.id).reduce((a, t) => a + (t.cost || 0), 0)
        })).filter(x => x.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 6);

        const maxCost = Math.max(...data.map(x => x.cost), 1);

        container.innerHTML = data.map(x => `
            <div class="stat-row">
                <div style="width:100px; font-size:12px">${x.name}</div>
                <div class="stat-bar-wrap">
                    <div class="stat-bar" style="width:${(x.cost/maxCost)*100}%; background:var(--accent)"></div>
                </div>
                <div style="width:70px; text-align:right"><b>$${x.cost.toLocaleString()}</b></div>
            </div>`).join('');
    },

    async renderDowntimeStats() {
        // Fetches logs of when machines were marked "Down"
        const { data: logs } = await window._mpdb.from('downtime_logs').select('*').limit(100);
        const container = document.getElementById('downtime-chart');
        if (!container || !logs) return;

        const totalMins = logs.reduce((sum, l) => sum + (l.total_minutes || 0), 0);
        const uptime = 100 - ((totalMins / (state.equipment.length * 43200)) * 100); // 30 day avg

        document.getElementById('r-uptime').textContent = `${Math.max(0, uptime).toFixed(1)}%`;
    }
};

// ============================================================
// 14. ADMIN & USER MANAGEMENT
// ============================================================
const Admin = {
    async render() {
        const { data: profiles } = await window._mpdb.from('profiles').select('*').order('created_at', {ascending: false});
        if (!profiles) return;

        this.renderApprovals(profiles.filter(p => p.status === 'pending'));
        this.renderUserTable(profiles.filter(p => p.status === 'approved'));
        this.renderAuditLogs();
    },

    renderApprovals(pending) {
        const container = document.getElementById('pending-list');
        document.getElementById('pending-count').textContent = pending.length;

        container.innerHTML = pending.map(p => `
            <div class="parts-row">
                <div style="flex:1"><b>${p.full_name}</b> (${p.username})</div>
                <div style="display:flex; gap:8px">
                    <button class="btn btn-success btn-sm" onclick="Admin.setStatus('${p.id}', 'approved')">Approve</button>
                    <button class="btn btn-danger btn-sm" onclick="Admin.setStatus('${p.id}', 'denied')">Deny</button>
                </div>
            </div>`).join('') || "No pending requests.";
    },

    async setStatus(userId, status) {
        await window._mpdb.from('profiles').update({ status }).eq('id', userId);
        Utils.showToast(`User ${status}`);
        this.render();
    },

    async renderAuditLogs() {
        const container = document.getElementById('audit-log-list');
        const { data: logs } = await window._mpdb.from('audit_logs').select('*').order('created_at', {ascending: false}).limit(50);
        
        if (container && logs) {
            container.innerHTML = logs.map(l => `
                <div style="font-size:12px; padding:6px 0; border-bottom:1px solid var(--border)">
                    <span style="color:var(--text3)">${new Date(l.created_at).toLocaleTimeString()}</span>
                    <b>${l.user_name}</b>: ${l.action} 
                    <div style="color:var(--text2); font-size:11px">${l.details}</div>
                </div>`).join('');
        }
    }
};

// ============================================================
// 15. GLOBAL EVENT HUB (Search, Resize, Keys)
// ============================================================
const Events = {
    init() {
        // Global Search Handler
        document.getElementById('global-search')?.addEventListener('input', (e) => {
            this.handleSearch(e.target.value.toLowerCase().trim());
        });

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#global-search')) {
                document.getElementById('search-results').style.display = 'none';
            }
        });

        // Chat Textarea Auto-height
        document.getElementById('chat-input')?.addEventListener('input', (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
        });

        // Sync with window resizing for mobile chat
        window.addEventListener('resize', () => enforceChatMobileLayout());
    },

    handleSearch(query) {
        const results = document.getElementById('search-results');
        if (query.length < 2) { results.style.display = 'none'; return; }

        let html = "";

        // Search Equipment
        const eqMatches = state.equipment.filter(e => e.name.toLowerCase().includes(query) || e.serial?.toLowerCase().includes(query));
        if (eqMatches.length) {
            html += `<div class="search-header">EQUIPMENT</div>`;
            html += eqMatches.map(e => `<div class="search-item" onclick="openEquipDetail('${e.id}')">${e.name}</div>`).join('');
        }

        // Search Tasks
        const taskMatches = state.tasks.filter(t => t.name.toLowerCase().includes(query));
        if (taskMatches.length) {
            html += `<div class="search-header">WORK ORDERS</div>`;
            html += taskMatches.map(t => `<div class="search-item" onclick="openTaskDetail('${t.id}')">${t.name}</div>`).join('');
        }

        results.innerHTML = html || `<div style="padding:15px; text-align:center">No results for "${query}"</div>`;
        results.style.display = 'block';
    }
};

// ============================================================
// 16. BOOTSTRAP (The Launch Button)
// ============================================================
async function enterApp() {
    // 1. Hide Login / Show App
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('user-chip-name').textContent = currentUser.name;

    // 2. Load Core Data
    await Data.fetchAll();

    // 3. Start Engines
    Chat.init();
    Events.init();
    
    // 4. Default Panel
    UI.showPanel('dashboard');

    // 5. Background Tasks
    runRecurrenceEngine(); // Check if new services need to be created
    Admin.render();        // Load user list for admin (silent)
}
