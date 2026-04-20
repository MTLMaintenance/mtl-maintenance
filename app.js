let selectedLoginUser = null;
let enteredPin = "";
let lastClickedDate = "";
let currentDetailId = null;
let selectedAbsenceType = 'all'; 
let staffAbsences = [];
let zerkPinMode = 'dot'; // 'dot' or 'line'
let zerkDrawingStep = 1; 
let currentWOTab = 'details'; 
let woPartsTemp = [];
let currentZerkView = 'side_1';
let allMachineZerks = [];
let tempZerkCoords = { x: 0, y: 0 };
let calDate = new Date();
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
 let currentCalEntryType = 'one-time';   
    // CONFIG
// ============================================================
async function promptResetPin(userId) {
    if (!state.users_list_cache) return;
    
    const user = state.users_list_cache.find(u => u.id === userId);
    const uName = user ? (user.full_name || user.username) : "User";

    const newPin = prompt("Enter new PIN for " + uName + ":");
    if (newPin === null || newPin.trim() === "") return;

    try {
        const { error } = await window._mpdb
            .from('profiles')
            .update({ pin_code: newPin.trim() })
            .eq('id', userId);

        if (error) { alert("Error: " + error.message); } 
        else { alert("Success! PIN updated for " + uName); }
    } catch (err) { console.error(err); }
}
async function showPinLogin() {
    try {
        console.log('Switching to PIN Login UI...');
        var oldLogin = document.getElementById('login-screen') || document.getElementById('auth-container'); 
        if (oldLogin) oldLogin.style.display = 'none';

        var pinUI = document.getElementById('pin-login-container');
        if (pinUI) pinUI.style.display = 'block';

        var userResult = await window._mpdb
            .from('profiles')
            .select('id, username, full_name')
            .eq('status', 'approved')
            .order('full_name', { ascending: true });

        if (userResult.error) {
            console.error('User fetch error:', userResult.error);
            return;
        }

        var list = document.getElementById('user-name-list');
        if (list && userResult.data) {
            list.innerHTML = '';
            userResult.data.forEach(function(user) {
                var btn = document.createElement('button');
                btn.className = 'user-select-btn';
                btn.textContent = user.full_name || user.username;
                btn.onclick = function() { selectUserForLogin(user); };
                list.appendChild(btn);
            });
        }
    } catch (err) {
        console.error('Critical error in showPinLogin:', err);
    }
}
function selectUserForLogin(user) {
    selectedLoginUser = user;
    enteredPin = "";
    document.getElementById('selected-user-display').textContent = user.full_name || user.username;
    document.getElementById('login-stage-names').style.display = 'none';
    document.getElementById('login-stage-pin').style.display = 'block';
    updatePinDots();
}
function pressPin(num) {
    if (num === 'clear') {
        enteredPin = "";
    } else if (enteredPin.length < 12) { // Set a max safety limit of 12
        enteredPin += num;
    }
    
    updatePinDisplay();
}
function updatePinDisplay() {
    const display = document.getElementById('pin-display');
    // Shows one asterisk for every digit typed
    display.textContent = "•".repeat(enteredPin.length);
}
async function verifyUserPin() {
    const { data, error } = await window._mpdb
        .from('profiles')
        .select('*')
        .eq('id', selectedLoginUser.id)
        .eq('pin_code', enteredPin)
        .single();

    if (data) {
        // 1. Success! Set the current user
        currentUser = data;

        // 2. SAVE THE SESSION so startApp() finds it on refresh
        // This matches the 'mp_session' check inside your startApp function
        localStorage.setItem('mp_session', JSON.stringify({
            id: data.id,
            username: data.username,
            name: data.full_name || data.username
        }));

        // 3. Create the official session token in Supabase
        if (typeof createSession === 'function') {
            await createSession(data.username, data.id);
        }

        // 4. Enter the app
        await fetchAbsences();
        await enterApp(); 

    } else {
        alert("Incorrect PIN");
        enteredPin = "";
        updatePinDots();
    }
}

function updatePinDots() {
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`dot-${i}`).classList.toggle('filled', i <= enteredPin.length);
    }
}

function backToNames() {
    document.getElementById('login-stage-names').style.display = 'block';
    document.getElementById('login-stage-pin').style.display = 'none';
}
function checkDateSelection(val) {
    if(val) document.getElementById('abs-options').style.display = 'block';
}

function setAbsenceType(type) {
    selectedAbsenceType = type;
    document.getElementById('btn-all-day').classList.toggle('active', type === 'all');
    document.getElementById('btn-partial').classList.toggle('active', type === 'partial');
    document.getElementById('abs-time-container').style.display = type === 'partial' ? 'block' : 'none';
}

async function saveAbsence() {
    try {
        const dateVal = document.getElementById('abs-date').value;
        const timeVal = document.getElementById('abs-time').value;
        const pubReason = document.getElementById('abs-public').value;
        const isPriv = document.getElementById('abs-is-private').checked;
        const privReason = document.getElementById('abs-private').value;

        if (!dateVal || !pubReason) {
            alert("Please select a date and provide a reason.");
            return;
        }

        // BUILDING THE DATA OBJECT
        const newEntry = {
            user_name: currentUser.name || currentUser.username || "Unknown",
            user_id: String(currentUser.id || ""),
            start_date: dateVal, 
            // We use 'all' as the default if the variable isn't set yet
            is_all_day: (window.selectedAbsenceType === 'all' || !window.selectedAbsenceType),
            partial_time: (window.selectedAbsenceType === 'partial') ? timeVal : null,
            reason_public: pubReason,
            is_private: isPriv,
            reason_private: isPriv ? privReason : null
        };

        const { error } = await window._mpdb
            .from('staff_absences')
            .insert([newEntry]);

        if (error) {
            console.error("Supabase Error:", error);
            alert("Error: " + error.message);
            return;
        }

        alert("Request Submitted!");
        closeAbsenceModal();
        
        // Refresh the calendar
        if (typeof fetchAbsences === 'function') await fetchAbsences();
        if (typeof renderCalendar === 'function') renderCalendar();

    } catch (err) {
        console.error("JS Error:", err);
    }
}
async function checkUpcomingAbsences() {
    const today = new Date().toISOString().split('T')[0];
    const lastCheck = localStorage.getItem('last_absence_check');
    if (lastCheck === today) return; // Don't spam, only check once a day

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const upcoming = staffAbsences.filter(a => a.start_date.split('T')[0] === tomorrowStr);

    for (let abs of upcoming) {
        const detail = abs.is_private ? abs.reason_private : abs.reason_public;
        
        // Insert a message into the Admin channel
        await window._mpdb.from('chat_messages').insert([{
            channel: 'admin',
            author: 'SYSTEM',
            author_name: 'Reminder Bot 🤖',
            body: `⚠️ REMINDER: ${abs.user_name} is scheduled to be out tomorrow. Reason: ${detail}`,
            created_at: new Date().toISOString()
        }]);
    }
    localStorage.setItem('last_absence_check', today);
}

function openAbsenceDetail(id) {
    const abs = staffAbsences.find(a => a.id === id);
    if (!abs) return;
    
    currentDetailId = id; 

    // --- STEP 3 INTEGRATION START ---
    // This defines who has "Manager Power" over absences
    const canManage = currentUser.role === 'admin' || 
                     (currentUser.permissions && currentUser.permissions.includes('manage_absences'));
    // --- STEP 3 INTEGRATION END ---
    
    // 1. Set Basic Info
    document.getElementById('det-user').textContent = `👤 ${abs.user_name}`;
    document.getElementById('det-reason').textContent = abs.reason_public;
    document.getElementById('det-time').textContent = abs.is_all_day ? "All Day" : `Leaving at ${formatTime(abs.partial_time)}`;

    // 2. Permission Check: Private Reason
    // Use 'canManage' instead of just checking for 'admin'
    const privSection = document.getElementById('det-private-section');
    if (abs.is_private && canManage) {
        privSection.style.display = 'block';
        document.getElementById('det-private-text').textContent = abs.reason_private || "No private note provided.";
    } else {
        privSection.style.display = 'none';
    }

    // 3. Permission Check: Deletion
    // Show delete button if it's YOUR request OR you have 'canManage' power
    const deleteBtn = document.getElementById('det-delete-btn');
    if (abs.user_id === String(currentUser.id) || canManage) {
        deleteBtn.style.display = 'block';
    } else {
        deleteBtn.style.display = 'none';
    }

    document.getElementById('absence-detail-modal').style.display = 'block';
}

async function deleteAbsence() {
    if (!currentDetailId) return;
    
    if (!confirm("Are you sure you want to delete this time off request?")) return;

    const { error } = await window._mpdb
        .from('staff_absences')
        .delete()
        .eq('id', currentDetailId);

    if (error) {
        alert("Error deleting: " + error.message);
    } else {
        document.getElementById('absence-detail-modal').style.display = 'none';
        await fetchAbsences();
        renderCalendar();
    }
}
async function fetchAbsences() {
    const { data, error } = await window._mpdb
        .from('staff_absences')
        .select('*');
    
    if (data) {
        staffAbsences = data;
        
        // Option B: Run the automatic reminder check for managers
        if (currentUser.role === 'admin') {
            checkUpcomingAbsences();
        }
    }
}
function openAbsenceModal() {
    console.log("Attempting to open modal...");
    const modal = document.getElementById('absence-modal');
    if (modal) {
        // This forces the display to 'block' even if CSS tries to hide it
        modal.style.setProperty('display', 'block', 'important');
        console.log("Modal is now set to display: block !important");
    } else {
        alert("HTML Error: Could not find id='absence-modal'");
    }
}

function closeAbsenceModal() {
    const modal = document.getElementById('absence-modal');
    if (modal) modal.style.display = 'none';
}
function togglePrivateReason(show) {
    const privBox = document.getElementById('priv-box');
    if (privBox) {
        if (show) {
            privBox.style.display = 'block';
            // Optional: Scroll to bottom of modal so they see the new box
        } else {
            privBox.style.display = 'none';
        }
    }
}


async function saveAbsence() {
    // 1. Get the NEW IDs we created for the simplified menu
    const dateInput = document.getElementById('abs-date');
    const timeInput = document.getElementById('abs-time');
    const pubReasonInput = document.getElementById('abs-public');
    const isPrivInput = document.getElementById('abs-is-private');
    const privReasonInput = document.getElementById('abs-private');

    // 2. Safety check: Make sure the elements actually exist
    if (!dateInput || !pubReasonInput) {
        console.error("Could not find the form inputs in the HTML.");
        return;
    }

    const date = dateInput.value;
    const time = timeInput.value;
    const pubReason = pubReasonInput.value;
    const isPriv = isPrivInput.checked;
    const privReason = privReasonInput.value;

    // 3. Validation
    if(!date || !pubReason) {
        alert("Please select a date and provide a public reason.");
        return;
    }

    // 4. Send to Supabase
    // Note: 'selectedAbsenceType' is the variable changed by the All Day/Partial buttons
    const { error } = await window._mpdb.from('staff_absences').insert([{
        user_name: currentUser.name || currentUser.username,
        user_id: currentUser.id,
        start_date: date,
        is_all_day: (selectedAbsenceType === 'all'),
        partial_time: (selectedAbsenceType === 'partial') ? time : null,
        reason_public: pubReason,
        is_private: isPriv,
        reason_private: isPriv ? privReason : null
    }]);

    if (!error) {
        alert("Request Submitted!");
        closeAbsenceModal();
        
        // Refresh the data and the screen
        if (typeof fetchAbsences === 'function') await fetchAbsences();
        if (typeof renderCalendar === 'function') renderCalendar();
    } else {
        alert("Error saving to database: " + error.message);
    }
}
// ── SESSION TOKEN ────────────────────────────────────────────
function setSyncStatus(s) {
  const dot = document.getElementById('sync-dot'); 
  if(!dot) return;
  
  // Reset classes
  dot.className = 'sync-dot';
  
  if(s === 'syncing') {
    dot.classList.add('syncing'); // This makes it pulse orange
  } else if(s === 'offline') {
    dot.classList.add('offline'); // This makes it red
  }
  // If 'online', it stays green (default)
}
    async function generateSessionToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createSession(username, userId) {
  const token = await generateSessionToken();
  const expiresAt = new Date(Date.now() + 8*60*60*1000).toISOString();
  try {
    await window._mpdb.from('app_sessions').insert({
      token, username, user_id: userId,
      expires_at: expiresAt, last_active: new Date().toISOString()
    });
    localStorage.setItem('mp_session_token', token);
  } catch(e) { console.error('Session create failed:', e); }
  return token;
}

async function validateSession() {
  const token = localStorage.getItem('mp_session_token');
  if(!token) return null;
  try {
    // 1. Fetch only the session data first
    const { data: session, error: sErr } = await window._mpdb.from('app_sessions')
      .select('*')
      .eq('token', token)
      .single();

    if(!session || sErr) return null;

    // Check expiry
    if(new Date(session.expires_at) < new Date()) {
      await window._mpdb.from('app_sessions').delete().eq('token', token);
      localStorage.removeItem('mp_session_token');
      localStorage.removeItem('mp_session');
      return null;
    }

    // 2. Fetch the profile data separately using the username from the session
    const { data: profile, error: pErr } = await window._mpdb.from('profiles')
      .select('*')
      .eq('username', session.username)
      .single();

    if(!profile || pErr) return null;

    // Refresh last_active and extend expiry
    const newExpiry = new Date(Date.now() + 8*60*60*1000).toISOString();
    await window._mpdb.from('app_sessions').update({
      last_active: new Date().toISOString(),
      expires_at: newExpiry
    }).eq('token', token);

    // Return combined data so the rest of the app works as expected
    return { ...session, profiles: profile };

  } catch(e) { 
    console.error("Session validation error:", e);
    return null; 
  }
}

async function destroySession() {
  const token = localStorage.getItem('mp_session_token');
  if(token) {
    try { await window._mpdb.from('app_sessions').delete().eq('token', token); } catch(e) {}
    localStorage.removeItem('mp_session_token');
  }
}

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const SUPABASE_URL = 'https://ldxryhgovspckypqoqvf.supabase.co';
// --- ZERK MAP UPLOAD LOGIC (PLACE AT TOP OF SCRIPT) ---
async function uploadZerkView(input) {
    const file = input.files[0]; if(!file) return;
    const equipId = window._currentDetailEquipId;
    const e = state.equipment.find(x => x.id === equipId);
    if(!e) return;

    showToast("⚙️ Processing image...");
    
    try {
        const base64 = await compressImage(await new Promise(res => {
            const r = new FileReader(); r.onload = ev => res(ev.target.result); r.readAsDataURL(file);
        }), 1200, 0.8);

        if(!e.zerk_photos) e.zerk_photos = [];
        e.zerk_photos.push(base64);

        // SAVE TO DATABASE
        const { error } = await window._mpdb
            .from('equipment')
            .update({ zerk_photos: e.zerk_photos })
            .eq('id', equipId);

        if (error) throw error;

        showToast("View added ✓");
        refreshZerkMap(equipId);
    } catch(err) { 
        console.error(err);
        showToast("Upload failed"); 
    }
    input.value = "";
}
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkeHJ5aGdvdnNwY2t5cHFvcXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2ODk2MTksImV4cCI6MjA4OTI2NTYxOX0.rI_PLHYbp_tat5vsXDHXbc0zbokhGrBq_Tg9vFrWuSc';
const ADMIN_USERNAME = 'tangal99';
let currentUser = null;


// ============================================================
// INIT
// ============================================================
async function startApp() {
  try { localStorage.removeItem('mp_users'); } catch(e) {}
  // Load Gemini key from secure storage
  try { window._geminiKey = localStorage.getItem('mp_gemini_key') || ''; } catch(e) {}
  
  try {
    // 1. Create the connection
    window._mpdb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: { 'x-app-token': 'mtl-maint-2026-secure-token-x7k9p' } }
    });

    // 2. Link the names
    window.supabase = window._mpdb;
    
    setSyncStatus('online');
  } catch(e) { 
    console.warn('Supabase init failed:', e); 
  }

  // Hide banner
  if(document.getElementById('setup-banner')) {
    document.getElementById('setup-banner').style.display='none';
  }

  // Check saved session
  try {
    const sessionData = await validateSession();
    if(sessionData) {
      const profile = sessionData.profiles || (await window._mpdb.from('profiles').select('*').eq('username', sessionData.username).single()).data;
      if(profile && profile.status === 'approved') {
        const isAdmin = sessionData.username.toLowerCase() === ADMIN_USERNAME.toLowerCase();
        currentUser = { id: profile.id, name: profile.full_name || sessionData.username, role: isAdmin ? 'admin' : profile.role, username: sessionData.username };
       await fetchAbsences();  
       await enterApp(); return;
      }
    }

    // Fallback to old session for backwards compatibility
    const saved = localStorage.getItem('mp_session');
    if (saved) {
      const u = JSON.parse(saved);
      const { data: profile } = await window._mpdb.from('profiles').select('*').eq('username', u.username).single();
      if (profile && profile.status === 'approved') {
        const isAdmin = u.username.toLowerCase() === ADMIN_USERNAME.toLowerCase();
        currentUser = { ...u, role: isAdmin ? 'admin' : profile.role };
        await fetchAbsences();
       // Upgrade to token-based session
        await createSession(u.username, profile.id);
        await enterApp(); return;
      } else { 
        localStorage.removeItem('mp_session'); 
      }
    }
  } catch(e) {
    console.error("Session error:", e);
  }
  
showPinLogin();}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', startApp); } else { startApp(); }
window.addEventListener('online',  () => { document.getElementById('offline-banner').style.display='none';  setSyncStatus('online'); });
window.addEventListener('offline', () => { document.getElementById('offline-banner').style.display='block'; setSyncStatus('offline'); });

// ============================================================
// AUTH
// ============================================================
function togglePassVis(inputId, btnId) {
  const input = document.getElementById(inputId);
  document.getElementById(btnId).style.opacity = input.type==='password' ? '1' : '0.6';
  input.type = input.type==='password' ? 'text' : 'password';
}
function showLogin() {
    // 1. Reset the UI to show the Login stage
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('login-view').style.display = 'block';
    document.getElementById('register-view').style.display = 'none';
    document.getElementById('pending-view').style.display = 'none';
    
    // 2. Start the new PIN system flow
    showPinLogin(); 
}
function showRegister() {
  document.getElementById('login-view').style.display='none';
  document.getElementById('register-view').style.display='block';
  document.getElementById('auth-err').style.display='none';
  document.getElementById('auth-sub').textContent='Request access to MTL Maintenance';
}
function showPending() {
  document.getElementById('login-view').style.display='none';
  document.getElementById('register-view').style.display='none';
  document.getElementById('pending-view').style.display='block';
}
function showErr(msg) { const e=document.getElementById('auth-err'); e.textContent=msg; e.style.display='block'; }

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function doLogin() {
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
    let passwordMatch = false;
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

async function doRegister() {
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
      pin_code: pin // Saves directly to the new PIN column
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


async function signOut() {
  await destroySession();
  localStorage.removeItem('mp_session');
  currentUser=null;
  document.getElementById('app').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
  showLogin();
}
 let html5QrCode = null;

async function startQRScanner() {
  openModal('scan-modal');
  document.getElementById('qr-status').textContent = "Initializing camera...";
  
  // Create instance if it doesn't exist
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("qr-reader");
  }

  const config = { fps: 10, qrbox: { width: 250, height: 250 } };

  try {
    await html5QrCode.start(
      { facingMode: "environment" }, 
      config, 
      (decodedText) => {
        const url = new URL(decodedText);
        const equipId = url.searchParams.get("equip");
        if (equipId) {
          stopQRScanner();
          (equipId);
        } else {
          showToast("Invalid QR Code");
        }
      }
    );
    document.getElementById('qr-status').textContent = "Camera active. Point at QR code.";
  } catch (err) {
    console.error("Camera error:", err);
    document.getElementById('qr-status').textContent = "⚠️ Camera Error: " + err;
  }
}

// Fixed stop function to ensure modal ALWAYS closes
async function stopQRScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    try {
      await html5QrCode.stop();
    } catch (e) {
      console.warn("Scanner was already stopped or failed to stop.");
    }
  }
  closeModal('scan-modal');
  // Clear the internal state of the reader
  const reader = document.getElementById('qr-reader');
  if(reader) reader.innerHTML = ""; 
}
function quickLogHours(equipId) {
  const e = state.equipment.find(x => x.id === equipId);
  if (!e) return;

  // Set up the modal fields
  const idField = document.getElementById('lh-equip-id');
  const dateField = document.getElementById('lh-date');
  const valField = document.getElementById('lh-val');
  
  if (idField) idField.value = equipId;
  if (dateField) dateField.value = new Date().toISOString().split('T')[0];
  if (valField) valField.value = e.hours;
  
  const display = document.getElementById('lh-current-display');
  if (display) display.textContent = `Current: ${e.hours.toLocaleString()} hrs`;
  
  openModal('log-hours-modal');
}
// ============================================================
// STATE
// ============================================================
let state = { equipment:[], tasks:[], schedules:[], parts:[], suppliers:[], documents:[], partUsage:[], recurrenceRules:[], monthlyCosts:[0,0,0,0], tools:[], wishlist: []}; 

function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

async function loadState() {
  setSyncStatus('syncing');
  try {
    // 1. Fetch all 10 main tables (Matches the order in state)
    const [eq, tk, sc, pt, sup, docs, pu, rr, tl, wl] = await Promise.all([
      window._mpdb.from('equipment').select('*'),
      window._mpdb.from('tasks').select('*'),
      window._mpdb.from('schedules').select('*'),
      window._mpdb.from('parts').select('*'),
      window._mpdb.from('suppliers').select('*'),
      window._mpdb.from('documents').select('*'),
      window._mpdb.from('part_usage').select('*'),
      window._mpdb.from('recurrence_rules').select('*'),
      window._mpdb.from('shop_tools').select('*'),
      window._mpdb.from('tool_requests').select('*').order('created_at', {ascending: false})
    ]);

    state.equipment       = eq.data||[];
    state.tasks           = tk.data||[];
    state.schedules       = sc.data||[];
    state.parts           = pt.data||[];
    state.suppliers       = sup.data||[];
    state.documents       = docs.data||[];
    state.partUsage       = pu.data||[];
    state.recurrenceRules = rr.data||[];
    state.tools           = tl.data||[];
    state.wishlist        = wl.data||[];
    
    // 2. Load Profiles (Added 'show_sensitive_metrics' to the selection)
    const { data: profiles } = await window._mpdb.from('profiles')
        .select('id, username, full_name, role, group_tag, show_sensitive_metrics')
        .eq('status', 'approved');
    state.users_list_cache = profiles || [];

    // --- DASHBOARD PRIVACY SYNC ---
    // Find the current user in the profile list to get their preference
    const myProfile = state.users_list_cache.find(p => p.username === currentUser.username);
    if (myProfile && myProfile.show_sensitive_metrics !== undefined) {
        currentUser.show_sensitive_metrics = myProfile.show_sensitive_metrics;
    }
    // Apply the filter immediately so the UI knows what to hide
    if (typeof applyPrivacyFilters === 'function') {
        
    }
    // ------------------------------
const { data: templates } = await window._mpdb.from('checklist_templates').select('*');
if(templates && templates.length > 0) {
    state.checklistTemplates = templates;
}
    // 3. Calculate metrics
    state.monthlyCosts = computeMonthlyCosts();
    setSyncStatus('online');

  } catch(e) { 
    console.error('Load error:', e); 
    setSyncStatus('offline'); 
  }

  // 4. Load observations (kept separate for better performance)
  try {
    const { data: obs } = await window._mpdb.from('observations').select('*').order('created_at',{ascending:false});
    state.observations = obs || [];
  } catch(e) {}
}
function computeMonthlyCosts() {
  const now=new Date();
  return [3,2,1,0].map(ago=>{
    const d=new Date(now.getFullYear(),now.getMonth()-ago,1);
    const y=d.getFullYear(), m=d.getMonth();
    return state.tasks.filter(t=>{
      if(!t.due) return false;
      const td=new Date(t.due);
      return td.getFullYear()===y && td.getMonth()===m;
    }).reduce((a,t)=>a+(t.cost||0),0);
  });
}

function setSyncStatus(s) {
  const dot=document.getElementById('sync-dot'); if(!dot) return;
  dot.className='sync-dot'+(s==='syncing'?' syncing':s==='offline'?' offline':'');
}

// ============================================================
// RECURRENCE ENGINE
// ============================================================
async function runRecurrenceEngine() {
  const today=new Date(); today.setHours(0,0,0,0);
  for (const rule of state.recurrenceRules) {
    if (!rule.active) continue;
    let shouldGenerate=false;
    let nextDue=new Date(rule.next_due||today);
    if (rule.type==='calendar') {
      if (!rule.next_due || new Date(rule.next_due)<=today) shouldGenerate=true;
    } else if (rule.type==='hours') {
      const equip=state.equipment.find(e=>e.id===rule.equip_id);
      const lastHours=parseFloat(rule.last_generated_hours||0);
      if (equip && equip.hours>=(lastHours+(rule.runtime_hours||500))) shouldGenerate=true;
    }
    if (shouldGenerate) {
      // Create work order from template
      const wo={
        id: uid(),
        name: rule.name,
        equipId: rule.equip_id,
        assign: rule.template?.assign||'',
        priority: rule.priority||'High',
        due: nextDue.toISOString().slice(0,10),
        cost: 0, meter:'', status:'Open',
        notes: (rule.notes||'')+'\n[Auto-generated from recurrence rule]',
        photos:[], checklist:[],
      };
      // Check not already created for this period
      const exists=state.tasks.find(t=>t.name===rule.name && t.due===wo.due && t.equipId===rule.equip_id);
      if (!exists) {
        state.tasks.push(wo);
        await window._mpdb.from('tasks').upsert(wo);
        // Update rule next_due
        let next=new Date(nextDue);
        if (rule.interval_unit==='day')   next.setDate(next.getDate()+rule.interval_value);
        if (rule.interval_unit==='week')  next.setDate(next.getDate()+(rule.interval_value*7));
        if (rule.interval_unit==='month') next.setMonth(next.getMonth()+rule.interval_value);
        if (rule.interval_unit==='year')  next.setFullYear(next.getFullYear()+rule.interval_value);
        const equip=state.equipment.find(e=>e.id===rule.equip_id);
        await window._mpdb.from('recurrence_rules').update({
          next_due: next.toISOString().slice(0,10),
          last_generated: today.toISOString().slice(0,10),
          last_generated_hours: equip?.hours||0,
        }).eq('id', rule.id);
        rule.next_due=next.toISOString().slice(0,10);
      }
    }
  }
}

// ============================================================
// HELPERS
// ============================================================
const ICONS={Excavator:'🦾',Tractor:'🚜','Wheel Loader':'⚙','Skid Steer':'🔧',Compressor:'💨',Crane:'🏗',Compactor:'🔩',Truck:'🚛',Forklift:'🏭'};
const TODAY=new Date(); TODAY.setHours(0,0,0,0);
function fmtDate(d){ 
  if(!d)return'—'; 
  // Parse YYYY-MM-DD as local date to avoid UTC timezone shift
  if(typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d)){
    const [y,m,day]=d.split('-').map(Number);
    return new Date(y,m-1,day).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  }
  return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); 
}
function isOverdue(d){ 
  if(!d) return false;
  if(typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d)){
    const [y,m,day]=d.split('-').map(Number);
    return new Date(y,m-1,day)<TODAY;
  }
  return new Date(d)<TODAY;
}
function equipName(id){ const e=state.equipment.find(x=>x.id===id); return e?e.name:'—'; }
function supplierName(id){ const s=state.suppliers.find(x=>x.id===id); return s?s.name:'—'; }
function badge(s) {
  const m = {
    'Operational': 'bs',
    'In Service': 'bi',
    'Down': 'bd',
    'Standby': 'bg',
    'Completed': 'bs',
    'Open': 'bi',
    'Overdue': 'bd',
    'Critical': 'bd',
    'High': 'bw',
    'Medium': 'bi',
    'Low': 'bg',
    // ADD THESE TWO LINES:
    'In Progress': 'b-progress',
    'Waiting for Parts': 'b-parts'
  };
  return `<span class="badge ${m[s] || 'bg'}">${s}</span>`;
}
function healthColor(score){ return score>=80?'#3B6D11':score>=50?'#BA7517':'#E24B4A'; }
function calcHealth(equipId){
  const tasks=state.tasks.filter(t=>t.equipId===equipId);
  const overdue=tasks.filter(t=>t.status==='Overdue').length;
  const open=tasks.filter(t=>t.status==='Open').length;
  const e=state.equipment.find(x=>x.id===equipId);
  if (e?.status==='Down') return 20;
  let score=100;
  score-=overdue*20;
  score-=open*5;
  return Math.max(0,Math.min(100,score));
}
function showToast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2000); }
function viewPhoto(src){ document.getElementById('pv-img').src=src; document.getElementById('photo-viewer').classList.add('open'); }
function closePhotoViewer(){ document.getElementById('photo-viewer').classList.remove('open'); }

// MODALS
// ============================================================
function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'flex';
        el.classList.add('open');

        // Fill dropdowns if the modal needs them
        if (id === 'task-modal' || id === 'calendar-entry-modal') {
            populateSelects();
        }
    } else {
        console.error("Modal not found:", id);
    }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'none';
        el.classList.remove('open');
    }
}

// --- THE DROPDOWN PAINTER ---

function populateSelects() {
    // Check if the machine list exists
    if (!state.equipment || state.equipment.length === 0) {
        console.warn("PopulateSelects: No equipment in state yet.");
    }

    // 1. Define the option strings
    const equipOpts = state.equipment.map(e => 
        `<option value="${e.id}">${e.name}</option>`
    ).join('') || '<option value="">No equipment found</option>';

    const users = state.users_list_cache || [];
    const userOpts = '<option value="">— Unassigned —</option>' +
        users.map(u => `<option value="${u.full_name}">${u.full_name}</option>`).join('');

    // 2. Targets for Work Order Modal
    const tEquip = document.getElementById('t-equip');
    const tAssign = document.getElementById('t-assign');
    if (tEquip) { tEquip.innerHTML = equipOpts; }
    if (tAssign) { tAssign.innerHTML = userOpts; }

    // 3. Targets for Calendar/Entry Modal
    const ceEquip = document.getElementById('ce-equip');
    const ceAssign = document.getElementById('ce-assign');
    if (ceEquip) { ceEquip.innerHTML = equipOpts; }
    if (ceAssign) { ceAssign.innerHTML = userOpts; }

    // 4. Target for Equipment Filter
    const taskFilter = document.getElementById('task-equip-filter');
    if (taskFilter) {
        taskFilter.innerHTML = `<option value="all">All Equipment</option>` + equipOpts;
    }

    // 5. Target for Parts Select
    const pSel = document.getElementById('wo-part-select');
    if (pSel) {
        pSel.innerHTML = state.parts.map(p => 
            `<option value="${p.id}">${p.name} (Stock: ${p.qty})</option>`
        ).join('');
    }
} // <--- Ensure this bracket is here!
function switchWOTab(tab, btn) {
  // 1. Hide all sections
  const sections = ['wo-details', 'wo-checklist', 'wo-parts-tab', 'wo-comments', 'wo-attachments'];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // 2. Show selected section
  const active = document.getElementById('wo-' + tab);
  if (active) active.style.display = 'block';

  // 3. Update tabs
  document.querySelectorAll('#task-modal .tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // 4. Update the global variable (This matches the one we put at the top)
  currentWOTab = tab;
}
function switchTab(group, tab, btn){
  const modal=btn.closest('.modal');
  modal.querySelectorAll('[id]').forEach(el=>{
    if(['details-eq','custom-eq','assign-eq'].includes(el.id)) el.style.display='none';
  });
  const el=document.getElementById(tab); if(el) el.style.display='block';
  modal.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(tab==='assign-eq') renderAssignUsers();
  if(tab==='custom-eq') renderCustomFields();
}

// ============================================================
// PHOTOS
// ============================================================
let pendingPhotos = { task: [], equip: [], memorial: [], obs: [] };
let pendingDocFile=null;
function refreshPhotoGrid(key){
  const gridId = key==='task'?'task-photo-grid':'equip-photo-grid';
  const grid = document.getElementById(gridId); if(!grid) return;
  
  grid.innerHTML = pendingPhotos[key].map((src, i) => `
    <div style="position:relative; width:72px; height:72px">
      <img class="photo-thumb" src="${src}" onclick="viewPhoto('${src}')" style="width:100%; height:100%"/>
      <!-- THE MARKUP BUTTON -->
      <button onclick="initMarkup('${src}', '${key}', ${i})" 
              style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:3px; font-size:10px; padding:2px 4px; cursor:pointer">
              ✏️
      </button>
    </div>
  `).join('') +
  `<div class="photo-add" onclick="document.getElementById('${key}-photo-input').click()">+</div>` +
  `<input type="file" id="${key}-photo-input" accept="image/*" multiple style="display:none" onchange="handlePhotoUpload(this,'${key}')"/>`;
}
function handleDocUpload(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    pendingDocFile={data:e.target.result, type:file.type, name:file.name};
    document.getElementById('doc-file-preview').textContent='📎 '+file.name;
  };
  reader.readAsDataURL(file); input.value='';
}

