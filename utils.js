// 1. Generate a unique ID (used for new tasks, parts, etc.)
export function uid() { 
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); 
}

// 2. Format dates into "Jan 1, 2024"
export function fmtDate(d) { 
    if (!d) return '—'; 
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y, m, day] = d.split('-').map(Number);
        return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); 
}

// 3. Check if a date has passed
export function isOverdue(d) { 
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y, m, day] = d.split('-').map(Number);
        return new Date(y, m - 1, day) < today;
    }
    return new Date(d) < today;
}

// 4. Create those colorful status badges
export function badge(s) {
    const m = {
        'Operational': 'bs', 'In Service': 'bi', 'Down': 'bd',
        'Standby': 'bg', 'Completed': 'bs', 'Open': 'bi',
        'Overdue': 'bd', 'Critical': 'bd', 'High': 'bw',
        'Medium': 'bi', 'Low': 'bg', 'In Progress': 'b-progress',
        'Waiting for Parts': 'b-parts'
    };
    return `<span class="badge ${m[s] || 'bg'}">${s}</span>`;
}

// 5. Show the little pop-up messages at the bottom
export function showToast(msg) { 
    const t = document.getElementById('toast'); 
    if (!t) return;
    t.textContent = msg; 
    t.classList.add('show'); 
    setTimeout(() => t.classList.remove('show'), 2000); 
}
