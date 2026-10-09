// Zerk / grease map: photo views and their synchronized fitting tables.
import { uid, showToast, compressImage } from './utils.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const machine = () => window.state?.equipment?.find(e => String(e.id) === String(window._currentDetailEquipId));
const photos = e => Array.isArray(e.zerk_photos) ? e.zerk_photos : [];
const points = e => Array.isArray(e.zerk_points) ? e.zerk_points : [];
const names = e => Array.isArray(e.zerk_names) ? e.zerk_names : [];
const defaultLabelX = p => clamp((Number(p.x) || 0) + 4.5, 4, 96);
const defaultLabelY = p => clamp((Number(p.y) || 0) - 4.5, 4, 96);
const labelX = p => clamp(p.lx ?? defaultLabelX(p), 4, 96);
const labelY = p => clamp(p.ly ?? defaultLabelY(p), 4, 96);
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

function bindDragListeners() {
    if (window.__zerkDragListenersBound) return;
    window.__zerkDragListenersBound = true;
    document.addEventListener('pointermove', handleDragMove);
    document.addEventListener('pointerup', handleDragEnd);
    document.addEventListener('pointercancel', handleDragEnd);
}
function handleDragMove(event) {
    const drag = window.__zerkDragState;
    if (!drag) return;
    const image = drag.boundary?.querySelector('img');
    if (!image || !image.complete || !image.naturalWidth) return;
    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nextX = clamp(((event.clientX - rect.left) / rect.width) * 100, 4, 96);
    const nextY = clamp(((event.clientY - rect.top) / rect.height) * 100, 4, 96);
    const movedEnough = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) > 4;
    if (movedEnough) drag.moved = true;
    drag.lx = Number(nextX.toFixed(2));
    drag.ly = Number(nextY.toFixed(2));
    if (drag.calloutEl) {
        drag.calloutEl.style.left = `${drag.lx}%`;
        drag.calloutEl.style.top = `${drag.ly}%`;
        drag.calloutEl.classList.add('dragging');
    }
    if (drag.lineEl) {
        drag.lineEl.setAttribute('x2', `${drag.lx}%`);
        drag.lineEl.setAttribute('y2', `${drag.ly}%`);
    }
}
function handleDragEnd() {
    const drag = window.__zerkDragState;
    if (!drag) return;
    if (drag.calloutEl) drag.calloutEl.classList.remove('dragging');
    window.__zerkDragState = null;
    if (!drag.moved) return;
    window.__zerkSuppressPointClick = { id: drag.pointId, until: Date.now() + 350 };
    updateMap(current => ({
        zerk_points: points(current).map(point => String(point.id) === String(drag.pointId)
            ? { ...point, lx: drag.lx, ly: drag.ly }
            : point)
    }));
}

export function startZerkCalloutDrag(event, pointId) {
    if (event.button !== undefined && event.button !== 0) return;
    const boundary = event.currentTarget.closest('.zerk-image-boundary');
    if (!boundary) return;
    bindDragListeners();
    window.__zerkDragState = {
        pointId,
        boundary,
        calloutEl: event.currentTarget,
        lineEl: boundary.querySelector(`.zerk-line[data-id="${String(pointId).replace(/"/g, '&quot;')}"]`),
        startClientX: event.clientX,
        startClientY: event.clientY,
        moved: false,
        lx: Number(event.currentTarget.dataset.lx) || 0,
        ly: Number(event.currentTarget.dataset.ly) || 0
    };
    event.preventDefault();
    event.stopPropagation();
}
export function handleZerkCalloutClick(event, pointId) {
    event?.stopPropagation();
    const suppress = window.__zerkSuppressPointClick;
    if (suppress && String(suppress.id) === String(pointId) && Date.now() < suppress.until) return;
    return editZerkNote(pointId);
}
export function resetZerkCallout(pointId) {
    const e = machine();
    const p = e && points(e).find(item => String(item.id) === String(pointId));
    if (!p) return;
    return updateMap(current => ({
        zerk_points: points(current).map(item => String(item.id) === String(pointId)
            ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'lx' && key !== 'ly'))
            : item)
    }));
}

export function handleZerkMapClick(event, viewIdx) {
    const e = machine();
    if (!e || !photos(e)[viewIdx] || event.target.closest('.zerk-callout') || event.target.closest('.zerk-dot-anchor')) return;
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
    const point = {
        id: uid(),
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        lx: Number(defaultLabelX({ x }).toFixed(2)),
        ly: Number(defaultLabelY({ y }).toFixed(2)),
        note: note.trim(),
        view_index: viewIdx
    };
    return updateMap(current => ({ zerk_points: [...points(current), point] }));
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
    const lines = active.map(p => {
        const x = clamp(Number(p.x) || 0, 0, 100);
        const y = clamp(Number(p.y) || 0, 0, 100);
        const lx = labelX(p);
        const ly = labelY(p);
        return `<line class="zerk-line" data-id="${esc(p.id)}" x1="${x}%" y1="${y}%" x2="${lx}%" y2="${ly}%"></line>`;
    }).join('');
    const markers = active.map((p, i) => {
        const x = clamp(Number(p.x) || 0, 0, 100);
        const y = clamp(Number(p.y) || 0, 0, 100);
        const lx = labelX(p);
        const ly = labelY(p);
        return `
            <span class="zerk-dot-anchor" style="left:${x}%;top:${y}%" title="Fitting #${i+1}"></span>
            <button class="zerk-callout" data-id="${esc(p.id)}" data-lx="${lx}" data-ly="${ly}" type="button" title="${esc(p.note || 'Edit fitting')}" style="left:${lx}%;top:${ly}%" onpointerdown="window.startZerkCalloutDrag(event,'${esc(p.id)}')" onclick="window.handleZerkCalloutClick(event,'${esc(p.id)}')">${i+1}</button>`;
    }).join('');
    const rows = active.map((p,i) => `<tr><td style="width:40px;font-weight:bold;color:#3b82f6">#${i+1}</td><td style="cursor:pointer;white-space:pre-wrap;overflow-wrap:anywhere" onclick="window.editZerkNote('${esc(p.id)}')">${esc(p.note || 'Click to add instructions')}</td><td style="white-space:nowrap"><button class="btn btn-sm" title="Reset label position" onclick="window.resetZerkCallout('${esc(p.id)}')">↺</button> <button class="btn btn-sm" title="Delete grease point" onclick="window.deleteZerk('${esc(p.id)}')">✕</button></td></tr>`).join('') || '<tr><td colspan="3">Click the photo to add a fitting.</td></tr>';
    return `<div class="os-zerk-wrapper">${actions}<div class="os-zerk-grid">
      <div class="zerk-photo-column"><div class="zerk-helper-text">Click the photo to add a fitting. Drag a numbered badge to pull it away from crowded spots.</div><div class="zerk-image-boundary" onclick="window.handleZerkMapClick(event,${idx})">
        <img src="${esc(views[idx])}" alt="Grease fitting map" draggable="false" onerror="this.style.display='none';this.parentElement.classList.add('zerk-image-missing');this.parentElement.querySelector('.zerk-image-error').hidden=false"><span class="zerk-image-error" hidden>Photo unavailable. Delete this view and add the photo again.</span><div class="zerk-photo-overlay"><svg class="zerk-lines-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${markers}</div>
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
    document.querySelectorAll('.zerk-callout').forEach(dot => dot.classList.toggle('highlight', active && dot.dataset.id === String(id)));
}
export function setZerkMode(mode) { window.zerkPinMode = mode; }