// ============================================================
// DASHBOARD
// ============================================================
function updateMetrics(){
  const overdueCount = (state.tasks || []).filter(t => t.status === 'Overdue').length;
  const openCount = (state.tasks || []).filter(t => t.status === 'Open').length;
  const lowCount = (state.parts || []).filter(p => p.qty <= p.reorder).length;
  const currentMonthCost = (state.monthlyCosts || [0,0,0,0])[3] || 0;

  // SAFE HELPER: This prevents the app from crashing if a card is missing
  const safeSet = (id, val) => {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
  };

  safeSet('m-total', state.equipment.length);
  safeSet('m-parts', lowCount);
  safeSet('m-open', openCount);
  safeSet('r-month-cost', '$' + currentMonthCost.toLocaleString()); // Update Analytics Spend

  const mo = document.getElementById('m-overdue'); 
  if(mo) {
    const totalActive = openCount + overdueCount;
    mo.textContent = totalActive;
    mo.className = 'metric-value ' + (overdueCount > 0 ? 'v-danger' : totalActive > 0 ? 'v-warning' : 'v-success');
  }
}
async function renderEquipListDash(){
  const el = document.getElementById('equip-list-dash');
  if(!el) return;

  // 1. Get the list of machines based on current group filter
  const list = filteredEquipment(activeGroupFilter).slice(0, 8);
  
  // 2. Build the list rows
  el.innerHTML = list.map(e => {
    // Check if the machine is currently redlined (locked out)
    const isLocked = e.is_locked === true;
    
    return `
    <div class="equip-row" onclick="openEquipDetail('${e.id}')" 
         style="cursor:pointer; ${isLocked ? 'background:rgba(226,75,74,0.12); border-left:4px solid var(--danger)' : ''}">
      <div class="equip-info">
        <div class="equip-name" style="${isLocked ? 'color:var(--danger-text); font-weight:800' : ''}">
            ${isLocked ? '🚨 ' : ''}${e.name}
        </div>
        <div class="equip-meta">${e.hours.toLocaleString()} hrs · ${badge(e.status)}</div>
        <div id="dash-predict-${e.id}" style="font-size:11px; margin-top:2px"></div>
      </div>
      <div style="text-align:right">
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); quickLogHours('${e.id}')">⏱ Log</button>
      </div>
    </div>`;
  }).join('');

  // 3. Inject the Adaptive Predictions (Working Hours Left)
  for (const e of list) {
    try {
        const res = await getAdaptivePrediction(e.id);
        const pEl = document.getElementById(`dash-predict-${e.id}`);
        if (pEl && res) {
            if (res.status === 'ACTIVE') {
                pEl.innerHTML = `<span style="color:var(--warning); font-weight:700">⚠️ ~${res.hoursRemaining} hrs until service</span>`;
            } else if (res.status === 'OVERDUE') {
                pEl.innerHTML = `<span style="color:var(--danger); font-weight:700">🚨 SERVICE OVERDUE</span>`;
            } else if (res.status === 'PAUSED') {
                pEl.innerHTML = `<span style="color:var(--text3); font-style:italic">Maintenance Paused</span>`;
            }
        }
    } catch(err) { console.warn("Prediction failed for", e.name); }
  }
}
function renderSchedDash(){
  const el=document.getElementById('sched-list-dash');
  // Combine scheduled maintenance + open/overdue work orders
  const schedItems = state.schedules.filter(s=>{
    const [sy,sm,sd]=(s.date||'').split('-').map(Number);
    const d=sy?new Date(sy,sm-1,sd):new Date(s.date);
    return d>=TODAY;
  }).map(s=>({...s, _type:'schedule'}));
  
  const woItems = state.tasks.filter(t=>t.status!=='Completed'&&t.due).map(t=>({
    id:t.id, name:t.name, date:t.due, equipId:t.equipId,
    tech:t.assign, _type:'wo', status:t.status, priority:t.priority
  }));

  const combined = [...schedItems, ...woItems]
    .sort((a,b)=>{
      const [ay,am,ad]=(a.date||'').split('-').map(Number);
      const [by,bm,bd]=(b.date||'').split('-').map(Number);
      return new Date(ay,am-1,ad)-new Date(by,bm-1,bd);
    }).slice(0,6);

  el.innerHTML=combined.map(s=>{
    const [sy,sm,sd]=(s.date||'').split('-').map(Number);
    const d=sy?new Date(sy,sm-1,sd):new Date(s.date);
    const isWO = s._type==='wo';
    const isOverdueItem = isWO && isOverdue(s.date);
    return `<div class="sched-item" onclick="${isWO?`openTaskDetail('${s.id}')`:''}" style="${isWO?'cursor:pointer':''}">
      <div class="sched-date" style="background:${isOverdueItem?'var(--danger-bg)':isWO?'var(--accent-bg)':'var(--bg2)'}">
        <div class="sched-day" style="color:${isOverdueItem?'var(--danger)':isWO?'var(--accent)':''}">${d.getDate()}</div>
        <div class="sched-month">${d.toLocaleString('default',{month:'short'})}</div>
      </div>
      <div class="sched-body">
        <div class="sched-title">${s.name} ${isWO?`<span class="badge ${isOverdueItem?'bd':s.status==='Open'?'bi':'bg'}" style="font-size:10px">${isOverdueItem?'Overdue':s.status}</span>`:''}</div>
        <div class="sched-detail">${equipName(s.equipId)} · ${s.tech||'Unassigned'}${isWO&&s.priority?' · '+s.priority:s.dur?' · '+s.dur+'h':''}</div>
      </div>
    </div>`;
  }).join('')||'<div style="color:var(--text2);font-size:13px;padding:8px 0">No upcoming maintenance or work orders</div>';
}
function renderRecentTasks(){
  const recent=[...state.tasks].sort((a,b)=>new Date(b.due)-new Date(a.due)).slice(0,5);
  document.getElementById('task-count-badge').textContent=state.tasks.length+' work orders';
  document.getElementById('recent-tasks').innerHTML=recent.map(t=>{
    const partsUsed=state.partUsage.filter(p=>p.task_id===t.id).length;
    return `<div class="parts-row" onclick="openTaskDetail('${t.id}')">
      <div style="flex:1"><div style="font-weight:500">${t.name}</div><div style="font-size:11px;color:var(--text2)">${equipName(t.equipId)}${partsUsed?` · ${partsUsed} part(s) used`:''}</div></div>
      ${badge(t.status)}<div style="font-size:12px;color:var(--text2);min-width:52px;text-align:right">$${(t.cost||0).toLocaleString()}</div>
    </div>`;
  }).join('');
}
function renderCostChart() {
    const container = document.getElementById('cost-chart-large'); // The new ID in Analytics
    if (!container) return;

    const costs = state.monthlyCosts || [0, 0, 0, 0];
    const max = Math.max(...costs, 1);
    const colors = ['#B5D4F4', '#85B7EB', '#378ADD', '#185FA5'];
    const now = new Date();
    const labels = [3, 2, 1, 0].map(ago => {
        const d = new Date(now.getFullYear(), now.getMonth() - ago, 1);
        return MONTHS[d.getMonth()];
    });

    container.innerHTML = costs.map((v, i) => `
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:5px">
            <div style="font-size:11px; font-weight:700">$${v.toLocaleString()}</div>
            <div style="width:100%; border-radius:4px 4px 0 0; height:${Math.round(v / max * 100)}px; background:${colors[i]}"></div>
            <div style="font-size:11px; color:var(--text2)">${labels[i]}</div>
        </div>
    `).join('');
}
// ============================================================
// CALENDAR
// ============================================================
async function renderCalendar() {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    
    const titleEl = document.getElementById('cal-title');
    const daysEl = document.getElementById('cal-days');
    const headersEl = document.getElementById('cal-headers');
    if(!titleEl || !daysEl || !headersEl) return;

    titleEl.textContent = `${MONTHS[month]} ${year}`;
    
    // 1. Set Headers
    headersEl.innerHTML = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
        .map(d => `<div class="cal-header" style="font-weight:600; padding:5px">${d}</div>`).join('');
    
    // 2. Pre-Calculate Adaptive Forecasts
    for (let e of state.equipment) {
        try {
            const pred = await getAdaptivePrediction(e.id);
            e._predictedDate = (pred && pred.status === 'ACTIVE') ? 
                pred.predictedDate.toISOString().split('T')[0] : null;
        } catch(err) { e._predictedDate = null; }
    }

    // 3. Month Calculation
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    
    let cells = '';

    // 4. Padding (Previous Month)
    for(let i = firstDay - 1; i >= 0; i--){
        cells += `<div class="cal-day other-month" style="opacity:0.3"><div class="cal-day-num">${daysInPrev - i}</div></div>`;
    }

    // 5. Current Month Days
    for(let d = 1; d <= daysInMonth; d++){
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = new Date().toISOString().split('T')[0] === dateStr;
        
        // --- FETCH ALL DATA FOR THIS DAY ---
        const dayTasks = state.tasks.filter(t => t.due === dateStr);
        const dayScheds = state.schedules.filter(s => s.date === dateStr);
        const dayForecasts = state.equipment.filter(e => e._predictedDate === dateStr);
        const dayAbs = (staffAbsences || []).filter(a => a.start_date.split('T')[0] === dateStr);

        // --- MERGE EVERYTHING INTO THE HTML ARRAY ---
        const eventsHtml = [
            ...dayTasks.map(t => `<div class="cal-event work-order ${t.status.toLowerCase()}" onclick="openTaskDetail('${t.id}')">${t.name}</div>`),
            ...dayScheds.map(s => `<div class="cal-event scheduled">${s.name}</div>`),
            ...dayForecasts.map(e => `<div class="cal-event forecast">📈 Forecast: ${e.name}</div>`),
            ...dayAbs.map(a => {
                const statusText = a.is_all_day 
                    ? `👤 ${a.user_name} Out` 
                    : `👤 ${a.user_name} @ ${formatTime(a.partial_time)}`;
                    
                return `<div class="cal-event" onclick="event.stopPropagation(); openAbsenceDetail('${a.id}')" 
                        style="background:#fff3cd; color:#856404; border:1px solid #ffeeba; font-weight:600; font-size:10px; padding:2px; margin-top:2px; border-radius:4px;">
                        ${statusText}</div>`;
            })
        ].join('');

        cells += `
            <div class="cal-day${isToday ? ' today' : ''}" onclick="calDayClick('${dateStr}')">
                <div class="cal-day-num">${d}</div>
                <div class="cal-event-container">${eventsHtml}</div>
            </div>`;
    }

    daysEl.innerHTML = cells;

    // 6. Refresh Sidebars
    if (typeof renderMonthSchedList === 'function') {
        try { renderMonthSchedList(); } catch(e) { console.warn("Side list failed"); }
    }
    if (typeof renderRecurList === 'function') {
        try { renderRecurList(); } catch(e) { console.warn("Recur list failed"); }
    }
  
    // RUN ADAPTIVE MATH (BACKGROUND)
    if (typeof fillAdaptiveCalendarMarkers === 'function') {
        fillAdaptiveCalendarMarkers(year, month);
    }
    
    console.log("Calendar Render: Success ✓");
}
function formatTime(timeStr) {
    if(!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hrs = parseInt(h);
    const suffix = hrs >= 12 ? 'PM' : 'AM';
    return `${((hrs + 11) % 12 + 1)}:${m} ${suffix}`;
}

async function fillAdaptiveCalendarMarkers(year, month) {
    for (let e of state.equipment) {
        try {
            // We only look for predictions if the machine has a rule
            const hasRule = state.recurrenceRules.some(r => r.equip_id === e.id && r.type === 'hours');
            if (!hasRule) continue;

            const pred = await getAdaptivePrediction(e.id);
            if (pred && pred.status === 'ACTIVE') {
                const predDateStr = pred.predictedDate.toISOString().split('T')[0];
                const container = document.getElementById(`forecast-box-${predDateStr}`);
                if (container) {
                    container.innerHTML += `<div class="cal-event" style="background:#FAEEDA; color:#854F0B; border:1px dashed #BA7517; font-size:9px; padding:2px">📈 Forecast: ${e.name}</div>`;
                }
            }
        } catch (err) {
            console.warn("Forecast skipped for:", e.name);
        }
    }
}
// Background function to add orange boxes
async function fillAdaptiveForecasts() {
    for (let e of state.equipment) {
        const pred = await getAdaptivePrediction(e.id);
        if (pred && pred.status === 'ACTIVE') {
            const dateStr = pred.predictedDate.toISOString().split('T')[0];
            const target = document.getElementById(`forecast-container-${dateStr}`);
            if (target) {
                target.innerHTML += `<div class="cal-event" style="background:#FAEEDA; color:#854F0B; border:1px dashed #BA7517; font-size:9px">📈 Forecast: ${e.name}</div>`;
            }
        }
    }
}
function renderMonthSchedList() {
    const list = document.getElementById('sched-month-list');
    if(!list) return;
    
    // Sort by date
    const sorted = [...state.schedules].sort((a,b) => new Date(a.date) - new Date(b.date));

    list.innerHTML = sorted.map(s => `
        <div class="sched-item" style="padding:8px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center">
            <div class="sched-body">
                <div style="font-weight:600; font-size:13px">${s.name}</div>
                <div style="font-size:11px; color:var(--text3)">${equipName(s.equipId)} · ${fmtDate(s.date)}</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="deleteSched('${s.id}')">✕</button>
        </div>`).join('') || '<div style="color:var(--text3); font-size:12px; padding:10px">Nothing scheduled.</div>';
}

function calPrev() { calDate.setMonth(calDate.getMonth() - 1); renderCalendar(); }
function calNext() { calDate.setMonth(calDate.getMonth() + 1); renderCalendar(); }
function calToday() { calDate = new Date(); renderCalendar(); }
function calDayClick(dateStr) {
    lastClickedDate = dateStr; // Store '2026-04-23'
    
    // Format the date for the title (e.g. "Thu, Apr 23")
    const dateObj = new Date(dateStr + "T00:00:00");
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    document.getElementById('action-modal-readable').textContent = dateObj.toLocaleDateString('en-US', options);
    
    // Show the modal
    document.getElementById('cal-action-modal').style.display = 'block';
}

function triggerAddEntryFromCal() {
    document.getElementById('cal-action-modal').style.display = 'none';
    
    // 1. Open the modal
    if (typeof openModal === 'function') {
        openModal('calendar-entry-modal'); 
    } else {
        const m = document.getElementById('calendar-entry-modal');
        if (m) m.style.display = 'block';
    }

    // 2. Try to reset, but wrap it in a 'try/catch' so if it fails, 
    // the date still gets filled in anyway.
    try {
        if (typeof populateSelects === 'function') populateSelects(); 
        if (typeof resetCalModal === 'function') resetCalModal();
    } catch (e) {
        console.warn("Reset/Populate failed, but continuing anyway:", e);
    }

    // 3. AUTO-FILL the date
    const dateInput = document.getElementById('cal-date') || document.getElementById('task-due');
    if (dateInput) {
        dateInput.value = lastClickedDate;
    }
}
// Function 2: Open the Absence Modal with the date filled
function triggerAbsenceFromCal() {
    document.getElementById('cal-action-modal').style.display = 'none';
    
    openAbsenceModal();

    // AUTO-FILL the 'Which Day?' input we made earlier
    const absDateInput = document.getElementById('abs-date');
    if (absDateInput) {
        absDateInput.value = lastClickedDate;
        // Trigger the check function so the 'All Day/Partial' options show up automatically
        if (typeof checkDateSelection === 'function') checkDateSelection(lastClickedDate);
    }
}
function toggleRecurType(){
  const t=document.getElementById('r-type').value;
  document.getElementById('r-interval-group').style.display=t==='calendar'?'block':'none';
  document.getElementById('r-hours-group').style.display=t==='hours'?'block':'none';
}
function renderRecurList() {
    const list = document.getElementById('recur-list');
    if(!list) return;
    
    list.innerHTML = state.recurrenceRules.map(r => `
        <div class="recur-item" style="padding:8px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center">
            <div style="flex:1">
                <div style="font-weight:600; font-size:13px">${r.name}</div>
                <div style="font-size:11px; color:var(--text3)">${equipName(r.equip_id)} · Every ${r.runtime_hours || r.interval_value} ${r.type === 'hours' ? 'hrs' : r.interval_unit}</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="deleteRecurRule('${r.id}')">✕</button>
        </div>`).join('') || '<div style="color:var(--text3); font-size:12px; padding:10px">No rules set.</div>';
}
// ============================================================
// EQUIPMENT
// ============================================================
function renderEquipmentTable(){
  const equip = equipGroupFilter==='all' ? state.equipment : state.equipment.filter(e=>e.group_tag===equipGroupFilter||e.group_tag==='both');
  document.getElementById('equip-table-body').innerHTML=equip.map(e=>{
    const score=calcHealth(e.id);
    const icon=e.photos&&e.photos.length?`<img src="${e.photos[0]}" style="width:100%;height:100%;object-fit:cover"/>` : (ICONS[e.type]||'⚙');
    return `<tr onclick="openEquipDetail('${e.id}')">
      <td><div style="display:flex;align-items:center;gap:9px">
        <div class="equip-icon" style="width:32px;height:32px">${icon}</div>
        <div><div style="font-weight:500">${e.name}</div><div style="font-size:11px;color:var(--text2)">${e.serial}</div></div>
      </div></td>
      <td>${badge(e.status)}</td>
      <td><b>${e.hours.toLocaleString()}</b> hrs</td>
      <td>
        <div class="health-bar"><div class="health-fill" style="width:${score}%;background:${healthColor(score)}"></div></div>
        <span style="font-size:11px;color:${healthColor(score)};font-weight:600">${score}%</span>
      </td>
      <td style="color:var(--text2);font-size:12px">${(e.assigned_users||[]).join(', ')||e.op||'—'}</td>
      <td style="font-size:12px;color:var(--text2)">${getLastService(e.id)}</td>
      <td style="font-size:12px">${getNextDue(e.id)}</td>
      <td onclick="event.stopPropagation()">
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${e.status!=='Down'?`<button class="btn btn-danger btn-sm" onclick="updateEquipStatus('${e.id}','Down')">↓ Down</button>`:`<button class="btn btn-success btn-sm" onclick="updateEquipStatus('${e.id}','Operational')">↑ Up</button>`}
          ${currentUser?.role==='admin'?`<button class="btn btn-secondary btn-sm" onclick="printQRCode('${e.id}')">QR</button>`:''}
          ${can('canDelete')?`<button class="btn btn-danger btn-sm" onclick="deleteEquip('${e.id}')">Del</button>`:''}
        </div>
      </td>
    </tr>`;
  }).join('');
}
function getLastService(id){ const d=state.tasks.filter(t=>t.equipId===id&&t.status==='Completed'); return d.length?fmtDate(d.sort((a,b)=>new Date(b.due)-new Date(a.due))[0].due):'—'; }
function getNextDue(id){ const o=state.tasks.filter(t=>t.equipId===id&&t.status!=='Completed'); if(!o.length)return'—'; const n=o.sort((a,b)=>new Date(a.due)-new Date(b.due))[0]; return `<span style="color:${isOverdue(n.due)?'var(--danger)':'inherit'}">${fmtDate(n.due)}</span>`; }
async function deleteEquip(id) {
  const e = state.equipment.find(x => x.id === id);
  if (!e) return;

  if (!confirm(`Permanently delete ${e.name}? This will also delete all its Work Orders, History, and Zerk Maps.`)) {
    return;
  }
 logAuditAction("Deleted Machine", `Removed ${e.name} (S/N: ${e.serial})`);
  try {
    // 1. Send delete command to Supabase
    // Because of the SQL change in Step 1, this will now work!
    const { error } = await window._mpdb
      .from('equipment')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // 2. Remove from local memory
    state.equipment = state.equipment.filter(eq => eq.id !== id);
    
    // 3. Update Audit Log
    if (typeof logAuditAction === 'function') {
        logAuditAction("Deleted Machine", `${e.name} removed from fleet`);
    }

    // 4. Refresh UI
    renderEquipmentTable();
    renderDashboard();
    showToast(`${e.name} removed ✓`);
    
  } catch (e) {
    console.error("Delete failed:", e);
    showToast("Error: Could not delete machine. Check Console.");
  }
}
// Custom fields
let customFieldsTemp={};
function renderCustomFields(){
  const list=document.getElementById('custom-fields-list'); if(!list)return;
  list.innerHTML=Object.entries(customFieldsTemp).map(([k,v])=>
    `<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
      <input class="form-input" value="${k}" style="flex:1" placeholder="Field name" onchange="customFieldsTemp['${k}']=undefined;delete customFieldsTemp['${k}'];customFieldsTemp[this.value]='${v}'"/>
      <input class="form-input" value="${v}" style="flex:1" placeholder="Value" onchange="customFieldsTemp['${k}']=this.value"/>
      <button class="btn btn-danger" onclick="delete customFieldsTemp['${k}'];renderCustomFields()">✕</button>
    </div>`
  ).join('');
}
function addCustomField(){ customFieldsTemp['New Field '+Object.keys(customFieldsTemp).length]='' ; renderCustomFields(); }

// Assign users
let assignedUsersTemp=[];
function renderAssignUsers(){
  const list=document.getElementById('assign-users-list'); if(!list)return;
  list.innerHTML='<div style="color:var(--text2);font-size:13px">Enter usernames to assign (comma separated):</div><input class="form-input" id="assign-input" placeholder="e.g. mike, sarah" style="margin-top:8px;width:100%" value="'+assignedUsersTemp.join(', ')+'"/>';
}

// ============================================================
// WORK ORDERS
// ============================================================
function renderTasks(){
  // We check the filter. If no filter is selected yet, we'll default to 'active'
  const f = document.getElementById('task-filter')?.value || 'active';
  const ef = document.getElementById('task-equip-filter')?.value || 'all';
  
  let tasks = [...state.tasks];

  // Logic: If 'all' or no filter is selected, HIDE completed tasks
  if(f === 'all' || f === 'active') {
    tasks = tasks.filter(t => t.status !== 'Completed');
  } else if(f === 'overdue') {
    tasks = tasks.filter(t => t.status === 'Overdue' || (isOverdue(t.due) && t.status !== 'Completed'));
  } else if(f === 'open') {
    tasks = tasks.filter(t => t.status === 'Open');
  } else if(f === 'completed') {
    tasks = tasks.filter(t => t.status === 'Completed');
  }

  if(ef !== 'all') {
    tasks = tasks.filter(t => t.equipId === ef);
  }

  // Sort: Overdue at top, then Open, then alphabetical
  tasks.sort((a,b) => {
    const o = { Overdue: 0, Open: 1, Completed: 2 };
    return (o[a.status] || 1) - (o[b.status] || 1);
  });

  document.getElementById('tasks-table-body').innerHTML = tasks.map(t => {
    const partsUsed = state.partUsage.filter(p => p.task_id === t.id).reduce((a, p) => a + p.qty_used, 0);
    const isActuallyOverdue = isOverdue(t.due) && t.status !== 'Completed';
    
    return `<tr onclick="openTaskDetail('${t.id}')">
      <td><div style="font-weight:500">${t.name}</div><div style="font-size:11px;color:var(--text2)">${t.meter || ''}</div></td>
      <td style="font-size:12px">${equipName(t.equipId)}</td>
      <td>${badge(t.priority)}</td>
      <td style="color:var(--text2)">${t.assign || '—'}</td>
      <td style="color:${isActuallyOverdue ? 'var(--danger)' : 'inherit'};font-size:12px">${fmtDate(t.due)}</td>
      <td style="font-weight:600">$${(t.cost || 0).toLocaleString()}</td>
      <td style="font-size:12px">${partsUsed ? partsUsed + ' unit(s)' : '—'}</td>
      <td>${badge(isActuallyOverdue ? 'Overdue' : t.status)}</td>
      <td onclick="event.stopPropagation()"><button class="btn btn-danger" onclick="deleteTask('${t.id}')">Del</button></td>
    </tr>`;
  }).join('');
}
async function deleteTask(id){
  if(!confirm('Delete this work order?'))return;
  // THE LOG (Do this BEFORE deleting so we still have the name)
  logAuditAction("Deleted WO", `Removed "${task.name}" for ${equipName(task.equipId)}`);

  const task = state.tasks.find(t=>t.id===id);
  // Delete linked observation - try obs_id first, then fallback to name matching
  if(task && task.notes && task.notes.startsWith('Auto-created from critical obs')) {
    let obsToDelete = null;
    if(task.obs_id) {
      obsToDelete = state.observations.find(o=>o.id===task.obs_id);
    }
    if(!obsToDelete) {
      // Fallback: match by equip and author in notes
      obsToDelete = state.observations.find(o=>
        o.equip_id===task.equipId && o.severity==='critical' &&
        task.notes.includes(o.author)
      );
    }
    if(obsToDelete) {
      try {
        await window._mpdb.from('observations').delete().eq('id', obsToDelete.id);
        state.observations = state.observations.filter(o=>o.id!==obsToDelete.id);
        showToast('Work order and linked observation deleted');
      } catch(e) {}
    }
  }
  state.tasks=state.tasks.filter(t=>t.id!==id);
  await persist('tasks','delete',{id});
  renderTasks(); renderDashboard();
}

// ============================================================
// SCHEDULE
// ============================================================
async function deleteSched(id){ state.schedules=state.schedules.filter(s=>s.id!==id); await persist('schedules','delete',{id}); renderSchedule(); renderCalendar(); }

// ============================================================
// PARTS
// ============================================================
function renderParts(){
  const reorderAlerts=state.parts.filter(p=>p.qty<=p.reorder&&p.auto_reorder);
  document.getElementById('reorder-alerts').innerHTML=reorderAlerts.map(p=>
    `<div class="alert alert-w">🔄 <b>Auto-reorder triggered:</b> ${p.name} — stock at ${p.qty}, reorder qty: ${p.reorder_qty||10}</div>`
  ).join('');
  document.getElementById('parts-table-body').innerHTML=state.parts.map(p=>{
    const out=p.qty===0, low=p.qty<=p.reorder;
    const sup=supplierName(p.supplier_id);
    return `<tr>
      <td style="font-weight:500">${p.name}</td>
      <td style="font-size:12px;color:var(--text2)">${p.num}</td>
      <td style="font-size:12px;color:var(--text2)">${sup}</td>
      <td style="font-weight:600;color:${out?'var(--danger)':low?'var(--warning)':'inherit'}">${p.qty}</td>
      <td style="color:var(--text2)">${p.reorder}</td>
      <td>$${p.cost}</td>
      <td style="font-weight:600">$${(p.qty*p.cost).toLocaleString()}</td>
      <td><span class="badge ${p.auto_reorder?'bs':'bg'}">${p.auto_reorder?'On':'Off'}</span></td>
      <td><span class="badge ${out?'bd':low?'bw':'bs'}">${out?'Out':low?'Low':'OK'}</span></td>
      <td onclick="event.stopPropagation()"><button class="btn btn-danger" onclick="deletePart('${p.id}')">Del</button></td>
    </tr>`;
  }).join('');
}
async function deletePart(id){ if(!confirm('Delete this part?'))return; state.parts=state.parts.filter(p=>p.id!==id); await persist('parts','delete',{id}); renderParts(); updateMetrics(); }

// ============================================================
// SUPPLIERS
// ============================================================
function renderSuppliers(){
  document.getElementById('supplier-table-body').innerHTML=state.suppliers.map(s=>{
    const partCount=state.parts.filter(p=>p.supplier_id===s.id).length;
    return `<tr onclick="openSupplierDetail('${s.id}')">
      <td style="font-weight:500">${s.name}</td>
      <td style="color:var(--text2)">${s.contact||'—'}</td>
      <td><a href="mailto:${s.email}" onclick="event.stopPropagation()" style="color:var(--accent)">${s.email||'—'}</a></td>
      <td style="color:var(--text2)">${s.phone||'—'}</td>
      <td><a href="${s.website}" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent)">${s.website?'Visit':'—'}</a></td>
      <td><span class="badge bg">${partCount} part${partCount!==1?'s':''}</span></td>
      <td onclick="event.stopPropagation()"><button class="btn btn-danger" onclick="deleteSupplier('${s.id}')">Del</button></td>
    </tr>`;
  }).join('');
}
async function deleteSupplier(id){ if(!confirm('Delete this supplier?'))return; state.suppliers=state.suppliers.filter(s=>s.id!==id); await persist('suppliers','delete',{id}); renderSuppliers(); }

// ============================================================
// DOCUMENTS
// ============================================================
function renderDocuments(){
  const now=new Date(); const soon=new Date(now.getTime()+30*24*60*60*1000);
  const expiring=state.documents.filter(d=>d.expiry_date&&new Date(d.expiry_date)<=soon);
  document.getElementById('doc-expiry-alerts').innerHTML=expiring.map(d=>
    `<div class="alert ${new Date(d.expiry_date)<now?'alert-d':'alert-w'}">
      ${new Date(d.expiry_date)<now?'⚠ EXPIRED:':'📅 Expiring soon:'} <b>${d.name}</b> — ${fmtDate(d.expiry_date)}
    </div>`
  ).join('');
  const warranties=state.documents.filter(d=>d.type==='warranty');
  const others=state.documents.filter(d=>d.type!=='warranty');
  const mkDoc=d=>{
    const equip=d.equip_id?equipName(d.equip_id):'';
    const expired=d.expiry_date&&new Date(d.expiry_date)<now;
    return `<div class="doc-item" onclick="openDocDetail('${d.id}')">
      <div class="doc-icon">${d.type==='warranty'?'🛡':d.type==='certificate'?'📜':d.type==='manual'?'📖':'📄'}</div>
      <div class="doc-info">
        <div class="doc-name">${d.name}</div>
        <div class="doc-meta">${equip?equip+' · ':''}${d.expiry_date?'Expires: '+fmtDate(d.expiry_date):'No expiry'}</div>
      </div>
      ${expired?'<span class="badge bd">Expired</span>':d.expiry_date&&new Date(d.expiry_date)<=soon?'<span class="badge bw">Expiring</span>':''}
      <button class="btn btn-danger" onclick="event.stopPropagation();deleteDoc('${d.id}')">Del</button>
    </div>`;
  };
  document.getElementById('warranty-list').innerHTML=warranties.map(mkDoc).join('')||'<div style="color:var(--text2);font-size:13px;padding:8px 0">No warranties added</div>';
  document.getElementById('doc-list').innerHTML=others.map(mkDoc).join('')||'<div style="color:var(--text2);font-size:13px;padding:8px 0">No documents added</div>';
}
async function deleteDoc(id){ if(!confirm('Delete this document?'))return; state.documents=state.documents.filter(d=>d.id!==id); await persist('documents','delete',{id}); renderDocuments(); }

// ============================================================
// ANALYTICS
// ============================================================

async function renderAnalytics() {
  console.log("Analytics: Starting render...");
  
  // 1. Core Calculations
  const completed = state.tasks.filter(t => t.status === 'Completed');
  const totalYTD = state.tasks.reduce((a, t) => a + (t.cost || 0), 0);
  const avgCost = completed.length ? Math.round(totalYTD / completed.length) : 0;
  const invValue = state.parts.reduce((a, p) => a + (p.qty * p.cost), 0);
  const totalPartsUsed = state.partUsage.reduce((a, p) => a + p.qty_used, 0);
  const fleetHealth = state.equipment.length ? 
    Math.round(state.equipment.reduce((a, e) => a + calcHealth(e.id), 0) / state.equipment.length) : 100;

  // 2. Update Metric Cards Safely
  const safeSet = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  safeSet('r-ytd', '$' + totalYTD.toLocaleString());
  safeSet('r-avg', '$' + avgCost.toLocaleString());
  safeSet('r-done', completed.length);
  safeSet('r-inv', '$' + invValue.toLocaleString());
  safeSet('r-parts-used', totalPartsUsed);
  safeSet('r-health', fleetHealth + '%');

  // 3. Run Sub-Renderers (The Specialists)
  // Each of these handles its own specific chart or list
  try {
    renderCostChart();            // Monthly Spend Bars
    renderCostByEquip();          // Horizontal Bars per machine
    renderPlannedVsUnplanned();
    renderTaskBreakdown();        // WO status bars
    renderHealthScores();         // Individual machine health
    renderTopPartsUsed();         // Most common parts
    await renderDowntimeStats();  // NEW: Downtime & Uptime
    await renderServiceForecast();// NEW: Adaptive 30-day projection
  } catch (e) {
    console.error("One or more charts failed to load:", e);
  }
}
// ============================================================
// ADMIN
// ============================================================

// ============================================================
// DETAIL VIEWS
// ============================================================
async function openTaskDetail(id){
  const t=state.tasks.find(x=>x.id===id); if(!t)return;
  // Load comments
  let comments=[];
  try { const {data}=await window._mpdb.from('wo_comments').select('*').eq('task_id',id).order('created_at',{ascending:true}); comments=data||[]; } catch(e){}
  const partsUsed=state.partUsage.filter(p=>p.task_id===id);
  const done=t.checklist.filter(c=>c.done).length;
  const photoHtml=t.photos&&t.photos.length?`<div class="photo-grid">${t.photos.map(src=>`<img class="photo-thumb" src="${src}" onclick="viewPhoto('${src}')"/>`).join('')}</div>`:'';
  document.getElementById('detail-title').textContent=t.name;
  document.getElementById('detail-body').innerHTML=`
    <div class="tab-bar">
      <button class="tab active" onclick="switchDetailTab('dt-info',this)">Info</button>
      <button class="tab" onclick="switchDetailTab('dt-checklist',this)">Checklist (${done}/${t.checklist.length})</button>
      <button class="tab" onclick="switchDetailTab('dt-parts',this)">Parts (${partsUsed.length})</button>
      <button class="tab" onclick="switchDetailTab('dt-comments',this)">Comments (${comments.length})</button>
      ${photoHtml?`<button class="tab" onclick="switchDetailTab('dt-photos',this)">Photos</button>`:''}
    </div>
    <div id="dt-info">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;font-size:13px">
        <div><span style="color:var(--text2)">Equipment:</span> <b>${equipName(t.equipId)}</b></div>
        <div><span style="color:var(--text2)">Assigned:</span> ${t.assign||'—'}</div>
        <div><span style="color:var(--text2)">Priority:</span> ${badge(t.priority)}</div>
        <div><span style="color:var(--text2)">Status:</span> ${badge(t.status)}</div>
        <div><span style="color:var(--text2)">Due:</span> <span style="color:${isOverdue(t.due)&&t.status!=='Completed'?'var(--danger)':'inherit'}">${fmtDate(t.due)}</span></div>
        <div><span style="color:var(--text2)">Cost:</span> <b>$${(t.cost||0).toLocaleString()}</b></div>
        <div><span style="color:var(--text2)">Meter:</span> ${t.meter||'—'}</div>
      </div>
      ${t.notes?`<div style="font-size:13px;color:var(--text2);background:var(--bg2);padding:9px 11px;border-radius:var(--radius);margin-bottom:12px">${t.notes}</div>`:''}
      ${t.tools?`<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text3);letter-spacing:.5px;margin-bottom:6px">🔧 Tools Required</div><div style="font-size:13px;background:var(--bg2);padding:9px 11px;border-radius:var(--radius)">${t.tools}</div></div>`:''}
    </div>
    <div id="dt-checklist" style="display:none">
      ${t.checklist.map((c,i)=>`<div class="check-item${c.done?' done':''}" onclick="toggleCheck('${t.id}',${i})">
        <div class="check-box" style="${c.done?'background:var(--text);border-color:var(--text);color:var(--bg)':''}">${c.done?'&#10003;':''}</div><span class="check-label">${c.text}</span>
      </div>`).join('')||'<div style="color:var(--text3);font-size:13px">No checklist items</div>'}
    </div>
    <div id="dt-parts" style="display:none">
      ${partsUsed.map(p=>`<div class="parts-row">
        <div style="flex:1"><div style="font-weight:500">${p.part_name}</div><div style="font-size:11px;color:var(--text2)">Used by ${p.used_by||'—'} · ${new Date(p.used_at).toLocaleDateString()}</div></div>
        <span class="badge bg">Qty: ${p.qty_used}</span>
      </div>`).join('')||'<div style="color:var(--text3);font-size:13px">No parts logged</div>'}
    </div>
    <div id="dt-comments" style="display:none">
      <div id="dt-comment-list">
        ${comments.map(c=>`<div class="comment"><div class="comment-author">${c.author||'Unknown'}<span class="comment-time">${new Date(c.created_at).toLocaleString()}</span></div><div class="comment-body">${c.body}</div></div>`).join('')||'<div style="color:var(--text3);font-size:13px;margin-bottom:12px">No comments yet</div>'}
      </div>
      <textarea class="form-textarea" id="dt-comment-input" placeholder="Add a comment..." style="margin-top:8px"></textarea>
      <button class="btn btn-secondary btn-sm" style="margin-top:6px" onclick="postDetailComment('${t.id}')">Post Comment</button>
    </div>
    ${photoHtml?`<div id="dt-photos" style="display:none">${photoHtml}</div>`:''}
    
    <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;flex-wrap:wrap">
 ${t.status!=='Completed'?`<button class="btn btn-primary" onclick="markComplete('${t.id}')">✓ Mark Complete</button>`:'<span class="badge bs">Completed</span>'}
      <button class="btn btn-secondary" onclick="closeModal('detail-modal')">Close</button>
    </div>`;
  openModal('detail-modal');
}
function switchDetailTab(tab, btn){
  const modal = document.getElementById('detail-modal');
  if(!modal) return;

  // 1. Hide all tab-content divs
  const contents = modal.querySelectorAll('.tab-content');
  contents.forEach(c => c.style.display = 'none');

  // 2. Show the specific tab clicked
  const el = document.getElementById(tab);
  if(el) el.style.display = 'block';

  // 3. Highlight button
  modal.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // 4. TRIGGER DATA RELOADS
  const id = window._currentDetailEquipId;
  if(!id) return;

  if(tab === 'eq-overview') { renderMiniTimeline(id); renderQuickSpecs(id); }
  if(tab === 'eq-history') renderFullHistoryList(id);
  if(tab === 'eq-obs') refreshObsList(id);
  if(tab === 'eq-zerks') refreshZerkMap(id);
  if(tab === 'eq-invoices') renderInvoicesList(id);
  if(tab === 'eq-docs') renderDocsList(id);
}

// Small helper for the downtime display logic inside the detail view
function renderDowntimeTab(equipId) {
    const dtContent = document.getElementById('eq-downtime-content');
    if(dtContent) {
        const dt = getEquipDowntime(equipId);
        const activeMins = dt.activeDown ? Math.round((new Date() - new Date(dt.activeDown.startedAt)) / 60000) : 0;
        dtContent.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:14px">
                <div class="metric-card"><div class="metric-label">Total Downtime</div><div class="metric-value">${formatDuration(dt.totalMins) || 'None'}</div></div>
                <div class="metric-card"><div class="metric-label">Events</div><div class="metric-value">${dt.entries.length}</div></div>
                <div class="metric-card"><div class="metric-label">Status</div><div class="metric-value">${dt.activeDown ? 'DOWN' : 'Operational'}</div></div>
            </div>
            ${dt.entries.length ? `
                <table style="width:100%; border-collapse:collapse; font-size:13px">
                    <thead><tr><th style="text-align:left; padding:5px">Date</th><th style="text-align:left; padding:5px">Duration</th></tr></thead>
                    <tbody>${dt.entries.map(d => `<tr><td style="padding:6px 5px; border-bottom:1px solid var(--border)">${new Date(d.startedAt).toLocaleDateString()}</td><td style="padding:6px 5px; border-bottom:1px solid var(--border); font-weight:600">${formatDuration(d.downtimeMins)}</td></tr>`).join('')}</tbody>
                </table>` : '<div style="color:var(--text3); font-size:13px; padding:8px 0">No downtime recorded</div>'}`;
    }
}

