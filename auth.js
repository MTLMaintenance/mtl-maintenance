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
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', window.selectedLoginUser.id)
        .eq('pin_code', window.enteredPin)
        .single();

    if (data) {
        window.currentUser = { ...data, name: data.full_name || data.username };
        localStorage.setItem('mp_session', JSON.stringify(window.currentUser));

        applyUserPreferences(window.currentUser);
        await logAuditAction("Sign In", `Logged into workspace.`, window.currentUser);
        await createSession(data.username, data.id);
        
        // ENTER THE APP
        await fetchAbsences();
        if (typeof window.enterApp === 'function') window.enterApp(); 

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
