// services.js - AI, Bug Reports, and External APIs
import { supabase } from './db.js';
import { uid, showToast, compressImage } from './utils.js';
import { closeModal } from './ui.js';

// 1. AI Invoice Scanning (Gemini API)
export async function scanInvoiceWithAI(imageData, geminiKey) {
  try {
    const base64Data = imageData.split(',')[1];
    const mediaType = imageData.split(';')[0].split(':')[1] || 'image/jpeg';
    
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + geminiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mediaType, data: base64Data } },
            { text: 'Extract invoice details. Respond ONLY with JSON: {"supplier":"","invoice_number":"","date":"YYYY-MM-DD","amount":0,"notes":""}' }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch(e) {
    console.error('AI Scan Error:', e);
    throw e;
  }
}

// 2. Submit Bug/Suggestion Report
export async function submitBugReport(reportData, currentUser) {
  const report = {
    ...reportData,
    id: uid(),
    reporter: currentUser?.name || 'Unknown',
    username: currentUser?.username || '',
    created_at: new Date().toISOString()
  };

  try {
    // Save to Database
    await supabase.from('bug_reports').insert(report);

    // Send Email via EmailJS (Ensure emailjs is linked in HTML)
    if (window.emailjs) {
        await window.emailjs.send('service_o320zzu','template_je3rl4j', {
            to_email: 'tannergalloway75@gmail.com',
            message: `${report.type.toUpperCase()}: ${report.title}\n\nDetails: ${report.description}`
        });
    }

    showToast("Report submitted ✓");
    closeModal('bug-modal');
    return true;
  } catch(e) {
    console.error("Report failed:", e);
    return false;
  }
}

// 1. Save the Gemini API Key to Supabase and LocalStorage
export async function saveGeminiKey(currentUser) {
  const keyInput = document.getElementById('gemini-key-input');
  const key = keyInput?.value.trim();
  
  if(!key || key.startsWith('•')) { 
      showToast('Enter a valid API key'); 
      return; 
  }

  window._geminiKey = key;
  localStorage.setItem('mp_gemini_key', key);

  try {
    await window._mpdb.from('profiles').update({ gemini_key: key }).eq('id', currentUser.id);
    keyInput.value = '••••••••••••••••';
    showToast('Gemini API key synced ✓');
  } catch(e) { console.error(e); }
}

// 2. AI Logic: Suggest tools for a specific job name
export async function suggestTools(woName, equipId, state, equipNameFunc) {
  if(!window._geminiKey) return showToast('Set Gemini Key in Admin first');
  
  const btn = document.getElementById('suggest-tools-btn');
  if(btn) { btn.textContent = '⏳ Thinking...'; btn.disabled = true; }

  try {
    const prompt = `Suggest tools for work order: "${woName}" on machine: ${equipNameFunc(equipId, state)}. Respond ONLY with a comma-separated list.`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + window._geminiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if(result) {
      document.getElementById('tools-suggestion-text').textContent = result;
      document.getElementById('tools-suggestion-area').style.display = 'block';
      window._lastToolSuggestion = result;
    }
  } catch(e) { showToast('AI suggestion failed'); }
  finally { if(btn) { btn.textContent = '✨ AI Suggest'; btn.disabled = false; } }
}
