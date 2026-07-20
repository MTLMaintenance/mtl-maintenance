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
  //
  // Parts/Consumables/Tools have no separate "view" - editPart/
  // editConsumable/editTool are edit forms, not detail views - so instead
  // of popping the edit modal straight from search, these three jump to
  // their panel and scroll to + briefly highlight the matching row.
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
      onClick: p => `window.locateSearchResult('parts', 'part-row-${p.id}')` },
    { key: 'consumables', label: 'CONSUMABLES',
      onClick: c => `window.locateSearchResult('parts', 'consumable-row-${c.id}')` },
    { key: 'suppliers', label: 'SUPPLIERS',
      onClick: s => `window.openSupplierDetail('${s.id}')` },
    { key: 'tools', label: 'TOOL CRIB',
      onClick: t => `window.locateSearchResult('tools', 'tool-row-${t.id}')` },
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
      html += `<div class="search-item" onclick="${cat.onClick(item)}; window.closeSearchResults();">${getItemLabel(item)}</div>`;
    });
  });

  resultsContainer.innerHTML = html || '<div style="padding:10px;">No results found</div>';
  resultsContainer.style.display = 'block';
}

// Closes the results dropdown and clears the search box - called after
// clicking any result, regardless of category, so it doesn't linger open.
export function closeSearchResults() {
    const resultsContainer = document.getElementById('search-results');
    const input = document.getElementById('global-search');
    if (resultsContainer) resultsContainer.style.display = 'none';
    if (input) input.value = '';
}

// Switches to the given panel, then scrolls the matching row into view and
// briefly highlights it - used for tables (Parts, Consumables, Tools) that
// don't have a separate detail/view popup, only an edit form.
export function locateSearchResult(panelId, rowId) {
    if (typeof window.showPanel === 'function') window.showPanel(panelId);

    // Parts and Consumables are sub-tabs within the same panel - the wrong
    // one is display:none, so switch to whichever sub-tab actually holds
    // this row before trying to scroll to it.
    if (typeof window.switchPartsSubTab === 'function') {
        if (rowId.startsWith('consumable-row-')) window.switchPartsSubTab('consumables');
        else if (rowId.startsWith('part-row-')) window.switchPartsSubTab('inventory');
    }

    // Give the panel a moment to actually render before we look for the row
    setTimeout(() => {
        const row = document.getElementById(rowId);
        if (!row) return;
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.classList.add('search-highlight');
        setTimeout(() => row.classList.remove('search-highlight'), 2000);
    }, 150);
}
