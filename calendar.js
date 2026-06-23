// calendar.js - Calendar Grid, Absences, and Scheduling
import { supabase, persist } from './db.js';
import { fmtDate, showToast, uid } from './utils.js';
import { openModal, closeModal } from './ui.js';
import { MONTHS } from './state.js';

// 1. Core Logic: Check if a user is out on a specific YYYY-MM-DD
export function isUserOutOnDate(absence, targetDateStr) {
    if (!absence.start_date || !absence.end_date) return false;
    const target = targetDateStr.substring(0, 10);
    const start = absence.start_date.substring(0, 10);
    const end = absence.end_date.substring(0, 10);
    return target >= start && target <= end;
}

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

// 3. Render the Actual Grid (The most complex part of the UI)
export async function renderCalendar(calDate) {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    
    const titleEl = document.getElementById('cal-title');
    const daysEl = document.getElementById('cal-days');
    if(!titleEl || !daysEl) return;

    titleEl.textContent = `${MONTHS[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let cells = '';

    // Padding for previous month
    for(let i = 0; i < firstDay; i++){
        cells += `<div class="cal-day other-month"></div>`;
    }

    // Current Month Days
    for(let d = 1; d <= daysInMonth; d++){
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = new Date().toISOString().split('T')[0] === dateStr;
        
        // Filter tasks and absences for this specific day
        const dayTasks = (window.state.tasks || []).filter(t => t.due && t.due.substring(0, 10) === dateStr);
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

export function openAbsenceModal() {
    const modal = document.getElementById('absence-modal');
    if (modal) modal.style.setProperty('display', 'block', 'important');
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
