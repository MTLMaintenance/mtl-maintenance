// Zerk / grease map: photo views and their synchronized fitting tables.
import { uid, showToast, compressImage } from './utils.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const machine = () => window.state?.equipment?.find(e => String(e.id) === String(window._currentDetailEquipId));
const photos = e => Array.isArray(e.zerk_photos) ? e.zerk_photos : [];
const points = e => Array.isArray(e.zerk_points) ? e.zerk_points : [];
const names = e => Array.isArray(e.zerk_names) ? e.zerk_names : [];
function activeIndex(e) {
    const idx = Number(window._currentZerkViewIdx) || 0;
    const result = photos(e).length ? Math.max(0, Math.min(idx, photos(e).length - 1)) : 0;
    window._currentZerkViewIdx = result;
    return result;
}
function refresh() {
    const e = machine(); if (!e) return;
    if (document.getElementById('mtl-zerk-os-area')) renderZerkOS(e.id);
    if (document.getElementById('tab-content-zerk')) renderZerkTab(e.id);
}
// Serialize map edits so quick successive clicks cannot save outdated arrays over newer ones.
let saveQueue = Promise.resolve();
function updateMap(changes) {
    const e = machine(); if (!e) return Promise.resolve(false);
    const id = e.id;
    saveQueue = saveQueue.catch(() => {}).then(async () => {
        const target = window.state?.equipment?.find(x => String(x.id) === String(id));
        if (!target) return false;
        const patch = typeof changes === 'function' ? changes(target) : changes;
        if (!patch) return false;
        const previous = Object.fromEntries(Object.keys(patch).map(k => [k, target[k]]));
        Object.assign(target, patch);
        refresh();
        try {
            if (!navigator.onLine) throw new Error('Internet connection is unavailable');
            const { error } = await window._mpdb.from('equipment').update(patch).eq('id', id);
            if (error) throw error;
            return true;
        } catch (error) {
            Object.assign(target, previous);
            refresh();
            console.error('Zerk save failed:', error);
            showToast(`Grease map not saved: ${error.message || 'Try again'}`);
            return false;
        }
    });
    return saveQueue;
}

export function handleZerkMapClick(event, viewIdx) {
    const e = machine();
    if (!e || !photos(e)[viewIdx] || event.target.closest('.zerk-dot')) return;
    const image = event.currentTarget.querySelector('img');
    if (!image || !image.complete || !image.naturalWidth) return;
    // The wrapper follows the displayed image size; coordinates remain correct when resized.
    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (event.clientX - rect.left) / rect.width * 100;
    const y = (event.clientY - rect.top) / rect.height * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    const note = prompt('Instructions for this fitting:');
    if (note === null) return;
    return updateMap(current => ({ zerk_points: [...points(current), {
        id: uid(), x: Number(x.toFixed(2)), y: Number(y.toFixed(2)),
        note: note.trim(), view_index: viewIdx
    }] }));
}
export function deleteZerk(pointId) {
    const e = machine();
    if (!e || !points(e).some(p => String(p.id) === String(pointId))) return;
    if (!confirm('Delete this grease point?')) return;
    return updateMap(current => ({ zerk_points: points(current).filter(p => String(p.id) !== String(pointId)) }));
}
export function editZerkNote(pointId) {
    const e = machine();
    const p = e && points(e).find(p => String(p.id) === String(pointId));
    if (!p) return;
    const note = prompt('Edit fitting instructions:', p.note || '');
    if (note === null) return;
    return updateMap(current => ({ zerk_points: points(current).map(item => String(item.id) === String(pointId) ? {...item, note: note.trim()} : item) }));
}
export async function renameZerkView(idx) {
    const e = machine(); if (!e || !photos(e)[idx]) return;
    const name = prompt('Rename this view:', names(e)[idx] || `View ${idx+1}`);
    if (!name?.trim()) return;
    const ok = await updateMap(current => {
        const updated = [...names(current)]; updated[idx] = name.trim();
        return { zerk_names: updated };
    });
    if (ok) showToast('View renamed');
}
// Called from a real file input after a user chooses an image. Keeping the input
// in the rendered toolbar avoids browsers blocking a file picker opened after prompt().
export async function addZerkViewWithTitle(input) {
    const file = input?.files?.[0];
    if (!file) return;
    input.value = ''; // Allow choosing the same file again after cancel or failure.
    if (!file.type.startsWith('image/')) { showToast('Please select an image file'); return; }
    const e = machine(); if (!e) return;
    const equipmentId = e.id;
    const suggested = `View ${photos(e).length + 1}`;
    const name = prompt('Name this photo view (e.g. Boom):', suggested);
    if (!name?.trim()) return;
    try {
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Could not read selected image'));
            reader.readAsDataURL(file);
        });
        const image = await compressImage(dataUrl, 1200, 0.8);
        if (!image?.startsWith('data:image/')) throw new Error('Image processing failed');
        if (String(machine()?.id) !== String(equipmentId)) throw new Error('Equipment changed during upload; please try again');
        const ok = await updateMap(current => ({
            zerk_photos: [...photos(current), image],
            zerk_names: [...names(current), name.trim()]
        }));
        if (ok) {
            window._currentZerkViewIdx = photos(machine()).length - 1;
            refresh();
            showToast('Photo view added');
        }
    } catch (error) {
        console.error('Grease map photo upload failed:', error);
        showToast(error.message || 'Could not process this image');
    }
}
export async function deleteZerkView() {
    const e = machine(); if (!e || !photos(e).length) return;
    const idx = activeIndex(e);
    if (!confirm(`Delete view "${names(e)[idx] || `View ${idx+1}`}" and all its grease points?`)) return;
    const ok = await updateMap(current => ({
        zerk_photos: photos(current).filter((_, i) => i !== idx),
        zerk_names: names(current).filter((_, i) => i !== idx),
        // Move subsequent view indexes back one, preserving their matching table rows.
        zerk_points: points(current).filter(p => Number(p.view_index) !== idx)
            .map(p => Number(p.view_index) > idx ? {...p, view_index: Number(p.view_index)-1} : p)
    }));
    if (ok) { window._currentZerkViewIdx = 0; refresh(); }
}

