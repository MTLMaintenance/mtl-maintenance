// calendar.js - Calendar Grid and Maintenance Scheduling
import { supabase, persist } from './db.js';
import { fmtDate, showToast, uid } from './utils.js';
import { openModal, closeModal } from './ui.js';
import { MONTHS } from './state.js';

let currentCalEntryType = 'one-time';


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

        const eventsHtml = [
            ...dayTasks.map(t => `<div class="cal-event work-order">${t.name}</div>`)
        ].join('');

        cells += `
            <div class="cal-day${isToday ? ' today' : ''}" onclick="window.calDayClick('${dateStr}')">
                <div class="cal-day-num">${d}</div>
                <div class="cal-event-container">${eventsHtml}</div>
            </div>`;
    }
    daysEl.innerHTML = cells;
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
export function calDayClick(dateStr) {
    console.log("📅 Calendar Logic Firing for:", dateStr); // Should see this in F12
    window.lastClickedDate = dateStr;

    const state = window.state || { tasks: [] };

    // 1. Set the Title
    const titleEl = document.getElementById('action-modal-readable');
    if (titleEl) {
        const dateObj = new Date(dateStr + "T00:00:00");
        titleEl.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }

    // 2. Filter Work Orders
    const dayTasks = (state.tasks || []).filter(t => t.due && t.due.substring(0, 10) === dateStr);
    

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


export function setCalEntryType(type) {
    currentCalEntryType = type === 'recurring' ? 'recurring' : 'one-time';
    const oneBtn = document.getElementById('cal-type-one');
    const recurBtn = document.getElementById('cal-type-recur');
    const oneGroup = document.getElementById('ce-group-one');
    const recurGroup = document.getElementById('ce-group-recur');
    if (oneBtn) oneBtn.classList.toggle('active', currentCalEntryType === 'one-time');
    if (recurBtn) recurBtn.classList.toggle('active', currentCalEntryType === 'recurring');
    if (oneGroup) oneGroup.style.display = currentCalEntryType === 'one-time' ? 'contents' : 'none';
    if (recurGroup) recurGroup.style.display = currentCalEntryType === 'recurring' ? 'block' : 'none';
    if (currentCalEntryType === 'recurring') toggleRecurFields();
}

export function toggleRecurFields() {
    const type = document.getElementById('ce-recur-type')?.value || 'calendar';
    const calendarWrap = document.getElementById('ce-recur-val-wrap');
    const hoursWrap = document.getElementById('ce-recur-hrs-wrap');
    if (calendarWrap) calendarWrap.style.display = type === 'calendar' ? 'block' : 'none';
    if (hoursWrap) hoursWrap.style.display = type === 'hours' ? 'block' : 'none';
}

export async function saveCalendarEntry() {
    const name = document.getElementById('ce-name')?.value.trim() || '';
    if (!name) return showToast('Enter a job name');

    const state = window.state;
    const equipId = document.getElementById('ce-equip')?.value || null;
    const assign = document.getElementById('ce-assign')?.value || '';
    const date = document.getElementById('ce-date')?.value || new Date().toISOString().slice(0,10);
    const notes = document.getElementById('ce-notes')?.value || '';

    try {
        if (currentCalEntryType === 'one-time') {
            const record = {
                id: uid(), name, equip_id: equipId, assign, due: date,
                status: 'Open', priority: 'Medium', meter: '0', notes,
                created_at: new Date().toISOString()
            };

            const { error } = await window._mpdb.from('tasks').insert(record);
            if (error) throw error;
            state.tasks.push({ ...record, equipId: record.equip_id });
        } else {
            const recurType = document.getElementById('ce-recur-type')?.value || 'calendar';
            const record = {
                id: uid(), name, equip_id: equipId, active: true,
                type: recurType,
                next_due: date,
                interval_unit: recurType === 'calendar' ? (document.getElementById('ce-unit')?.value || 'month') : null,
                interval_value: recurType === 'calendar' ? (parseInt(document.getElementById('ce-interval')?.value, 10) || 1) : null,
                runtime_hours: recurType === 'hours' ? (parseInt(document.getElementById('ce-runtime')?.value, 10) || 500) : null,
                notes,
                priority: 'Medium'
            };
            const { error } = await window._mpdb.from('recurrence_rules').insert(record);
            if (error) throw error;
            state.recurrenceRules.push(record);
        }

        closeModal('calendar-entry-modal');
        if (typeof window.updateMetrics === 'function') window.updateMetrics();
        if (typeof window.renderCalendar === 'function') window.renderCalendar();
        if (typeof window.renderTasksTable === 'function') window.renderTasksTable();
        if (typeof window.refreshDashboard === 'function') window.refreshDashboard();
        showToast('Added successfully ✓');
        return true;
    } catch (err) {
        console.error('Calendar save error:', err);
        showToast('Failed to add entry');
        return false;
    }
}
