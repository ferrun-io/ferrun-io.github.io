// Progressive enhancement keeps static download links usable if a script fails.
const platform = document.getElementById('platform');
if (platform) {
  const rows = [...document.querySelectorAll('[data-target]')];
  const unavailable = document.getElementById('unavailable');
  platform.closest('.platform-filter').hidden = false;

  // Explicit native-platform selection never relies on emulated browser architecture.
  platform.addEventListener('change', () => {
    let available = false;
    for (const row of rows) {
      row.hidden = platform.value !== 'all' && row.dataset.target !== platform.value;
      available ||= !row.hidden;
    }
    unavailable.hidden = available;
    document.querySelector('.table-wrap').hidden = !available;
  });
}

// Clipboard access happens only after activation; denied access retains exact
// selected text for manual copying without touching the user's clipboard.
for (const button of document.querySelectorAll('.copy')) {
  const code = button.parentElement.querySelector('code');
  const status = document.getElementById('copy-status');
  const label = button.textContent;
  let attempt = 0;
  let timer;
  button.hidden = false;
  button.addEventListener('click', async () => {
    const current = ++attempt;
    clearTimeout(timer);
    button.textContent = label;
    const range = document.createRange();
    range.selectNodeContents(code);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    // A successful write is the only condition that may display confirmation.
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(code.textContent);
      if (current !== attempt) return;
      button.textContent = 'Copied';
      status.textContent = 'Copied to clipboard.';
    } catch {
      if (current !== attempt) return;
      button.textContent = 'Text selected';
      status.textContent = 'Text selected. Press Control+C or Command+C to copy.';
    }

    // A newer request owns its feedback lifetime; stale writes cannot reset it.
    timer = setTimeout(() => {
      if (current === attempt) button.textContent = label;
    }, 1800);
  });
}