async function postDetailComment(taskId){
  const body=document.getElementById('dt-comment-input').value.trim(); if(!body) return;
  const comment={id:uid(),task_id:taskId,author:currentUser.name,body,created_at:new Date().toISOString()};
  try {
    await window._mpdb.from('wo_comments').insert(comment);
    showToast('Comment posted');
    openTaskDetail(taskId);
  } catch(e){ showToast('Failed to post comment'); }
}

async function toggleCheck(taskId,idx){
  const t=state.tasks.find(x=>x.id===taskId); if(!t)return;
  t.checklist[idx].done=!t.checklist[idx].done;
  await persist('tasks','upsert',t); openTaskDetail(taskId);
}
function openEquipDetail(id){
  const e = state.equipment.find(x => x.id === id); 
  if(!e) return;
  
  window._currentDetailEquipId = id;
  const score = calcHealth(id);

  document.getElementById('detail-title').textContent = e.name;
  
  document.getElementById('detail-body').innerHTML = `
    <!-- QUICK NAVIGATION -->
    <div class="tab-bar" style="overflow-x: auto; white-space: nowrap; margin-bottom: 15px; display: flex; gap: 4px;">
      <button class="tab active" onclick="switchDetailTab('eq-overview',this)">Overview</button>
      <button class="tab" onclick="switchDetailTab('eq-zerks',this)">Zerk Map</button>
      <button class="tab" onclick="switchDetailTab('eq-history',this)">Full History</button>
      <button class="tab" onclick="switchDetailTab('eq-obs',this)">Observations</button>
      <button class="tab" onclick="switchDetailTab('eq-invoices',this)">Invoices</button>
      <button class="tab" onclick="switchDetailTab('eq-docs',this)">Docs</button>
    </div>

    <!-- 1. OVERVIEW VIEW -->
    <div id="eq-overview" class="tab-content">
      <div class="eq-dash-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px;">
        
        <!-- Widget: Machine Status -->
        <div class="eq-widget" id="status-widget-${e.id}" style="background: ${e.is_locked ? '#FCEBEB' : 'var(--bg2)'}; border: 1px solid ${e.is_locked ? '#E24B4A' : 'var(--border)'}; border-radius: 8px; padding: 12px; transition: all 0.3s">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; border-bottom: 1px solid ${e.is_locked ? 'rgba(226,75,74,0.2)' : 'var(--border)'}; padding-bottom: 5px;">
            <span style="font-size: 11px; font-weight: 700; color: ${e.is_locked ? 'var(--danger-text)' : 'var(--text2)'}; text-transform: uppercase;">Status</span>
            <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:10px; font-weight:700; color:${e.is_locked ? 'var(--danger-text)' : 'var(--text3)'}">
                <input type="checkbox" ${e.is_locked ? 'checked' : ''} onchange="toggleLockout('${e.id}', this.checked)"/> 🚨 LOCKOUT
            </label>
          </div>
          <div style="font-size: 13px; line-height: 2;">
            <div id="lock-warning-${e.id}" style="display: ${e.is_locked ? 'block' : 'none'}; color:var(--danger-text); font-weight:700; margin-bottom:8px">⚠️ DANGER: ${e.lock_reason || ''}</div>
            <div>Status: ${badge(e.status)}</div>
            <div>Meter: <b>${e.hours.toLocaleString()} hrs</b></div>
            <div id="adaptive-prediction-${e.id}"></div>
          </div>
          <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border)">
            ${e.manual_url ? 
              `<button class="btn btn-primary btn-sm" style="width:100%" onclick="window.open('${e.manual_url}', '_blank')">📖 Open Manual</button>` : 
              `<button class="btn btn-secondary btn-sm" style="width:100%" onclick="setManualLink('${e.id}')">🔗 Link Manual</button>`
            }
          </div>
        </div>

        <!-- Widget: Quick Specs -->
        <div class="eq-widget" style="background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; border-bottom: 1px solid var(--border); padding-bottom: 5px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--text2); text-transform: uppercase;">Quick Specs</span>
            <button class="btn btn-secondary btn-sm" style="font-size:10px; padding: 2px 6px" onclick="addQuickSpec('${e.id}')">+ Add</button>
          </div>
          <div id="eq-quick-specs"></div>
        </div>

        <!-- Widget: Recent Activity -->
        <div class="eq-widget" style="background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 12px;">
          <div style="font-size: 11px; font-weight: 700; color: var(--text2); text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid var(--border); padding-bottom: 5px;">Recent Activity</div>
          <div id="eq-timeline-content-mini" style="max-height: 180px; overflow-y: auto;"></div>
        </div>
      </div>
    </div>

    <!-- 2. ZERK MAP VIEW (With Drawing Layer) -->
    <div id="eq-zerks" class="tab-content" style="display:none">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:10px; flex-wrap:wrap">
        <div id="zerk-view-switcher" style="display:flex; gap:4px; overflow-x:auto; flex:1"></div>
        <div class="sub-toggle">
            <button class="btn btn-sm active" id="mode-dot" onclick="setZerkMode('dot')">Point Only</button>
            <button class="btn btn-sm" id="mode-line" onclick="setZerkMode('line')">Pointer Line</button>
        </div>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('zerk-upload-input').click()">+ Add View</button>
      </div>
      <div id="zerk-map-container" style="position:relative; width:100%; border-radius:12px; overflow:hidden; background:#000; border:1px solid var(--border)">
          <img id="zerk-map-img" src="" style="width:100%; display:block; opacity:0.9"/>
          <svg id="zerk-svg-layer" viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:50;"></svg>
          <div id="zerk-dots-overlay" style="position:absolute; inset:0; z-index:100; cursor:crosshair" onclick="handleMapClick(event)"></div>
      </div>
      <div id="zerk-detail-box" style="display:none; margin-top:12px; padding:15px; background:var(--bg); border:1px solid var(--border); border-radius:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center"><div id="zerk-label" style="font-weight:700"></div><button class="btn btn-danger btn-sm" id="zerk-delete-btn" style="font-size:10px" onclick="deleteZerk()">Delete</button></div>
        <div id="zerk-instr" style="font-size:13px; color:var(--text2); margin-top:4px"></div>
      </div>
      <input type="file" id="zerk-upload-input" style="display:none" onchange="uploadZerkView(this)"/>
    </div>

    <!-- 3. FULL HISTORY VIEW -->
    <div id="eq-history" class="tab-content" style="display:none"><div id="eq-history-list"></div></div>

   <!-- Observations Tab -->
    <div id="eq-obs" class="tab-content" style="display:none">
      <div style="background:var(--bg2); padding:12px; border-radius:var(--radius); margin-bottom:12px; border:1px solid var(--border)">
        <div style="margin-bottom:8px">
          <label class="form-label" style="font-size:11px">Severity Level</label>
          <!-- THE SEVERITY SELECTOR -->
          <select class="form-select" id="obs-severity-${e.id}" style="width:100%; margin-top:4px">
              <option value="info">ℹ️ Info / Maintenance Log</option>
              <option value="watch">👀 Watch / Monitoring Required</option>
              <option value="critical">🚨 Critical / Needs Immediate Action</option>
          </select>
        </div>

        <textarea class="form-textarea" id="obs-input-${e.id}" placeholder="What do you see?" style="width:100%; min-height:60px; margin-bottom:8px"></textarea>
        
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px">
          <div style="display:flex; gap:6px; align-items:center">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('obs-photo-input').click()">📸 Add Photo</button>
            <input type="file" id="obs-photo-input" accept="image/*" style="display:none" onchange="handlePhotoUpload(this,'obs')"/>
            <span id="obs-photo-status" style="font-size:11px; color:var(--success); font-weight:600"></span>
          </div>
          <button class="btn btn-primary btn-sm" onclick="addObservation('${e.id}')">Post Observation</button>
        </div>
      </div>
      <div id="obs-list-${e.id}">Loading history...</div>
    </div>

    <div id="eq-invoices" class="tab-content" style="display:none"><div id="invoices-list"></div><button class="btn btn-primary btn-sm" onclick="openAddInvoice()">+ Add Invoice</button></div>
    <div id="eq-docs" class="tab-content" style="display:none"><div id="docs-list"></div></div>

    <div style="margin-top:20px; display:flex; gap:8px; justify-content:flex-end; border-top: 1px solid var(--border); padding-top: 15px;">
      <button class="btn btn-secondary" onclick="printMachineHistory('${e.id}')">🖨 History Report</button>
      <button class="btn btn-primary" onclick="closeModal('detail-modal')">Close</button>
    </div>`;

  openModal('detail-modal');
  renderMiniTimeline(id);
  renderQuickSpecs(id);
}
function openSupplierDetail(id){
  const s = state.suppliers.find(x => x.id === id); 
  if(!s) return;
  
  const parts = state.parts.filter(p => p.supplier_id === id);
  document.getElementById('detail-title').textContent = s.name;
  
  document.getElementById('detail-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;font-size:13px">
      <div><span style="color:var(--text2)">Contact:</span> ${s.contact||'—'}</div>
      <div><span style="color:var(--text2)">Phone:</span> ${s.phone||'—'}</div>
      <div><span style="color:var(--text2)">Email:</span> <a href="mailto:${s.email}" style="color:var(--accent)">${s.email||'—'}</a></div>
      <div><span style="color:var(--text2)">Website:</span> ${s.website ? `<a href="${s.website}" target="_blank" style="color:var(--accent)">Visit</a>` : '—'}</div>
    </div>
    ${s.notes ? `<div style="font-size:13px;color:var(--text2);background:var(--bg2);padding:9px 11px;border-radius:var(--radius);margin-bottom:12px">${s.notes}</div>` : ''}
    <div style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Parts from this supplier (${parts.length})</div>
    ${parts.map(p => `<div class="parts-row">
        <div style="flex:1"><div style="font-weight:500">${p.name}</div><div style="font-size:11px;color:var(--text2)">${p.num} · Stock: ${p.qty}</div></div>
    </div>`).join('') || '<div style="color:var(--text3);font-size:13px">No parts linked</div>'}
    <div style="margin-top:16px;text-align:right">
        <button class="btn btn-primary" onclick="closeModal('detail-modal')">Close</button>
    </div>`;

  openModal('detail-modal');

}

function openDocDetail(id){
  const d=state.documents.find(x=>x.id===id); if(!d)return;
  document.getElementById('detail-title').textContent=d.name;
  document.getElementById('detail-body').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;font-size:13px">
      <div><span style="color:var(--text2)">Type:</span> ${d.type}</div>
      <div><span style="color:var(--text2)">Equipment:</span> ${d.equip_id?equipName(d.equip_id):'—'}</div>
      <div><span style="color:var(--text2)">Expiry:</span> ${fmtDate(d.expiry_date)}</div>
    </div>
    ${d.notes?`<div style="font-size:13px;color:var(--text2);background:var(--bg2);padding:9px 11px;border-radius:var(--radius);margin-bottom:12px">${d.notes}</div>`:''}
    ${d.file_data?`<div style="margin-top:12px">${d.file_type&&d.file_type.startsWith('image')?`<img src="${d.file_data}" style="max-width:100%;border-radius:var(--radius);cursor:pointer" onclick="viewPhoto('${d.file_data}')"/>`:`<a href="${d.file_data}" download="${d.name}" class="btn btn-secondary">⬇ Download File</a>`}</div>`:'<div style="color:var(--text3);font-size:13px">No file attached</div>'}
    <div style="margin-top:16px;text-align:right"><button class="btn btn-primary" onclick="closeModal('detail-modal')">Close</button></div>`;
  openModal('detail-modal');
}

// ============================================================
// WO PARTS
// ============================================================
let woPartsAdded=[];
function addPartToWO(){
  const partId=document.getElementById('wo-part-select').value;
  const qty=parseInt(document.getElementById('wo-part-qty').value)||1;
  const part=state.parts.find(p=>p.id===partId); if(!part) return;
  if(qty>part.qty){ showToast('Not enough stock! ('+part.qty+' available)'); return; }
  const unitCost = parseFloat(part.cost)||0;
  const existing=woPartsAdded.find(p=>p.part_id===partId);
  if(existing){ existing.qty_used+=qty; } else { woPartsAdded.push({id:uid(),part_id:partId,part_name:part.name,qty_used:qty,unit_cost:unitCost}); }
  updateWOCostFromParts();
  renderWOPartsList();
}
function renderWOPartsList(){
  const total = woPartsAdded.reduce((sum,p)=>sum+(p.unit_cost||0)*p.qty_used, 0);
  document.getElementById('wo-parts-list').innerHTML=woPartsAdded.length?
    woPartsAdded.map((p,i)=>`<div class="parts-row">
      <div style="flex:1"><div style="font-weight:500">${p.part_name}</div>
        <div style="font-size:11px;color:var(--text2)">$${(p.unit_cost||0).toFixed(2)} each × ${p.qty_used} = <b>$${((p.unit_cost||0)*p.qty_used).toFixed(2)}</b></div>
      </div>
      <button class="btn btn-danger" onclick="woPartsAdded.splice(${i},1);renderWOPartsList();updateWOCostFromParts()">✕</button>
    </div>`).join('')
    :'<div style="color:var(--text3);font-size:13px">No parts added yet</div>';
  // Update cost summary
  const summary = document.getElementById('wo-parts-cost-summary');
  const subtotalEl = document.getElementById('wo-parts-subtotal');
  if(summary) summary.style.display = woPartsAdded.length ? 'block' : 'none';
  if(subtotalEl) subtotalEl.textContent = '$' + total.toFixed(2);
}
function addWOComment(){
  const body=document.getElementById('wo-comment-input').value.trim(); if(!body) return;
  document.getElementById('wo-comment-list').innerHTML+=`<div class="comment"><div class="comment-author">${currentUser.name}<span class="comment-time">Just now</span></div><div class="comment-body">${body}</div></div>`;
  document.getElementById('wo-comment-input').value='';
}

// ============================================================
// SAVE DATA
// ============================================================
async function saveTask(){
  const name=document.getElementById('t-name').value.trim(); if(!name){ showToast('Please enter a name'); return; }
  const record={
    id:uid(), name,
    equipId: document.getElementById('t-equip').value,
    assign:  document.getElementById('t-assign').value,
    priority:document.getElementById('t-priority').value,
    due:     document.getElementById('t-due').value,
    cost:    woPartsAdded.length>0
      ? woPartsAdded.reduce((sum,p)=>sum+(p.unit_cost||0)*p.qty_used, 0) + (parseFloat(document.getElementById('t-cost').value)||0)
      : parseFloat(document.getElementById('t-cost').value)||0,
    meter:   document.getElementById('t-meter').value,
    status:  document.getElementById('t-status').value,
    email_freq: parseInt(document.getElementById('t-email-freq')?.value||'7'),
    notes:   document.getElementById('t-notes').value,
    tools:   document.getElementById('t-tools')?.value||'',
    photos:  pendingPhotos.task.slice(),
    checklist: document.getElementById('t-checklist').value.split('\n').filter(Boolean).map(text=>{return {text,done:false}}),
  };
  state.tasks.push(record);
  await persist('tasks','upsert',record);
  // Save part usage
  for(const pu of woPartsAdded){
    const usage={...pu, task_id:record.id, used_by:currentUser.name, used_at:new Date().toISOString(), unit_cost:pu.unit_cost||0, line_total:(pu.unit_cost||0)*pu.qty_used};
    state.partUsage.push(usage);
    await window._mpdb.from('part_usage').insert(usage);
    // Decrement stock
    const part=state.parts.find(p=>p.id===pu.part_id);
    if(part){ part.qty=Math.max(0,part.qty-pu.qty_used); await persist('parts','upsert',part); }
  }
  // Save pending comments
  const commentBody=document.getElementById('wo-comment-input')?.value.trim();
  if(commentBody){
    const comment={id:uid(),task_id:record.id,author:currentUser.name,body:commentBody,created_at:new Date().toISOString()};
    await window._mpdb.from('wo_comments').insert(comment);
  }
  woPartsAdded=[];
  pendingPhotos.task=[];
  closeModal('task-modal');
  state.monthlyCosts=computeMonthlyCosts();
  renderDashboard();
  // Reset form
  ['t-name','t-due','t-cost','t-meter','t-checklist','t-notes','t-tools','wo-comment-input'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('task-photo-grid').innerHTML='<div class="photo-add" onclick="document.getElementById(\'task-photo-input\').click()">+</div><input type="file" id="task-photo-input" accept="image/*" multiple style="display:none" onchange="handlePhotoUpload(this,\'task\')"/>';
  document.getElementById('wo-parts-list').innerHTML='<div style="color:var(--text3);font-size:13px">No parts added yet</div>';
}


async function deleteRecurRule(id){ if(!confirm('Delete this recurrence rule?'))return; state.recurrenceRules=state.recurrenceRules.filter(r=>r.id!==id); await persist('recurrence_rules','delete',{id}); renderCalendar(); }

async function savePart(){
  const name=document.getElementById('p-name').value.trim(); if(!name){ showToast('Please enter a name'); return; }
  const record={
    id:uid(), name,
    num:        document.getElementById('p-num').value,
    supplier_id:document.getElementById('p-supplier-select').value||null,
    qty:        parseInt(document.getElementById('p-qty').value)||0,
    reorder:    parseInt(document.getElementById('p-reorder').value)||0,
    cost:       parseFloat(document.getElementById('p-cost').value)||0,
    auto_reorder:document.getElementById('p-auto-reorder').checked,
    reorder_qty:parseInt(document.getElementById('p-reorder-qty').value)||10,
  };
  state.parts.push(record);
  await persist('parts','upsert',record);
  closeModal('part-modal'); renderParts(); updateMetrics();
  ['p-name','p-num','p-qty','p-reorder','p-cost','p-reorder-qty'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('p-auto-reorder').checked=false;
}

async function saveSupplier(){
  const name=document.getElementById('sup-name').value.trim(); if(!name){ showToast('Please enter a name'); return; }
  const record={
    id:uid(), name,
    contact: document.getElementById('sup-contact').value,
    email:   document.getElementById('sup-email').value,
    phone:   document.getElementById('sup-phone').value,
    website: document.getElementById('sup-website').value,
    notes:   document.getElementById('sup-notes').value,
  };
  state.suppliers.push(record);
  await persist('suppliers','upsert',record);
  closeModal('supplier-modal'); renderSuppliers();
  ['sup-name','sup-contact','sup-email','sup-phone','sup-website','sup-notes'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
}

async function saveDoc(){
  const name=document.getElementById('d-name').value.trim(); if(!name){ showToast('Please enter a name'); return; }
  const record={
    id:uid(), name,
    type:        document.getElementById('d-type').value,
    equip_id:    document.getElementById('d-equip').value||null,
    expiry_date: document.getElementById('d-expiry').value||null,
    notes:       document.getElementById('d-notes').value,
    file_data:   pendingDocFile?.data||null,
    file_type:   pendingDocFile?.type||null,
  };
  state.documents.push(record);
  await persist('documents','upsert',record);
  pendingDocFile=null;
  closeModal('doc-modal'); renderDocuments();
  ['d-name','d-expiry','d-notes'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('doc-file-preview').textContent='';
}

function convertToTask(schedId){
  const s=state.schedules.find(x=>x.id===schedId); if(!s)return;
  populateSelects();
  setTimeout(()=>{
    document.getElementById('t-name').value=s.name;
    document.getElementById('t-due').value=s.date;
    document.getElementById('t-notes').value=s.notes||'';
    document.getElementById('t-equip').value=s.equipId||'';
    if(s.tech){const assign=document.getElementById('t-assign');if(assign){Array.from(assign.options).forEach(o=>{if(o.text===s.tech)o.selected=true;});}}
    pullEquipSuppliers();
  },50);
  openModal('task-modal');
}
  





// ============================================================
// EXPORTS
// ============================================================
function exportCSV(){
  const rows=[['Work Order','Equipment','Assign','Priority','Due','Cost','Status','Meter','Notes']];
  state.tasks.forEach(t=>rows.push([t.name,equipName(t.equipId),t.assign,t.priority,t.due,t.cost,t.status,t.meter,t.notes]));
  const csv=rows.map(r=>r.map(x=>`"${String(x||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='mtl-maintenance-'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
  showToast('CSV downloaded');
}

function exportHealthCSV(){
  const rows=[['Equipment','Type','Serial','Hours','Status','Health Score','Overdue WOs','Open WOs']];
  state.equipment.forEach(e=>{
    const score=calcHealth(e.id);
    const overdue=state.tasks.filter(t=>t.equipId===e.id&&t.status==='Overdue').length;
    const open=state.tasks.filter(t=>t.equipId===e.id&&t.status==='Open').length;
    rows.push([e.name,e.type,e.serial,e.hours,e.status,score+'%',overdue,open]);
  });
  const csv=rows.map(r=>r.map(x=>`"${String(x||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='mtl-health-scores-'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
  showToast('Health CSV downloaded');
}

function exportEquipCSV(){
  const rows=[['Equipment','Type','Serial','Hours','Status','Operator','Health Score','Assigned Users','Last Service','Notes']];
  state.equipment.forEach(e=>{
    rows.push([e.name,e.type,e.serial,e.hours,e.status,e.op,calcHealth(e.id)+'%',(e.assigned_users||[]).join(';'),getLastService(e.id),e.notes]);
  });
  const csv=rows.map(r=>r.map(x=>`"${String(x||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='mtl-equipment-'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
  showToast('Equipment CSV downloaded');
}

function exportPDF(){
  const completed=state.tasks.filter(t=>t.status==='Completed');
  const totalCost=state.tasks.reduce((a,t)=>a+(t.cost||0),0);
  const invValue=state.parts.reduce((a,p)=>a+(p.qty*p.cost),0);
  const od=state.tasks.filter(t=>t.status==='Overdue');
  const lp=state.parts.filter(p=>p.qty<=p.reorder);
  const date=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const avgH=state.equipment.length?Math.round(state.equipment.reduce((a,e)=>a+calcHealth(e.id),0)/state.equipment.length):0;
  
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MTL Maintenance Report</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a18;margin:0;padding:28px}
    h1{font-size:22px;margin-bottom:3px}h2{font-size:14px;color:#185FA5;border-bottom:2px solid #185FA5;padding-bottom:4px;margin:22px 0 8px}
    .meta{font-size:11px;color:#888;margin-bottom:18px}.kpis{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap}
    .kpi{background:#f5f5f3;border-radius:6px;padding:10px 14px;min-width:100px}.kpi-l{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:.4px}
    .kpi-v{font-size:20px;font-weight:700;margin-top:2px}
    table{width:100%;border-collapse:collapse;margin-bottom:6px}th{font-size:10px;text-align:left;text-transform:uppercase;letter-spacing:.4px;color:#888;padding:5px 7px;border-bottom:2px solid #eee}
    td{padding:6px 7px;border-bottom:1px solid #eee;font-size:12px}
    .alert{background:#FAEEDA;border:1px solid #FAC775;border-radius:4px;padding:8px 12px;margin-bottom:8px;font-size:12px;color:#854F0B}
    @media print{.no-print{display:none} *{-webkit-print-color-adjust:exact}}
    .btn-print{padding:10px 25px; font-weight:bold; cursor:pointer; background:#fff; border:2px solid #1a1a18; border-radius:8px; margin-top:30px}
  </style></head><body>
  <h1>⚙ MTL Maintenance Report</h1>
  <div class="meta">Generated ${date} · ${currentUser?.name||'—'}</div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-l">Equipment</div><div class="kpi-v">${state.equipment.length}</div></div>
    <div class="kpi"><div class="kpi-l">Total Cost</div><div class="kpi-v">$${totalCost.toLocaleString()}</div></div>
    <div class="kpi"><div class="kpi-l">Avg Health</div><div class="kpi-v">${avgH}%</div></div>
  </div>
  <h2>Work Orders</h2>
  <table><thead><tr><th>Name</th><th>Equipment</th><th>Assigned</th><th>Due</th><th>Cost</th><th>Status</th></tr></thead><tbody>
  ${state.tasks.map(t=>`<tr><td>${t.name}</td><td>${equipName(t.equipId)}</td><td>${t.assign||'—'}</td><td>${fmtDate(t.due)}</td><td>$${(t.cost||0).toLocaleString()}</td><td>${t.status}</td></tr>`).join('')}
  </tbody></table>
  <div class="no-print" style="text-align:center">
    <button class="btn-print" onclick="window.print()">🖨 Print / Save as PDF</button>
  </div>
  </body></html>`;

  const w=window.open('','_blank');
  if(w){ w.document.write(html); w.document.close(); }
}

// ============================================================
// DARK MODE
// ============================================================
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const btn = document.getElementById('dark-btn');
  const isDark = document.body.classList.contains('dark-mode');
  if(btn) btn.textContent = isDark ? '☀️' : '🌙';
  try { localStorage.setItem('mp_darkmode', isDark ? '1' : '0'); } catch(e) {}
}
// Apply saved dark mode on load
(function() {
  try { if(localStorage.getItem('mp_darkmode')==='1') { document.body.classList.add('dark-mode'); } } catch(e) {}
})();

// ============================================================
// PHOTO COMPRESSION
// ============================================================
function compressImage(dataUrl, maxWidth=800, quality=0.75) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if(w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

// Override handlePhotoUpload to compress
const _origHandlePhoto = handlePhotoUpload;
async function handlePhotoUpload(input, key) {
  const files = Array.from(input.files);
  for(const file of files) {
    const reader = new FileReader();
    const dataUrl = await new Promise(res => { reader.onload = e => res(e.target.result); reader.readAsDataURL(file); });
    const compressed = await compressImage(dataUrl);
    const savings = Math.round((1 - compressed.length/dataUrl.length)*100);
    if(savings > 5) showToast('Photo compressed — saved ' + savings + '% storage');
    pendingPhotos[key].push(compressed);
    refreshPhotoGrid(key);
  }
  input.value = '';
}

// ============================================================
// OFFLINE QUEUE
// ============================================================
let offlineQueue = [];
try { offlineQueue = JSON.parse(localStorage.getItem('mp_offline_queue') || '[]'); } catch(e) {}

function saveOfflineQueue() {
  try { localStorage.setItem('mp_offline_queue', JSON.stringify(offlineQueue)); } catch(e) {}
  document.getElementById('offline-queue-banner').style.display = offlineQueue.length ? 'block' : 'none';
}

// Override persist to queue when offline
const _origPersist = persist;
async function persist(table, action, record) {
  if(!navigator.onLine) {
    offlineQueue.push({ table, action, record, ts: Date.now() });
    saveOfflineQueue();
    showToast('Saved locally — will sync when online');
    return;
  }
  try {
    if(action==='upsert') await window._mpdb.from(table).upsert(record);
    if(action==='delete') await window._mpdb.from(table).delete().eq('id', record.id);
    setSyncStatus('online'); showToast('Saved & synced ✓');
  } catch(e) {
    offlineQueue.push({ table, action, record, ts: Date.now() });
    saveOfflineQueue();
    setSyncStatus('offline'); showToast('Saved locally — will sync when online');
  }
}

async function syncOfflineQueue() {
  if(!offlineQueue.length) { showToast('Nothing to sync'); return; }
  showToast('Syncing ' + offlineQueue.length + ' change(s)...');
  const failed = [];
  for(const item of offlineQueue) {
    try {
      if(item.action==='upsert') await window._mpdb.from(item.table).upsert(item.record);
      if(item.action==='delete') await window._mpdb.from(item.table).delete().eq('id', item.record.id);
    } catch(e) { failed.push(item); }
  }
  offlineQueue = failed;
  saveOfflineQueue();
  if(failed.length) { showToast(failed.length + ' items failed to sync'); }
  else { showToast('All changes synced ✓'); setSyncStatus('online'); }
}

// Auto-sync when coming back online
window.addEventListener('online', () => { if(offlineQueue.length) syncOfflineQueue(); });

// Show queue banner on load if items pending
if(offlineQueue.length) document.getElementById('offline-queue-banner').style.display = 'block';

// ============================================================
// HOURS AUTO-TRACKER
// ============================================================
async function markComplete(taskId) {
  const t = state.tasks.find(x => x.id === taskId);
  if (!t) return;

  // 1. Update machine hours (Helpful for maintenance tracking)
  const equip = state.equipment.find(e => e.id === t.equipId);
  const currentHours = equip ? equip.hours : 0;
  
  const newHours = prompt(`Update meter for ${equip?.name || 'machine'}?\nCurrent: ${currentHours.toLocaleString()} hrs\nEnter new reading (or cancel to skip):`);
  
  if (newHours !== null && newHours.trim() !== '') {
    const val = parseInt(newHours);
    if (!isNaN(val) && val >= currentHours) {
      if (equip) {
        equip.hours = val;
        t.meter = val + ' hrs';
        await persist('equipment', 'upsert', equip);
         logAuditAction("Completed WO", `${t.name} on ${equip?.name || 'Unknown'}`);

    const rule = state.recurrenceRules.find(r => r.equip_id === t.equipId && r.type === 'hours');
    if (rule && equip) {
        await window._mpdb.from('recurrence_rules').update({ last_generated_hours: equip.hours }).eq('id', rule.id);
    }
      }
    }
  }

  // 2. Set status to Completed
  t.status = 'Completed';
  t.completed_at = new Date().toISOString();

  // 3. Save to Database
  try {
    await persist('tasks', 'upsert', t);

    // SAFETY CHECK: Only log to audit if the function exists
    if (typeof logAuditAction === 'function') {
        logAuditAction("Completed WO", `${t.name} on ${equip?.name || 'Unknown'}`);
    }

    // 4. Trigger Recurrence (Checks if a new 500hr service etc. needs to be created)
    await runRecurrenceEngine();
    
    // 5. UI Refresh
    closeModal('detail-modal');
    renderDashboard();
    
    // Ensure the task list also refreshes
    if (typeof renderTasks === 'function') {
        renderTasks();
    }
    
    showToast("Work Order Completed ✓");
  } catch (e) {
    console.error("Completion error:", e);
    showToast("Failed to save. Check connection.");
  }

await window._mpdb.from('meter_history').insert({ 
    equip_id: equipId, 
    reading: val, 
    status_at_reading: e.status 
});
}
// OVERDUE EMAIL (weekly, one email per batch)
// ============================================================
const OVERDUE_EMAIL_RECIPIENT = 'tannergalloway75@gmail.com';

function scheduleOverdueCheck(task) {
  // Store when each task was created so we can check 1 week later
  try {
    const schedules = JSON.parse(localStorage.getItem('mp_email_schedule') || '{}');
    if(!schedules[task.id]) {
      const dueDate = new Date(task.due || Date.now());
      const sendDate = new Date(dueDate.getTime() + 7*24*60*60*1000);
      schedules[task.id] = { sendAt: sendDate.toISOString(), taskId: task.id, taskName: task.name };
      localStorage.setItem('mp_email_schedule', JSON.stringify(schedules));
    }
  } catch(e) {}
}

async function checkAndSendOverdueEmails() {
  try {
    const schedules = JSON.parse(localStorage.getItem('mp_email_schedule') || '{}');
    const now = new Date();
    const toSend = [];
    for(const [taskId, info] of Object.entries(schedules)) {
      if(new Date(info.sendAt) <= now) {
        const task = state.tasks.find(t=>t.id===taskId);
        if(task && task.status !== 'Completed') toSend.push(task);
        delete schedules[taskId];
      }
    }
    localStorage.setItem('mp_email_schedule', JSON.stringify(schedules));
    if(toSend.length > 0) {
      await sendOverdueEmailBatch(toSend);
    }
  } catch(e) { console.log('Email check error:', e); }
}

async function sendOverdueEmailBatch(tasks) {
  // Check we haven't sent a similar email in last 6 days (dedup)
  try {
    const { data: recentEmails } = await window._mpdb.from('email_log')
      .select('*').eq('type','overdue')
      .gte('sent_at', new Date(Date.now()-6*24*60*60*1000).toISOString());
    const recentIds = new Set((recentEmails||[]).flatMap(e=>e.task_ids||[]));
    const newTasks = tasks.filter(t=>!recentIds.has(t.id));
    if(!newTasks.length) return;
    // Log the email
    await window._mpdb.from('email_log').insert({
      id: uid(), type:'overdue', recipient: OVERDUE_EMAIL_RECIPIENT,
      subject: 'MTL Maintenance — Overdue Work Orders',
      task_ids: newTasks.map(t=>t.id),
    });
    // Show in-app notification to admin
    if(currentUser?.role==='admin') {
      showToast('📧 Overdue email queued for ' + OVERDUE_EMAIL_RECIPIENT);
    }
  } catch(e) { console.log('Email send error:', e); }
}

// Run email check on app load
setTimeout(checkAndSendOverdueEmails, 3000);

// ============================================================
// PUSH NOTIFICATIONS
// ============================================================
// Check for overdue tasks and send push on load
// ============================================================
// QR CODES (Admin only)
// ============================================================
function printQRCode(equipId) {
  const equip = state.equipment.find(e=>e.id===equipId); if(!equip) return;
  const url = window.location.origin + window.location.pathname + '?equip=' + equipId;
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
  const win = window.open('','_blank');
  
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>QR — ${equip.name}</title>
  <style>
    body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff}
    .card{text-align:center;padding:32px;border:2px solid #1a1a18;border-radius:12px;max-width:300px}
    h2{font-size:18px;margin:16px 0 4px}
    .sub{font-size:13px;color:#666;margin-bottom:8px}
    .serial{font-size:12px;color:#999}
    .url{font-size:10px;color:#aaa;margin-top:12px;word-break:break-all}
    @media print{.no-print{display:none}}
  </style></head><body>
  <div class="card">
    <div style="font-size:28px">⚙</div>
    <h2>${equip.name}</h2>
    <div class="sub">${equip.type||''}</div>
    <div class="serial">S/N: ${equip.serial||'—'}</div>
    <img src="${qrUrl}" style="margin:16px 0;width:220px;height:220px" alt="QR Code"/>
    <div class="url">Scan to view maintenance history</div>
    <div style="margin-top:16px" class="no-print">
      <button onclick="window.print()" style="padding:8px 20px;cursor:pointer;font-size:14px;border:1px solid #000;border-radius:8px;background:#fff">🖨 Print</button>
    </div>
  </div>
  </body></html>`);
  
  win.document.close();
}

// Handle QR code deep link on load
(function() {
  const params = new URLSearchParams(window.location.search);
  const equipId = params.get('equip');
  if(equipId) {
    const checkReady = setInterval(() => {
      if(currentUser && state.equipment.length) {
        clearInterval(checkReady);
        showPanel('equipment');
        openEquipDetail(equipId);
      }
    }, 300);
  }
})();

// ============================================================
// BULK WORK ORDERS
// ============================================================
function toggleBulkWO() {
  const card = document.getElementById('bulk-wo-card');
  const isHidden = card.style.display==='none';
  card.style.display = isHidden ? 'block' : 'none';
  if(isHidden) {
    // Populate equipment checkboxes
    document.getElementById('bulk-equip-list').innerHTML = state.equipment.map(e=>
      `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg)">
        <input type="checkbox" value="${e.id}" style="cursor:pointer"/>
        <span>${e.name}</span>
      </label>`
    ).join('');
  }
}

async function createBulkWO() {
  const name = document.getElementById('bulk-name').value.trim();
  if(!name) { showToast('Please enter a work order name'); return; }
  const checked = Array.from(document.querySelectorAll('#bulk-equip-list input:checked')).map(i=>i.value);
  if(!checked.length) { showToast('Please select at least one equipment'); return; }
  const priority = document.getElementById('bulk-priority').value;
  const due = document.getElementById('bulk-due').value;
  const notes = document.getElementById('bulk-notes').value;
  let created = 0;
  for(const equipId of checked) {
    const record = { id:uid(), name, equipId, assign:'', priority, due, cost:0, meter:'', status:'Open', notes, photos:[], checklist:[] };
    state.tasks.push(record);
    await window._mpdb.from('tasks').upsert(record);
    created++;
  }
  document.getElementById('bulk-wo-card').style.display='none';
  ['bulk-name','bulk-due','bulk-notes'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  state.monthlyCosts = computeMonthlyCosts();
  renderDashboard();
  showToast(created + ' work orders created ✓');
}

// ============================================================
// COST BUDGET ALERTS (in analytics + dashboard)
// ============================================================
function checkBudgetAlerts() {
  const now = new Date();
  const alerts = [];
  state.equipment.forEach(e=>{
    if(!e.monthly_budget && !e.yearly_budget) return;
    const monthCost = state.tasks.filter(t=>{
      if(t.equipId!==e.id) return false;
      const d=new Date(t.due||'');
      return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
    }).reduce((a,t)=>a+(t.cost||0),0);
    const yearCost = state.tasks.filter(t=>{
      if(t.equipId!==e.id) return false;
      return new Date(t.due||'').getFullYear()===now.getFullYear();
    }).reduce((a,t)=>a+(t.cost||0),0);
    if(e.monthly_budget && monthCost >= e.monthly_budget*0.9) {
      alerts.push(`${e.name}: monthly budget ${monthCost>=e.monthly_budget?'EXCEEDED':'at 90%'} ($${monthCost.toLocaleString()} / $${e.monthly_budget.toLocaleString()})`);
    }
    if(e.yearly_budget && yearCost >= e.yearly_budget*0.9) {
      alerts.push(`${e.name}: yearly budget ${yearCost>=e.yearly_budget?'EXCEEDED':'at 90%'} ($${yearCost.toLocaleString()} / $${e.yearly_budget.toLocaleString()})`);
    }
  });
  return alerts;
}

// ============================================================
// PATCH: saveEquipment — add budget fields
// ============================================================
const _origSaveEquipment = saveEquipment;
async function saveEquipment() {
  const name = document.getElementById('e-name').value.trim(); if(!name){ showToast('Please enter a name'); return; }
  const assignInput = document.getElementById('assign-input');
  const assignedUsers = assignInput ? assignInput.value.split(',').map(s=>s.trim()).filter(Boolean) : [];
  const record = {
    id:uid(), name,
    type:   document.getElementById('e-type').value,
    serial: document.getElementById('e-serial').value,
    hours:  parseInt(document.getElementById('e-hours').value)||0,
    status: document.getElementById('e-status').value,
    op:     document.getElementById('e-op').value,
    notes:  document.getElementById('e-notes').value,
    photos: pendingPhotos.equip.slice(),
    assigned_users: assignedUsers,
    custom_fields: customFieldsTemp,
    health_score: 100,
    manufacturer: document.getElementById('e-manufacturer')?.value.trim()||'',
    group_tag: document.getElementById('e-group')?.value||'outside',
    monthly_budget: parseFloat(document.getElementById('e-budget-monthly')?.value)||0,
    yearly_budget:  parseFloat(document.getElementById('e-budget-yearly')?.value)||0,
  };
  state.equipment.push(record);
  await persist('equipment','upsert',record);
  pendingPhotos.equip=[]; customFieldsTemp={};
  closeModal('equip-modal'); renderEquipmentTable(); updateMetrics();
  ['e-name','e-type','e-serial','e-hours','e-op','e-notes','e-budget-monthly','e-budget-yearly'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
}

// ============================================================
// PATCH: renderDashboard — add budget alerts + push check
// ============================================================
const _origRenderDashboard = renderDashboard;

// ============================================================
// PATCH: enterApp — request push, init push check
// ============================================================
const _origEnterApp = enterApp;

// ============================================================
// PATCH: renderEquipmentTable — add QR button for admin
// ============================================================
const _origRenderEquipmentTable = renderEquipmentTable;



// ============================================================
// PERMISSIONS
// ============================================================
const PERMISSIONS = {
  admin:   {canCreate:true,canEdit:true,canDelete:true,canViewReports:true,canManageUsers:true,canManageParts:true,canManageEquip:true,canManageSuppliers:true,canViewCosts:true,canManageTools:true},
  manager: {canCreate:true,canEdit:true,canDelete:true,canViewReports:true,canManageUsers:false,canManageParts:true,canManageEquip:true,canManageSuppliers:true,canViewCosts:true,canManageTools:true},
  tech:    {canCreate:true,canEdit:true,canDelete:false,canViewReports:false,canManageUsers:false,canManageParts:false,canManageEquip:false,canManageSuppliers:false,canViewCosts:false,canManageTools:true},
  viewer:  {canCreate:false,canEdit:false,canDelete:false,canViewReports:false,canManageUsers:false,canManageParts:false,canManageEquip:false,canManageSuppliers:false,canViewCosts:false,canManageTools:false},
};
(function(){try{const s=JSON.parse(localStorage.getItem('mp_permissions')||'null');if(s){['manager','tech','viewer'].forEach(r=>{if(s[r])PERMISSIONS[r]={...PERMISSIONS[r],...s[r]};});}}catch(e){}})();
function can(permission){
  if(!currentUser)return false;
  if(currentUser.custom_permissions&&currentUser.custom_permissions[permission]!==undefined)return!!currentUser.custom_permissions[permission];
  return!!(PERMISSIONS[currentUser.role||'viewer']?.[permission]);
}

// State additions
state.downtimeLog=[];state.observations=[];state.chatMessages=[];
state.checklistTemplates=[
  {id:'tpl-cat320',name:'CAT 320 Excavator — Daily',model:'CAT 320',type:'Excavator',items:['Check engine oil level','Check hydraulic fluid level','Check coolant level','Check fuel level','Inspect for fluid leaks','Drain water separator','Inspect hydraulic hoses','Check cylinder seals','Inspect undercarriage','Check track tension','Inspect track bolts','Inspect sprocket','Inspect bucket teeth','Check bucket pins','Grease all pivot points','Test lights and horn','Test seat belt','Check control switches','Inspect mirrors','Clean cab','Clean radiator','Monitor display for errors','Test brakes','Listen for abnormal sounds','Test all hydraulic functions','Log hours']},
  {id:'tpl-cat320-500',name:'CAT 320 — 500hr Service',model:'CAT 320',type:'Excavator',items:['Change engine oil and filter','Replace fuel filters','Replace hydraulic return filter','Check and clean air filter','Top up all fluid levels','Grease all lubrication points','Inspect track and undercarriage','Check swing bearing','Inspect cylinder seals','Check all hydraulic hoses','Inspect engine belts','Check battery terminals','Test all safety devices','Check slew ring bolts','Sample hydraulic oil','Sample engine oil','Inspect radiator cores','Log service']},
  {id:'tpl-loader',name:'Wheel Loader — Daily',model:'General',type:'Wheel Loader',items:['Check engine oil','Check hydraulic fluid','Check coolant','Check fuel','Inspect tyres','Check wheel nuts','Inspect bucket teeth','Check bucket pins','Inspect hydraulic hoses','Grease pivot points','Test lights and alarm','Test seat belt','Check mirrors','Test hydraulic functions','Log hours']},
  {id:'tpl-skid',name:'Skid Steer — Daily',model:'General',type:'Skid Steer',items:['Check engine oil','Check hydraulic fluid','Check coolant','Check fuel','Inspect tyres or tracks','Check quick attach','Inspect hydraulic hoses','Grease lubrication points','Test lights and alarm','Test seat bar','Test all controls','Log hours']},
  {id:'tpl-crane',name:'Crane — Daily Pre-Op',model:'General',type:'Crane',items:['Check engine oil','Check hydraulic fluid','Check coolant','Check fuel','Inspect wire rope','Inspect hook and latch','Check load block','Inspect boom','Check outriggers','Test limit switches','Test load indicator','Inspect hydraulic hoses','Grease all points','Test all controls','Verify lift certification','Log hours']},
];
(function(){try{const s=JSON.parse(localStorage.getItem('mp_tpl')||'null');if(s){const ids=new Set(state.checklistTemplates.map(t=>t.id));s.forEach(t=>{if(!ids.has(t.id))state.checklistTemplates.push(t);});}}catch(e){}})();
(function(){try{state.downtimeLog=JSON.parse(localStorage.getItem('mp_downtime')||'[]');}catch(e){}})();

// Patch loadState to also load observations

// ── DOWNTIME ─────────────────────────────────────────────────
function formatDuration(mins){if(!mins)return'0 mins';if(mins<60)return mins+' min'+(mins!==1?'s':'');const h=Math.floor(mins/60),m=mins%60;return h+'h'+(m>0?' '+m+'m':'');}
function getEquipDowntime(equipId){const entries=state.downtimeLog.filter(d=>d.equipId===equipId&&d.status==='resolved');const totalMins=entries.reduce((a,d)=>a+(d.downtimeMins||0),0);const activeDown=state.downtimeLog.find(d=>d.equipId===equipId&&d.status==='started'&&!d.endedAt);return{entries,totalMins,activeDown};}
async function logStatusChange(equipId,oldStatus,newStatus){
  if(oldStatus===newStatus)return;
  const now=new Date().toISOString();
  if(newStatus==='Down'){state.downtimeLog.push({id:uid(),equipId,status:'started',startedAt:now,endedAt:null});}
  else if(oldStatus==='Down'){const open=state.downtimeLog.find(d=>d.equipId===equipId&&d.status==='started'&&!d.endedAt);if(open){open.endedAt=now;open.status='resolved';open.downtimeMins=Math.round((new Date(now)-new Date(open.startedAt))/60000);showToast('Downtime: '+formatDuration(open.downtimeMins));}}
  try{localStorage.setItem('mp_downtime',JSON.stringify(state.downtimeLog));}catch(e){}
}
async function updateEquipStatus(equipId, newStatus) {
    const e = state.equipment.find(x => x.id === equipId);
    if (!e) return;

    const oldStatus = e.status;
    e.status = newStatus;
    const now = new Date().toISOString();

    try {
        // 1. Save the status change to the main equipment table
        await persist('equipment', 'upsert', e);

        // 2. DOWNTIME TRACKING LOGIC
        if (newStatus === 'Down') {
            // Started Downtime: Create a new log entry
            await window._mpdb.from('downtime_logs').insert({
                equip_id: equipId,
                start_time: now,
                reason: prompt("Brief reason for downtime? (e.g., Hydraulic leak, waiting for parts)") || "Unspecified"
            });
            showToast(`${e.name} marked as DOWN`);
        } 
        else if (oldStatus === 'Down' && (newStatus === 'Operational' || newStatus === 'Standby')) {
            // Ended Downtime: Find the open log and close it
            const { data: openLogs } = await window._mpdb
                .from('downtime_logs')
                .select('*')
                .eq('equip_id', equipId)
                .is('end_time', null)
                .order('start_time', { ascending: false });

            if (openLogs && openLogs.length > 0) {
                const log = openLogs[0];
                const start = new Date(log.start_time);
                const end = new Date(now);
                const diffMinutes = Math.round((end - start) / 60000);

                await window._mpdb.from('downtime_logs').update({
                    end_time: now,
                    total_minutes: diffMinutes
                }).eq('id', log.id);
                
                showToast(`Downtime ended: ${formatDuration(diffMinutes)}`);
            }
        }

        renderEquipmentTable();
        renderDashboard();
    } catch (err) {
        showToast("Status update failed");
    }
}
function printMachineHistory(equipId){
  const e=state.equipment.find(x=>x.id===equipId);if(!e)return;
  const tasks=state.tasks.filter(t=>t.equipId===equipId).sort((a,b)=>new Date(b.due)-new Date(a.due));
  const docs=state.documents.filter(d=>d.equip_id===equipId);
  const dt=getEquipDowntime(equipId);const score=calcHealth(equipId);
  const totalCost=tasks.reduce((a,t)=>a+(t.cost||0),0);
  const date=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>History — ${e.name}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a18;margin:0;padding:28px}
    h1{font-size:20px;margin-bottom:3px}h2{font-size:13px;font-weight:700;text-transform:uppercase;color:#185FA5;border-bottom:1.5px solid #185FA5;padding-bottom:4px;margin:22px 0 8px}
    .kpis{display:flex;gap:10px;margin-bottom:16px}.kpi{background:#f5f5f3;border-radius:6px;padding:10px 14px;min-width:100px}.kpi-l{font-size:10px;text-transform:uppercase;color:#888}.kpi-v{font-size:18px;font-weight:700;margin-top:2px}
    table{width:100%;border-collapse:collapse}th{font-size:10px;text-align:left;color:#888;padding:5px 7px;border-bottom:2px solid #eee}td{padding:6px 7px;border-bottom:1px solid #eee;font-size:11px}
    @media print{.no-print{display:none}}
    .btn-print{padding:10px 25px; font-weight:bold; cursor:pointer; background:#fff; border:2px solid #1a1a18; border-radius:8px; margin-top:30px}
  </style></head><body>
  <h1>⚙ ${e.name} History</h1>
  <div class="kpis">
    <div class="kpi"><div class="kpi-l">Total WOs</div><div class="kpi-v">${tasks.length}</div></div>
    <div class="kpi"><div class="kpi-l">Total Cost</div><div class="kpi-v">$${totalCost.toLocaleString()}</div></div>
  </div>
  <table><thead><tr><th>Name</th><th>Due</th><th>Cost</th><th>Status</th></tr></thead><tbody>
  ${tasks.map(t=>`<tr><td><b>${t.name}</b></td><td>${fmtDate(t.due)}</td><td>$${(t.cost||0).toLocaleString()}</td><td>${t.status}</td></tr>`).join('')}
  </tbody></table>
  <div class="no-print" style="text-align:center">
    <button class="btn-print" onclick="window.print()">🖨 Print / Save as PDF</button>
  </div>
  </body></html>`;
  
  const w=window.open('','_blank');
  if(w){ w.document.write(html); w.document.close(); }
}

// ── CHECKLIST TEMPLATES ──────────────────────────────────────
function renderChecklistTemplates(){
  const list = document.getElementById('tpl-list');
  if(!list) return;

  list.innerHTML = state.checklistTemplates.map(tpl => `
    <div class="card" style="margin-bottom:10px">
      <div class="card-header">
        <div>
          <div style="font-weight:600;font-size:14px">${tpl.name}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">
            ${tpl.model ? `<span class="badge bi">${tpl.model}</span>` : ''} 
            ${tpl.type ? `<span class="badge bg">${tpl.type}</span>` : ''}
            <span style="margin-left:8px">${tpl.items.length} items</span>
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <!-- NEW EDIT BUTTON -->
          <button class="btn btn-secondary btn-sm" onclick="editTemplate('${tpl.id}')">Edit</button>
          <button class="btn btn-secondary btn-sm" onclick="printTemplate('${tpl.id}')">🖨 Print</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTpl('${tpl.id}')">Delete</button>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">
        ${tpl.items.slice(0,5).map(i => `<span style="font-size:10px;background:var(--bg3);padding:2px 6px;border-radius:3px">${i}</span>`).join('')}
        ${tpl.items.length > 5 ? `<span style="font-size:10px;color:var(--text3)">+${tpl.items.length-5} more</span>` : ''}
      </div>
    </div>`).join('') || '<div class="card"><div style="color:var(--text2);font-size:13px;text-align:center;padding:20px">No templates found. Click "+ Add Template" to start.</div></div>';
}
function previewTemplate(id){
  const tpl=state.checklistTemplates.find(t=>t.id===id);if(!tpl)return;
  document.getElementById('detail-title').textContent=tpl.name;
  document.getElementById('detail-body').innerHTML=`<div style="margin-bottom:12px">${tpl.model?`<span class="badge bi" style="margin-right:4px">${tpl.model}</span>`:''} ${tpl.type?`<span class="badge bg">${tpl.type}</span>`:''}</div>${tpl.items.map((item,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px"><div style="width:20px;height:20px;border:1px solid var(--border2);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text3)">${i+1}</div>${item}</div>`).join('')}<div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-secondary" onclick="printTemplate('${id}')">🖨 Print</button><button class="btn btn-primary" onclick="closeModal('detail-modal')">Close</button></div>`;
  openModal('detail-modal');
}
function saveTpl(){
  const name=document.getElementById('tpl-name').value.trim();if(!name){showToast('Enter a name');return;}
  const items=document.getElementById('tpl-items').value.split('\n').filter(Boolean);if(!items.length){showToast('Add checklist items');return;}
  const tpl={id:'tpl-'+uid(),name,model:document.getElementById('tpl-model').value.trim(),type:document.getElementById('tpl-type').value.trim(),items};
  state.checklistTemplates.push(tpl);try{localStorage.setItem('mp_tpl',JSON.stringify(state.checklistTemplates));}catch(e){}
  closeModal('tpl-modal');renderChecklistTemplates();showToast('Template saved ✓');
  ['tpl-name','tpl-model','tpl-type','tpl-items'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}
function deleteTpl(id){if(!confirm('Delete this template?'))return;state.checklistTemplates=state.checklistTemplates.filter(t=>t.id!==id);try{localStorage.setItem('mp_tpl',JSON.stringify(state.checklistTemplates));}catch(e){}renderChecklistTemplates();showToast('Template deleted');}
function applyTemplate(){
  const tplId=document.getElementById('tpl-selector')?.value;if(!tplId){showToast('Select a template first');return;}
  const tpl=state.checklistTemplates.find(t=>t.id===tplId);if(!tpl)return;
  document.getElementById('t-checklist').value=tpl.items.join('\n');
  document.querySelectorAll('#task-modal .tab').forEach(b=>{if(b.textContent==='Checklist'){b.classList.add('active');switchWOTab('checklist',b);}});
  showToast(tpl.items.length+' items applied ✓');
}

// ── OBSERVATIONS ─────────────────────────────────────────────
// 2. THE ACTION: Handles adding a new observation and sending alerts
async function addObservation(equipId) {
    const body = document.getElementById('obs-input-'+equipId)?.value.trim();
    const severity = document.getElementById('obs-severity-'+equipId)?.value || 'info';
    
    // SAFE CHECK: This prevents the 'length' error
    const hasPhoto = (pendingPhotos && pendingPhotos.obs && pendingPhotos.obs.length > 0);
    
    if(!body && !hasPhoto) {
        showToast("Please enter a note or attach a photo");
        return;
    }

    const obs = {
        id: uid(),
        equip_id: equipId,
        author: currentUser.name,
        body: body || "",
        severity: severity,
        photo: hasPhoto ? pendingPhotos.obs[0] : null,
        created_at: new Date().toISOString()
    };

    try {
        const { error } = await window._mpdb.from('observations').insert(obs);
        if (error) throw error;

        state.observations.unshift(obs);
        
        if (severity === 'critical') {
            await sendCriticalObsEmail(obs, equipId);
        }

        // Cleanup
        if(pendingPhotos.obs) pendingPhotos.obs = [];
        const input = document.getElementById('obs-input-'+equipId);
        if(input) input.value = '';
        
        refreshObsList(equipId);
        showToast('Observation saved ✓');
        renderDashboard();
    } catch(e) {
        console.error(e);
        showToast('Failed to save');
    }
}

async function deleteObservation(obsId, equipId) {
    if(!confirm("Delete this observation?")) return;
    try {
        await window._mpdb.from('observations').delete().eq('id', obsId);
        state.observations = state.observations.filter(o => o.id !== obsId);
        refreshObsList(equipId);
        showToast("Observation deleted");
        renderDashboard();
    } catch(e) {
        showToast("Failed to delete");
    }
}
 async function editObservation(obsId, equipId) {
    const o = state.observations.find(x => x.id === obsId);
    if(!o) return;

    const newText = prompt("Update your observation:", o.body);
    if (newText === null) return; // User clicked cancel

    const newSev = prompt("Update Severity (info, watch, or critical):", o.severity);
    if (newSev === null) return;

    try {
        const { error } = await window._mpdb.from('observations').update({
            body: newText || o.body,
            severity: newSev || o.severity
        }).eq('id', obsId);

        if (error) throw error;

        // Update local memory
        o.body = newText || o.body;
        o.severity = newSev || o.severity;

        refreshObsList(equipId);
        showToast("Updated ✓");
        renderDashboard();
    } catch(e) {
        showToast("Update failed");
    }
}
  function refreshObsList(equipId) {
    const container = document.getElementById('obs-list-' + equipId);
    if (!container) return;

    const obs = (state.observations || []).filter(o => o.equip_id === equipId);
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';

    container.innerHTML = obs.map(o => {
        const sevClass = o.severity === 'critical' ? 'obs-critical' : o.severity === 'watch' ? 'obs-watch' : 'obs-info';
        const isAuthor = o.author === currentUser.username || o.author === currentUser.name;

        return `
        <div class="card" style="margin-bottom: 12px; border-left: 5px solid ${o.severity === 'critical' ? 'var(--danger)' : 'var(--border)'}">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px">
                <span class="badge ${sevClass}">${o.severity.toUpperCase()}</span>
                <span style="font-size:11px; color:var(--text3)">${o.author} · ${fmtDate(o.created_at)}</span>
            </div>
            <div style="font-size:13px; line-height:1.5">${o.body}</div>
            ${o.photo ? `<img src="${o.photo}" style="width:100%; max-height:200px; object-fit:cover; margin-top:8px; border-radius:4px; cursor:pointer" onclick="viewPhoto('${o.photo}')"/>` : ''}
            
            <div style="margin-top:10px; display:flex; gap:8px; justify-content:flex-end">
                ${(isAuthor || isAdmin) ? `<button class="btn btn-secondary btn-sm" style="font-size:10px" onclick="editObservation('${o.id}', '${equipId}')">Edit</button>` : ''}
                ${(isAdmin) ? `<button class="btn btn-danger btn-sm" style="font-size:10px" onclick="deleteObservation('${o.id}', '${equipId}')">Delete</button>` : ''}
            </div>
        </div>`;
    }).join('') || '<div style="color:var(--text3); padding:20px; text-align:center">No observations yet.</div>';
}
// ── GROUPS ───────────────────────────────────────────────────
let activeGroupFilter='all',equipGroupFilter='all';
function setGroupFilter(group){activeGroupFilter=group;['all','outside','production'].forEach(g=>{const btn=document.getElementById('grp-'+g);if(!btn)return;if(g===group){btn.style.background='#fff';btn.style.color='#1a1a18';btn.style.fontWeight='700';btn.style.borderColor='#fff';}else{btn.style.background='rgba(255,255,255,0.15)';btn.style.color='#fff';btn.style.fontWeight='500';btn.style.borderColor='rgba(255,255,255,0.6)';}});renderDashboard();}
function setEquipGroupFilter(group){equipGroupFilter=group;['all','outside','production'].forEach(g=>{const btn=document.getElementById('eq-grp-'+g);if(!btn)return;btn.classList.toggle('active',g===group);});renderEquipmentTable();}
function filteredEquipment(filter){const f=filter||activeGroupFilter;if(f==='all')return state.equipment;return state.equipment.filter(e=>e.group_tag===f||e.group_tag==='both');}
function applyUserGroupFilter(){if(!currentUser)return;const g=currentUser.group_tag;if(g&&g!=='all'){setGroupFilter(g);setEquipGroupFilter(g);}}

// ── RECENT OBS + FLEET HEALTH ────────────────────────────────
function renderRecentObservations(){
  const listEl=document.getElementById('recent-obs-list');const badgeEl=document.getElementById('obs-count-badge');if(!listEl)return;
  let obs=[...(state.observations||[])];if(activeGroupFilter!=='all'){const ids=new Set(filteredEquipment(activeGroupFilter).map(e=>e.id));obs=obs.filter(o=>ids.has(o.equip_id));}
  if(badgeEl)badgeEl.textContent=obs.length+' total';
  if(!obs.length){listEl.innerHTML='<div style="color:var(--text2);font-size:13px;padding:8px 0">No observations yet</div>';return;}
  listEl.innerHTML=obs.slice(0,6).map(o=>`<div class="parts-row" style="cursor:pointer" onclick="openEquipDetail('${o.equip_id}')">
    <span style="font-size:16px;flex-shrink:0">${o.severity==='critical'?'🚨':o.severity==='watch'?'👀':'ℹ'}</span>
    <div style="flex:1;min-width:0"><div style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.body}</div>
      <div style="font-size:11px;color:var(--text2)">${equipName(o.equip_id)} · ${o.author} · ${new Date(o.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
    </div><span class="badge ${o.severity==='critical'?'bd':o.severity==='watch'?'bw':'bg'}">${o.severity}</span>
  </div>`).join('');
}
function renderFleetHealthDash(){
  const el=document.getElementById('fleet-health-dash');if(!el)return;
  const equip=filteredEquipment(activeGroupFilter).slice(0,6);
  if(!equip.length){el.innerHTML='<div style="color:var(--text2);font-size:13px">No equipment in this group</div>';return;}
  el.innerHTML=equip.map(e=>{const score=calcHealth(e.id);return`<div class="parts-row" onclick="openEquipDetail('${e.id}')" style="cursor:pointer"><div style="flex:1;min-width:0"><div style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.name}</div><div class="progress-bar" style="margin-top:4px"><div class="progress-fill" style="width:${score}%;background:${healthColor(score)}"></div></div></div><span style="font-size:12px;font-weight:600;color:${healthColor(score)};flex-shrink:0;margin-left:8px">${score}%</span></div>`;}).join('');
}

// ── PERMISSIONS ADMIN ────────────────────────────────────────
const PERM_LABELS = {
  'canCreate': 'Create work orders',
  'canEdit': 'Edit records',
  'canDelete': 'Delete records',
  'canViewReports': 'View reports & analytics',
  'canViewCosts': 'View costs',
  'canManageEquip': 'Manage equipment',
  'canManageParts': 'Manage parts',
  'canManageSuppliers': 'Manage suppliers',
  'canManageUsers': 'Manage users',
  'canManageTools': 'Manage Tool Crib (Add/Edit)' // <--- ADD THIS LINE
};
let editingUserId=null,editingUserRole=null,editingPerms={};
function openUserPerms(userId,userName,userRole,customPerms){editingUserId=userId;editingUserRole=userRole;editingPerms={...PERMISSIONS[userRole]||PERMISSIONS.tech,...(customPerms||{})};document.getElementById('user-perms-title').textContent=userName+' — Permissions';document.getElementById('user-perms-role').textContent=userRole;renderUserPermsList();openModal('user-perms-modal');}
function renderUserPermsList(){const rd=PERMISSIONS[editingUserRole]||PERMISSIONS.tech;document.getElementById('user-perms-list').innerHTML=Object.entries(PERM_LABELS).map(([key,label])=>{const def=!!(rd[key]),cur=!!(editingPerms[key]),ov=cur!==def;return`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)"><div style="flex:1"><div style="font-size:13px;font-weight:500">${label}</div><div style="font-size:11px;color:var(--text3)">Default: ${def?'✅':'❌'}${ov?' <span style="color:var(--warning)">● Override</span>':''}</div></div><label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex-shrink:0;margin-left:12px"><span style="font-size:12px;color:${cur?'var(--success)':'var(--danger)'};font-weight:600;min-width:60px;text-align:right">${cur?'Allowed':'Denied'}</span><div style="position:relative;width:40px;height:22px;flex-shrink:0"><input type="checkbox" ${cur?'checked':''} onchange="editingPerms['${key}']=this.checked;renderUserPermsList()" style="position:absolute;opacity:0;width:100%;height:100%;cursor:pointer;margin:0;z-index:2"/><div style="width:40px;height:22px;border-radius:11px;background:${cur?'#3B6D11':'#E24B4A'};position:absolute;top:0;left:0"></div><div style="width:16px;height:16px;border-radius:50%;background:#fff;position:absolute;top:3px;left:${cur?'21px':'3px'};transition:left .2s;pointer-events:none"></div></div></label></div>`;}).join('');}
function resetUserPerms(){editingPerms={...PERMISSIONS[editingUserRole]||PERMISSIONS.tech};renderUserPermsList();showToast('Reset to defaults');}
async function saveUserPerms(){try{const rd=PERMISSIONS[editingUserRole]||PERMISSIONS.tech;const ho=Object.entries(editingPerms).some(([k,v])=>v!==rd[k]);await window._mpdb.from('profiles').update({custom_permissions:ho?editingPerms:null}).eq('id',editingUserId);showToast('Permissions saved ✓');closeModal('user-perms-modal');renderUsersTable();}catch(e){showToast('Failed');}}
function togglePermission(role,permission,value){if(role==='admin')return;PERMISSIONS[role][permission]=value;try{const c={};['manager','tech','viewer'].forEach(r=>{c[r]={...PERMISSIONS[r]};});localStorage.setItem('mp_permissions',JSON.stringify(c));}catch(e){}showToast('Updated ✓');}
function renderPermissionsMatrix(){const perms=Object.entries(PERM_LABELS);const roles=['admin','manager','tech','viewer'];document.getElementById('permissions-table-body').innerHTML=perms.map(([key,label])=>`<tr><td style="padding-left:16px;font-weight:500">${label}</td>${roles.map(role=>`<td style="text-align:center">${role==='admin'?'✅':`<input type="checkbox" ${PERMISSIONS[role]?.[key]?'checked':''} onchange="togglePermission('${role}','${key}',this.checked)" style="width:16px;height:16px;cursor:pointer"/>`}</td>`).join('')}</tr>`).join('');}
async function quickRoleChange(userId, newRole) {
    showToast("Updating role...");
    try {
        const { error } = await window._mpdb
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId); // TARGET SPECIFIC USER ONLY
            
        if (error) throw error;
        showToast("Role updated ✓");
        // Update local currentUser if you just edited yourself
        if (currentUser.id === userId) currentUser.role = newRole;
    } catch(e) {
        showToast("Update failed");
        renderUsersTable(); // Revert UI on failure
    }
}

async function quickGroupChange(userId, newGroup) {
    showToast("Updating group...");
    try {
        const { error } = await window._mpdb
            .from('profiles')
            .update({ group_tag: newGroup || null })
            .eq('id', userId); // TARGET SPECIFIC USER ONLY

        if (error) throw error;
        showToast("Group updated ✓");
    } catch(e) {
        showToast("Update failed");
        renderUsersTable();
    }
}
async function changeUserRole() {
  const userId = document.getElementById('role-user-select').value;
  const newRole = document.getElementById('role-select').value;
  const newGroup = document.getElementById('group-select').value;

  if (!userId) { showToast("Select a user first"); return; }

  try {
    const { error } = await window._mpdb.from('profiles').update({
      role: newRole,
      group_tag: newGroup || null
    }).eq('id', userId);

    if (error) throw error;

    showToast("User permissions updated ✓");
    renderUsersTable(); // Refresh the table to show the change
  } catch(e) {
    showToast("Failed to update user");
  }
}
async function renderUsersTable() {
  try {
    const { data: profiles, error } = await window._mpdb.from('profiles').select('*').order('created_at', { ascending: false });
    if (error || !profiles) return;

    // We store the users here so the reset function can find the names later
    state.users_list_cache = profiles;

    const active = profiles.filter(p => p.status === 'approved');
    
    const tableBody = document.getElementById('users-table-body');
    if (tableBody) {
        const rc = { 'admin': 'bd', 'manager': 'bw', 'tech': 'bi', 'viewer': 'bg' };
        
        tableBody.innerHTML = active.map(p => `
            <tr>
                <td><b>${p.full_name || p.username}</b></td>
                <td>${p.username}</td>
                <td><span class="badge ${rc[p.role] || 'bg'}">${p.role || 'tech'}</span></td>
                <td>${p.group_tag ? `<span class="badge bi">${p.group_tag}</span>` : '—'}</td>
                <td>
                  <div style="display:flex; gap:5px;">
                    <!-- We ONLY pass the ID here. This prevents the quote crash! -->
                    <button class="btn btn-secondary btn-sm" onclick="promptResetPin('${p.id}')">🔑 PIN</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser('${p.id}')">Delete</button>
                  </div>
                </td>
            </tr>`).join('');
    }

    const userSelect = document.getElementById('role-user-select');
    if (userSelect) {
      userSelect.innerHTML = '<option value="">— Select User —</option>' + 
        active.map(p => `<option value="${p.id}">${p.full_name} (${p.username})</option>`).join('');
    }

  } catch(e) { 
    console.error("User Table Render Error:", e); 
  }
}
async function approveUser(id,name){await window._mpdb.from('profiles').update({status:'approved'}).eq('id',id);showToast(name+' approved ✓');renderAdminPanel();}
async function denyUser(id){await window._mpdb.from('profiles').update({status:'denied'}).eq('id',id);showToast('Denied');renderAdminPanel();}
async function deleteUser(id,name){if(!confirm('Delete '+name+'?'))return;await window._mpdb.from('profiles').delete().eq('id',id);showToast(name+' removed');renderAdminPanel();}

// ── CHAT ─────────────────────────────────────────────────────
let currentChannel='general',chatTagEquipId=null,chatTagTaskId=null,chatPhotoData=null,lastReadAt={};
const CHANNEL_DESCS={general:'General team chat',outside:'Outside crew channel',production:'Production team channel'};
(function(){try{lastReadAt=JSON.parse(localStorage.getItem('mp_chat_read')||'{}');}catch(e){}})();

   async function initChat() {
    // 1. Initial load of existing messages
    try {
        const { data } = await window._mpdb.from('chat_messages')
            .select('id, channel, created_at, author, body, author_name')
            .order('created_at', { ascending: false })
            .limit(100);
        state.chatMessages = data || [];
        updateUnreadBadge();
    } catch (e) {
        console.error("Chat load error:", e);
    }

    // 2. Setup Realtime Listener for new messages
    try {
        window._mpdb.channel('chat').on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages'
        }, payload => {
            const msg = payload.new;
            state.chatMessages.unshift(msg);

            // Handle @Mentions
            if (msg.body && msg.body.includes('@' + currentUser.username)) {
                showToast(`🔔 ${msg.author_name} mentioned you in #${msg.channel}`);
            }

            // Update UI if user is looking at the channel
            if (msg.channel === currentChannel) {
                if (msg.author !== currentUser?.username) {
                    appendChatMessage(msg);
                }
                markChannelRead(currentChannel);
            } else {
                // Otherwise, update the red notification dots/badges
                updateUnreadBadge();
            }
        }).subscribe();
    } catch (e) {
        console.error("Chat subscription error:", e);
    }
}
async function renderChat() {
    console.log("Loading Chat...");
    await renderDmList();     // 1. Load the DM names
    enforceChatMobileLayout();
    updateUnreadBadge();      // 2. Check for red dots
    loadChatMessages(currentChannel); // 3. Load the actual messages
}

function populateChatTagSelects(){
  const esel=document.getElementById('tag-equip-select');const tsel=document.getElementById('tag-task-select');
  if(esel)esel.innerHTML='<option value="">+ Equipment</option>'+state.equipment.map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
  if(tsel)tsel.innerHTML='<option value="">+ Work Order</option>'+state.tasks.filter(t=>t.status!=='Completed').map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
}
function isMobileViewport(){return window.matchMedia('(max-width: 768px)').matches;}
function shouldStickChatToBottom(container){
  if(!container)return false;
  const threshold=80;
  return container.scrollHeight-container.scrollTop-container.clientHeight<=threshold;
}
async function loadChatMessages(channel) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const shouldAutoScroll = !isMobileViewport() && shouldStickChatToBottom(container);

  container.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px">Loading...</div>';

  try {
    const { data } = await window._mpdb
      .from('chat_messages')
      .select('*')
      .eq('channel', channel)
      .order('created_at', { ascending: true })
      .limit(100);

    renderChatMessages(data || [], container);
    markChannelRead(channel);
      setTimeout(() => {
      if (shouldAutoScroll) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  } catch (e) {
    container.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px">Could not load messages</div>';
  }
}
      
function renderChatMessages(msgs,container){
  if(!msgs.length){container.innerHTML='<div style="color:var(--text3);font-size:13px;text-align:center;padding:40px 20px">No messages yet — say hello! 👋</div>';return;}
  let html='',lastDate='';
  msgs.forEach(msg=>{const msgDate=new Date(msg.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});if(msgDate!==lastDate){html+=`<div style="text-align:center;font-size:11px;color:var(--text3);padding:8px 0;display:flex;align-items:center;gap:8px"><div style="flex:1;height:1px;background:var(--border)"></div>${msgDate}<div style="flex:1;height:1px;background:var(--border)"></div></div>`;lastDate=msgDate;}html+=buildChatMsgHtml(msg);});
  container.innerHTML=html;
}
function buildChatMsgHtml(msg){
  const initials=(msg.author_name||msg.author).split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const isMe=msg.author===currentUser.username;
  const time=new Date(msg.created_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  let body=(msg.body||'').split('\n').join('<br>');
  body=body.replace(/@([\w]+)/g,'<span style="color:var(--accent);font-weight:500">@$1</span>');
  const equipTag=msg.equip_id?`<div style="display:inline-flex;align-items:center;gap:4px;background:var(--accent-bg);color:var(--accent-text);border-radius:4px;padding:1px 7px;font-size:11px;cursor:pointer" onclick="openEquipDetail('${msg.equip_id}')">🔧 ${equipName(msg.equip_id)}</div>`:'';
  const taskN=state.tasks.find(t=>t.id===msg.task_id)?.name||'Work Order';
  const taskTag=msg.task_id?`<div style="display:inline-flex;align-items:center;gap:4px;background:var(--bg2);color:var(--text2);border-radius:4px;padding:1px 7px;font-size:11px;cursor:pointer" onclick="openTaskDetail('${msg.task_id}')">📋 ${taskN}</div>`:'';
  const photoHtml=msg.photo?`<img src="${msg.photo}" style="max-width:240px;border-radius:var(--radius);margin-top:6px;cursor:pointer;border:1px solid var(--border)" onclick="viewPhoto('${msg.photo}')"/>`:'';
  const canDelete=isMe||currentUser?.role==='admin'||currentUser?.role==='manager';
  const canBlock=!isMe&&(currentUser?.role==='admin'||currentUser?.role==='manager');
  return `<div style="display:flex;gap:10px;padding:6px 0;align-items:flex-start;${isMe?'flex-direction:row-reverse':''}" onmouseenter="this.querySelector('.msg-actions')?.style.setProperty('opacity','1')" onmouseleave="this.querySelector('.msg-actions')?.style.setProperty('opacity','0')">
    <div style="width:32px;height:32px;border-radius:50%;background:${isMe?'var(--success-bg)':'var(--accent-bg)'};color:${isMe?'var(--success-text)':'var(--accent-text)'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${initials}</div>
    <div style="flex:1;min-width:0;${isMe?'align-items:flex-end;display:flex;flex-direction:column':''}">
      <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px;${isMe?'flex-direction:row-reverse':''}">
        <span style="font-weight:600;font-size:13px">${isMe?'You':msg.author_name||msg.author}</span>
        <span style="font-size:11px;color:var(--text3)">${time}</span>
        ${canDelete||canBlock?`<span class="msg-actions" style="opacity:0;transition:opacity .15s;display:flex;gap:4px;margin-left:4px">${canDelete?`<button onclick="deleteChatMessage('${msg.id}','${msg.channel}','${msg.author}')" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--danger);padding:0 3px" title="Delete">🗑</button>`:''}${canBlock?`<button onclick="blockChatUser('${msg.author}','${msg.author_name||msg.author}')" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--warning);padding:0 3px" title="Block">🚫</button>`:''}</span>`:''}
      </div>
      <div style="background:${isMe?'var(--success-bg)':'var(--bg2)'};border-radius:${isMe?'12px 12px 2px 12px':'12px 12px 12px 2px'};padding:8px 12px">
        ${body?`<div style="font-size:13px;color:var(--text);line-height:1.5;word-break:break-word">${body}</div>`:''}${photoHtml}
        ${equipTag||taskTag?`<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">${equipTag}${taskTag}</div>`:''}
      </div>
    </div>
  </div>`;
}
function appendChatMessage(msg){const c=document.getElementById('chat-messages');if(!c)return;const d=document.createElement('div');d.innerHTML=buildChatMsgHtml(msg);c.appendChild(d.firstElementChild);c.scrollTop=c.scrollHeight;}
async function sendChatMessage(){
  const input=document.getElementById('chat-input');const body=input?.value.trim();if(!body&&!chatPhotoData)return;
  if(!navigator.onLine){showToast('Offline');return;}
  try{const{data:p}=await window._mpdb.from('profiles').select('blocked_from_chat').eq('username',currentUser.username).single();if(p?.blocked_from_chat){showToast('You have been blocked from sending messages. Contact your admin.');return;}}catch(e){}
  const mentions=[];const re=/@([\w]+)/g;let m;while((m=re.exec(body||''))!==null)mentions.push(m[1]);
  const msg={id:uid(),channel:currentChannel,author:currentUser.username,author_name:currentUser.name,body:body||null,photo:chatPhotoData||null,equip_id:chatTagEquipId||null,task_id:chatTagTaskId||null,mentions,created_at:new Date().toISOString()};
 appendChatMessage(msg);
  if(input) input.value='';
  clearTag('equip');
  clearTag('task');
  chatPhotoData=null;
  
  // 1. Safe way to clear the photo preview
  try { 
    if(document.getElementById('chat-photo-preview')) {
      document.getElementById('chat-photo-preview').textContent=''; 
    }
  } catch(e) {}

  // 2. THE PART THAT SAVES (This is what was likely missing)
  try {
    const { error } = await window._mpdb.from('chat_messages').insert([msg]);
    if (error) {
      console.error("Supabase Save Error:", error.message);
      showToast('Message failed to save');
    } else {
      console.log("Message saved successfully!");
    }
  } catch(e) {
    console.error("Critical Save Error:", e);
    showToast('Connection error');
  }
} // This is the end of the function
function handleChatInput(el){
  el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';
  const val=el.value,atIdx=val.lastIndexOf('@');
  if(atIdx>=0&&(atIdx===val.length-1||/([\w]+)$/.test(val.slice(atIdx+1)))){
    const query=val.slice(atIdx+1).toLowerCase();
    const names=[...new Set([...(state.observations||[]).map(o=>o.author),...(state.chatMessages||[]).map(m=>m.author_name||m.author),currentUser.name])].filter(n=>n&&n.toLowerCase().includes(query));
    const dd=document.getElementById('mention-dropdown');
    if(dd&&names.length){dd.style.display='block';dd.innerHTML=names.slice(0,6).map(n=>`<div style="padding:6px 10px;cursor:pointer;border-radius:4px;font-size:13px" onmousedown="insertMention('${n}')" onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">@${n}</div>`).join('');}
    else if(dd)dd.style.display='none';
  }else{const dd=document.getElementById('mention-dropdown');if(dd)dd.style.display='none';}
}
function insertMention(name){const i=document.getElementById('chat-input');if(!i)return;const v=i.value;const a=v.lastIndexOf('@');i.value=v.slice(0,a)+'@'+name.replace(/ /g,'')+' ';const dd=document.getElementById('mention-dropdown');if(dd)dd.style.display='none';i.focus();}
function chatKeyDown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChatMessage();}}
function refreshMobileChatChannelOptions(){
    const menu = document.getElementById('chat-channel-mobile-menu');
    if (!menu) return;
    const baseOptions = [
        { value: 'general', label: '# general' },
        { value: 'outside', label: '# outside' },
        { value: 'production', label: '# production' }
    ];
    const dmUsers = (state.users_list_cache || []).filter(u => u.username !== currentUser?.username);
    const dmOptions = dmUsers.map(u => ({
        value: 'dm-' + [currentUser.username, u.username].sort().join('-'),
        label: '@ ' + u.full_name
    }));
    const allOptions = [...baseOptions, ...dmOptions];
    menu.innerHTML = allOptions.map(opt => `<button type="button" class="chat-mobile-menu-item${opt.value===currentChannel?' active':''}" onclick="chooseMobileChatChannel('${opt.value}')">${opt.label}</button>`).join('');
    menu.querySelectorAll('.chat-mobile-menu-item').forEach(btn => {
        btn.style.width = '100%';
        btn.style.border = 'none';
        btn.style.background = 'transparent';
        btn.style.textAlign = 'left';
        btn.style.padding = '8px 10px';
        btn.style.borderRadius = '8px';
        btn.style.fontSize = '13px';
        btn.style.color = 'var(--text)';
        if (btn.classList.contains('active')) {
            btn.style.background = 'var(--accent-bg)';
            btn.style.color = 'var(--accent-text)';
            btn.style.fontWeight = '700';
        }
    });
    updateMobileChatMenuLabel(currentChannel, allOptions);
}
function updateMobileChatMenuLabel(channel, options){
    const label = document.getElementById('chat-channel-menu-label');
    if(!label) return;
    const knownOptions = options || [];
    const match = knownOptions.find(opt => opt.value === channel);
    if(match){ label.textContent = match.label; return; }
    if(channel && channel.startsWith('dm-')) label.textContent = '@ direct message';
    else label.textContent = '# general';
}
function toggleMobileChatMenu(event){
    if(event) event.stopPropagation();
    const menu = document.getElementById('chat-channel-mobile-menu');
    if(!menu) return;
    const isOpen = menu.style.display === 'block';
    menu.style.display = isOpen ? 'none' : 'block';
}
function chooseMobileChatChannel(channel){
    if(!channel) return;
    const btn = document.querySelector(`#chat-sidebar .chat-channel-btn[data-channel="${channel}"]`) || document.getElementById(`btn-ch-${channel}`) || null;
    switchChannel(channel, btn);
    const menu = document.getElementById('chat-channel-mobile-menu');
    if(menu) menu.style.display = 'none';
}
function enableHorizontalDragScroll(el){
    if(!el || el.dataset.dragScrollBound === '1') return;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let dragging = false;
    el.addEventListener('touchstart', function(e){
        if(!e.touches || !e.touches[0]) return;
        dragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startScrollLeft = el.scrollLeft;
    }, { passive: true });
    el.addEventListener('touchmove', function(e){
        if(!dragging || !e.touches || !e.touches[0]) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        // Only intercept mostly-horizontal swipes.
        if(Math.abs(dx) > Math.abs(dy)){
            el.scrollLeft = startScrollLeft - dx;
            e.preventDefault();
        }
    }, { passive: false });
    el.addEventListener('touchend', function(){ dragging = false; }, { passive: true });
    el.addEventListener('touchcancel', function(){ dragging = false; }, { passive: true });
    el.dataset.dragScrollBound = '1';
}
function applyDesktopChatHeight(){
    if (window.matchMedia('(max-width: 768px)').matches) return;
    const layout = document.querySelector('#panel-chat .chat-layout');
    if (!layout) return;
    const rect = layout.getBoundingClientRect();
    const bottomGap = 14;
    const desired = Math.max(640, Math.floor(window.innerHeight - rect.top - bottomGap));
    layout.style.height = desired + 'px';
    layout.style.minHeight = desired + 'px';
}
function enforceChatMobileLayout(){
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const layout = document.querySelector('#panel-chat .chat-layout');
    const sidebar = document.getElementById('chat-sidebar');
    const mainChat = document.querySelector('#panel-chat .main-chat-window');
    const mobileMenuBtn = document.getElementById('chat-channel-menu-btn');
    const mobileMenu = document.getElementById('chat-channel-mobile-menu');
    const headerTitle = document.getElementById('chat-header-title');
    const mobileToggle = document.getElementById('chat-mobile-toggle');
    const topbar = document.querySelector('.topbar');
    const topbarRight = document.querySelector('.topbar-right');
    const mainNav = document.getElementById('main-nav');
    if(!layout || !sidebar || !mainChat) return;

    if(isMobile){
        layout.style.flexDirection = 'column';
        layout.style.height = 'calc(100vh - 210px)';
        layout.style.minHeight = 'calc(100vh - 210px)';
        layout.style.gap = '10px';
        sidebar.style.display = 'none';
        mainChat.style.width = '100%';
        mainChat.style.maxWidth = '100%';
        mainChat.style.minWidth = '0';
        if(mobileToggle) mobileToggle.style.display = 'none';
        if(mobileMenuBtn){
            mobileMenuBtn.style.display = 'inline-flex';
            mobileMenuBtn.style.alignItems = 'center';
            mobileMenuBtn.style.gap = '8px';
            mobileMenuBtn.style.marginLeft = '0';
            mobileMenuBtn.style.height = '34px';
            mobileMenuBtn.style.padding = '6px 12px';
            mobileMenuBtn.style.borderRadius = '999px';
            mobileMenuBtn.style.border = '1px solid rgba(255,255,255,0.3)';
            mobileMenuBtn.style.background = 'rgba(0,0,0,0.55)';
            mobileMenuBtn.style.color = '#fff';
            mobileMenuBtn.style.fontSize = '13px';
            mobileMenuBtn.style.fontWeight = '600';
        }
        if(mobileMenu){
            mobileMenu.style.position = 'absolute';
            mobileMenu.style.top = '42px';
            mobileMenu.style.left = '12px';
            mobileMenu.style.right = 'auto';
            mobileMenu.style.zIndex = '30';
            mobileMenu.style.minWidth = '180px';
            mobileMenu.style.maxWidth = '78vw';
            mobileMenu.style.background = '#fff';
            mobileMenu.style.border = '1px solid var(--border)';
            mobileMenu.style.borderRadius = '12px';
            mobileMenu.style.boxShadow = '0 10px 24px rgba(0,0,0,0.16)';
            mobileMenu.style.padding = '6px';
            mobileMenu.style.display = 'none';
        }
        if(topbar){
            topbar.style.overflowX = 'hidden';
        }
        if(topbarRight){
            topbarRight.style.overflowX = 'auto';
            topbarRight.style.webkitOverflowScrolling = 'touch';
            topbarRight.style.touchAction = 'pan-x';
            topbarRight.style.justifyContent = 'flex-start';
            topbarRight.style.flexWrap = 'nowrap';
            topbarRight.style.gap = '8px';
            topbarRight.style.width = '100%';
            topbarRight.style.padding = '0 12px 8px';
            enableHorizontalDragScroll(topbarRight);
        }
        if(mainNav){
            mainNav.style.overflowX = 'auto';
            mainNav.style.webkitOverflowScrolling = 'touch';
            mainNav.style.touchAction = 'pan-x';
            mainNav.style.whiteSpace = 'nowrap';
            mainNav.style.flexWrap = 'nowrap';
            mainNav.style.justifyContent = 'flex-start';
            mainNav.style.width = '100%';
            mainNav.style.padding = '0 12px 8px';
            enableHorizontalDragScroll(mainNav);
        }
        if(headerTitle) headerTitle.style.display = 'none';
    } else {
        layout.style.flexDirection = '';
        layout.style.height = '';
        layout.style.minHeight = '';
        layout.style.gap = '';
        sidebar.style.display = '';
        mainChat.style.width = '';
        mainChat.style.maxWidth = '';
        mainChat.style.minWidth = '';
        if(mobileToggle) mobileToggle.style.display = 'none';
        if(mobileMenuBtn) mobileMenuBtn.style.display = 'none';
        if(mobileMenu) mobileMenu.style.display = 'none';
        if(headerTitle) headerTitle.style.display = '';
        if(topbar){
            topbar.style.overflowX = '';
        }
        if(topbarRight){
            topbarRight.style.overflowX = '';
            topbarRight.style.webkitOverflowScrolling = '';
            topbarRight.style.touchAction = '';
            topbarRight.style.justifyContent = '';
            topbarRight.style.flexWrap = '';
            topbarRight.style.gap = '';
            topbarRight.style.width = '';
            topbarRight.style.padding = '';
        }
        if(mainNav){
            mainNav.style.overflowX = '';
            mainNav.style.webkitOverflowScrolling = '';
            mainNav.style.touchAction = '';
            mainNav.style.whiteSpace = '';
            mainNav.style.flexWrap = '';
            mainNav.style.justifyContent = '';
            mainNav.style.width = '';
            mainNav.style.padding = '';
        }
        applyDesktopChatHeight();
    }
}
window.addEventListener('resize', enforceChatMobileLayout);
document.addEventListener('click', function(event){
    const menu = document.getElementById('chat-channel-mobile-menu');
    const btn = document.getElementById('chat-channel-menu-btn');
    if(!menu || !btn) return;
    if(menu.contains(event.target) || btn.contains(event.target)) return;
    menu.style.display = 'none';
});
function switchChannel(channel, btn) {
    try {
        currentChannel = channel;
        
        // Update button colors
        document.querySelectorAll('.chat-channel-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');

        // Update the Header Title
        const header = document.getElementById('chat-header-title');
        if (header) {
            if (channel.startsWith('dm-')) {
                let dmName = '';
                if (btn) dmName = (btn.innerText || '').split('\n')[0].trim();
                if (!dmName) {
                    const menuLabel = document.getElementById('chat-channel-menu-label')?.textContent || '';
                    dmName = menuLabel.replace(/^@\s*/, '').trim();
                }
                header.textContent = '@ ' + (dmName || 'direct message');
            } else {
                header.textContent = '# ' + channel;
            }
        }

        // --- NEW CODE ADDED HERE FOR MOBILE LABEL ---
        const mobileMenuBtn = document.getElementById('chat-channel-menu-btn');
        if (mobileMenuBtn) {
            // This grabs the name we just set in the header above and puts it on the mobile button
            const newLabel = header ? header.textContent : (channel.startsWith('dm-') ? '@ direct message' : '# ' + channel);
            mobileMenuBtn.innerHTML = '☰ ' + newLabel;
        }
        // --- END OF NEW CODE ---

        refreshMobileChatChannelOptions();
        updateMobileChatMenuLabel(channel);

        loadChatMessages(channel);
        markChannelRead(channel); // Clears the red dots
    } catch (e) { console.error("Switch error:", e); }

}

function tagEquip(id){if(!id)return;chatTagEquipId=id;const b=document.getElementById('chat-tag-bar');const n=document.getElementById('chat-tag-equip-name');const w=document.getElementById('chat-tag-equip');if(b)b.style.display='flex';if(n)n.textContent='🔧 '+equipName(id);if(w)w.style.display='inline-flex';document.getElementById('tag-equip-select').value='';}
function tagTask(id){if(!id)return;chatTagTaskId=id;const b=document.getElementById('chat-tag-bar');const n=document.getElementById('chat-tag-task-name');const w=document.getElementById('chat-tag-task');const t=state.tasks.find(x=>x.id===id);if(b)b.style.display='flex';if(n)n.textContent='📋 '+(t?.name||'Work Order');if(w)w.style.display='inline-flex';document.getElementById('tag-task-select').value='';}
function clearTag(type){if(type==='equip'){chatTagEquipId=null;const w=document.getElementById('chat-tag-equip');if(w)w.style.display='none';}if(type==='task'){chatTagTaskId=null;const w=document.getElementById('chat-tag-task');if(w)w.style.display='none';}if(!chatTagEquipId&&!chatTagTaskId){const b=document.getElementById('chat-tag-bar');if(b)b.style.display='none';}}
async function handleChatPhoto(input){const file=input.files[0];if(!file)return;const compressed=await compressImage(await new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsDataURL(file);}),600,0.7);chatPhotoData=compressed;document.getElementById('chat-photo-preview').textContent='📎 Photo attached';input.value='';}
function markChannelRead(channel) {
    lastReadAt[channel] = new Date().toISOString();
    try {
        localStorage.setItem('mp_chat_read', JSON.stringify(lastReadAt));
    } catch(e) {}
    
    // Refresh the counts immediately
    updateUnreadBadge();
}
function updateUnreadBadge() {
    let totalUnread = 0;
    const channels = ['general', 'outside', 'production'];

    channels.forEach(ch => {
        const lastRead = lastReadAt[ch] ? new Date(lastReadAt[ch]) : new Date(0);
        const unreadCount = (state.chatMessages || []).filter(m => 
            m.channel === ch && 
            new Date(m.created_at) > lastRead && 
            m.author !== currentUser?.username
        ).length;
        
        totalUnread += unreadCount;

        // Force hide/show dots on Sidebar
        const dot = document.getElementById(`dot-ch-${ch}`) || document.getElementById(`dot-dm-${ch}`);
        if (dot) dot.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    });

    // Update Topbar Global Badge
    const topBadge = document.getElementById('chat-unread-top');
    if (topBadge) {
        topBadge.textContent = totalUnread;
        topBadge.style.display = totalUnread > 0 ? 'inline-block' : 'none';
    }
}


window.addEventListener('online',()=>{document.getElementById('offline-banner').style.display='none';const cb=document.getElementById('chat-offline-banner');if(cb)cb.style.display='none';setSyncStatus('online');if(document.getElementById('panel-chat')?.classList.contains('active'))renderChat();});
window.addEventListener('offline',()=>{document.getElementById('offline-banner').style.display='block';const cb=document.getElementById('chat-offline-banner');if(cb)cb.style.display='block';setSyncStatus('offline');});

// ── BUG / SUGGESTION ─────────────────────────────────────────

// ── PULLEQUIPSUPPLIERS with template selector ─────────────────
function pullEquipSuppliers(){
  const equipId=document.getElementById('t-equip')?.value;const box=document.getElementById('equip-suppliers-box');const cont=document.getElementById('equip-suppliers-content');
  const tplWrap=document.getElementById('tpl-selector-wrap');const tplSel=document.getElementById('tpl-selector');
  if(equipId&&tplWrap&&tplSel){const equip=state.equipment.find(e=>e.id===equipId);const matches=state.checklistTemplates.filter(t=>(t.type&&equip?.type&&t.type.toLowerCase()===equip.type.toLowerCase())||(t.model&&equip?.name&&equip.name.toLowerCase().includes(t.model.toLowerCase())));const all=matches.length?matches:state.checklistTemplates;tplSel.innerHTML='<option value="">— Select a template —</option>'+all.map(t=>`<option value="${t.id}"${matches.find(m=>m.id===t.id)?' style="font-weight:600"':''}>${t.name}${matches.find(m=>m.id===t.id)?' ✓':''}</option>`).join('');tplWrap.style.display='block';}
  if(!equipId){if(box)box.style.display='none';return;}
  const equip=state.equipment.find(e=>e.id===equipId);const equipTaskIds=new Set(state.tasks.filter(t=>t.equipId===equipId).map(t=>t.id));const usageForEquip=state.partUsage.filter(p=>equipTaskIds.has(p.task_id));const supplierMap={};
  usageForEquip.forEach(u=>{const part=state.parts.find(p=>p.id===u.part_id);if(!part||!part.supplier_id)return;if(!supplierMap[part.supplier_id])supplierMap[part.supplier_id]={};supplierMap[part.supplier_id][part.name]=(supplierMap[part.supplier_id][part.name]||0)+u.qty_used;});
  state.parts.forEach(p=>{if(p.supplier_id&&!supplierMap[p.supplier_id])supplierMap[p.supplier_id]={};});
  const hasHistory=Object.keys(supplierMap).length>0;let displayEntries=[];
  if(hasHistory){displayEntries=Object.entries(supplierMap).map(([sid,pm])=>({supplier:state.suppliers.find(s=>s.id===sid),partsMap:pm})).filter(e=>e.supplier);}
  else{displayEntries=state.suppliers.filter(s=>state.parts.some(p=>p.supplier_id===s.id)).map(s=>({supplier:s,partsMap:Object.fromEntries(state.parts.filter(p=>p.supplier_id===s.id).map(p=>[p.name,'in stock: '+p.qty]))}));}
  if(!displayEntries.length){if(box)box.style.display='none';return;}
  cont.innerHTML='<div style="margin-bottom:8px;font-size:12px">'+(hasHistory?'Parts used on <b>'+(equip?.name||'this machine')+'</b>:':'Available suppliers:')+'</div>'+displayEntries.map(({supplier:s,partsMap})=>{const pl=Object.entries(partsMap).map(([n,q])=>`<span style="display:inline-block;background:rgba(24,95,165,0.12);border-radius:3px;padding:1px 7px;margin:2px 3px 2px 0;font-size:11px">${n}${typeof q==='number'?' × '+q+' used':''}</span>`).join('');return`<div style="padding:8px 0;border-bottom:1px solid rgba(24,95,165,0.15)"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><div style="font-weight:600;flex:1">${s.name}</div>${s.phone?`<a href="tel:${s.phone}" style="color:var(--accent);font-size:12px;text-decoration:none">📞 ${s.phone}</a>`:''}${s.email?`<a href="mailto:${s.email}" style="color:var(--accent);font-size:12px;text-decoration:none;margin-left:6px">✉ Email</a>`:''}</div><div>${pl||'<span style="font-size:11px;color:var(--text3)">No parts linked yet</span>'}</div></div>`;}).join('');
  if(box)box.style.display='block';
}

// ── LAZY IMAGES ──────────────────────────────────────────────
const lazyObserver=new IntersectionObserver((entries)=>{entries.forEach(entry=>{if(entry.isIntersecting){const img=entry.target;const src=img.getAttribute('data-src');if(src){img.src=src;img.removeAttribute('data-src');lazyObserver.unobserve(img);}}});},{rootMargin:'100px'});
function initLazyImages(){document.querySelectorAll('img.lazy-img[data-src]').forEach(img=>lazyObserver.observe(img));}

// ── OVERRIDDEN renderDashboard ────────────────────────────────

async function renderDashboard(){
  console.log("Safe Render: Starting Dashboard...");
  try {
      updateMetrics();
      renderAlerts();
      await renderEquipListDash(); // Predictions
      renderRecentTasks();
      renderRecentObservations();
      renderSchedDash();
      
      // We REMOVED renderFleetHealthDash() and renderCostChart() from here
      
  } catch (e) {
      console.error("Dashboard error:", e);
  }
}
// ── OVERRIDDEN renderAlerts ───────────────────────────────────
function renderAlerts(){
  const sec=document.getElementById('alert-section');if(!sec)return;
  const od=state.tasks.filter(t=>t.status!=='Completed'&&isOverdue(t.due));
  const lp=state.parts.filter(p=>p.qty<=p.reorder_qty&&p.reorder_qty>0);
  const exp=state.documents.filter(d=>d.expiry_date&&new Date(d.expiry_date)<=new Date(Date.now()+30*24*60*60*1000));
  const critObs=(state.observations||[]).filter(o=>o.severity==='critical');
  let h='';
  if(od.length)h+=`<div class="alert alert-d"><span class="dot"></span><b>${od.length} overdue:</b> ${od.map(t=>t.name).join(', ')}</div>`;
  if(lp.length)h+=`<div class="alert alert-w">⚠ <b>${lp.length} part${lp.length>1?'s':''} low/out of stock:</b> ${lp.map(p=>p.name).join(', ')}</div>`;
  if(exp.length)h+=`<div class="alert alert-w">📄 <b>${exp.length} document${exp.length>1?'s':''} expiring soon:</b> ${exp.map(d=>d.name).join(', ')}</div>`;
  if(critObs.length)h+=`<div class="alert alert-d">🚨 <b>${critObs.length} critical observation${critObs.length>1?'s':''}:</b> ${critObs.map(o=>equipName(o.equip_id)+' — '+o.body.slice(0,50)).join(' | ')}</div>`;
  sec.innerHTML=h;
}

// ── OVERRIDDEN openModal ──────────────────────────────────────
function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'flex';
        el.classList.add('open');

        // Fill dropdowns if the modal needs them
        if (id === 'task-modal' || id === 'calendar-entry-modal') {
            populateSelects();
        }
    } else {
        console.error("Modal not found:", id);
    }
}
async function enterApp(){
  try { localStorage.setItem('mp_session', JSON.stringify(currentUser)); } catch(e) {}
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('user-chip-name').textContent = currentUser.name;

  const nav = document.getElementById('main-nav');
  nav.innerHTML = '';

  const buttons = [
    { id: 'analytics', label: 'Analytics' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'chat', label: 'Chat' },
    { id: 'checklists', label: 'Checklists' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'documents', label: 'Docs' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'parts', label: 'Parts' },
    { id: 'suppliers', label: 'Suppliers' },
    { id: 'tools', label: 'Tool Crib' },
    { id: 'tasks', label: 'Work Orders' }
  ];

  // 1. Sort A-Z
  buttons.sort((a, b) => a.label.localeCompare(b.label));

  // 2. Filter and Build
  buttons.forEach(btn => {
    if (btn.id === 'analytics' && !can('canViewReports')) return;
    if (btn.id === 'suppliers' && !can('canManageSuppliers')) return;

    const b = document.createElement('button');
    b.className = 'nav-btn';
    if (btn.id === 'dashboard') b.classList.add('active');
    b.onclick = () => showPanel(btn.id);
    b.innerHTML = btn.id === 'chat' ? 
      `Chat <span id="chat-unread-top" class="badge bd" style="display:none">0</span>` : btn.label;
    nav.appendChild(b);
  });

  // 3. Add Admin last
  if (currentUser.role === 'admin') {
    const adminBtn = document.createElement('button');
    adminBtn.className = 'nav-btn';
    adminBtn.onclick = () => showPanel('admin');
    adminBtn.textContent = 'Admin';
    nav.appendChild(adminBtn);
  }

  // 4. Data Logic
  await loadState();
  await runRecurrenceEngine();
  applyUserGroupFilter();
  showPanel('dashboard');
  await initChat();
  updateLastSeen();
  setInterval(updateLastSeen, 2 * 60 * 1000);
}
// ── CHAT SIDEBAR MOBILE ──────────────────────────────────────
function toggleChatSidebar(){const s=document.getElementById('chat-sidebar');const o=document.getElementById('chat-sidebar-overlay');if(!s)return;const open=s.classList.contains('open');if(open){s.classList.remove('open');if(o)o.style.display='none';}else{s.classList.add('open');if(o)o.style.display='block';}}
function closeChatSidebarMobile(){if(window.innerWidth<=640){const s=document.getElementById('chat-sidebar');const o=document.getElementById('chat-sidebar-overlay');if(s)s.classList.remove('open');if(o)o.style.display='none';}}

// ── ONLINE USERS (all team members) ──────────────────────────
async function renderOnlineUsers(){
  const el=document.getElementById('online-users-list');if(!el)return;
  try{
    const{data:profiles}=await window._mpdb.from('profiles').select('full_name,username,last_seen').eq('status','approved');
    const fiveMinAgo=new Date(Date.now()-5*60*1000);
    el.innerHTML=(profiles||[]).map(p=>{
      const isMe=p.username===currentUser.username;
      const isOnline=isMe||(p.last_seen&&new Date(p.last_seen)>fiveMinAgo);
      return `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px;color:rgba(255,255,255,0.8)">
        <div style="width:7px;height:7px;border-radius:50%;background:${isOnline?'#3B6D11':'rgba(255,255,255,0.25)'};flex-shrink:0"></div>
        ${p.full_name}${isMe?' (you)':''}
      </div>`;
    }).join('');
  }catch(e){}
}

// Update last_seen every 2 minutes while app is open
async function updateLastSeen(){
  try{
    await window._mpdb.from('profiles').update({last_seen:new Date().toISOString()}).eq('username',currentUser.username);
  }catch(e){}
}

// ── DIRECT MESSAGES ──────────────────────────────────────────
let activeDmUser=null;
function getDmChannel(u1,u2){return 'dm-'+[u1,u2].sort().join('-');}

   async function renderDmList() {
    const el = document.getElementById('dm-list');
    if (!el) return;
    
    // Ensure we have users in the cache
    if (!state.users_list_cache || state.users_list_cache.length === 0) {
        const { data } = await window._mpdb.from('profiles').select('username, full_name').eq('status', 'approved');
        state.users_list_cache = data || [];
    }

    const otherUsers = state.users_list_cache.filter(u => u.username !== currentUser.username);
    
    el.innerHTML = otherUsers.map(u => {
        const ch = 'dm-' + [currentUser.username, u.username].sort().join('-');
        return `
        <button class="chat-channel-btn" id="btn-dm-${u.username}" data-channel="${ch}" onclick="switchChannel('${ch}', this)">
            ${u.full_name} <span class="unread-dot" id="dot-dm-${ch}" style="display:none"></span>
        </button>`;
    }).join('') || '<div style="color:rgba(255,255,255,0.4); font-size:11px; padding-left:12px">No users found</div>';
    refreshMobileChatChannelOptions();
} 
function switchToDm(username,fullName,btn){
  activeDmUser=username;currentChannel=getDmChannel(currentUser.username,username);
  document.querySelectorAll('.chat-channel-btn').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');
  const t=document.getElementById('chat-channel-title');const d=document.getElementById('chat-channel-desc');
  if(t)t.textContent='@ '+fullName;if(d)d.textContent='Direct message';
  const i=document.getElementById('chat-input');if(i)i.placeholder='Message '+fullName+'...';
  loadChatMessages(currentChannel);closeChatSidebarMobile();
}



// ── DELETE CHAT MESSAGE ──────────────────────────────────────
async function deleteChatMessage(msgId,channel,author){
  if(!confirm('Delete this message?')) return;
  try{
    const{data:msgs}=await window._mpdb.from('chat_messages').select('*').eq('id',msgId);
    const msg=msgs?.[0];
    if(msg){await window._mpdb.from('deleted_messages').insert({id:uid(),original_id:msgId,channel:msg.channel,author:msg.author,author_name:msg.author_name,body:msg.body,photo:msg.photo,deleted_by:currentUser.username,deleted_at:new Date().toISOString(),expires_at:new Date(Date.now()+30*24*60*60*1000).toISOString()});}
    await window._mpdb.from('chat_messages').delete().eq('id',msgId);
    state.chatMessages=state.chatMessages.filter(m=>m.id!==msgId);
    await loadChatMessages(currentChannel);
    showToast('Message deleted');
  }catch(e){showToast('Failed to delete');}
}

// ── BLOCK CHAT USER ───────────────────────────────────────────
async function blockChatUser(username,displayName){
  if(!confirm('Block '+displayName+' from sending chat messages?'))return;
  try{await window._mpdb.from('profiles').update({blocked_from_chat:true}).eq('username',username);showToast(displayName+' blocked from chat');}catch(e){showToast('Failed');}
}
async function unblockChatUser(username,displayName){
  try{await window._mpdb.from('profiles').update({blocked_from_chat:false}).eq('username',username);showToast(displayName+' unblocked');renderDeletedMessages();}catch(e){showToast('Failed');}
}

// ── DELETED MESSAGES ADMIN ────────────────────────────────────
async function renderDeletedMessages(){
  const listEl=document.getElementById('deleted-msgs-list');const blockedEl=document.getElementById('blocked-users-list');if(!listEl)return;
  try{const{data:deleted}=await window._mpdb.from('deleted_messages').select('*').gte('expires_at',new Date().toISOString()).order('deleted_at',{ascending:false});
    listEl.innerHTML=!deleted||!deleted.length?'<div style="color:var(--text2);font-size:13px;padding:8px 0">No deleted messages</div>':deleted.map(m=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap"><span style="font-weight:600;font-size:13px">${m.author_name||m.author}</span><span class="badge bg">#${m.channel}</span><span style="font-size:11px;color:var(--text3)">${new Date(m.deleted_at).toLocaleDateString()} · Deleted by ${m.deleted_by}</span><span style="font-size:11px;color:var(--danger);margin-left:auto">Expires ${new Date(m.expires_at).toLocaleDateString()}</span><button class="btn btn-secondary btn-sm" onclick="recoverMessage('${m.id}')">Recover</button><button class="btn btn-danger btn-sm" onclick="permanentDeleteMessage('${m.id}')">Delete Forever</button></div><div style="font-size:13px;color:var(--text);background:var(--bg2);padding:8px 10px;border-radius:var(--radius)">${m.body||'[photo]'}</div></div>`).join('');
  }catch(e){if(listEl)listEl.innerHTML='<div style="color:var(--text2);font-size:13px">Could not load</div>';}
  if(!blockedEl)return;
  try{const{data:blocked}=await window._mpdb.from('profiles').select('username,full_name').eq('blocked_from_chat',true);
    blockedEl.innerHTML=!blocked||!blocked.length?'<div style="color:var(--text2);font-size:13px;padding:8px 0">No blocked users</div>':blocked.map(p=>`<div class="parts-row"><div style="flex:1"><div style="font-weight:500">${p.full_name}</div><div style="font-size:12px;color:var(--text2)">${p.username}</div></div><button class="btn btn-success btn-sm" onclick="unblockChatUser('${p.username}','${p.full_name}')">Unblock</button></div>`).join('');
  }catch(e){}
}
async function recoverMessage(deletedId){
  if(!confirm('Restore this message?'))return;
  try{const{data:dm}=await window._mpdb.from('deleted_messages').select('*').eq('id',deletedId);const m=dm?.[0];if(!m)return;
    await window._mpdb.from('chat_messages').insert({id:m.original_id||uid(),channel:m.channel,author:m.author,author_name:m.author_name,body:m.body,photo:m.photo,created_at:new Date().toISOString()});
    await window._mpdb.from('deleted_messages').delete().eq('id',deletedId);
    showToast('Message recovered ✓');renderDeletedMessages();
  }catch(e){showToast('Failed');}
}

// ── ADMIN TAB SWITCHER ────────────────────────────────────────
function switchAdminTab(tab, btn) {
  // Hide all admin sub-panels
  ['admin-approvals', 'admin-users', 'admin-permissions', 'admin-deleted-msgs', 'admin-settings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Show the one you clicked
  const target = document.getElementById('admin-' + tab);
  if (target) target.style.display = 'block';

  // Highlight the tab button
  document.querySelectorAll('#panel-admin .tab').forEach(b => {
    b.classList.remove('active');
  });
  btn.classList.add('active');

  // --- TRIGGER DATA RELOADS ---
  if(tab === 'settings') renderAuditLogs();
    
    if (tab === 'users' || tab === 'permissions') {
    renderUsersTable(); // This fills the dropdown and the table
  }
  if (tab === 'permissions') {
    renderPermissionsMatrix();
  }
  if (tab === 'deleted-msgs') {
    renderDeletedMessages();
  }
  if (tab === 'settings') {
    renderAuditLogs();
  }
}
// ── RESET USER PASSWORD ───────────────────────────────────────
async function resetUserPassword(userId,userName){
  const newPass=prompt('Set a new password for '+userName+':');
  if(!newPass||newPass.trim().length<4){if(newPass!==null)showToast('Password must be at least 4 characters');return;}
  const confirm2=prompt('Confirm new password for '+userName+':');
  if(newPass!==confirm2){showToast('Passwords do not match');return;}
  try{const hashed=await hashPassword(newPass.trim());await window._mpdb.from('profiles').update({password_hash:hashed}).eq('id',userId);showToast(userName+' password reset ✓');}catch(e){showToast('Failed');}
}

// ── PARTS CATALOG ─────────────────────────────────────────────
const PARTS_CATALOG_URLS={'cat':'https://parts.cat.com','caterpillar':'https://parts.cat.com','komatsu':'https://parts.komatsu.com','deere':'https://parts.deere.com','john deere':'https://parts.deere.com','kubota':'https://www.kubotausa.com/parts-and-service','volvo':'https://www.volvoce.com/united-states/en-us/services/parts/','bobcat':'https://www.bobcat.com/en/parts-and-service/parts','case':'https://www.caseparts.com','jcb':'https://parts.jcb.com'};
function getPartsCatalogUrl(name,type,mfr){const text=((mfr||'')+' '+name+' '+(type||'')).toLowerCase();for(const[brand,url]of Object.entries(PARTS_CATALOG_URLS)){if(text.includes(brand))return url;}return 'https://www.google.com/search?q='+encodeURIComponent((mfr||name)+' parts catalog');}
function openPartsCatalog(equipId){if(window.innerWidth<768){showToast('Parts catalog is only available on desktop');return;}const e=state.equipment.find(x=>x.id===equipId);if(!e)return;window.open(getPartsCatalogUrl(e.name,e.type,e.manufacturer),'_blank');}

// ── BUG REPORT ────────────────────────────────────────────────
function updateReportType(){const isBug=document.getElementById('type-bug').checked;const tl=document.getElementById('bug-title-label'),dl=document.getElementById('bug-desc-label');const tw=document.getElementById('bug-title-wrap'),pw=document.getElementById('bug-page-wrap'),sw=document.getElementById('bug-steps-wrap'),sevw=document.getElementById('bug-severity-wrap');const de=document.getElementById('bug-desc'),bl=document.getElementById('type-bug-label'),sugl=document.getElementById('type-sug-label');if(isBug){if(tl)tl.textContent='What were you trying to do? *';if(dl)dl.textContent='What happened? *';if(de)de.placeholder='Describe what went wrong...';if(tw)tw.style.display='block';if(pw)pw.style.display='block';if(sw)sw.style.display='block';if(sevw)sevw.style.display='block';if(bl)bl.style.borderColor='var(--accent)';if(sugl)sugl.style.borderColor='var(--border2)';}else{if(dl)dl.textContent='What would you like to add or change in the app? *';if(de)de.placeholder='Describe your idea...';if(tw)tw.style.display='none';if(pw)pw.style.display='none';if(sw)sw.style.display='none';if(sevw)sevw.style.display='none';if(bl)bl.style.borderColor='var(--border2)';if(sugl)sugl.style.borderColor='var(--accent)';}}
async function submitBugReport(){const isBug=document.getElementById('type-bug').checked;const desc=document.getElementById('bug-desc').value.trim();if(!desc){showToast('Please fill in the required fields');return;}const title=isBug?document.getElementById('bug-title').value.trim():'Suggestion';if(isBug&&!title){showToast('Please fill in the required fields');return;}const report={id:uid(),reporter:currentUser?.name||'Unknown',username:currentUser?.username||'',type:isBug?'bug':'suggestion',title,description:desc,page:isBug?document.getElementById('bug-page').value:'N/A',severity:isBug?document.getElementById('bug-severity').value:'suggestion',steps:isBug?(document.getElementById('bug-steps').value||''):'',created_at:new Date().toISOString()};try{await window._mpdb.from('bug_reports').insert(report);}catch(e){}try{emailjs.init('n5n6_xxmNNHqk0xrE');await emailjs.send('service_o320zzu','template_je3rl4j',{to_email:'tannergalloway75@gmail.com',message:(isBug?'🐛 BUG REPORT':'💡 SUGGESTION')+'\n\nBy: '+report.reporter+'\nTitle: '+title+'\n\nDetails:\n'+desc});}catch(e){}document.getElementById('bug-success').style.display='block';['bug-title','bug-desc','bug-steps'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});setTimeout(()=>{closeModal('bug-modal');document.getElementById('bug-success').style.display='none';},2500);}

// ── PRINT TEMPLATE ────────────────────────────────────────────
function printTemplate(id){const tpl=state.checklistTemplates.find(t=>t.id===id);if(!tpl)return;const date=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${tpl.name}</title><style>body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a18;margin:0;padding:28px;max-width:700px}h1{font-size:18px;margin:0 0 4px}.meta{font-size:11px;color:#888;margin-bottom:20px}.item{display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #eee}.checkbox{width:20px;height:20px;border:2px solid #333;border-radius:3px;flex-shrink:0;margin-top:1px}.num{width:20px;font-size:11px;color:#888;text-align:right;flex-shrink:0;margin-top:2px}.label{flex:1;font-size:13px;line-height:1.4}.notes{margin-top:6px;border:1px solid #ddd;border-radius:3px;min-height:30px}.footer{margin-top:28px;padding-top:12px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:10px;color:#aaa}.sign-row{display:flex;gap:24px;margin-top:24px}.sign-field{flex:1;border-bottom:1px solid #333;padding-bottom:4px;font-size:11px;color:#888}@media print{.no-print{display:none}}</style></head><body><h1>⚙ ${tpl.name}</h1><div class="meta">${tpl.model?'Model: '+tpl.model+' · ':''}${tpl.type?'Type: '+tpl.type+' · ':''}${tpl.items.length} items · MTL Maintenance</div><div style="display:flex;gap:16px;margin-bottom:16px;font-size:12px"><div>Equipment: <span style="border-bottom:1px solid #333;display:inline-block;width:180px">&nbsp;</span></div><div>Date: <span style="border-bottom:1px solid #333;display:inline-block;width:120px">&nbsp;</span></div><div>Technician: <span style="border-bottom:1px solid #333;display:inline-block;width:140px">&nbsp;</span></div></div>${tpl.items.map((item,i)=>`<div class="item"><div class="num">${i+1}</div><div class="checkbox"></div><div class="label">${item}<div class="notes"></div></div></div>`).join('')}<div class="sign-row"><div class="sign-field">Technician signature: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div><div class="sign-field">Supervisor signature: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div></div><div class="footer"><div>MTL Maintenance — ${tpl.name}</div><div>Printed ${date}</div></div><div class="no-print" style="text-align:center;padding:20px"><button onclick="window.print()" style="padding:10px 28px;font-size:14px;cursor:pointer">🖨 Print / Save PDF</button></div><script>window.onload=()=>setTimeout(()=>window.print(),600)<\/script></body></html>`;const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();}else showToast('Allow popups to print');}

// ── PERMANENT DELETE MESSAGE ──────────────────────────────────
async function permanentDeleteMessage(deletedId) {
  if(!confirm('Permanently delete this message? This cannot be undone.')) return;
  try {
    await window._mpdb.from('deleted_messages').delete().eq('id', deletedId);
    showToast('Message permanently deleted');
    renderDeletedMessages();
  } catch(e) {
    showToast('Failed to delete');
  }
}

// ── AUTO-CREATE WO FROM CRITICAL OBSERVATION ─────────────────
async function autoCreateCriticalWO(obs, equipId) {
  const equip = state.equipment.find(e=>e.id===equipId);
  const today = new Date();
  const due = new Date(today.getTime() + 24*60*60*1000); // Due tomorrow
  const wo = {
    id: uid(),
    name: '🚨 Critical — ' + (equip?.name||'Equipment') + ': ' + obs.body.slice(0,60),
    equipId: equipId,
    type: 'Repair',
    priority: 'High',
    status: 'Open',
    due: due.toISOString().split('T')[0],
    assign: '',
    cost: 0,
    notes: 'Auto-created from critical obs by '+obs.author+': '+obs.body.slice(0,100),
    obs_id: obs.id,
    checklist: '',
    photos: [],
    email_freq: 1,
    created_at: new Date().toISOString(),
  };
  try {
    await persist('tasks', 'upsert', wo);
    state.tasks.push(wo);
    showToast('🚨 Critical WO created — due tomorrow');
    renderTasks && renderTasks();
    renderDashboard();
  } catch(e) {
    console.error('Failed to auto-create WO:', e);
  }
}

// ── WO COST CALCULATOR ───────────────────────────────────────
function updateWOCostFromParts() {
  const partsCost = woPartsAdded.reduce((sum,p)=>sum+(p.unit_cost||0)*p.qty_used, 0);
  const costEl = document.getElementById('t-cost');
  const otherEl = document.getElementById('t-other-cost');
  const partsEl = document.getElementById('t-parts-cost');
  const totalEl = document.getElementById('t-total-cost');
  const breakdown = document.getElementById('t-cost-breakdown');

  if(!costEl) return;

  // Get any manually entered other costs
  const currentVal = parseFloat(costEl.value) || 0;
  const prevPartsCost = parseFloat(costEl.dataset.partsCost || 0);
  const otherCost = Math.max(0, currentVal - prevPartsCost);

  // Update cost field with parts + other
  const total = partsCost + otherCost;
  costEl.value = total > 0 ? total.toFixed(2) : '';
  costEl.dataset.partsCost = partsCost;

  // Show breakdown if parts have been added
  if(breakdown) breakdown.style.display = partsCost > 0 ? 'block' : 'none';
  if(partsEl) partsEl.textContent = '$' + partsCost.toFixed(2);
  if(otherEl) otherEl.textContent = '$' + otherCost.toFixed(2);
  if(totalEl) totalEl.textContent = '$' + total.toFixed(2);
}

function updateTotalCostDisplay() {
  const costEl = document.getElementById('t-cost');
  const partsCost = woPartsAdded.reduce((sum,p)=>sum+(p.unit_cost||0)*p.qty_used, 0);
  const otherEl = document.getElementById('t-other-cost');
  const partsEl = document.getElementById('t-parts-cost');
  const totalEl = document.getElementById('t-total-cost');
  const breakdown = document.getElementById('t-cost-breakdown');

  const total = parseFloat(costEl?.value) || 0;
  const otherCost = Math.max(0, total - partsCost);

  if(breakdown) breakdown.style.display = partsCost > 0 ? 'block' : 'none';
  if(partsEl) partsEl.textContent = '$' + partsCost.toFixed(2);
  if(otherEl) otherEl.textContent = '$' + otherCost.toFixed(2);
  if(totalEl) totalEl.textContent = '$' + total.toFixed(2);
}

// ── EDIT OBSERVATION ─────────────────────────────────────────

async function deleteObservation(obsId, equipId) {
    if(!confirm("Delete this observation?")) return;
    try {
        await window._mpdb.from('observations').delete().eq('id', obsId);
        state.observations = state.observations.filter(o => o.id !== obsId);
        refreshObsList(equipId);
        showToast("Observation deleted");
    } catch(e) { showToast("Failed"); }
}

function editObservation(obsId) {
    const o = state.observations.find(x => x.id === obsId);
    if(!o) return;

    const newText = prompt("Edit Observation:", o.body);
    if(newText === null || newText.trim() === "") return;

    const newSev = prompt("Change Severity? (info, watch, or critical):", o.severity);
    const validSevs = ['info', 'watch', 'critical'];
    
    o.body = newText;
    if(validSevs.includes(newSev)) o.severity = newSev;

    window._mpdb.from('observations').update({
        body: o.body,
        severity: o.severity
    }).eq('id', obsId).then(() => {
        refreshObsList(o.equip_id);
        showToast("Updated ✓");
    });
}
async function saveEditObservation(obsId, equipId) {
  const body = document.getElementById('edit-obs-body')?.value.trim();
  const severity = document.getElementById('edit-obs-severity')?.value;
  if(!body) { showToast('Please enter an observation'); return; }

  const obs = state.observations.find(o=>o.id===obsId);
  if(!obs) return;

  const wasCritical = obs.severity === 'critical';
  const nowCritical = severity === 'critical';

  obs.body = body;
  obs.severity = severity;

  try {
    await window._mpdb.from('observations').update({body, severity}).eq('id', obsId);
    showToast('Observation updated ✓');
    document.getElementById('edit-obs-modal-temp')?.remove();
    refreshObsList(equipId);
    renderAlerts();
    if(document.getElementById('recent-obs-list')) renderRecentObservations();

    // Only send email if severity just changed TO critical
    if(nowCritical && !wasCritical) {
      await sendCriticalObsEmail(obs, equipId);
      await autoCreateCriticalWO(obs, equipId);
      showToast('🚨 Critical — email sent and WO created');
    }
  } catch(e) {
    showToast('Failed to update');
  }
}

async function sendCriticalObsEmail(obs, equipId) {
  const equip = state.equipment.find(e=>e.id===equipId);
  try {
    emailjs.init('n5n6_xxmNNHqk0xrE');
    await emailjs.send('service_o320zzu','template_je3rl4j',{
      to_email:'tannergalloway75@gmail.com',
      message:'🚨 CRITICAL OBSERVATION\n\nEquipment: '+(equip?.name||'Unknown')+'\nBy: '+obs.author+'\n\n'+obs.body+'\n\nhttps://mtlmaintenance.github.io/mtl-maintenance'
    });
  } catch(e) { console.log('Email failed:', e); }
}

// ── INVOICES ─────────────────────────────────────────────────
let _currentInvoiceEquipId = null;
let _invoicePhotoData = null;

function openAddInvoice() {
  _invoicePhotoData = null;
  _currentInvoiceEquipId = window._currentDetailEquipId;
  // Reset form
  ['inv-supplier','inv-number','inv-date','inv-amount','inv-notes'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('invoice-scanning').style.display='none';
  document.getElementById('invoice-extracted-badge').style.display='none';
  document.getElementById('inv-clear-photo-wrap').style.display='none';
  document.getElementById('invoice-photo-preview-area').innerHTML=`
    <div style="font-size:32px;margin-bottom:8px">📄</div>
    <div style="font-size:13px;font-weight:500;color:var(--text)">Drop invoice photo here or click to upload</div>
    <div style="font-size:12px;color:var(--text2);margin-top:4px">The app will automatically read the invoice details</div>`;
  openModal('invoice-modal');
}

async function handleInvoicePhoto(input) {
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    _invoicePhotoData = await compressImage(dataUrl, 1200, 0.85);
    
    // Show preview
    document.getElementById('invoice-photo-preview-area').innerHTML=`
      <img src="${_invoicePhotoData}" style="max-height:160px;border-radius:var(--radius);border:1px solid var(--border)"/>
      <div style="font-size:12px;color:var(--success);margin-top:8px;font-weight:500">✓ Photo ready — scanning now...</div>`;
    document.getElementById('inv-clear-photo-wrap').style.display='block';
    
    // Auto-scan with Claude API
    await scanInvoiceWithAI(_invoicePhotoData);
  };
  reader.readAsDataURL(file);
  input.value='';
}

function handleInvoiceDrop(event) {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if(!file || !file.type.startsWith('image/')) return;
  const input = document.getElementById('invoice-photo-input');
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  handleInvoicePhoto(input);
}

async function scanInvoiceWithAI(imageData) {
  document.getElementById('invoice-scanning').style.display='block';
  
  try {
    const base64Data = imageData.split(',')[1];
    const mediaType = imageData.split(';')[0].split(':')[1] || 'image/jpeg';
    
    const GEMINI_KEY = 'AIzaSyPlaceholderReplaceWithYourKey'; // Set via app config
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + window._geminiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: { mime_type: mediaType, data: base64Data }
            },
            {
              text: 'Extract invoice details from this image. Respond ONLY with a JSON object, no other text: {"supplier":"company name or empty string","invoice_number":"invoice/receipt number or empty string","date":"YYYY-MM-DD format or empty string","amount":total_amount_as_number_or_0,"notes":"brief summary of line items or empty string"}'
            }
          ]
        }],
        generationConfig: { maxOutputTokens: 500, temperature: 0 }
      })
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    let extracted = {};
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      extracted = JSON.parse(clean);
    } catch(e) {
      // Try to extract with regex if JSON parse fails
      const amountMatch = text.match(/"amount"\s*:\s*([\d.]+)/);
      const supplierMatch = text.match(/"supplier"\s*:\s*"([^"]+)"/);
      const dateMatch = text.match(/"date"\s*:\s*"([^"]+)"/);
      const numMatch = text.match(/"invoice_number"\s*:\s*"([^"]+)"/);
      const notesMatch = text.match(/"notes"\s*:\s*"([^"]+)"/);
      if(amountMatch) extracted.amount = parseFloat(amountMatch[1]);
      if(supplierMatch) extracted.supplier = supplierMatch[1];
      if(dateMatch) extracted.date = dateMatch[1];
      if(numMatch) extracted.invoice_number = numMatch[1];
      if(notesMatch) extracted.notes = notesMatch[1];
    }

    // Populate form fields
    if(extracted.supplier) document.getElementById('inv-supplier').value = extracted.supplier;
    if(extracted.invoice_number) document.getElementById('inv-number').value = extracted.invoice_number;
    if(extracted.date) document.getElementById('inv-date').value = extracted.date;
    if(extracted.amount) document.getElementById('inv-amount').value = extracted.amount.toFixed(2);
    if(extracted.notes) document.getElementById('inv-notes').value = extracted.notes;

    document.getElementById('invoice-extracted-badge').style.display = 'block';
    showToast('✅ Invoice details extracted');

  } catch(e) {
    console.error('Invoice scan error:', e);
    showToast('Could not read invoice — please fill in manually');
  } finally {
    document.getElementById('invoice-scanning').style.display = 'none';
  }
}

