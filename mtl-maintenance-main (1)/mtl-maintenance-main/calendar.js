// calendar.js - Calendar Grid, Absences, and Scheduling
import { supabase, persist } from './db.js';
import { fmtDate, showToast, uid } from './utils.js';
import { openModal, closeModal } from './ui.js';
import { MONTHS } from './state.js';


// 2. Fetch all absences from Supabase
export async function fetchAbsences() {
    try {
        const { data, error } = await supabase.from('staff_absences').select('*');
        if (error) throw error;
        window.state.staffAbsences = data || [];
        return data;
    } catch (e) {
        console.error("Absence sync failed:", e);
        return [];
    }
}

export async function renderCalendar() {
    const date = window.calDate || new Date();
    const state = window.state;
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const titleEl = document.getElementById('cal-title');
    const daysEl = document.getElementById('cal-days');
    const headersEl = document.getElementById('cal-headers');
    
    if(!titleEl || !daysEl) return;

    titleEl.textContent = `${MONTHS[month]} ${year}`;
    
    if (headersEl) {
        headersEl.innerHTML = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
            .map(d => `<div class="cal-header">${d}</div>`).join('');
    }

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    
    let cells = '';

    for(let i = firstDay - 1; i >= 0; i--){
        cells += `<div class="cal-day other-month">${daysInPrev - i}</div>`;
    }

    for(let d = 1; d <= daysInMonth; d++){
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = new Date().toISOString().split('T')[0] === dateStr;
        const dayTasks = (state.tasks || []).filter(t => t.due && t.due.substring(0, 10) === dateStr);
        const dayAbs = (window.state.staffAbsences || []).filter(a => isUserOutOnDate(a, dateStr));

        const eventsHtml = [
            ...dayTasks.map(t => `<div class="cal-event work-order">${t.name}</div>`),
            ...dayAbs.map(a => `<div class="cal-event absence">👤 ${a.user_name} Out</div>`)
        ].join('');

        cells += `
            <div class="cal-day${isToday ? ' today' : ''}" onclick="window.calDayClick('${dateStr}')">
                <div class="cal-day-num">${d}</div>
                <div class="cal-event-container">${eventsHtml}</div>
            </div>`;
    }
    daysEl.innerHTML = cells;
}



// 4. Save a Time-Off Request
export async function saveAbsence(record) {
    try {
        const { error } = await supabase.from('staff_absences').insert(record);
        if (error) throw error;
        showToast("Request submitted ✓");
        return true;
    } catch (e) {
        console.error("Absence save error:", e);
        return false;
    }
}
export function setAbsenceType(type) {
    window.selectedAbsenceType = type;
    document.getElementById('btn-all-day').classList.toggle('active', type === 'all');
    document.getElementById('btn-partial').classList.toggle('active', type === 'partial');
    document.getElementById('abs-time-container').style.display = type === 'partial' ? 'block' : 'none';
}

export async function deleteAbsence() {
    if (!window.currentDetailId) return;
    if (!confirm("Are you sure you want to cancel this request?")) return;

    try {
        const { error } = await window._mpdb.from('staff_absences').delete().eq('id', window.currentDetailId);
        if (error) throw error;

        window.state.staffAbsences = window.state.staffAbsences.filter(a => a.id !== window.currentDetailId);
        document.getElementById('absence-detail-modal').style.display = 'none';
        
        // This is important: trigger the redraw
        if (typeof renderCalendar === 'function') renderCalendar(window.calDate); 
        window.showToast("Request deleted ✓");
    } catch (e) { alert("Error: " + e.message); }
}


export function closeAbsenceModal() {
    const modal = document.getElementById('absence-modal');
    if (modal) modal.style.display = 'none';
}

