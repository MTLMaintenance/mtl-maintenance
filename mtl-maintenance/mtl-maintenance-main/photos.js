import { compressImage, showToast } from './utils.js';

// 1. Handle the actual upload and compression
export async function handlePhotoUpload(input, key) {
  // Use the global window version of pendingPhotos if it exists
  const photos = window.pendingPhotos || {};
  if (!photos[key]) photos[key] = [];

  const files = Array.from(input.files);
  
  for(const file of files) {
    const reader = new FileReader();
    const dataUrl = await new Promise(res => { 
        reader.onload = e => res(e.target.result); 
        reader.readAsDataURL(file); 
    });
    
    try {
        showToast("Compressing...");
        const compressed = await compressImage(dataUrl);
        photos[key].push(compressed);
        
        // Call the refresh function directly since it's in this same file
        refreshPhotoGrid(key); 
    } catch (e) {
        console.error("Compression failed:", e);
    }
  }
  input.value = '';
}

// 2. Build the HTML for the little 72x72 photo boxes
export function refreshPhotoGrid(key) {
  const photos = window.pendingPhotos || {};
  const gridId = key === 'task' ? 'task-photo-grid' : 'equip-photo-grid';
  const grid = document.getElementById(gridId); 
  
  if(!grid || !photos[key]) return;
  
  grid.innerHTML = photos[key].map((src, i) => `
    <div style="position:relative; width:72px; height:72px">
      <img class="photo-thumb" src="${src}" onclick="window.viewPhoto('${src}')" style="width:100%; height:100%; object-fit:cover; border-radius:8px;"/>
      <button onclick="window.initMarkup('${src}', '${key}', ${i})" 
              style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:3px; font-size:10px; padding:2px 4px; cursor:pointer">
              ✏️
      </button>
    </div>
  `).join('') +
  `<div class="photo-add" onclick="document.getElementById('${key}-photo-input').click()">+</div>` +
  `<input type="file" id="${key}-photo-input" accept="image/*" multiple style="display:none" onchange="window.handlePhotoUpload(this,'${key}')"/>`;
}


// ---- Photo viewer / markup -------------------------------------------------
let markupContext = null;
let markupDrawing = false;
let markupSource = null;
let markupTargetKey = null;
let markupTargetIndex = -1;
let markupOriginalData = null;

export function viewPhoto(src) {
  const viewer = document.getElementById('photo-viewer');
  const img = document.getElementById('pv-img');
  if (!viewer || !img) return;
  img.src = src;
  viewer.classList.add('open');
}

export function closePhotoViewer(event) {
  if (event && event.target && event.target.id === 'pv-img') return;
  const viewer = document.getElementById('photo-viewer');
  if (viewer) viewer.classList.remove('open');
}

function canvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const point = event.touches?.[0] || event;
  return {
    x: (point.clientX - rect.left) * (canvas.width / rect.width),
    y: (point.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function beginMarkup(event) {
  if (!markupContext) return;
  event.preventDefault();
  markupDrawing = true;
  const p = canvasPoint(event.currentTarget, event);
  markupContext.beginPath();
  markupContext.moveTo(p.x, p.y);
}

function drawMarkup(event) {
  if (!markupDrawing || !markupContext) return;
  event.preventDefault();
  const p = canvasPoint(event.currentTarget, event);
  markupContext.lineTo(p.x, p.y);
  markupContext.stroke();
}

function endMarkup(event) {
  if (event) event.preventDefault();
  markupDrawing = false;
  if (markupContext) markupContext.closePath();
}

function drawMarkupBase() {
  const canvas = document.getElementById('markup-canvas');
  if (!canvas || !markupOriginalData) return;
  const img = new Image();
  img.onload = () => {
    const maxW = 1400;
    const scale = Math.min(1, maxW / img.width);
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    markupContext = canvas.getContext('2d');
    markupContext.drawImage(img, 0, 0, canvas.width, canvas.height);
    markupContext.lineWidth = Math.max(3, canvas.width / 220);
    markupContext.lineCap = 'round';
    markupContext.lineJoin = 'round';
    markupContext.strokeStyle = '#ff2d2d';
  };
  img.src = markupOriginalData;
}

export function initMarkup(src, key, index) {
  markupSource = src;
  markupOriginalData = src;
  markupTargetKey = key;
  markupTargetIndex = Number(index);

  const modal = document.getElementById('markup-modal');
  const canvas = document.getElementById('markup-canvas');
  if (!modal || !canvas) return;

  canvas.onpointerdown = beginMarkup;
  canvas.onpointermove = drawMarkup;
  canvas.onpointerup = endMarkup;
  canvas.onpointerleave = endMarkup;
  canvas.onpointercancel = endMarkup;
  canvas.style.touchAction = 'none';

  drawMarkupBase();
  modal.style.display = 'flex';
  modal.classList.add('open');
}

export function clearMarkup() {
  drawMarkupBase();
}

export function closeMarkupModal() {
  const modal = document.getElementById('markup-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('open');
  }
  markupDrawing = false;
  markupContext = null;
}

export function saveMarkup() {
  const canvas = document.getElementById('markup-canvas');
  const photos = window.pendingPhotos || {};
  if (!canvas || !markupTargetKey || markupTargetIndex < 0 || !photos[markupTargetKey]) return;

  const output = canvas.toDataURL('image/jpeg', 0.9);
  photos[markupTargetKey][markupTargetIndex] = output;
  refreshPhotoGrid(markupTargetKey);
  closeMarkupModal();
  showToast('Photo markup saved ✓');
}