async function saveInvoice() {
  const amount = parseFloat(document.getElementById('inv-amount').value) || 0;
  const supplier = document.getElementById('inv-supplier').value.trim();
  const date = document.getElementById('inv-date').value;
  
  if(!supplier && !amount) { showToast('Please fill in at least supplier or amount'); return; }
  
  const clearPhoto = document.getElementById('inv-clear-photo')?.checked;
  let photoPath = null;

  // Upload photo to Supabase Storage if not clearing
  if(_invoicePhotoData && !clearPhoto) {
    try {
      const invoiceId = uid();
      const fileName = 'invoice-' + invoiceId + '.jpg';
      // Convert base64 to blob
      const base64Data = _invoicePhotoData.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for(let i=0;i<byteCharacters.length;i++) byteNumbers[i]=byteCharacters.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], {type:'image/jpeg'});
      
      const { data: uploadData, error: uploadError } = await window._mpdb.storage
        .from('invoices')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
    
      if(!uploadError) {
        photoPath = fileName;
        showToast('Photo uploaded ✓');
      }
    } catch(e) {
      console.log('Photo upload failed, saving without photo:', e);
    }
  }

  const invoice = {
    id: uid(),
    equip_id: _currentInvoiceEquipId,
    supplier,
    amount,
    invoice_date: date || null,
    invoice_number: document.getElementById('inv-number').value.trim(),
    notes: document.getElementById('inv-notes').value.trim(),
    photo: photoPath,
    created_by: currentUser.name,
    created_at: new Date().toISOString(),
  };

  try {
    await window._mpdb.from('invoices').insert(invoice);
    showToast('Invoice saved ✓');
    closeModal('invoice-modal');
    _invoicePhotoData = null;
    renderInvoicesList(_currentInvoiceEquipId);
  } catch(e) {
    showToast('Failed to save invoice');
    console.error(e);
  }
}

