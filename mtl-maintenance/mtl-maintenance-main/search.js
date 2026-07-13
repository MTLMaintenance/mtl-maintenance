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
  // and the real "open this record" function for that type (confirmed
  // against the app's window.* bindings). Only `schedules` has no known
  // detail opener, so it falls back to jumping to the calendar panel.
  const categories = [
    { key: 'equipment', label: 'EQUIPMENT',
      onClick: e => `window.openEquipDetail('${e.id}')` },
    { key: 'tasks', label: 'WORK ORDERS',
      onClick: t => `window.openTaskDetail('${t.id}')` },
    { key: 'observations', label: 'OBSERVATIONS',
      onClick: o => `window.globalEditObs('${o.id}')` },
    { key: 'faults', label: 'FAULTS',
      onClick: f => `window.openFaultCodeDetail('${f.id}')` },
    { key: 'parts', label: 'PARTS',
      onClick: p => `window.editPart('${p.id}')` },
    { key: 'consumables', label: 'CONSUMABLES',
      onClick: c => `window.editConsumable('${c.id}')` },
    { key: 'suppliers', label: 'SUPPLIERS',
      onClick: s => `window.openSupplierDetail('${s.id}')` },
    { key: 'tools', label: 'TOOL CRIB',
      onClick: t => `window.editTool('${t.id}')` },
    { key: 'documents', label: 'DOCUMENTS',
      onClick: d => `window.openDocDetail('${d.id}')` },
    { key: 'checklistTemplates', label: 'CHECKLISTS',
      onClick: c => `window.editTemplate('${c.id}')` },
    { key: 'wishlist', label: 'WISHLIST',
      onClick: w => `window.openWishDetailCard('${w.id}')` },
    { key: 'schedules', label: 'SCHEDULED MAINTENANCE',
      onClick: () => `window.showPanel('calendar')` },
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
