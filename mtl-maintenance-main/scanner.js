// scanner.js - QR Code Scanning Logic

let html5QrCode = null;

export async function startQRScanner(onSuccess) {
  const container = document.getElementById('qr-reader');
  if (!container) return;

  // Initialize library if needed (Assumes Html5Qrcode is loaded in HTML)
  if (!html5QrCode) {
    html5QrCode = new window.Html5Qrcode("qr-reader");
  }

  try {
    await html5QrCode.start(
      { facingMode: "environment" }, 
      { fps: 10, qrbox: { width: 250, height: 250 } }, 
      (decodedText) => {
        stopQRScanner();
        onSuccess(decodedText); // Send the result back to app.js
      }
    );
  } catch (err) {
    console.error("Camera error:", err);
  }
}

export async function stopQRScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    try {
      await html5QrCode.stop();
      document.getElementById('qr-reader').innerHTML = ""; 
    } catch (e) { console.warn(e); }
  }
}