async function renderInvoicesList(equipId) {
  const listEl = document.getElementById('invoices-list');
  if(!listEl) return;
  
  try {
    const { data: invoices } = await window._mpdb.from('invoices')
      .select('*')
      .eq('equip_id', equipId)
      .order('invoice_date', { ascending: false });

    if(!invoices || !invoices.length) {
      listEl.innerHTML = '<div style="color:var(--text3);font-size:13px">No invoices yet</div>';
      return;
    }
  

    const total = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

    listEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;margin-bottom:8px;border-bottom:2px solid var(--border)">
        <span style="font-size:13px;font-weight:600">${invoices.length} invoice${invoices.length!==1?'s':''}</span>
        <span style="font-size:14px;font-weight:700;color:var(--accent)">Total: $${total.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      </div>
      ${invoices.map(inv => `
        <div style="background:var(--bg2);border-radius:var(--radius);padding:10px 12px;margin-bottom:8px;border:1px solid var(--border)">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                <span style="font-weight:600;font-size:14px">$${(inv.amount||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                ${inv.supplier?`<span style="font-size:13px;color:var(--text2)">${inv.supplier}</span>`:''}
                ${inv.invoice_number?`<span class="badge bg" style="font-size:11px">#${inv.invoice_number}</span>`:''}
              </div>
              <div style="font-size:12px;color:var(--text3)">
                ${inv.invoice_date?fmtDate(inv.invoice_date)+' · ':''}Added by ${inv.created_by}
              </div>
              ${inv.notes?`<div style="font-size:12px;color:var(--text2);margin-top:4px">${inv.notes}</div>`:''}
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              ${inv.photo?`<button class="btn btn-secondary btn-sm" onclick="viewInvoicePhoto('${inv.photo}')">📎 Photo</button>`:''}
              ${can('canDelete')?`<button class="btn btn-danger btn-sm" onclick="deleteInvoice('${inv.id}','${equipId}')">Delete</button>`:''}
            </div>
          </div>
        </div>`).join('')}`;
  } catch(e) {
    listEl.innerHTML = '<div style="color:var(--text2);font-size:13px">Could not load invoices</div>';
  }
}

// ── UNLOCK USER ───────────────────────────────────────────────
async function unlockUser(userId, userName) {
  try {
    await window._mpdb.from('profiles').update({ login_attempts: 0, locked_until: null }).eq('id', userId);
    showToast(userName + ' unlocked ✓');
    renderUsersTable();
  } catch(e) { showToast('Failed to unlock'); }
}

// ── INVOICE PHOTO VIEWER ─────────────────────────────────────
async function viewInvoicePhoto(photoPath) {
  try {
    const { data } = await window._mpdb.storage
      .from('invoices')
      .createSignedUrl(photoPath, 300); // 5 minute signed URL
    if(data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      showToast('Could not load photo');
    }
  } catch(e) {
    showToast('Could not load photo');
  }
}

// ── DELETE INVOICE PHOTO FROM STORAGE ────────────────────────
async function deleteInvoicePhotoFromStorage(photoPath) {
  if(!photoPath) return;
  try {
    await window._mpdb.storage.from('invoices').remove([photoPath]);
  } catch(e) {
    console.log('Photo delete error:', e);
  }
}

// Override deleteInvoice to also remove photo from storage
const _baseDeleteInvoice = deleteInvoice;
async function deleteInvoice(invoiceId, equipId) {
  if(!confirm('Delete this invoice?')) return;
  try {
    // Get photo path first
    const { data: inv } = await window._mpdb.from('invoices').select('photo').eq('id', invoiceId).single();
    if(inv?.photo) await deleteInvoicePhotoFromStorage(inv.photo);
    await window._mpdb.from('invoices').delete().eq('id', invoiceId);
    showToast('Invoice deleted');
    renderInvoicesList(equipId);
  } catch(e) {
    showToast('Failed to delete');
  }
}

// ── GEMINI KEY MANAGEMENT ─────────────────────────────────────
function saveGeminiKey() {
  const key = document.getElementById('gemini-key-input')?.value.trim();
  if(!key || key.startsWith('•')) { showToast('Enter a valid API key'); return; }
  window._geminiKey = key;
  try { localStorage.setItem('mp_gemini_key', key); } catch(e) {}
  document.getElementById('gemini-key-status').textContent = '✅ Gemini key saved';
  document.getElementById('gemini-key-input').value = '••••••••••••••••';
  showToast('Gemini API key saved ✓');
}

// ── AI TOOL SUGGESTIONS ───────────────────────────────────────
let _lastToolSuggestion = '';

async function suggestTools() {
  if(!window._geminiKey) {
    showToast('Set your Gemini API key in Admin → Settings first');
    return;
  }
  const woName = document.getElementById('t-name')?.value.trim();
  const equipId = document.getElementById('t-equip')?.value;
  if(!woName) { showToast('Enter a work order name first'); return; }

  const btn = document.getElementById('suggest-tools-btn');
  if(btn) { btn.textContent = '⏳ Thinking...'; btn.disabled = true; }

  try {
    // Get relevant past work orders for context
    const equip = state.equipment.find(e=>e.id===equipId);
    const pastWOs = state.tasks
      .filter(t=>t.status==='Completed' && t.tools && (
        (equipId && t.equipId===equipId) ||
        t.name.toLowerCase().split(' ').some(w=>w.length>3&&woName.toLowerCase().includes(w))
      ))
      .slice(0,10)
      .map(t=>`Job: "${t.name}" on ${equipName(t.equipId)} — Tools: ${t.tools}`).join('\n');

    const prompt = `You are a heavy equipment maintenance expert. Based on the work order history below, suggest the tools needed for this new job.

Equipment: ${equip?.name || 'Unknown'} (${equip?.type || ''})
New work order: "${woName}"

Past similar work orders:
${pastWOs || 'No relevant history yet - suggest based on job name and equipment type'}

Respond with ONLY a comma-separated list of tools needed. Be specific and concise. Example: "3/4 socket set, torque wrench 150 ft-lbs, hydraulic pressure gauge, drain pan, shop rags"`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + window._geminiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.3 }
      })
    });

    const data = await response.json();
    const suggestion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if(suggestion) {
      _lastToolSuggestion = suggestion;
      document.getElementById('tools-suggestion-text').textContent = suggestion;
      document.getElementById('tools-suggestion-area').style.display = 'block';
    } else {
      showToast('No suggestion available — fill in manually');
    }
  } catch(e) {
    console.error('Tool suggestion error:', e);
    showToast('AI suggestion failed — fill in manually');
  } finally {
    if(btn) { btn.textContent = '✨ AI Suggest'; btn.disabled = false; }
  }
}

