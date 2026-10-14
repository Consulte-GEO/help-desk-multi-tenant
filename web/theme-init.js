/* Runs before styles. Stores only a three-value visual preference, never identity. */
(() => {
  let theme = 'auto';
  try {
    const saved = localStorage.getItem('helpdesk.ui.theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch { /* Storage may be unavailable; the operating-system preference still works. */ }
  document.documentElement.setAttribute('data-theme', theme);
})();
