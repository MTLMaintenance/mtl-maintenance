import { compressImage, showToast } from './utils.js';
import { openModal } from './ui.js';

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