function acceptToolSuggestion() {
  const toolsField = document.getElementById('t-tools');
  if(toolsField && _lastToolSuggestion) {
    toolsField.value = _lastToolSuggestion;
  }
  document.getElementById('tools-suggestion-area').style.display = 'none';
}
function handleGlobalSearch() {
  const q = document.getElementById('global-search').value.toLowerCase().trim();
  const res = document.getElementById('search-results');
  if (q.length < 2) { res.style.display = 'none'; return; }

  let html = '';
  // Search Equipment
  const eq = state.equipment.filter(e => e.name.toLowerCase().includes(q) || (e.serial && e.serial.toLowerCase().includes(q)));
  if (eq.length) html += `<div style="padding:8px; font-size:11px; font-weight:600; color:var(--text3); background:var(--bg2)">EQUIPMENT</div>` + 
    eq.map(e => `<div style="padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--border)" onclick="openEquipDetail('${e.id}'); document.getElementById('search-results').style.display='none'">${e.name} <span style="font-size:11px; color:var(--text2)">(${e.serial})</span></div>`).join('');

  // Search Work Orders
  const tk = state.tasks.filter(t => t.name.toLowerCase().includes(q) || (t.assign && t.assign.toLowerCase().includes(q)));
  if (tk.length) html += `<div style="padding:8px; font-size:11px; font-weight:600; color:var(--text3); background:var(--bg2)">WORK ORDERS</div>` + 
    tk.map(t => `<div style="padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--border)" onclick="openTaskDetail('${t.id}'); document.getElementById('search-results').style.display='none'">${t.name} <span style="font-size:11px; color:var(--text2)">[${t.status}]</span></div>`).join('');

  // Search Parts
  const pt = state.parts.filter(p => p.name.toLowerCase().includes(q) || p.num.toLowerCase().includes(q));
  if (pt.length) html += `<div style="padding:8px; font-size:11px; font-weight:600; color:var(--text3); background:var(--bg2)">PARTS</div>` + 
    pt.map(p => `<div style="padding:8px 12px; border-bottom:1px solid var(--border)">${p.name} <span style="font-size:11px; color:var(--text2)">(${p.num}) - ${p.qty} in stock</span></div>`).join('');
 // Search Tools
  const tl = state.tools.filter(t => t.name.toLowerCase().includes(q));
  if (tl.length) {
    html += `<div style="padding:6px 10px; font-size:10px; font-weight:700; color:var(--text3); background:var(--bg2)">TOOLS</div>`;
    html += tl.map(t => `<div style="padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--border); font-size:13px" onclick="showPanel('tools'); editTool('${t.id}'); document.getElementById('search-results').style.display='none'"><b>${t.name}</b> <span style="font-size:11px; color:var(--text2)">@ ${t.location || 'Shop'}</span></div>`).join('');
  }

  res.innerHTML = html || `<div style="padding:20px; text-align:center; color:var(--text3); font-size:13px">No results for "${q}"</div>`;
  res.style.display = 'block';
}


