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

  // Pulls together whatever text fields an item happens to have,
  // since not every collection uses the same field name for its
  // "title" (some use name, some title, some description/body/notes).
  function getItemText(item) {
    return [item.name, item.title, item.description, item.body, item.notes]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function getItemLabel(item) {
    return item.name || item.title
      || (item.description ? item.description.slice(0, 60) : null)
      || (item.body ? item.body.slice(0, 60) : null)
      || 'Untitled';
  }

  // Each category: which state array to search, what heading to show,
  // and what clicking a result should do. Where we know the real
  // "open this record" function (equipment, tasks) we use it directly.
  // Everywhere else, we jump to that section's panel instead of guessing
  // at a detail function that might not exist.
  const categories = [
    { key: 'equipment', label: 'EQUIPMENT',
      onClick: e => `window.openEquipDetail('${e.id}')` },
    { key: 'tasks', label: 'WORK ORDERS',
      onClick: t => `window.openTaskDetail('${t.id}')` },
    { key: 'observations', label: 'OBSERVATIONS',
      onClick: o => o.equip_id ? `window.openEquipDetail('${o.equip_id}')` : `window.showPanel('equipment')` },
    { key: 'faults', label: 'FAULTS',
      onClick: f => f.equip_id ? `window.openEquipDetail('${f.equip_id}')` : `window.showPanel('equipment')` },
    { key: 'parts', label: 'PARTS',
      onClick: () => `window.showPanel('parts')` },
    { key: 'consumables', label: 'CONSUMABLES',
      onClick: () => `window.showPanel('parts')` },
    { key: 'suppliers', label: 'SUPPLIERS',
      onClick: () => `window.showPanel('suppliers')` },
    { key: 'tools', label: 'TOOL CRIB',
      onClick: () => `window.showPanel('tools')` },
    { key: 'documents', label: 'DOCUMENTS',
      onClick: () => `window.showPanel('documents')` },
    { key: 'checklistTemplates', label: 'CHECKLISTS',
      onClick: () => `window.showPanel('checklists')` },
    { key: 'schedules', label: 'SCHEDULED MAINTENANCE',
      onClick: () => `window.showPanel('calendar')` },
    { key: 'wishlist', label: 'WISHLIST',
      onClick: () => `window.showPanel('parts')` },
  ];

  let html = '';

  categories.forEach(cat => {
    const list = state[cat.key] || [];
    const matches = list.filter(item => getItemText(item).includes(query)).slice(0, 5);
    if (!matches.length) return;

    html += `<div class="search-header">${cat.label}</div>`;
    matches.forEach(item => {
      html += `<div class="search-item" onclick="${cat.onClick(item)}">${getItemLabel(item)}</div>`;
    });
  });

  resultsContainer.innerHTML = html || '<div style="padding:10px;">No results found</div>';
  resultsContainer.style.display = 'block';
}