export function openAbsenceDetail(id, currentUser, state) {
    const abs = (state.staffAbsences || []).find(a => a.id === id);
    if (!abs) return;
    
    window.currentDetailId = id; 

    document.getElementById('det-user').textContent = `👤 ${abs.user_name}`;
    document.getElementById('det-reason').textContent = abs.reason_public || "No reason provided.";
    document.getElementById('det-time').textContent = abs.is_all_day ? "All Day" : (abs.partial_time || "Scheduled");

    const isOwner = (abs.author === currentUser.username || abs.user_id === String(currentUser.id));
    const isAdmin = (currentUser.role === 'Admin');

    const delBtn = document.getElementById('det-delete-btn');
    if (delBtn) delBtn.style.display = (isOwner || isAdmin) ? 'block' : 'none';

    const privBox = document.getElementById('det-private-section');
    if (privBox && isAdmin) {
        privBox.style.display = 'block';
        document.getElementById('det-private-text').textContent = abs.reason_private || "None";
    }

    const modal = document.getElementById('absence-detail-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active'); 
    }
}

export function togglePrivateReason(show) {
    const privBox = document.getElementById('priv-box');
    if (privBox) privBox.style.display = show ? 'block' : 'none';
}
export function triggerAddEntryFromCal() {
    // 1. Close the small day card
    const actionModal = document.getElementById('cal-action-modal');
    if (actionModal) {
        actionModal.classList.remove('active');
        actionModal.style.display = 'none';
    }
    
    // 2. Clear the Work Order form so it's fresh
    if (typeof window.resetPartForm === 'function') window.resetPartForm(); 

    // 3. Pre-fill the Date in the DETAILED Work Order form
    // Your Work Order modal uses the ID 't-due' for the date
    const dateInput = document.getElementById('t-due');
    if (dateInput) {
        dateInput.value = window.lastClickedDate;
    }

    // 4. Open the DETAILED Work Order modal (The left picture)
    if (typeof window.openModal === 'function') {
        window.openModal('task-modal'); 
    }

    // 5. Ensure dropdowns (Equipment/Users) are filled
    if (typeof window.populateSelects === 'function') window.populateSelects();
}

export function triggerAbsenceFromCal(lastClickedDate) {
    window.closeModal('cal-action-modal');

    // Pre-fill the date in the Time Off modal
    const startInp = document.getElementById('abs-start-date');
    if (startInp) startInp.value = lastClickedDate;

    window.openModal('absence-modal'); 
}

export function renderRecurList(state, equipNameFunc) {
    const list = document.getElementById('recur-list');
    if(!list) return;
    
    list.innerHTML = state.recurrenceRules.map(r => `
        <div class="recur-item">
            <div style="flex:1">
                <div class="bold">${r.name}</div>
                <div class="text-mini">${equipNameFunc(r.equip_id)} · Every ${r.runtime_hours || r.interval_value} ${r.type === 'hours' ? 'hrs' : r.interval_unit}</div>
            </div>
            <button class="btn-danger btn-sm" onclick="window.deleteRecurRule('${r.id}')">✕</button>
        </div>`).join('') || '<div class="empty-text">No rules set.</div>';
}

export async function deleteSched(id) {
    if (!confirm("Delete this scheduled item?")) return;

    // 1. Remove from local memory
    if (window.state && window.state.schedules) {
        window.state.schedules = window.state.schedules.filter(s => s.id !== id);
    }

    // 2. Remove from Database
    try {
        await persist('schedules', 'delete', id);
        
        // 3. Refresh UI
        if (typeof window.renderSchedule === 'function') window.renderSchedule();
        if (typeof renderCalendar === 'function') renderCalendar();
        
        window.showToast("Item deleted ✓");
    } catch (e) {
        console.error("Delete schedule error:", e);
    }
}
export function isUserOutOnDate(absence, targetDateStr) {
    if (!absence.start_date || !absence.end_date) return false;
    const target = targetDateStr.substring(0, 10);
    const start = absence.start_date.substring(0, 10);
    const end = absence.end_date.substring(0, 10);
    return target >= start && target <= end;
}

export function openAbsenceModal() {
    console.log("Attempting to open absence modal...");
    const modal = document.getElementById('absence-modal');
    if (modal) {
        // Use 'flex' if your modal is centered, or 'block' if standard
        modal.style.setProperty('display', 'flex', 'important');
        modal.classList.add('active');
        console.log("Modal opened ✓");
    } else {
        alert("HTML Error: Could not find id='absence-modal'");
    }
}

