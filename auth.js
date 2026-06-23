// auth.js - Authentication & PIN Pad Logic
import { supabase, createSession } from './db.js';
import { logAuditAction } from './admin.js';
import { applyUserPreferences } from './settings.js';
import { fetchAbsences } from './calendar.js';

// 1. Show the list of users on the login screen
export async function showPinLogin() {
    const list = document.getElementById('user-name-list');
    if (!list) return;

    list.innerHTML = '<div style="color:white; grid-column:span 2;">Loading names...</div>';

    try {
        const { data: users, error } = await supabase.from('profiles').select('*');
        if (error) throw error;

        list.innerHTML = '';
        users.forEach(user => {
            const name = user.full_name || user.username;
            const card = document.createElement('div');
            card.style.cssText = "background: rgba(255,255,255,0.1); border: 1px solid white; color: white; padding: 15px; border-radius: 10px; text-align: center; cursor: pointer;";
            card.innerHTML = name;
            card.onclick = () => selectUserForLogin(user);
            list.appendChild(card);
        });
    } catch (e) {
        console.error("Crash in showPinLogin:", e);
    }
}

// 2. When a user clicks their name
export function selectUserForLogin(user) {
    window.selectedLoginUser = user; 
    window.enteredPin = "";          
    
    document.getElementById('selected-user-display').textContent = "Hello, " + (user.full_name || user.username);
    document.getElementById('login-stage-names').style.display = 'none';
    document.getElementById('login-stage-pin').style.display = 'block';
    
    updatePinDots();
}


// 3. Handle numbers pressed on the PIN pad
export function pressPin(num) {
    if (!window.enteredPin) window.enteredPin = ""; // Initialize if empty

    if (num === 'clear') {
        window.enteredPin = "";
    } else {
        if (window.enteredPin.length < 10) {
            window.enteredPin += num;
        }
    }
    updatePinDots();
}
// 4. Verify the PIN against the database
export async function verifyUserPin() {
    console.log("Verifying PIN for:", window.selectedLoginUser?.username);
    
    // 1. Check Supabase
    const { data, error } = await window._mpdb
        .from('profiles')
        .select('*')
        .eq('id', window.selectedLoginUser.id)
        .eq('pin_code', window.enteredPin)
        .single();

    if (data) {
        console.log("PIN Correct! Setting user...");
        window.currentUser = { ...data, name: data.full_name || data.username };
        localStorage.setItem('mp_session', JSON.stringify(window.currentUser));

        // 2. Run success logic
        if (typeof applyUserPreferences === 'function') applyUserPreferences(window.currentUser);
        
        // 3. IMPORTANT: Tell the main file to enter the app
        if (typeof window.enterApp === 'function') {
            window.enterApp();
        } else {
            console.error("Critical: window.enterApp not found!");
        }
    } else {
        alert("Incorrect PIN");
        window.enteredPin = "";
        updatePinDots();
    }
}

// 5. Visual: Update the dots (●●●○)
export function updatePinDots() {
    const container = document.getElementById('pin-display');
    if (!container) return;

    const currentLen = window.enteredPin.length;
    const dotsCount = Math.max(4, currentLen);

    let dotHtml = "";
    for (let i = 0; i < dotsCount; i++) {
        dotHtml += i < currentLen ? '<div class="pin-dot filled"></div>' : '<div class="pin-dot"></div>';
    }
    container.innerHTML = dotHtml;
}

export function backToNames() {
    window.enteredPin = "";
    document.getElementById('login-stage-names').style.display = 'block';
    document.getElementById('login-stage-pin').style.display = 'none';
}

export const PERMISSIONS = {
  admin:   {canCreate:true,canEdit:true,canDelete:true,canViewReports:true,canManageUsers:true,canManageParts:true,canManageEquip:true,canManageSuppliers:true,canViewCosts:true,canManageTools:true},
  manager: {canCreate:true,canEdit:true,canDelete:true,canViewReports:true,canManageUsers:false,canManageParts:true,canManageEquip:true,canManageSuppliers:true,canViewCosts:true,canManageTools:true},
  tech:    {canCreate:true,canEdit:true,canDelete:false,canViewReports:false,canManageUsers:false,canManageParts:false,canManageEquip:false,canManageSuppliers:false,canViewCosts:false,canManageTools:true},
  viewer:  {canCreate:false,canEdit:false,canDelete:false,canViewReports:false,canManageUsers:false,canManageParts:false,canManageEquip:false,canManageSuppliers:false,canViewCosts:false,canManageTools:false},
};

export function can(permission, currentUser) {
  if(!currentUser) return false;
  const role = currentUser.role || 'viewer';
  return !!(PERMISSIONS[role]?.[permission]);
}

export function togglePassVis(inputId, btnId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}
