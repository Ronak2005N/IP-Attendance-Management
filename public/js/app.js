let toastTimer = null;

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('error', 'success');
  toast.classList.add(type === 'error' ? 'error' : 'success');
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 5000);
}

async function ensureSessionIsActive() {
  try {
    const response = await fetch('/api/session/active', { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok) {
      showToast('Could not verify session status. Try again.', 'error');
      return false;
    }

    if (!data.active) {
      showToast(data.message || 'No active attendance session. Please wait for the teacher.', 'error');
      return false;
    }

    return true;
  } catch (err) {
    showToast('Server is unreachable. Ensure npm run dev is running.', 'error');
    return false;
  }
}

// ============================================================================
// FEATURE 1: PERSISTENT DEVICE ID
// Generate a unique device ID and store it in localStorage so each
// browser/device can only submit attendance once per session.
// ============================================================================
let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
  deviceId = crypto.randomUUID();
  localStorage.setItem('deviceId', deviceId);
}

// ============================================================================
// FEATURE 5: SELFIE CAPTURE
// Use the front-facing camera to take a photo for visual verification.
// ============================================================================
let selfieBase64 = null;
let cameraStream = null;

/** Start the front-facing camera and show the live preview */
async function startCamera() {
  const video = document.getElementById('selfie-video');
  const captureBtn = document.getElementById('capture-btn');
  const preview = document.getElementById('selfie-preview');

  // If camera is already running, do nothing
  if (cameraStream) return;

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    video.srcObject = cameraStream;
    video.style.display = 'block';
    captureBtn.textContent = '📸 Take Selfie';
    preview.style.display = 'none';
    selfieBase64 = null;
  } catch (err) {
    showToast('Camera access denied. Please allow camera.', 'error');
    console.error('Camera error:', err);
  }
}

/** Capture a frame from the video stream as a JPEG base64 string */
function captureSelfie() {
  const video = document.getElementById('selfie-video');
  const canvas = document.getElementById('selfie-canvas');
  const preview = document.getElementById('selfie-preview');
  const captureBtn = document.getElementById('capture-btn');

  if (!cameraStream) {
    // Camera not started yet — start it first
    startCamera();
    return;
  }

  // Draw the current video frame onto the hidden canvas
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  // Convert to JPEG base64 at 70% quality
  selfieBase64 = canvas.toDataURL('image/jpeg', 0.7);

  // Show the captured image preview
  preview.src = selfieBase64;
  preview.style.display = 'block';

  // Stop the camera stream
  cameraStream.getTracks().forEach(track => track.stop());
  cameraStream = null;
  video.style.display = 'none';
  captureBtn.textContent = '🔄 Retake Selfie';
}

// ============================================================================
// ATTENDANCE FORM SUBMISSION
// Sends student_id, student_name, deviceId, and selfie to the server.
// ============================================================================
document.getElementById('attendance-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const studentId = document.getElementById('student_id').value.trim();
  const studentName = document.getElementById('student_name').value.trim();

  const canSubmit = await ensureSessionIsActive();
  if (!canSubmit) {
    return;
  }

  // Validate selfie was captured
  if (!selfieBase64) {
    showToast('Please capture a selfie before submitting.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        student_name: studentName,
        deviceId: deviceId,
        selfie: selfieBase64
      })
    });

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (parseErr) {
      data = { message: raw || '' };
    }

    const message = data.message || (response.ok ? 'Attendance submitted successfully.' : `Request failed (${response.status}).`);
    showToast(message, response.ok ? 'success' : 'error');
  } catch (err) {
    const errorMessage = err && err.message ? err.message : 'Could not send data.';
    showToast(`Error: ${errorMessage}`, 'error');
    console.error(err);
  }
});

// Glass container focus/click behavior: add/remove `.focused` so blur increases
(() => {
  const glass = document.querySelector('.glass-container');
  if (!glass) return;

  // Add focused class on click (so clicking empty area of the card triggers effect)
  glass.addEventListener('click', () => glass.classList.add('focused'));

  // Add focused class when any child receives focus (keyboard tab)
  glass.addEventListener('focusin', () => glass.classList.add('focused'));

  // Remove focused class when focus leaves and click occurs outside
  document.addEventListener('click', (e) => {
    if (!glass.contains(e.target)) glass.classList.remove('focused');
  });

  // Also remove focused when focus leaves the container
  glass.addEventListener('focusout', () => {
    // small timeout to allow focus to move to another element inside
    setTimeout(() => {
      if (!glass.contains(document.activeElement)) glass.classList.remove('focused');
    }, 0);
  });
})();