function renderView(e, layout) {
    const idx = activeIndex(e);
    const views = photos(e);
    const active = points(e).filter(p => Number(p.view_index ?? 0) === idx);
    const nav = views.map((_, i) => `<button class="btn btn-sm ${i === idx ? 'btn-primary' : 'btn-secondary'}" onclick="window._currentZerkViewIdx=${i};window.${layout === 'os' ? 'renderZerkOS' : 'renderZerkTab'}(window._currentDetailEquipId)">${esc(names(e)[i] || `View ${i+1}`)}</button>`).join('');
    const actions = `<div class="os-zerk-subnav"><div class="os-zerk-view-tabs">${nav}</div><div class="os-zerk-view-actions"><input type="file" accept="image/*" style="display:none" aria-label="Select grease map photo" onchange="window.addZerkViewWithTitle(this)"><button type="button" class="btn btn-secondary btn-sm" onclick="this.previousElementSibling.click()">+ Add View</button>${views.length ? `<button class="btn btn-danger btn-sm" onclick="window.deleteZerkView()">Delete View</button><button class="btn btn-secondary btn-sm" onclick="window.renameZerkView(${idx})">Rename View</button>` : ''}</div></div>`;
    if (!views.length) return `<div class="os-zerk-wrapper">${actions}<p>No grease maps for this equipment yet. Add a photo to start marking fittings.</p></div>`;
    const dots = active.map((p, i) => {
        const x = Math.min(100, Math.max(0, Number(p.lx ?? p.x) || 0));
        const y = Math.min(100, Math.max(0, Number(p.ly ?? p.y) || 0));
        return `<button class="zerk-dot" type="button" title="${esc(p.note || 'Edit fitting')}" style="left:${x}%;top:${y}%" onclick="event.stopPropagation();window.editZerkNote('${esc(p.id)}')">${i+1}</button>`;
    }).join('');
    const rows = active.map((p,i) => `<tr><td style="width:40px;font-weight:bold;color:#3b82f6">#${i+1}</td><td style="cursor:pointer;white-space:pre-wrap;overflow-wrap:anywhere" onclick="window.editZerkNote('${esc(p.id)}')">${esc(p.note || 'Click to add instructions')}</td><td><button class="btn btn-sm" title="Delete grease point" onclick="window.deleteZerk('${esc(p.id)}')">✕</button></td></tr>`).join('') || '<tr><td colspan="3">Click the photo to add a fitting.</td></tr>';
    return `<div class="os-zerk-wrapper">${actions}<div class="os-zerk-grid">
      <div class="zerk-photo-column"><div class="zerk-image-boundary" onclick="window.handleZerkMapClick(event,${idx})">
        <img src="${esc(views[idx])}" alt="Grease fitting map" draggable="false" onerror="this.style.display='none';this.parentElement.classList.add('zerk-image-missing');this.parentElement.querySelector('.zerk-image-error').hidden=false"><span class="zerk-image-error" hidden>Photo unavailable. Delete this view and add the photo again.</span><div class="zerk-photo-overlay">${dots}</div>
      </div></div>
      <div class="os-zerk-list"><div class="os-zerk-list-header">GREASE POINTS — ${active.length}</div><div class="os-zerk-list-body"><table class="os-zerk-fittings-table"><thead><tr><th>#</th><th>Instructions</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>
    </div></div>`;
}
export function renderZerkOS(equipId) {
    const e = window.state?.equipment?.find(x => String(x.id) === String(equipId));
    const el = document.getElementById('mtl-zerk-os-area');
    if (e && el) el.innerHTML = renderView(e, 'os');
}
export function renderZerkTab(equipId) {
    const e = window.state?.equipment?.find(x => String(x.id) === String(equipId));
    const el = document.getElementById('tab-content-zerk');
    if (e && el) el.innerHTML = renderView(e, 'tab');
}
// Legacy hooks retained for compatibility with other modules.
export function renderZerkDots() { refresh(); }
export function showZerkInfo(event, id) { event?.stopPropagation(); return editZerkNote(id); }
export function highlightZerk(id, active) {
    document.querySelectorAll('.zerk-dot').forEach(dot => dot.classList.toggle('highlight', active && dot.dataset.id === String(id)));
}
export function setZerkMode(mode) { window.zerkPinMode = mode; }
