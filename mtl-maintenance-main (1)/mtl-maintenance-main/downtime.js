// downtime.js - Machine Downtime & Uptime Tracking
import { supabase } from './db.js';
import { showToast } from './utils.js';

// 1. Format minutes into "2h 15m" strings
export function formatDuration(mins) {
    if (!mins) return '0 mins';
    if (mins < 60) return mins + ' min' + (mins !== 1 ? 's' : '');
    const h = Math.floor(mins / 60), m = mins % 60;
    return h + 'h' + (m > 0 ? ' ' + m + 'm' : '');
}

// 2. Calculate downtime stats for a specific machine
export function getEquipDowntime(equipId, downtimeLog) {
    const entries = downtimeLog.filter(d => d.equipId === equipId && d.status === 'resolved');
    const totalMins = entries.reduce((a, d) => a + (d.downtimeMins || 0), 0);
    const activeDown = downtimeLog.find(d => d.equipId === equipId && d.status === 'started' && !d.endedAt);
    return { entries, totalMins, activeDown };
}

// 3. Log a status change to the Database (Operational -> Down)
export async function logStatusChange(equipId, oldStatus, newStatus, state) {
    if (oldStatus === newStatus) return;
    const now = new Date().toISOString();

    if (newStatus === 'Down') {
        const { error } = await supabase.from('downtime_logs').insert({
            equip_id: equipId,
            start_time: now,
            reason: prompt("Reason for downtime?") || "Unspecified"
        });
        if (!error) showToast("Downtime log started");
    } 
    else if (oldStatus === 'Down') {
        // Find the open log and close it
        const { data } = await supabase.from('downtime_logs').select('*').eq('equip_id', equipId).is('end_time', null);
        if (data && data[0]) {
            const start = new Date(data[0].start_time);
            const diff = Math.round((new Date() - start) / 60000);
            await supabase.from('downtime_logs').update({ end_time: now, total_minutes: diff }).eq('id', data[0].id);
            showToast(`Downtime ended: ${formatDuration(diff)}`);
        }
    }
}
