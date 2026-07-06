// auth.js - Authentication & PIN Pad Logic
import { supabase, createSession } from './db.js';
import { logAuditAction } from './admin.js';
import { applyUserPreferences } from './settings.js';
import { fetchAbsences } from './calendar.js';

export const PERMISSIONS = {
  admin:   {canCreate:true,canEdit:true,canDelete:true,canViewReports:true,canManageUsers:true,canManageParts:true,canManageEquip:true,canManageSuppliers:true,canViewCosts:true,canManageTools:true},
  manager: {canCreate:true,canEdit:true,canDelete:true,canViewReports:true,canManageUsers:false,canManageParts:true,canManageEquip:true,canManageSuppliers:true,canViewCosts:true,canManageTools:true},
  tech:    {canCreate:true,canEdit:true,canDelete:false,canViewReports:false,canManageUsers:false,canManageParts:false,canManageEquip:false,canManageSuppliers:false,canViewCosts:false,canManageTools:true},
  viewer:  {canCreate:false,canEdit:false,canDelete:false,canViewReports:false,canManageUsers:false,canManageParts:false,canManageEquip:false,canManageSuppliers:false,canViewCosts:false,canManageTools:false},
};

export const PERM_LABELS = {
  'canCreate': 'Create work orders',
  'canEdit': 'Edit records',
  'canDelete': 'Delete records',
  'canViewReports': 'View reports & analytics',
  'canViewCosts': 'View costs',
  'canManageEquip': 'Manage equipment',
  'canManageParts': 'Manage parts',
  'canManageSuppliers': 'Manage suppliers',
  'canManageUsers': 'Manage users',
  'canManageTools': 'Manage Tool Crib'
};


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

export async function signOut() {
    // 1. Tell the database to end the session
    if (typeof window.destroySession === 'function') {
        await window.destroySession();
    }

    // 2. Clear local storage so the app "forgets" the user
    localStorage.removeItem('mp_session');
    localStorage.removeItem('mp_session_token');
    
    // 3. Reset the global user variable
    window.currentUser = null;

    // 4. Reload the page to show the login screen
    window.location.reload();
}

export async function doLogin() {
  const username = document.getElementById('auth-user').value.trim();
  const pass = document.getElementById('auth-pass').value;
  document.getElementById('auth-err').style.display='none';
  if (!username||!pass) { showErr('Please enter your username and password.'); return; }
  const btn = document.getElementById('auth-btn');
  btn.textContent='Signing in...'; btn.disabled=true;
  try {
    const { data: profile, error } = await window._mpdb.from('profiles').select('*').eq('username', username).single();
    if (error||!profile) { showErr('Username not found.'); btn.textContent='Sign In'; btn.disabled=false; return; }

    // Check if account is locked
    if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(profile.locked_until) - new Date()) / 60000);
      showErr('Account locked due to too many failed attempts. Try again in ' + mins + ' minute' + (mins!==1?'s':'') + '.');
      btn.textContent='Sign In'; btn.disabled=false; return;
    }

    // Check password
    const hashedInput = await hashPassword(pass);
    const storedHash = profile.password_hash || '';
    if (storedHash.length === 64) {
      passwordMatch = storedHash === hashedInput;
    } else {
      try { passwordMatch = atob(storedHash.replace(/\s/g,'')) === pass; } catch(e) {}
    }

    if (!passwordMatch) {
      const attempts = (profile.login_attempts || 0) + 1;
      const updateData = { login_attempts: attempts };
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
        updateData.locked_until = lockUntil;
        updateData.login_attempts = 0;
        showErr('Too many failed attempts. Account locked for ' + LOCKOUT_MINUTES + ' minutes.');
      } else {
        const remaining = MAX_LOGIN_ATTEMPTS - attempts;
        showErr('Incorrect password. ' + remaining + ' attempt' + (remaining!==1?'s':'') + ' remaining.');
      }
      await window._mpdb.from('profiles').update(updateData).eq('username', username);
      btn.textContent='Sign In'; btn.disabled=false; return;
    }

    // Success — reset attempts
    await window._mpdb.from('profiles').update({ login_attempts: 0, locked_until: null }).eq('username', username);

    if (profile.status==='pending') { showErr('Your account is pending admin approval.'); btn.textContent='Sign In'; btn.disabled=false; return; }
    if (profile.status==='denied') { showErr('Access denied. Contact your administrator.'); btn.textContent='Sign In'; btn.disabled=false; return; }

    const isAdmin = username.toLowerCase()===ADMIN_USERNAME.toLowerCase();
    currentUser = { id: profile.id, name: profile.full_name||username, role: isAdmin?'admin':'tech', username };
    // Create secure session token
    await createSession(username, profile.id);
    enterApp();
  } catch(e) { showErr('Login failed. Try again.'); btn.textContent='Sign In'; btn.disabled=false; }
}

export async function doRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const username = document.getElementById('reg-user').value.trim();
  const pin = document.getElementById('reg-pin').value.trim(); // Changed from reg-pass to reg-pin
  
  // Clear any old errors
  document.getElementById('auth-err').style.display = 'none';

  // 1. Validation
  if (!name || !username || !pin) { 
      showErr('Please fill in all fields.'); 
      return; 
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { 
      showErr('Username: letters, numbers and underscores only.'); 
      return; 
  }

  try {
    // 2. Check if username is already taken
    const { data: existing } = await window._mpdb
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();
    
    if (existing) { 
        showErr('That username is already taken.'); 
        return; 
    }

    // 3. Insert the new user into the database
    const { error } = await window._mpdb.from('profiles').insert({
      id: crypto.randomUUID(), 
      username: username, 
      full_name: name, 
      role: 'tech', 
      status: 'pending',
      pin_code: pin // Saves ly to the new PIN column
    });

    if (error) { 
        showErr('Could not submit: ' + error.message); 
        return; 
    }

    // 4. Success - show the pending screen
    showPending();

  } catch(e) { 
    console.error(e);
    showErr('Registration failed. Try again.'); 
  }
}