export function calDayClick(dateStr) {
    console.log("📅 Calendar Logic Firing for:", dateStr); // Should see this in F12
    window.lastClickedDate = dateStr;

    const state = window.state || { tasks: [], staffAbsences: [] };

    // 1. Set the Title
    const titleEl = document.getElementById('action-modal-readable');
    if (titleEl) {
        const dateObj = new Date(dateStr + "T00:00:00");
        titleEl.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }

    // 2. Filter Work Orders
    const dayTasks = (state.tasks || []).filter(t => t.due && t.due.substring(0, 10) === dateStr);
    
    // 3. Filter Absences
    const dayAbs = (state.staffAbsences || []).filter(a => isUserOutOnDate(a, dateStr));

    const listContainer = document.getElementById('day-items-list');
    if (listContainer) {
        let html = "";
        
        // Add Work Orders to list
        dayTasks.forEach(t => {
            html += `
            <div class="day-card-item" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:5px;">
                <div>🛠️ ${t.name}</div>
                <button class="btn-sm" onclick="window.closeModal('cal-action-modal'); window.openTaskDetail('${t.id}')">View</button>
            </div>`;
        });

        // Add Absences to list
        dayAbs.forEach(a => {
            html += `<div class="day-card-item" style="border-left:4px solid #ff9800; padding:10px;">👤 ${a.user_name} Out</div>`;
        });

        listContainer.innerHTML = html || `<div style="color:#888; padding:20px; text-align:center;">Nothing scheduled.</div>`;
    }

    // 4. Open the modal (Uses bridge from app.js)
  const modal = document.getElementById('cal-action-modal');
    if (modal) {
        // We use setProperty and !important to bypass any CSS rules that might be hiding it
        modal.style.setProperty('display', 'flex', 'important');
        modal.style.setProperty('z-index', '999999', 'important');
        modal.classList.add('active'); 
        console.log("✅ Modal display set to flex !important");
    } else {
        console.error("❌ Could not find 'cal-action-modal' in HTML.");
    }
}

export function switchCalendarView(view) {
    console.log("Switching Calendar View to:", view);
    
    const gridContainer = document.getElementById('cal-grid-container');
    const listContainer = document.getElementById('cal-list-container');
    const btnGrid = document.getElementById('btn-view-grid');
    const btnList = document.getElementById('btn-view-list');

    // 1. Toggle Visibility
    if (gridContainer) gridContainer.style.display = view === 'grid' ? 'block' : 'none';
    if (listContainer) listContainer.style.display = view === 'list' ? 'block' : 'none';
    
    // 2. Update Button Highlights (If you have these IDs in your HTML)
    if (btnGrid) btnGrid.classList.toggle('active', view === 'grid');
    if (btnList) btnList.classList.toggle('active', view === 'list');
    
    // 3. Trigger the appropriate render
    if (view === 'grid') {
        if (typeof window.renderCalendar === 'function') window.renderCalendar();
    } else {
        if (typeof window.renderSchedule === 'function') window.renderSchedule();
    }
}

export async function saveCalendarEntry() {
    const name = document.getElementById('ce-name').value.trim();
    if(!name) return;

    const equipId = document.getElementById('ce-equip').value;
    const date = document.getElementById('ce-date').value;

    try {
        if (currentCalEntryType === 'one-time') {
            const record = {
                id: uid(),
                name: name,
                equip_id: equipId,
                due: date,
                status: 'Open',
                priority: 'Medium',
                meter: '0',
                created_at: new Date().toISOString()
            };

            const { error } = await window._mpdb.from('tasks').insert(record);
            if (error) throw error;

            state.tasks.push({ ...record, equipId: record.equip_id });
        } else {
            // Recurring logic
            const record = {
                id: uid(),
                name: name,
                equip_id: equipId,
                active: true,
                next_due: date,
                interval_unit: document.getElementById('ce-unit').value,
                interval_value: parseInt(document.getElementById('ce-interval').value) || 1,
            };
            await window._mpdb.from('recurrence_rules').insert(record);
            state.recurrenceRules.push(record);
        }

        closeModal('calendar-entry-modal');
        updateMetrics(); 
        renderCalendar();
        renderTasks();
        renderDashboard();
        showToast("Added successfully ✓");

    } catch (err) {
        console.error("Calendar save error:", err);
        showToast("Failed to add entry");
    }
}