async function toggleToolStatus(id) {
  const t = state.tools.find(x => x.id === id);
  if (t.status === 'In Shop') {
    t.status = 'Checked Out';
    t.checked_out_by = currentUser.name;
  } else {
    t.status = 'In Shop';
    t.checked_out_by = null;
  }
  t.last_updated = new Date().toISOString();
  await persist('shop_tools', 'upsert', t);
  renderTools();
}  
function switchToolTab(view) {
    // Hide all views
    document.getElementById('tool-inventory-view').style.display = 'none';
    document.getElementById('tool-wishlist-view').style.display = 'none';
    document.getElementById('tool-denied-view').style.display = 'none';
    
    // Deactivate all tabs
    document.getElementById('tool-inv-tab').classList.remove('active');
    document.getElementById('tool-wish-tab').classList.remove('active');
    document.getElementById('tool-denied-tab').classList.remove('active');

    // Show selected
    if (view === 'inventory') {
        document.getElementById('tool-inventory-view').style.display = 'block';
        document.getElementById('tool-inv-tab').classList.add('active');
        renderTools();
    } else if (view === 'wishlist') {
        document.getElementById('tool-wishlist-view').style.display = 'block';
        document.getElementById('tool-wish-tab').classList.add('active');
        renderWishlist();
    } else if (view === 'denied') {
        document.getElementById('tool-denied-view').style.display = 'block';
        document.getElementById('tool-denied-tab').classList.add('active');
        renderDeniedList();
    }
}
function renderTools() {
    const tableBody = document.getElementById('tools-table-body');
    if(!tableBody) return;

    tableBody.innerHTML = state.tools.map(t => {
        const isOnOrder = t.location && t.location.includes('ON ORDER');
        const critical = (t.health <= 40 || t.is_lost) && !isOnOrder;
        const rowClick = can('canManageTools') ? `onclick="editTool('${t.id}')"` : '';
        const rowCursor = can('canManageTools') ? 'pointer' : 'default';

        return `<tr onclick="editTool('${t.id}')" style="cursor:pointer; ${isOnOrder ? 'background: var(--accent-bg)' : ''}">
            <td><b>${t.name}</b></td>
            <td>${t.category}</td>
            <td><span style="${isOnOrder ? 'font-weight:700; color:var(--accent-text)' : ''}">${t.location || '—'}</span></td>
            <td>${isOnOrder ? '—' : t.health + '%'}</td>
            <td>${isOnOrder ? '<span class="badge bi">ORDERED</span>' : t.is_lost ? '<span class="badge bd">LOST</span>' : '<span class="badge bs">OK</span>'}</td>
            <td>${critical ? '<span class="badge bd">🛒 REPLACE</span>' : isOnOrder ? '<span style="font-size:11px; color:var(--accent-text)">Arriving soon</span>' : '—'}</td>
        </tr>`;
    }).join('');
}

async function saveTool() {
    const id = document.getElementById('tool-edit-id').value;
    const tool = {
        id: id || uid(),
        name: document.getElementById('tool-name').value.trim(),
        category: document.getElementById('tool-cat').value,
        location: document.getElementById('tool-loc').value.trim(),
        health: parseInt(document.getElementById('tool-health').value),
        is_lost: document.getElementById('tool-lost').checked,
        last_updated: new Date().toISOString()
    };
    if(!tool.name) return;
    await window._mpdb.from('shop_tools').upsert(tool);
    const idx = state.tools.findIndex(x => x.id === tool.id);
    if(idx > -1) state.tools[idx] = tool; else state.tools.push(tool);
        logAuditAction("Tool Update", `${name}: Health ${tool.health}%, Lost: ${tool.is_lost}`);
    if(tool.health <= 40 || tool.is_lost) {
        await notifyManagers(`⚠️ TOOL ALERT: "${tool.name}" ${tool.is_lost ? 'is LOST' : 'is CRITICAL ('+tool.health+'%)'}.`);
    }
    closeModal('tool-modal'); renderTools();
}
function renderWishlist() {
    const container = document.getElementById('wishlist-container');
    const pending = state.wishlist.filter(w => w.status === 'pending');
    const isManager = currentUser.role === 'admin' || currentUser.role === 'manager';

    container.innerHTML = pending.map(w => `
        <div class="card" style="border-left: 5px solid var(--warning)">
            <div style="display:flex; justify-content:space-between; align-items:flex-start">
                <div>
                    <div style="font-weight:700; font-size:15px">${w.tool_name}</div>
                    <!-- ONLY MANAGERS SEE THE NAME -->
                    <div style="font-size:11px; color:var(--text3); margin-top:2px">
                        ${isManager ? `Requested by <b>${w.requested_by}</b>` : `Status: Pending Review`}
                    </div>
                </div>
                <span class="badge bw">PENDING</span>
            </div>
            <div style="margin-top:10px; font-size:13px; color:var(--text2); background:var(--bg2); padding:8px 10px; border-radius:4px">
                <b>Reason Needed:</b> ${w.request_reason || 'No reason provided.'}
            </div>
            ${isManager ? `
                <div style="margin-top:12px; display:flex; gap:8px">
                    <button class="btn btn-success btn-sm" onclick="handleWishApproval('${w.id}')">Approve</button>
                    <button class="btn btn-danger btn-sm" onclick="handleWishDenial('${w.id}')">Deny</button>
                </div>
            ` : ''}
        </div>`).join('') || '<div style="color:var(--text3); padding:20px">No pending suggestions.</div>';
    updateWishCount();
}
function renderDeniedList() {
    const container = document.getElementById('denied-container');
    const denied = state.wishlist.filter(w => w.status === 'denied');
    const isManager = currentUser.role === 'admin' || currentUser.role === 'manager';
    
    container.innerHTML = denied.map(w => `
        <div class="card" style="border-left: 5px solid var(--danger); opacity: 0.9">
            <div style="display:flex; justify-content:space-between">
                <div>
                    <div style="font-weight:700; font-size:15px">${w.tool_name}</div>
                    <div style="font-size:11px; color:var(--text3)">
                        Denied on: ${new Date(w.created_at).toLocaleDateString()} 
                        ${isManager ? ` · Requested by: ${w.requested_by}` : ''}
                    </div>
                </div>
                <span class="badge bd">DENIED</span>
            </div>
            <div style="margin-top:10px; font-size:12px; color:var(--danger-text); background:var(--danger-bg); padding:8px 10px; border-radius:4px">
                <b>Denial Reason:</b> ${w.denial_reason || 'Not specified.'}
            </div>
        </div>`).join('') || '<div style="color:var(--text3); padding:20px">No denied tools in history.</div>';
}

async function handleWish(id, status) {
    let reason = "";
    if (status === 'denied') { reason = prompt("Denial reason:"); if (reason === null) return; }
    const req = state.wishlist.find(x => x.id === id);
    await window._mpdb.from('tool_requests').update({status, denial_reason: reason}).eq('id', id);
    req.status = status;
    if (status === 'denied') await sendDM(req.requested_by, `❌ Tool request "${req.tool_name}" denied: ${reason}`);
    else await notifyManagers(`✅ Tool approved: "${req.tool_name}" (Req by ${req.requested_by})`);
    renderWishlist();
}
async function saveWishRequest() {
    const name = document.getElementById('wish-name').value.trim();
    const reason = document.getElementById('wish-reason').value.trim();
    
    if(!name || !reason) { 
        showToast("Please provide both the Tool Name and the Reason."); 
        return; 
    }

    const req = { 
        id: uid(), 
        tool_name: name, 
        request_reason: reason, // NEW FIELD
        requested_by: currentUser.name, 
        status: 'pending', 
        created_at: new Date().toISOString() 
    };

    try {
        await window._mpdb.from('tool_requests').insert(req);
        state.wishlist.unshift(req);
        
        // Reset form
        document.getElementById('wish-name').value = '';
        document.getElementById('wish-reason').value = '';
        
        closeModal('wishlist-modal'); 
        switchToolTab('wishlist');
        showToast("Suggestion submitted for review ✓");
    } catch(e) {
        showToast("Error submitting request");
    }
}
function updateWishCount() {
    const count = state.wishlist.filter(w => w.status === 'pending').length;
    const badge = document.getElementById('wish-count');
    if(badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-block' : 'none'; }
}

async function notifyManagers(text) {
    const { data: m } = await window._mpdb.from('profiles').select('username').in('role', ['admin', 'manager']);
    for (const u of m) { if (u.username !== currentUser.username) await sendDMToUsername(u.username, text); }
}

async function sendDM(fullName, text) {
    const { data: p } = await window._mpdb.from('profiles').select('username').eq('full_name', fullName).single();
    if (p) await sendDMToUsername(p.username, text);
}

async function sendDMToUsername(username, text) {
    const ch = 'dm-' + [currentUser.username, username].sort().join('-');
    await window._mpdb.from('chat_messages').insert({ id: uid(), channel: ch, author: 'System', author_name: 'Tool Monitor', body: text, created_at: new Date().toISOString() });
}

function renderEquipTimeline(equipId) {
  const container = document.getElementById('eq-timeline-content');
  if(!container) return;

  // Gather Work Orders
  const tasks = state.tasks.filter(t => t.equipId === equipId).map(t => ({ 
      date: t.due, 
      title: t.name, 
      body: t.notes, 
      type: 'WO', 
      status: t.status 
  }));
  
  // Gather Observations
  const obs = (state.observations || []).filter(o => o.equip_id === equipId).map(o => ({ 
      date: o.created_at, 
      title: o.severity.toUpperCase() + ' Obs', 
      body: o.body, 
      type: 'OBS', 
      author: o.author,
      photo: o.photo
  }));
  
  // Combine and Sort (Newest at top)
  const timeline = [...tasks, ...obs].sort((a,b) => new Date(b.date) - new Date(a.date));

  if (!timeline.length) {
    container.innerHTML = '<div style="color:var(--text3); font-size:13px; padding:20px 0">No history found for this machine.</div>';
    return;
  }

  container.innerHTML = timeline.map(item => `
    <div style="position:relative; padding-left:24px; margin-bottom:20px; border-left:2px solid var(--border)">
      <!-- The Timeline Dot -->
      <div style="position:absolute; left:-7px; top:0; width:12px; height:12px; border-radius:50%; background:${item.type === 'WO' ? 'var(--accent)' : 'var(--warning)'}; border:2px solid var(--bg)"></div>
      
      <div style="font-size:11px; color:var(--text3); font-weight:600">${fmtDate(item.date)}</div>
      <div style="font-weight:600; font-size:14px; margin:2px 0">${item.title} ${item.status ? `<span class="badge bg" style="font-size:10px">${item.status}</span>` : ''}</div>
      <div style="font-size:13px; color:var(--text2); line-height:1.4">${item.body || ''}</div>
      
      ${item.photo ? `<img src="${item.photo}" style="width:100px; height:100px; object-fit:cover; border-radius:4px; margin-top:8px; border:1px solid var(--border); cursor:pointer" onclick="viewPhoto('${item.photo}')"/>` : ''}
      
      ${item.author ? `<div style="font-size:11px; color:var(--text3); margin-top:4px">Logged by ${item.author}</div>` : ''}
    </div>
  `).join('');
}
function healthColor(score) {
    if (score <= 40) return '#E24B4A'; // Red
    if (score <= 70) return '#BA7517'; // Orange
    return '#3B6D11'; // Green
}
// Switches between Details and Observations inside the tool popup
function switchToolModalTab(tab) {
    document.getElementById('tool-tab-details').style.display = tab === 'details' ? 'block' : 'none';
    document.getElementById('tool-tab-obs').style.display = tab === 'observations' ? 'block' : 'none';
    document.getElementById('btn-tool-details').classList.toggle('active', tab === 'details');
    document.getElementById('btn-tool-obs').classList.toggle('active', tab === 'observations');
    if(tab === 'observations') renderToolObsList();
}

// 2. Render Observations specific to a tool
function renderToolObsList() {
    const toolId = document.getElementById('tool-edit-id').value;
    const container = document.getElementById('tool-obs-list');
    if(!toolId || !container) return;

    // Check if the current user has permission to delete
    const canDeleteNotes = currentUser.role === 'admin' || currentUser.role === 'manager';

    const obs = state.observations.filter(o => o.tool_id === toolId);
    
    container.innerHTML = obs.map(o => `
        <div style="padding:10px; border-bottom:1px solid var(--border); font-size:13px; position:relative">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px">
                <div style="font-size:11px; color:var(--text3); font-weight:600">
                    ${o.author} · ${new Date(o.created_at).toLocaleDateString()}
                </div>
                ${canDeleteNotes ? 
                    `<button class="btn btn-danger" style="padding:2px 6px; font-size:10px" 
                        onclick="deleteToolObservation('${o.id}')" title="Delete Note">✕</button>` 
                    : ''}
            </div>
            <div style="line-height:1.4; color:var(--text)">${o.body}</div>
        </div>
    `).join('') || '<div style="color:var(--text3); font-size:12px; padding:20px; text-align:center">No notes recorded for this tool.</div>';
}

// 3. Add an observation to a tool
async function addToolObservation() {
    const toolId = document.getElementById('tool-edit-id').value;
    const body = document.getElementById('tool-obs-input').value.trim();
    if(!toolId || !body) return;

    const obs = {
        id: uid(),
        tool_id: toolId,
        author: currentUser.name,
        body: body,
        severity: 'info',
        created_at: new Date().toISOString()
    };

    try {
        await window._mpdb.from('observations').insert(obs);
        state.observations.unshift(obs);
        document.getElementById('tool-obs-input').value = '';
        renderToolObsList();
        showToast("Note added ✓");
    } catch(e) { showToast("Failed to save note"); }
}
function resetToolForm() {
    document.getElementById('tool-edit-id').value = '';
    document.getElementById('tool-name').value = '';
    document.getElementById('tool-loc').value = '';
    document.getElementById('tool-health').value = 100;
    document.getElementById('health-val-display').textContent = '100%';
    document.getElementById('tool-lost').checked = false;
    document.getElementById('tool-delete-btn').style.display = 'none';
}
    // 1. OPEN THE TOOL POPUP
function editTool(id) {
    console.log("Opening tool popup for ID:", id);
    const t = state.tools.find(x => x.id === id);
    if(!t) return;

    // Reset popup to 'Details' tab
    if (typeof switchToolModalTab === 'function') switchToolModalTab('details');

    // Fill the hidden ID field so the save function knows which tool to update
    document.getElementById('tool-edit-id').value = t.id;
    
    // Fill the visible fields
    document.getElementById('tool-name').value = t.name;
    document.getElementById('tool-cat').value = t.category || 'Other';
    document.getElementById('tool-loc').value = t.location || '';
    document.getElementById('tool-health').value = t.health || 100;
    document.getElementById('health-val-display').textContent = (t.health || 100) + '%';
    document.getElementById('tool-lost').checked = !!t.is_lost;
    
    // Show the delete button because we are editing an existing tool
    const delBtn = document.getElementById('tool-delete-btn');
    if(delBtn) delBtn.style.display = 'block';
    
    openModal('tool-modal');
}

// 2. SAVE TOOL CHANGES
async function saveTool() {
    const id = document.getElementById('tool-edit-id').value;
    const name = document.getElementById('tool-name').value.trim();
    if(!name) { showToast("Name is required"); return; }

    const tool = {
        id: id || uid(), // If no ID, it's a new tool
        name: name,
        category: document.getElementById('tool-cat').value,
        location: document.getElementById('tool-loc').value.trim(),
        health: parseInt(document.getElementById('tool-health').value),
        is_lost: document.getElementById('tool-lost').checked,
        last_updated: new Date().toISOString()
    };

    try {
        await window._mpdb.from('shop_tools').upsert(tool);
        
        // Update local memory
        const idx = state.tools.findIndex(x => x.id === tool.id);
        if(idx > -1) state.tools[idx] = tool; else state.tools.push(tool);

        // Notify managers if broken or lost
        if(tool.health <= 40 || tool.is_lost) {
            if(typeof notifyToolManagers === 'function') {
                notifyToolManagers(`⚠️ TOOL ALERT: "${tool.name}" is ${tool.is_lost ? 'LOST' : 'BROKEN ('+tool.health+'%)'}`);
            }
        }

        closeModal('tool-modal');
        renderTools(); // Redraw the table
        showToast("Tool Saved ✓");
    } catch(e) {
        showToast("Error saving tool");
        console.error(e);
    }
}

// 3. DELETE A TOOL
async function deleteTool() {
    const id = document.getElementById('tool-edit-id').value;
    if(!id || !confirm("Permanently delete this tool from inventory?")) return;

    try {
        await window._mpdb.from('shop_tools').delete().eq('id', id);
       logAuditAction("Deleted Tool", `Removed ${tool ? tool.name : 'Unknown Tool'}`);  
      state.tools = state.tools.filter(t => t.id !== id);
        closeModal('tool-modal');
        renderTools();
        showToast("Tool deleted");
    } catch(e) {
        showToast("Delete failed");
    }
}
async function deleteToolObservation(obsId) {
    if (!confirm("Are you sure you want to permanently delete this note?")) return;

    try {
        // 1. Remove from Supabase
        const { error } = await window._mpdb
            .from('observations')
            .delete()
            .eq('id', obsId);

        if (error) throw error;

        // 2. Remove from local memory
        state.observations = state.observations.filter(o => o.id !== obsId);

        // 3. Log the action to the audit log (optional but recommended)
        if (typeof logAuditAction === 'function') {
            logAuditAction("Deleted Tool Note", `A tool observation was removed by ${currentUser.name}`);
        }

        // 4. Refresh the list on screen
        renderToolObsList();
        showToast("Note deleted");
    } catch (e) {
        console.error("Delete failed:", e);
        showToast("Error: Could not delete note");
    }
}
async function handleWishApproval(id) {
    const req = state.wishlist.find(x => x.id === id);
    if (!req) return;

    // 1. Mark wish as approved
    req.status = 'approved';
    await window._mpdb.from('tool_requests').update({status: 'approved'}).eq('id', id);

    // 2. Create the tool in Inventory as "On Order"
    const newTool = {
        id: uid(),
        name: req.tool_name,
        category: 'Other',
        location: '📦 ON ORDER', // This marks it as not here yet
        health: 100,
        is_lost: false,
        last_updated: new Date().toISOString()
    };
    
    state.tools.push(newTool);
    await window._mpdb.from('shop_tools').insert(newTool);

    await notifyManagers(`✅ Tool Approved & Ordered: "${req.tool_name}" (Requested by ${req.requested_by})`);
    
    showToast("Approved! Tool added to Inventory as 'On Order'");
     logAuditAction("Wishlist Approval", `Approved and Ordered: ${req.tool_name}`);
  switchToolTab('inventory');
}

async function handleWishDenial(id) {
    const reason = prompt("Why is this tool being denied? (This will be shown to the crew)");
    if (reason === null) return;

    const req = state.wishlist.find(x => x.id === id);
    req.status = 'denied';
    req.denial_reason = reason;

    await window._mpdb.from('tool_requests').update({status: 'denied', denial_reason: reason}).eq('id', id);
    
    await sendDM(req.requested_by, `❌ Your tool request for "${req.tool_name}" was denied. Reason: ${reason}`);
    
    showToast("Request denied and moved to history");
       logAuditAction("Wishlist Denial", `Denied "${req.tool_name}". Reason: ${reason}`);
  renderWishlist();
}

function promptWishlistCheck() {
    alert("Please ensure you have checked the 'Denied History' tab to see if this tool was previously rejected before submitting your suggestion.");
    openModal('wishlist-modal');
}
    
function syncAdminRoleSelects() {
    const userId = document.getElementById('role-user-select').value;
    if (!userId) return;

    // Find the user's data in our local state
    // Note: We check profiles in loadState, so we need to ensure they are accessible
    // Let's fetch the specific user from the state we loaded in renderUsersTable
    const { data: profile } = state.users_list_cache ? { data: state.users_list_cache.find(u => u.id === userId) } : { data: null };

    if (profile) {
        // Set the Role dropdown to match the user
        document.getElementById('role-select').value = profile.role || 'tech';
        
        // Set the Group dropdown to match the user
        document.getElementById('group-select').value = profile.group_tag || '';
        
        console.log(`Syncing UI for ${profile.username}: Role=${profile.role}, Group=${profile.group_tag}`);
    }
}
async function renderAdminPanel(){
  try {
    const { data: profiles } = await window._mpdb.from('profiles').select('*').order('created_at',{ascending:false});
    if (!profiles) return;
    
    const pending = profiles.filter(p => p.status === 'pending');
    const active = profiles.filter(p => p.status === 'approved');
    document.getElementById('pending-count').textContent = pending.length || '0';
    document.getElementById('pending-list').innerHTML = pending.map(p => `
      <div class="parts-row">
        <div style="flex:1"><b>${p.full_name}</b> (${p.username})</div>
        <button class="btn btn-success btn-sm" onclick="approveUser('${p.id}')">Approve</button>
      </div>`).join('') || 'No pending requests';

    // Call user table render to fill the rest
    renderUsersTable();
  } catch(e){ console.error(e); }
}

async function approveUser(id){
  await window._mpdb.from('profiles').update({status:'approved'}).eq('id',id);
  showToast('User approved ✓');
  renderAdminPanel();
}

async function renderUsersTable() {
  try {
    const { data: profiles } = await window._mpdb.from('profiles').select('*').order('created_at', { ascending: false });
    if (!profiles) return;

    // Save users to a cache so we can find names by ID later
    state.users_list_cache = profiles;

    const active = profiles.filter(p => p.status === 'approved');
    const tableBody = document.getElementById('users-table-body');
    
    if (tableBody) {
        const rc = { 'admin': 'bd', 'manager': 'bw', 'tech': 'bi', 'viewer': 'bg' };
        
        // FIX: We ONLY pass the ID string. No names. No quotes. No crashes.
        tableBody.innerHTML = active.map(p => `
            <tr>
                <td><b>${p.full_name || p.username}</b></td>
                <td>${p.username}</td>
                <td><span class="badge ${rc[p.role] || 'bg'}">${p.role || 'tech'}</span></td>
                <td>${p.group_tag ? `<span class="badge bi">${p.group_tag}</span>` : '—'}</td>
                <td>
                  <div style="display:flex; gap:5px;">
                    <button class="btn btn-secondary btn-sm" onclick="promptResetPin('${p.id}')">🔑 PIN</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser('${p.id}')">Delete</button>
                  </div>
                </td>
            </tr>`).join('');
    }

    const userSelect = document.getElementById('role-user-select');
    if (userSelect) {
      userSelect.innerHTML = '<option value="">— Select User —</option>' + 
        active.map(p => `<option value="${p.id}">${p.full_name} (${p.username})</option>`).join('');
    }
  } catch(e) { console.error("Table Render Crash:", e); }
}
function handleChatInput(el) {
    // 1. Auto-resize textarea
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';

    const val = el.value;
    const cursor = el.selectionStart;
    const lastAt = val.lastIndexOf('@', cursor - 1);

    // 2. Check if user is typing a mention
    if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
        const query = val.substring(lastAt + 1, cursor).toLowerCase();
        
        // Fetch users from our existing cache or profiles
        const users = (state.users_list_cache || []).filter(u => 
            u.full_name.toLowerCase().includes(query) || 
            u.username.toLowerCase().includes(query)
        );

        if (users.length > 0) {
            showMentionDropdown(users, lastAt);
        } else {
            hideMentionDropdown();
        }
    } else {
        hideMentionDropdown();
    }
}

function showMentionDropdown(users, atPos) {
    const dd = document.getElementById('mention-dropdown');
    if (!dd) return;
    
    dd.innerHTML = users.map(u => `
        <div class="mention-item" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--border); font-size:13px" onclick="insertMention('${u.username}', ${atPos})">
            <b>${u.full_name}</b> <span style="font-size:11px; color:var(--text3)">@${u.username}</span>
        </div>
    `).join('');
    dd.style.display = 'block';
}

function hideMentionDropdown() {
    const dd = document.getElementById('mention-dropdown');
    if (dd) dd.style.display = 'none';
}

function insertMention(username, atPos) {
    const input = document.getElementById('chat-input');
    const val = input.value;
    const before = val.substring(0, atPos);
    const after = val.substring(input.selectionStart);
    
    input.value = before + '@' + username + ' ' + after;
    hideMentionDropdown();
    input.focus();
}
// --- THE MASTER SWITCHBOARD ---
async function showPanel(id) {
    // 1. Reset view to top of page
    window.scrollTo(0, 0);

    // 2. Hide all panels and deactivate nav buttons
    const panels = document.querySelectorAll('.panel');
    panels.forEach(p => {
        p.style.display = 'none';
        p.classList.remove('active');
    });

    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(b => b.classList.remove('active'));

    // 3. Show the requested panel
    const targetPanel = document.getElementById('panel-' + id);
    if (targetPanel) {
        targetPanel.style.display = 'block';
        targetPanel.classList.add('active');
    } else {
        console.warn("Panel not found:", 'panel-' + id);
    }

    // 4. Highlight the clicked button
    navButtons.forEach(btn => {
        // This checks if the button's onclick contains the panel ID
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes("'" + id + "'")) {
            btn.classList.add('active');
        }
    });

    // 5. THE SWITCHBOARD (Logic for every tab)
    const renderMap = {
        'dashboard': async () => {
            if (typeof renderDashboard === 'function') await renderDashboard();
        },
        'calendar': async () => {
            if (typeof renderCalendar === 'function') await renderCalendar();
        },
        'equipment': () => {
            if (typeof renderEquipmentTable === 'function') renderEquipmentTable();
        },
        'tasks': () => {
            if (typeof renderTasks === 'function') renderTasks();
        },
        'parts': () => {
            if (typeof renderParts === 'function') renderParts();
        },
        'suppliers': () => {
            if (typeof renderSuppliers === 'function') renderSuppliers();
        },
        'documents': () => {
            if (typeof renderDocuments === 'function') renderDocuments();
        },
        'analytics': () => {
            if (typeof renderAnalytics === 'function') renderAnalytics();
        },
        'admin': () => {
            if (typeof renderAdminPanel === 'function') renderAdminPanel();
        },
        'checklists': () => {
            if (typeof renderChecklistTemplates === 'function') renderChecklistTemplates();
        },
        'chat': () => { 
            if (typeof renderChat === 'function') renderChat(); 
            if (typeof markChannelRead === 'function') markChannelRead(currentChannel); 
        },
        'tools': () => { 
            // This forces the Tool Crib to reset to the 'Inventory' tab when opened
            if (typeof switchToolTab === 'function') switchToolTab('inventory');
            if (typeof renderTools === 'function') renderTools(); 
            if (typeof updateWishCount === 'function') updateWishCount(); 
        }
    };

    // 6. Execute the render if it exists
    if (renderMap[id]) {
        await renderMap[id]();
    }
    if (id === 'chat') {
        requestAnimationFrame(() => {
            applyDesktopChatHeight();
        });
    }
    if (id !== 'calendar') {
        const calPanel = document.getElementById('panel-calendar');
        if (calPanel) calPanel.style.overflowY = '';
    }
}

// Ensure the Mobile Chat Auto-Close logic is placed OUTSIDE of showPanel
const _baseSwitchChannel = typeof switchChannel === 'function' ? switchChannel : null;
if (_baseSwitchChannel) {
    switchChannel = function(channel, btn) {
        _baseSwitchChannel(channel, btn);
        // AUTO-CLOSE SIDEBAR ON MOBILE
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('chat-sidebar');
            if (sidebar) sidebar.classList.remove('open');
        }
    };
}

// Function to send a log to the database
async function logAuditAction(action, details) {
  try {
    await window._mpdb.from('audit_logs').insert({
      user_name: currentUser?.name || 'System',
      action: action,
      details: details,
      created_at: new Date().toISOString()
    });
  } catch(e) { console.warn("Logging failed"); }
}

// Function to draw the logs on the screen
async function renderAuditLogs() {
  const container = document.getElementById('audit-log-list');
  if(!container) return;
  
  try {
    const { data } = await window._mpdb.from('audit_logs').select('*').order('created_at', {ascending: false}).limit(50);
    if(!data || !data.length) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text3)">No logs found.</div>';
        return;
    }
    container.innerHTML = data.map(log => `
      <div style="padding:8px 12px; border-bottom:1px solid var(--border); display:flex; gap:10px; font-size:12px">
        <div style="color:var(--text3); width:70px; flex-shrink:0">${new Date(log.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
        <div style="flex:1"><b>${log.user_name}</b>: ${log.action} <div style="font-size:11px; color:var(--text2)">${log.details}</div></div>
      </div>
    `).join('');
  } catch(e) { container.innerHTML = 'Failed to load logs.'; }
}
async function refreshZerkMap(equipId) {
    const e = state.equipment.find(x => x.id === equipId);
    if(!e) return;

    const switcher = document.getElementById('zerk-view-switcher');
    const container = document.getElementById('zerk-map-container');
    const noPhotos = document.getElementById('zerk-no-photos');

    // 1. Check if photos exist in the database for this machine
    if(!e.zerk_photos || e.zerk_photos.length === 0) {
        if(container) container.style.display = 'none';
        if(noPhotos) noPhotos.style.display = 'block';
        return;
    }

    // 2. Photos exist, show the map UI
    if(container) container.style.display = 'block';
    if(noPhotos) noPhotos.style.display = 'none';

    // 3. Rebuild the view buttons
    if(switcher) {
        switcher.innerHTML = e.zerk_photos.map((_, i) => `
            <button class="btn btn-secondary btn-sm" id="btn-side-${i+1}" onclick="changeZerkView('side_${i+1}', this)">View ${i+1}</button>
        `).join('');
    }

    // 4. Fetch the dots from Supabase
    const { data } = await window._mpdb.from('grease_points').select('*').eq('equip_id', equipId);
    allMachineZerks = data || [];
    
    // 5. Load the first side
    changeZerkView('side_1', document.getElementById('btn-side-1'));
}

function changeZerkView(viewName, btn) {
    currentZerkView = viewName;
    const equip = state.equipment.find(x => x.id === window._currentDetailEquipId);
    const viewIndex = parseInt(viewName.split('_')[1]) - 1;
    
    const img = document.getElementById('zerk-map-img');
    const container = document.getElementById('zerk-map-container');

    // FORCE THE IMAGE TO SHOW
    if(equip && equip.zerk_photos && equip.zerk_photos[viewIndex]) {
        img.src = equip.zerk_photos[viewIndex];
        img.style.display = 'block'; // Make sure it's not hidden
        if(container) container.style.display = 'block';
    }

    renderZerkDots();
}
function changeZerkView(viewName, btn) {
    currentZerkView = viewName;
    const equip = state.equipment.find(x => x.id === window._currentDetailEquipId);
    if(!equip) return;

    // Highlight the active button
    document.querySelectorAll('#zerk-view-switcher .btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.borderColor = 'var(--border2)';
        b.style.color = 'var(--text)';
    });
    if(btn) {
        btn.style.background = 'var(--accent-bg)';
        btn.style.borderColor = 'var(--accent)';
        btn.style.color = 'var(--accent-text)';
    }

    // Update the Map Image
    const viewIndex = parseInt(viewName.split('_')[1]) - 1;
    const img = document.getElementById('zerk-map-img');
    
    // FIXED: Changed 'photos' to 'zerk_photos'
    if(equip.zerk_photos && equip.zerk_photos[viewIndex]) {
        img.src = equip.zerk_photos[viewIndex];
    }

    // Redraw the dots for THIS specific view
    renderZerkDots();
    
    // Hide the detail box from previous view
    const detailBox = document.getElementById('zerk-detail-box');
    if(detailBox) detailBox.style.display = 'none';
}
  
function renderZerkDots() {
    const overlay = document.getElementById('zerk-dots-overlay');
    const svg = document.getElementById('zerk-svg-layer');
    if(!overlay || !svg) return;

    const visibleDots = allMachineZerks.filter(z => z.view_name === currentZerkView);
    console.log("Zerk Map: Drawing " + visibleDots.length + " lines/dots.");
    
    // 1. CLEAR AND DRAW THE LINES
    let svgContent = '';
    visibleDots.forEach(z => {
        // Only draw a line if the target and label are in different spots
        if (Number(z.x_target) !== Number(z.x_pos) || Number(z.y_target) !== Number(z.y_pos)) {
            svgContent += `<line x1="${z.x_target}" y1="${z.y_target}" x2="${z.x_pos}" y2="${z.y_pos}" class="zerk-line" style="stroke:yellow; stroke-width:0.8;" />`;
        }
    });
    svg.innerHTML = svgContent;

    // 2. DRAW THE LABELS AND TARGET DOTS
    let html = visibleDots.map((z, index) => {
        const isSingleDot = (Number(z.x_target) === Number(z.x_pos));
        return `
            ${!isSingleDot ? `<div class="zerk-target-dot" style="left: ${z.x_target}%; top: ${z.y_target}%"></div>` : ''}
            <div class="zerk-dot" style="left: ${z.x_pos}%; top: ${z.y_pos}%" onclick="showZerkInfo(event, '${z.id}')">
                 ${index + 1}
            </div>
        `;
    }).join('');

    // 3. SHOW PREVIEW DOT (If currently drawing a line)
    if (zerkDrawingStep === 2) {
        html += `<div class="zerk-target-dot" style="left: ${tempZerkCoords.x}%; top: ${tempZerkCoords.y}%; background: yellow; border: 2px solid white; transform: translate(-50%, -50%) scale(2);"></div>`;
    }

    overlay.innerHTML = html;
}
function showZerkInfo(event, zerkId) {
    event.stopPropagation(); // Prevents adding a new dot when clicking an existing one
    
    // Find the specific dot data
    const z = allMachineZerks.find(x => x.id === zerkId);
    if(!z) return;

    const box = document.getElementById('zerk-detail-box');
    if(!box) return;
    
    // Fill the text
    document.getElementById('zerk-label').textContent = z.label;
    document.getElementById('zerk-instr').textContent = z.instructions || "No special instructions.";
    
    // Setup the Delete button
    const delBtn = document.getElementById('zerk-delete-btn');
    if(delBtn) {
        // Only show delete button for Admins/Managers
        delBtn.style.display = (currentUser.role === 'admin' || currentUser.role === 'manager') ? 'block' : 'none';
        
        // This connects the button to the function we just added
        delBtn.onclick = () => deleteZerk(z.id);
    }
    
    box.style.display = 'block';
}
async function handleMapClick(event) {
    if (currentUser.role !== 'admin' && currentUser.role !== 'manager') return;
    
    const overlay = event.currentTarget;
    const rect = overlay.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    // MODE 1: SIMPLE DOT (One Click)
    if (zerkPinMode === 'dot') {
        const label = prompt("Zerk Name:");
        if (!label) return;

        saveZerkPoint(label, x, y, x, y); // Target and Label are the same spot
    } 
    // MODE 2: POINTER LINE (Two Clicks)
    else {
        if (zerkDrawingStep === 1) {
            tempZerkCoords = { x, y };
            zerkDrawingStep = 2;
            showToast("Target set. Now click where the Label goes.");
            renderZerkDots();
        } else {
            const label = prompt("Zerk Name:");
            if (!label) { zerkDrawingStep = 1; renderZerkDots(); return; }
            
            saveZerkPoint(label, x, y, tempZerkCoords.x, tempZerkCoords.y);
            zerkDrawingStep = 1;
        }
    }
}
// DELETE AN ENTIRE PHOTO VIEW
async function deleteZerkView() {
    const equipId = window._currentDetailEquipId;
    const e = state.equipment.find(x => x.id === equipId);
    if(!e || !e.zerk_photos) return;

    if(!confirm("Delete this photo and ALL grease points pinned to it?")) return;

    // 1. Identify index (e.g., 'side_1' -> index 0)
    const viewIndex = parseInt(currentZerkView.split('_')[1]) - 1;

    try {
        // 2. Remove photo from array
        e.zerk_photos.splice(viewIndex, 1);

        // 3. Remove associated dots from DB
        await window._mpdb.from('grease_points').delete()
            .eq('equip_id', equipId)
            .eq('view_name', currentZerkView);

        // 4. Update machine record
        await window._mpdb.from('equipment').update({ zerk_photos: e.zerk_photos }).eq('id', equipId);
        
        showToast("View deleted ✓");
        refreshZerkMap(equipId); // Full refresh of the zerk tab
    } catch(err) { showToast("Delete failed"); }
}

