// search.js - Global Search Logic
export function handleGlobalSearch() {
  const state = window.state;
  const input = document.getElementById('global-search');
  const resultsContainer = document.getElementById('search-results');
  if (!input || !resultsContainer) return;

  const query = input.value.toLowerCase().trim();
  if (!query) {
    resultsContainer.style.display = 'none';
    return;
  }

  const equipment = state.equipment.filter(e => e.name.toLowerCase().includes(query));
  const tasks = state.tasks.filter(t => t.name.toLowerCase().includes(query));

  let html = '';
  if (equipment.length) {
    html += '<div class="search-header">EQUIPMENT</div>';
    equipment.forEach(e => html += `<div class="search-item" onclick="window.openEquipDetail('${e.id}')">${e.name}</div>`);
  }
  if (tasks.length) {
    html += '<div class="search-header">WORK ORDERS</div>';
    tasks.forEach(t => html += `<div class="search-item" onclick="window.openTaskDetail('${t.id}')">${t.name}</div>`);
  }

  resultsContainer.innerHTML = html || '<div style="padding:10px;">No results found</div>';
  resultsContainer.style.display = 'block';
}
