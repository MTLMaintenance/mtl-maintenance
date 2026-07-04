import { handleGlobalSearch } from './search.js';

export function adjustMobileLayout() {
    if (window.innerWidth <= 768) {
        const topbar = document.querySelector('.topbar');
        if (topbar) {
            document.documentElement.style.setProperty('--topbar-h', topbar.offsetHeight + 'px');
        }
    } else {
        document.documentElement.style.setProperty('--topbar-h', '60px');
    }
}

export function handleLogoClick(state) {
    if (window.innerWidth <= 768) {
        const query = prompt("Search for equipment, tasks, or parts:");
        if (query && query.trim() !== "") {
            const searchInput = document.getElementById('global-search');
            if (searchInput) {
                searchInput.value = query;
                handleGlobalSearch(state); 
            }
        }
    } else {
        window.showPanel('dashboard');
    }
}

// Optimization: Call layout adjustment on window resize
window.addEventListener('resize', adjustMobileLayout);

export function openMobileSearch() {
    // Instead of a tiny bar, we use a prompt or a full-screen search experience
    const query = prompt("Search equipment, tasks, or parts:");
    
    if (query && query.trim() !== "") {
        // Use your existing search logic
        const input = document.getElementById('global-search');
        if (input) {
            input.value = query;
            handleGlobalSearch(); // Trigger the search result dropdown
        } else {
            // Fallback: If you don't have the global search input anymore
            // We can just alert or filter the current view
            alert("Searching for: " + query);
        }
    }
}