async function deleteZerk(id) {
    if(!confirm("Delete this grease point?")) return;
    try {
        await window._mpdb.from('grease_points').delete().eq('id', id);
        allMachineZerks = allMachineZerks.filter(z => z.id !== id);
        renderZerkDots();
        document.getElementById('zerk-detail-box').style.display = 'none';
        showToast("Point removed");
    } catch(e) { console.error(e); }
}
  
// UPDATE: refreshZerkMap to use the new zerk_photos field
async function refreshZerkMap(equipId) {
    const e = state.equipment.find(x => x.id === equipId);
    if(!e) return;

    const switcher = document.getElementById('zerk-view-switcher');
    const noPhotos = document.getElementById('zerk-no-photos');
    const container = document.getElementById('zerk-map-container');
    const delViewBtn = document.getElementById('btn-delete-view');

    if(!e.zerk_photos || e.zerk_photos.length === 0) {
        if(switcher) switcher.style.display = 'none';
        if(container) container.style.display = 'none';
        if(delViewBtn) delViewBtn.style.display = 'none';
        if(noPhotos) noPhotos.style.display = 'block';
        return;
    }

    if(switcher) switcher.style.display = 'flex';
    if(container) container.style.display = 'block';
    if(delViewBtn) delViewBtn.style.display = 'block';
    if(noPhotos) noPhotos.style.display = 'none';

    switcher.innerHTML = e.zerk_photos.map((_, i) => `
        <button class="btn btn-secondary btn-sm" id="btn-zerk-side_${i+1}" onclick="changeZerkView('side_${i+1}', this)">
            View ${i+1}
        </button>
    `).join('');

    const { data } = await window._mpdb.from('grease_points').select('*').eq('equip_id', equipId);
    allMachineZerks = data || [];
    
    changeZerkView('side_1', document.getElementById('btn-zerk-side_1'));
}

// UPDATE: changeZerkView to pull from zerk_photos array
function changeZerkView(viewName, btn) {
    currentZerkView = viewName;
    const equip = state.equipment.find(x => x.id === window._currentDetailEquipId);
    
    document.querySelectorAll('#zerk-view-switcher .btn').forEach(b => b.style.borderColor = 'var(--border2)');
    if(btn) btn.style.borderColor = 'var(--accent)';

    const viewIndex = parseInt(viewName.split('_')[1]) - 1;
    const img = document.getElementById('zerk-map-img');
    
    if(equip.zerk_photos && equip.zerk_photos[viewIndex]) {
        img.src = equip.zerk_photos[viewIndex];
    }

    renderZerkDots();
    document.getElementById('zerk-detail-box').style.display = 'none';
}
function renderZerkDots() {
    const overlay = document.getElementById('zerk-dots-overlay');
    const svg = document.getElementById('zerk-svg-layer');
    if(!overlay || !svg) return;

    const visibleDots = allMachineZerks.filter(z => z.view_name === currentZerkView);
    
    // 1. Draw Lines in SVG
    svg.innerHTML = visibleDots.map(z => `
        <line class="zerk-line" x1="${z.x_target}" y1="${z.y_target}" x2="${z.x_pos}" y2="${z.y_pos}" />
    `).join('');

    // 2. Draw Labels and Target Dots
    let html = visibleDots.map((z, index) => `
        <div class="zerk-target-dot" style="left: ${z.x_target}%; top: ${z.y_target}%"></div>
        <div class="zerk-dot" style="left: ${z.x_pos}%; top: ${z.y_pos}%" onclick="showZerkInfo(event, '${z.id}')">
             ${index + 1}
        </div>
    `).join('');

    // 3. Show temporary target if in Step 2 of drawing
    if (zerkDrawingStep === 2) {
        html += `<div class="zerk-target-dot" style="left: ${tempZerkCoords.x}%; top: ${tempZerkCoords.y}%; background: yellow; scale: 2;"></div>`;
    }

    overlay.innerHTML = html;
}
    
function renderDashboardObs(equipId) {
    const container = document.getElementById('eq-obs-list-dash');
    if(!container) return;
    const obs = state.observations.filter(o => o.equip_id === equipId).slice(0, 3);
    container.innerHTML = obs.map(o => `
        <div style="padding:6px 0; border-bottom:1px solid var(--border); font-size:12px">
            <div style="color:var(--text3); font-size:10px">${o.author} · ${fmtDate(o.created_at)}</div>
            <div>${o.body.slice(0, 50)}${o.body.length > 50 ? '...' : ''}</div>
        </div>
    `).join('') || '<div style="color:var(--text3); font-size:11px">No notes</div>';
}
    function renderMiniTimeline(equipId) {
    const container = document.getElementById('eq-timeline-content-mini');
    if(!container) return;

    const items = state.tasks.filter(t => t.equipId === equipId).slice(0, 5);
    container.innerHTML = items.map(t => `
        <div style="padding:8px 0; border-bottom: 1px solid var(--border); font-size: 12px">
            <div style="color: var(--text3); font-size: 10px">${fmtDate(t.due)}</div>
            <div style="font-weight: 600">${t.name}</div>
            <div style="color: var(--text2)">${badge(t.status)}</div>
        </div>
    `).join('') || '<div style="color:var(--text3); font-size:12px">No recent activity</div>';
}
function renderQuickSpecs(equipId) {
    const container = document.getElementById('eq-quick-specs');
    if(!container) return;
    const e = state.equipment.find(x => x.id === equipId);
    
    const specs = e.custom_fields || {};
    const entries = Object.entries(specs);

    if (entries.length === 0) {
        container.innerHTML = '<div style="color:var(--text3); font-style:italic; padding: 10px 0;">No specs added yet.</div>';
        return;
    }

    container.innerHTML = entries.map(([key, val]) => `
        <div class="spec-row" style="display:flex; align-items:center; gap:8px; padding: 4px 0; border-bottom: 1px solid rgba(0,0,0,0.05)">
            <!-- Clicking the text still triggers the edit -->
            <div style="flex:1; display:flex; justify-content:space-between; cursor:pointer" onclick="editQuickSpec('${equipId}', '${key.replace(/'/g, "\\'")}')">
                <span style="color:var(--text2)">${key}:</span>
                <b style="color:var(--text)">${val}</b>
            </div>
            
            <!-- NEW: Dedicated Delete Button -->
            <button class="btn btn-danger" 
                    style="padding: 2px 6px; font-size: 10px; border-radius: 4px; line-height: 1" 
                    onclick="deleteQuickSpec('${equipId}', '${key.replace(/'/g, "\\'")}')" 
                    title="Delete Spec">✕</button>
        </div>
    `).join('');
}
async function addQuickSpec(equipId) {
    // 1. Find the machine in our local list
    const e = state.equipment.find(x => x.id === equipId);
    if(!e) return;

    // 2. Ask for the info
    const key = prompt("Spec Name (e.g. Engine Oil, Front Tire PSI)");
    if (!key) return;
    const val = prompt(`Value for ${key} (e.g. 15 qts, 35 PSI)`);
    if (!val) return;

    // 3. Update the LOCAL data immediately so the redraw sees it
    if (!e.custom_fields) e.custom_fields = {};
    e.custom_fields[key] = val;

    // 4. DRAW IT NOW (Before even talking to the database)
    renderQuickSpecs(equipId);

    // 5. Save to the database in the background
    try {
        await persist('equipment', 'upsert', e);
        showToast("Spec saved ✓");
        
        if(typeof logAuditAction === 'function') {
            logAuditAction("Added Spec", `${e.name}: ${key}=${val}`);
        }
    } catch(err) {
        console.error(err);
        showToast("Sync failed - will retry later");
    }
}
async function editQuickSpec(equipId, key) {
    const e = state.equipment.find(x => x.id === equipId);
    if(!e || !e.custom_fields) return;

    const currentVal = e.custom_fields[key];
    const newVal = prompt(`Update value for "${key}":`, currentVal);

    // If user clicks cancel or enters nothing, do nothing
    if (newVal === null || newVal.trim() === "") return;

    // Update local state and redraw
    e.custom_fields[key] = newVal.trim();
    renderQuickSpecs(equipId);

    // Save to DB
    try {
        await persist('equipment', 'upsert', e);
        showToast("Updated ✓");
    } catch(err) { console.error(err); }
}
async function deleteQuickSpec(equipId, key) {
    if (!confirm(`Are you sure you want to delete the spec "${key}"?`)) return;

    const e = state.equipment.find(x => x.id === equipId);
    if (!e || !e.custom_fields) return;

    // 1. Remove the key from the local object
    delete e.custom_fields[key];

    // 2. Instant UI Refresh
    renderQuickSpecs(equipId);

    // 3. Save to Database
    try {
        await persist('equipment', 'upsert', e);
        showToast("Spec deleted");
        
        if(typeof logAuditAction === 'function') {
            logAuditAction("Deleted Spec", `${e.name}: removed ${key}`);
        }
    } catch(err) {
        console.error(err);
        showToast("Error saving changes");
    }
}
function setZerkMode(mode) {
    zerkPinMode = mode;
    zerkDrawingStep = 1; // Reset steps
    document.getElementById('mode-dot')?.classList.toggle('active', mode === 'dot');
    document.getElementById('mode-line')?.classList.toggle('active', mode === 'line');
    renderZerkDots(); // Clear any temp dots
}
// 1. Define the actual function so the app stops crashing
function setCalEntryType(type) {
    console.log("Setting Calendar Entry Type:", type);
    
    // 2. Update the UI buttons (One-time vs Recurring)
    const btnOne = document.getElementById('cal-type-one');
    const btnRecur = document.getElementById('cal-type-recur');
    
    if (btnOne) btnOne.classList.toggle('active', type === 'one-time');
    if (btnRecur) btnRecur.classList.toggle('active', type === 'recurring');

    // 3. Handle showing/hiding the recurrence fields in your modal
    const recurFields = document.getElementById('cal-recur-fields');
    if (recurFields) {
        recurFields.style.display = (type === 'recurring') ? 'block' : 'none';
    }
}

// Keep this helper for backwards compatibility if other parts of your code use it
function updateCalEntryTypeButtons(type) {
    setCalEntryType(type);
}
    async function saveZerkPoint(label, x_label, y_label, x_target, y_target) {
    const newZerk = {
        id: uid(),
        equip_id: window._currentDetailEquipId,
        view_name: currentZerkView,
        label: label,
        instructions: prompt("Instructions (optional):") || "",
        x_pos: x_label,
        y_pos: y_label,
        x_target: x_target,
        y_target: y_target
    };

    try {
        await window._mpdb.from('grease_points').insert(newZerk);
        allMachineZerks.push(newZerk);
        renderZerkDots();
        showToast("Zerk Saved ✓");
    } catch(e) { console.error(e); }
}
 function renderFullHistoryList(equipId) {
    const container = document.getElementById('eq-history-list');
    if(!container) return;
    const tasks = state.tasks.filter(t => t.equipId === equipId).sort((a,b) => new Date(b.due) - new Date(a.due));
    container.innerHTML = tasks.map(t => `
        <div class="parts-row">
            <div style="flex:1"><b>${t.name}</b><div style="font-size:11px">${fmtDate(t.due)}</div></div>
            ${badge(t.status)}
        </div>`).join('') || '<div style="color:var(--text3); padding:20px">No history recorded</div>';
} 
    function renderDocsList(equipId) {
    const container = document.getElementById('docs-list');
    if(!container) return;
    const docs = state.documents.filter(d => d.equip_id === equipId);
    container.innerHTML = docs.map(d => `
        <div class="doc-item">
            <div class="doc-info"><b>${d.name}</b><div style="font-size:11px">${d.type}</div></div>
            ${d.file_data ? `<button class="btn btn-secondary btn-sm" onclick="openDocDetail('${d.id}')">View</button>` : ''}
        </div>`).join('') || '<div style="color:var(--text3); padding:20px">No documents found</div>';

    }
async function getAdaptivePrediction(equipId) {
    const e = state.equipment.find(x => x.id === equipId);
    if (!e || e.status === 'Down') return { status: 'PAUSED' };

    const { data: history } = await window._mpdb.from('meter_history')
        .select('reading, created_at')
        .eq('equip_id', equipId)
        .order('created_at', { ascending: false }).limit(7);

    if (!history || history.length < 2) return null;

    const newest = history[0];
    const oldest = history[history.length - 1];
    
    const totalHoursUsed = Number(newest.reading) - Number(oldest.reading);
    
    // Calculate time difference
    const msDiff = new Date(newest.created_at) - new Date(oldest.created_at);
    const daysPassed = msDiff / (1000 * 60 * 60 * 24);
    
    // If daysPassed is 0 (same day), we treat it as 1 day to avoid "0.00" error
    const effectiveDays = daysPassed < 0.1 ? 0.1 : daysPassed;
    const burnRate = totalHoursUsed / effectiveDays; 

    const rule = state.recurrenceRules.find(r => r.equip_id === equipId && r.type.toLowerCase() === 'hours');
    if (!rule) return null;

    const nextServiceAt = Number(rule.last_generated_hours || 0) + Number(rule.runtime_hours || 500);
    const hoursRemaining = nextServiceAt - e.hours;

    if (hoursRemaining <= 0) return { status: 'OVERDUE', hours: hoursRemaining };
    if (hoursRemaining > 40) return { status: 'HIDDEN' };

    return {
        status: 'ACTIVE',
        hoursRemaining: Math.round(hoursRemaining * 10) / 10,
        predictedDate: new Date(Date.now() + (hoursRemaining / burnRate) * 86400000),
        burnRate: burnRate.toFixed(1)
    };
}

async function saveQuickLogHours() {
  const equipId = document.getElementById('lh-equip-id').value;
  const date = document.getElementById('lh-date').value; 
  const val = parseInt(document.getElementById('lh-val').value);
  const e = state.equipment.find(x => x.id === equipId);
  if (!e || isNaN(val)) return;

  try {
    await persist('equipment', 'upsert', e);
    await window._mpdb.from('meter_history').insert({ equip_id: equipId, reading: val, created_at: new Date(date).toISOString() });
    
    // THE LOG
    logAuditAction("Meter Update", `${e.name} set to ${val} hrs (Date: ${date})`);

    closeModal('log-hours-modal');
    renderDashboard();
    showToast("Updated ✓");
  } catch (err) { console.error(err); }
}

function toggleRecurFields() {
    const type = document.getElementById('ce-recur-type').value;
    document.getElementById('ce-recur-val-wrap').style.display = type === 'calendar' ? 'block' : 'none';
    document.getElementById('ce-recur-hrs-wrap').style.display = type === 'hours' ? 'block' : 'none';
}

function resetCalModal() {
    setCalEntryType('one-time');
    document.getElementById('ce-name').value = '';
    document.getElementById('ce-notes').value = '';
    document.getElementById('ce-date').value = new Date().toISOString().split('T')[0];
    
    // Fill dropdowns
    const equipSelect = document.getElementById('ce-equip');
    const userSelect = document.getElementById('ce-assign');
    if(equipSelect) equipSelect.innerHTML = (state.equipment || []).map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    if(userSelect) userSelect.innerHTML = '<option value="">— Unassigned —</option>' + (state.users_list_cache || []).map(u => `<option value="${u.full_name}">${u.full_name}</option>`).join('');
}

async function saveCalendarEntry() {
    const name = document.getElementById('ce-name').value.trim();
    if(!name) { showToast("Enter a name"); return; }

    if (currentCalEntryType === 'one-time') {
        // Build one-time job record
        const record = {
            id: uid(),
            name: name,
            equipId: document.getElementById('ce-equip').value,
            date: document.getElementById('ce-date').value,
            tech: document.getElementById('ce-assign').value,
            dur: parseInt(document.getElementById('ce-dur').value) || 1,
            notes: document.getElementById('ce-notes').value
        };
        await persist('schedules', 'upsert', record);
        state.schedules.push(record);
    } else {
        // Build recurring rule record
        const type = document.getElementById('ce-recur-type').value;
        const record = {
            id: uid(),
            name: name,
            equip_id: document.getElementById('ce-equip').value,
            type: type,
            interval_unit: document.getElementById('ce-unit').value,
            interval_value: parseInt(document.getElementById('ce-interval').value) || 1,
            runtime_hours: parseInt(document.getElementById('ce-runtime').value) || 500,
            priority: 'High',
            notes: document.getElementById('ce-notes').value,
            active: true,
            next_due: new Date().toISOString().split('T')[0],
            template: { assign: document.getElementById('ce-assign').value }
        };
        await window._mpdb.from('recurrence_rules').insert(record);
        state.recurrenceRules.push(record);
    }

    closeModal('calendar-entry-modal');
    renderCalendar();
    showToast("Added to Calendar ✓");
}   
 function editTemplate(id) {
    const tpl = state.checklistTemplates.find(t => t.id === id);
    if(!tpl) return;

    // 1. Fill the modal
    document.getElementById('tpl-modal-title').textContent = "Edit Template";
    document.getElementById('tpl-edit-id').value = tpl.id;
    document.getElementById('tpl-name').value = tpl.name;
    document.getElementById('tpl-model').value = tpl.model || '';
    document.getElementById('tpl-type').value = tpl.type || '';
    document.getElementById('tpl-items').value = tpl.items.join('\n');

    openModal('tpl-modal');
}

async function saveTpl() {
  const id = document.getElementById('tpl-edit-id').value;
  const name = document.getElementById('tpl-name').value.trim();
  const items = document.getElementById('tpl-items').value.split('\n').filter(s => s.trim() !== '');

  if(!name || items.length === 0) {
    showToast('Name and items are required');
    return;
  }

  const record = {
    id: id || 'tpl-' + uid(),
    name,
    model: document.getElementById('tpl-model').value.trim(),
    type: document.getElementById('tpl-type').value.trim(),
    items: items,
    created_at: new Date().toISOString()
  };

  try {
    // Save to Supabase
    await window._mpdb.from('checklist_templates').upsert(record);

    // Update local memory
    const idx = state.checklistTemplates.findIndex(t => t.id === record.id);
    if(idx > -1) state.checklistTemplates[idx] = record;
    else state.checklistTemplates.push(record);

    closeModal('tpl-modal');
    renderChecklistTemplates();
    showToast('Template saved ✓');
    
    // Clear form
    document.getElementById('tpl-edit-id').value = '';
    ['tpl-name','tpl-model','tpl-type','tpl-items'].forEach(id => document.getElementById(id).value = '');
  } catch(e) {
    showToast('Failed to save template');
    console.error(e);
  }
}  
async function toggleLockout(equipId, isLocked) {
    const e = state.equipment.find(x => x.id === equipId);
    if (!e) return;

    let reason = "";
    if (isLocked) {
        reason = prompt("REASON FOR SAFETY LOCKOUT:\n(This will be shown to everyone on the dashboard)");
        if (!reason) {
            // Cancel if no reason provided
            document.querySelector(`#status-widget-${equipId} input`).checked = false;
            return;
        }
        e.status = 'Down'; // Automatically mark as down
    } else {
        if (!confirm("Clear safety lockout? Ensure all repairs are verified.")) {
            document.querySelector(`#status-widget-${equipId} input`).checked = true;
            return;
        }
        e.status = 'Operational';
    }

    e.is_locked = isLocked;
    e.lock_reason = reason;

    try {
        await persist('equipment', 'upsert', e);
        
        // 1. Update the UI widget immediately
        const widget = document.getElementById(`status-widget-${equipId}`);
        const warn = document.getElementById(`lock-warning-${equipId}`);
        if(widget) {
            widget.style.background = isLocked ? '#FCEBEB' : 'var(--bg2)';
            widget.style.borderColor = isLocked ? '#E24B4A' : 'var(--border)';
        }
        if(warn) {
            warn.style.display = isLocked ? 'block' : 'none';
            warn.textContent = `⚠️ DANGER: ${reason}`;
        }

        // 2. Send an URGENT message to the chat
        const alertMsg = isLocked ? 
            `🚨 **SAFETY LOCKOUT**: ${currentUser.name} locked out **${e.name}**! Reason: ${reason}` : 
            `✅ **LOCKOUT CLEARED**: ${currentUser.name} cleared the lockout on **${e.name}**. Machine is back in service.`;
        
        await sendSystemDMToUsername('general', alertMsg); // Posts to general channel

        renderDashboard();
        showToast(isLocked ? "Machine LOCKED OUT" : "Lockout Cleared");
    } catch(err) {
        showToast("Failed to update lockout status");
    }
}  
    async function setManualLink(equipId) {
    const url = prompt("Enter the URL for this machine's parts manual or manufacturer catalog:");
    if (!url) return;

    const e = state.equipment.find(x => x.id === equipId);
    if (!e) return;
    
    e.manual_url = url;
    try {
        await persist('equipment', 'upsert', e);
        openEquipDetail(equipId); // Refresh the card to show the new button
        showToast("Catalog link saved ✓");
    } catch(err) {
        showToast("Failed to save link");
    }
}
// Specialists: Downtime & Uptime
async function renderDowntimeStats() {
    const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString();
    const { data: logs } = await window._mpdb.from('downtime_logs').select('*').gte('created_at', thirtyDaysAgo);
    if (!logs) return;

    // Calculate Uptime %
    const totalPossibleMins = state.equipment.length * 30 * 24 * 60;
    const totalDownMins = logs.reduce((sum, l) => sum + (l.total_minutes || 0), 0);
    const uptime = totalPossibleMins > 0 ? Math.max(0, Math.min(100, ((totalPossibleMins - totalDownMins) / totalPossibleMins) * 100)) : 100;

    const uptimeEl = document.getElementById('r-uptime');
    if(uptimeEl) {
        uptimeEl.textContent = uptime.toFixed(1) + '%';
        uptimeEl.className = 'metric-value ' + (uptime > 95 ? 'v-success' : uptime > 85 ? 'v-warning' : 'v-danger');
    }

    // Draw Downtime Chart
    const chart = document.getElementById('downtime-chart');
    if(!chart) return;
    const machineMap = {};
    logs.forEach(l => { const name = equipName(l.equip_id); machineMap[name] = (machineMap[name] || 0) + (l.total_minutes / 60); });
    const entries = Object.entries(machineMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
    const maxH = Math.max(...Object.values(machineMap), 1);
    chart.innerHTML = entries.map(([name, hrs]) => `
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px">
            <div style="font-size:10px; font-weight:700">${hrs.toFixed(1)}h</div>
            <div style="width:100%; background:#E24B4A; height:${Math.round(hrs/maxH * 80)}px; border-radius:3px 3px 0 0"></div>
            <div style="font-size:9px; color:var(--text2); text-align:center; white-space:nowrap; overflow:hidden; width:100%">${name}</div>
        </div>`).join('') || '<div style="color:var(--text3); font-size:12px; padding:20px">No downtime logged</div>';
}

// Specialists: 30-Day Adaptive Forecast
async function renderServiceForecast() {
    const container = document.getElementById('predictive-analytics-list');
    if(!container) return;
    let html = '';
    for (let e of state.equipment) {
        const pred = await getAdaptivePrediction(e.id);
        if (pred && pred.status === 'ACTIVE' && pred.days <= 30) {
            html += `<div class="card" style="padding:10px; border-left:4px solid var(--warning)">
                <div style="font-weight:600; font-size:13px">${e.name}</div>
                <div style="color:var(--warning); font-weight:700; font-size:12px">Due in ~${pred.days} days</div>
            </div>`;
        }
    }
    container.innerHTML = html || '<div style="color:var(--text3); font-size:12px">No service due in next 30 days</div>';
}

// Specialists: Cost by Equipment
function renderCostByEquip() {
    const el = document.getElementById('cost-by-equip');
    if(!el) return;
    const ec = state.equipment.map(e => {
        const c = state.tasks.filter(t => t.equipId === e.id).reduce((a, t) => a + (t.cost || 0), 0);
        return { name: e.name.split(' ').slice(0, 2).join(' '), cost: c };
    }).filter(x => x.cost > 0).sort((a, b) => b.cost - a.cost).slice(0, 6);
    const mc = Math.max(...ec.map(x => x.cost), 1);
    el.innerHTML = ec.map(x => `
        <div class="stat-row"><div style="width:100px; font-size:12px; color:var(--text2)">${x.name}</div>
        <div class="stat-bar-wrap"><div class="stat-bar" style="width:${Math.round(x.cost/mc*100)}%; background:var(--accent)"></div></div>
        <div style="width:60px; text-align:right; font-weight:600">$${x.cost.toLocaleString()}</div></div>`
    ).join('');
}

// Specialists: Health Scores
function renderHealthScores() {
    const el = document.getElementById('health-scores');
    if(!el) return;
    el.innerHTML = state.equipment.map(e => {
        const s = calcHealth(e.id);
        return `<div class="stat-row"><div style="flex:1; font-size:12px">${e.name}</div>
        <div class="stat-bar-wrap" style="width:100px"><div class="stat-bar" style="width:${s}%; background:${healthColor(s)}"></div></div>
        <div style="width:40px; text-align:right; font-weight:600">${s}%</div></div>`;
    }).join('');
}

// Specialists: Task Breakdown
function renderTaskBreakdown() {
    const el = document.getElementById('task-breakdown');
    if(!el) return;
    const tot = state.tasks.length || 1;
    const stats = [
        ['Completed', state.tasks.filter(t=>t.status==='Completed').length, 'var(--success)'],
        ['Open', state.tasks.filter(t=>t.status==='Open').length, 'var(--accent)'],
        ['Overdue', state.tasks.filter(t=>t.status==='Overdue').length, 'var(--danger)']
    ];
    el.innerHTML = stats.map(([l, c, col]) => `
        <div class="stat-row"><div style="width:80px; font-size:12px">${l}</div>
        <div class="stat-bar-wrap"><div class="stat-bar" style="width:${Math.round(c/tot*100)}%; background:${col}"></div></div>
        <div style="width:30px; text-align:right; font-weight:600">${c}</div></div>`).join('');
}
function renderTopPartsUsed() {
    const el = document.getElementById('parts-consumed');
    if (!el) return;

    // 1. Group usage by part name
    const partMap = {};
    (state.partUsage || []).forEach(p => {
        partMap[p.part_name] = (partMap[p.part_name] || 0) + p.qty_used;
    });

    // 2. Sort by highest quantity and take top 6
    const topParts = Object.entries(partMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

    if (topParts.length === 0) {
        el.innerHTML = '<div style="color:var(--text3); font-size:12px; padding:10px">No parts usage recorded yet.</div>';
        return;
    }

    const maxQty = Math.max(...topParts.map(x => x[1]), 1);

    // 3. Render horizontal bars
    el.innerHTML = topParts.map(([name, qty]) => `
        <div class="stat-row">
            <div style="width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; color:var(--text2)">${name}</div>
            <div class="stat-bar-wrap" style="flex:1">
                <div class="stat-bar" style="width:${Math.round(qty / maxQty * 100)}%; background:#BA7517"></div>
            </div>
            <div style="width:30px; text-align:right; font-weight:600; font-size:12px">${qty}</div>
        </div>
    `).join('');
}
    
function renderPlannedVsUnplanned() {
    const el = document.getElementById('planned-vs-unplanned');
    if (!el) return;

    // Planned = Auto-generated notes
    const planned = state.tasks.filter(t => t.notes && t.notes.includes('auto-generated')).length;
    const unplanned = state.tasks.length - planned;
    const total = state.tasks.length || 1;

    el.innerHTML = `
        <div class="stat-row">
            <div style="width:100px; font-size:12px">Planned</div>
            <div class="stat-bar-wrap"><div class="stat-bar" style="width:${Math.round(planned/total*100)}%; background:var(--success)"></div></div>
            <div style="width:30px; text-align:right; font-weight:600">${planned}</div>
        </div>
        <div class="stat-row">
            <div style="width:100px; font-size:12px">Breakdowns</div>
            <div class="stat-bar-wrap"><div class="stat-bar" style="width:${Math.round(unplanned/total*100)}%; background:var(--warning)"></div></div>
            <div style="width:30px; text-align:right; font-weight:600">${unplanned}</div>
        </div>
        <div style="font-size:11px; color:var(--text3); margin-top:10px; text-align:center">
            Higher "Planned" percentage means better fleet reliability.
        </div>
    `;
}
let markupCanvas, markupCtx, isDrawing = false;
let currentMarkupSource = { key: '', index: -1 };

function initMarkup(imgSrc, key, index) {
    currentMarkupSource = { key, index };
    const modal = document.getElementById('markup-modal');
    markupCanvas = document.getElementById('markup-canvas');
    markupCtx = markupCanvas.getContext('2d');
    
    const img = new Image();
    img.onload = () => {
        // Set canvas size to match image
        markupCanvas.width = img.width;
        markupCanvas.height = img.height;
        markupCtx.drawImage(img, 0, 0);
        
        // Set drawing style
        markupCtx.strokeStyle = "#ff0000"; // Bright Red
        markupCtx.lineWidth = Math.max(img.width / 100, 5); // Scale line with image size
        markupCtx.lineCap = "round";
        
        openModal('markup-modal');
        setupCanvasListeners();
    };
    img.src = imgSrc;
}

function setupCanvasListeners() {
    const getPos = (e) => {
        const rect = markupCanvas.getBoundingClientRect();
        const scaleX = markupCanvas.width / rect.width;
        const scaleY = markupCanvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    const start = (e) => { isDrawing = true; const pos = getPos(e); markupCtx.beginPath(); markupCtx.moveTo(pos.x, pos.y); };
    const move = (e) => { if (!isDrawing) return; e.preventDefault(); const pos = getPos(e); markupCtx.lineTo(pos.x, pos.y); markupCtx.stroke(); };
    const end = () => { isDrawing = false; };

    markupCanvas.onmousedown = start; markupCanvas.onmousemove = move; window.onmouseup = end;
    markupCanvas.ontouchstart = start; markupCanvas.ontouchmove = move; markupCanvas.ontouchend = end;
}

function clearMarkup() {
    const img = new Image();
    img.onload = () => markupCtx.drawImage(img, 0, 0);
    img.src = pendingPhotos[currentMarkupSource.key][currentMarkupSource.index];
}

function saveMarkup() {
    const editedData = markupCanvas.toDataURL('image/jpeg', 0.8);
    pendingPhotos[currentMarkupSource.key][currentMarkupSource.index] = editedData;
    refreshPhotoGrid(currentMarkupSource.key);
    closeMarkupModal();
}

function closeMarkupModal() {
    closeModal('markup-modal');
    isDrawing = false;
}
  async function logAuditAction(action, details) {
  try {
    await window._mpdb.from('audit_logs').insert({
      user_name: currentUser?.name || 'System',
      action: action,
      details: details,
      created_at: new Date().toISOString()
    });
  } catch(e) { console.warn("Audit log failed silently"); }
}
async function renderAuditLogs() {
  const container = document.getElementById('audit-log-list');
  if(!container) return;
  container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text3)">Loading history...</div>';
  try {
    const { data } = await window._mpdb.from('audit_logs').select('*').order('created_at', {ascending: false}).limit(100);
    if(!data || !data.length) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text3)">No activity logged yet</div>';
        return;
    }
    container.innerHTML = data.map(log => `
      <div style="padding:8px 12px; border-bottom:1px solid var(--border); display:flex; gap:10px; align-items:flex-start">
        <div style="font-size:10px; color:var(--text3); white-space:nowrap; width:75px">${new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}<br>${new Date(log.created_at).toLocaleDateString()}</div>
        <div style="flex:1">
          <div style="font-size:12px"><b>${log.user_name}</b>: ${log.action}</div>
          <div style="font-size:11px; color:var(--text2)">${log.details}</div>
        </div>
      </div>`).join('');
  } catch(e) { container.innerHTML = 'Error loading logs'; }
}
 let currentCalendarView = 'grid';

function switchCalendarView(view) {
    currentCalendarView = view;
    
    // Toggle Visibility
    document.getElementById('cal-grid-container').style.display = view === 'grid' ? 'block' : 'none';
    document.getElementById('cal-list-container').style.display = view === 'list' ? 'block' : 'none';
    
    // Toggle Button Styles
    document.getElementById('btn-view-grid').classList.toggle('active', view === 'grid');
    document.getElementById('btn-view-list').classList.toggle('active', view === 'list');
    
    // Refresh the data
    if(view === 'grid') renderCalendar(); else renderSchedule();
}
async function exportFullDatabase() {
    // 1. UPDATED TABLE LIST (Added Calendar & Tool Crib)
    const tables = [
        'chat_messages', 
        'profiles', 
        'equipment', 
        'parts', 
        'suppliers', 
        'work_orders', 
        'staff_absences',
        'tasks',
        'schedules',        // This is your Calendar data
        'tool_crib_items'   // This is your Tool Crib data
    ];

    if (!confirm("Download a full snapshot of all data (including Calendar and Tool Crib)?")) return;

    let fullBackup = {
        metadata: {
            app: "MTL Maintenance",
            date: new Date().toLocaleString(),
            timestamp: new Date().toISOString()
        },
        database_tables: {}
    };

    console.log("Starting Master Backup...");
    if (typeof showToast === 'function') showToast("Generating system backup...");

    try {
        // 2. Fetch every table
        for (const tableName of tables) {
            console.log(`Backing up: ${tableName}...`);
            const { data, error } = await window._mpdb.from(tableName).select('*');
            
            if (error) {
                console.error(`Error on table ${tableName}:`, error.message);
                fullBackup.database_tables[tableName] = { status: "FAILED", error: error.message };
            } else {
                fullBackup.database_tables[tableName] = data;
            }
        }

        // 3. Create and download the file
        const dataStr = JSON.stringify(fullBackup, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `MTL_FULL_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert("System backup downloaded successfully! Please upload this file to your Google Drive.");

    } catch (err) {
        console.error("Backup failed:", err);
        alert("Critical Backup Error: " + err.message);
    }
}
// Ensure the old renderSchedule function points to the new IDs
function renderSchedule(){
  const nw = new Date(TODAY); nw.setDate(nw.getDate() + 7);
  const n30 = new Date(TODAY); n30.setDate(n30.getDate() + 30);
  const sorted = [...state.schedules].sort((a,b) => new Date(a.date) - new Date(b.date));
  
  const mk = s => {
    const d = new Date(s.date);
    return `<div class="sched-item">
      <div class="sched-date"><div class="sched-day">${d.getDate()}</div><div class="sched-month">${MONTHS[d.getMonth()].slice(0,3)}</div></div>
      <div class="sched-body"><div class="sched-title">${s.name}</div><div class="sched-detail">${equipName(s.equipId)} · ${s.tech||'Unassigned'}</div></div>
      <button class="btn btn-danger btn-sm" onclick="deleteSched('${s.id}')">✕</button>
    </div>`;
  };

  document.getElementById('sched-week').innerHTML = sorted.filter(s => new Date(s.date) >= TODAY && new Date(s.date) <= nw).map(mk).join('') || 'Nothing this week';
  document.getElementById('sched-next30').innerHTML = sorted.filter(s => new Date(s.date) >= TODAY && new Date(s.date) <= n30).map(mk).join('') || 'Nothing in 30 days';
}   
