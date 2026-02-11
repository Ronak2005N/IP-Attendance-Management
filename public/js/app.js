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

document.getElementById('attendance-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const studentId = document.getElementById('student_id').value.trim();
  const studentName = document.getElementById('student_name').value.trim();
  try {
    const response = await fetch('/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, student_name: studentName })
    });
    const data = await response.json();
    showToast(data.message, response.ok ? 'success' : 'error');
  } catch (err) {
    showToast('Error: Could not send data.', 'error');
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
