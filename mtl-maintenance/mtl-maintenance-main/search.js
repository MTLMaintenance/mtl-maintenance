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

  // Each category: which state array to search, what heading to show, and
  // what happens on click. Everywhere with a home in a real panel table/
  // card list navigates there and highlights the matching row/card - same
  // smooth feel throughout, rather than popping a modal straight from
  // search results.
  //
  // Observations and Faults are the exception: they don't live in their
  // own flat panel table (observations are nested per-equipment, and
  // there's no dedicated Faults panel in this build), so there's no
  // sensible row to scroll to - these two still open their existing
  // detail popup directly.
  const categories = [
    { key: 'equipment', label: 'EQUIPMENT',
      onClick: e => `window.locateSearchResult('equipment', 'equip-row-${e.id}')` },
    { key: 'tasks', label: 'WORK ORDERS',
      onClick: t => `window.locateSearchResult('tasks', 'task-row-${t.id}')` },
    { key: 'observations', label: 'OBSERVATIONS',
      onClick: o => `window.globalEditObs('${o.id}')` },
    { key: 'faults', label: 'FAULTS',
      onClick: f => `window.openFaultCodeDetail('${f.id}')` },
    { key: 'parts', label: 'PARTS',
      onClick: p => `window.locateSearchResult('parts', 'part-row-${p.id}')` },
    { key: 'consumables', label: 'CONSUMABLES',
      onClick: c => `window.locateSearchResult('parts', 'consumable-row-${c.id}')` },
    { key: 'suppliers', label: 'SUPPLIERS',
      onClick: s => `window.locateSearchResult('suppliers', 'supplier-row-${s.id}')` },
    { key: 'tools', label: 'TOOL CRIB',
      filter: t => t.status === 'available' || t.status === 'ordered' || !t.status,
      onClick: t => `window.locateSearchResult('tools', 'tool-row-${t.id}')` },
    { key: 'documents', label: 'DOCUMENTS',
      onClick: d => `window.locateSearchResult('documents', 'doc-row-${d.id}')` },
    { key: 'checklistTemplates', label: 'CHECKLISTS',
      onClick: c => `window.locateSearchResult('checklists', 'tpl-row-${c.id}')` },
    // NOTE: wishlist items live in state.tools (status 'requested'/'ordered'),
    // not a separate state.wishlist array - that array is never populated
    // anywhere, so this category previously never matched anything.
    { key: 'tools', label: 'WISHLIST',
      filter: t => t.status === 'requested' || t.status === 'ordered',
      onClick: t => `window.locateSearchResult('tools', 'wishlist-row-${t.id}')` },
    { key: 'schedules', label: 'SCHEDULED MAINTENANCE',
      onClick: () => `window.showPanel('calendar')` },
  ];

  let html = '';

  categories.forEach(cat => {
    const list = (state[cat.key] || []).filter(item => !cat.filter || cat.filter(item));
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
// briefly highlights it - used throughout search results instead of
// popping a detail/edit modal directly, for a consistent feel everywhere.
export function locateSearchResult(panelId, rowId) {
    if (typeof window.showPanel === 'function') window.showPanel(panelId);

    // Parts and Consumables are sub-tabs within the same panel - the wrong
    // one is display:none, so switch to whichever sub-tab actually holds
    // this row before trying to scroll to it.
    if (typeof window.switchPartsSubTab === 'function') {
        if (rowId.startsWith('consumable-row-')) window.switchPartsSubTab('consumables');
        else if (rowId.startsWith('part-row-')) window.switchPartsSubTab('inventory');
    }

    // Same idea for Tool Crib's Inventory/Wishlist/Denied sub-tabs
    if (typeof window.switchToolTab === 'function') {
        if (rowId.startsWith('wishlist-row-')) window.switchToolTab('wishlist');
        else if (rowId.startsWith('denied-row-')) window.switchToolTab('denied');
        else if (rowId.startsWith('tool-row-')) window.switchToolTab('inventory');
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
