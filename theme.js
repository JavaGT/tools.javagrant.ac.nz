(function () {
  const THEME_KEY = 'tools-theme';

  function getStoredTheme() {
    return localStorage.getItem(THEME_KEY);
  }

  function getPreferredTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(dark) {
    document.documentElement.classList.toggle('dark', dark);
  }

  function getIsDark() {
    const stored = getStoredTheme();
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return getPreferredTheme() === 'dark';
  }

  function toggleTheme() {
    const isDark = getIsDark();
    const nextDark = !isDark;
    localStorage.setItem(THEME_KEY, nextDark ? 'dark' : 'light');
    applyTheme(nextDark);
    updateToggleIcon(nextDark);
    return nextDark;
  }

  function updateToggleIcon(dark) {
    const sunEl = document.getElementById('icon-sun');
    const moonEl = document.getElementById('icon-moon');
    if (sunEl) sunEl.classList.toggle('hidden', dark);
    if (moonEl) moonEl.classList.toggle('hidden', !dark);
  }

  function init() {
    const dark = getIsDark();
    applyTheme(dark);
    updateToggleIcon(dark);

    // Listen for system preference changes (for auto mode users)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getStoredTheme() === null) {
        applyTheme(getPreferredTheme() === 'dark');
      }
    });

    // Bind toggle button if present
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleTheme);
    }
  }

  // Export for programmatic use by pages that need custom toggle logic
  window.toolsTheme = { toggle: toggleTheme, init, getIsDark };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
