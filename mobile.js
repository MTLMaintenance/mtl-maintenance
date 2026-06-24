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
