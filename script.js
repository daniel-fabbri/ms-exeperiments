// =====================================================================
// Experiment router (minimal)
// All markup lives in index.html; all visual rules live in style.css.
// This file just wires the few pieces of behaviour we can't do in CSS:
//   1. Set body[data-ref] from the URL — drives every variant rule
//   2. Fix sidebar links (the page's <base href> would hijack relative URLs)
//   3. Highlight the active sidebar link
//   4. Close button on the Ask-AI card
//   5. Scroll the Surface Explorer block into view
// =====================================================================

(function () {
  if (!/(?:^|\/)(?:index\.html)?$/i.test(window.location.pathname)) return;

  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref) document.body.dataset.ref = ref;

  const pageUrl = window.location.origin + window.location.pathname;

  // Fix sidebar hrefs (defeated by <base>) and mark the active one
  document.querySelectorAll('#exp-sidebar a[data-ref]').forEach(a => {
    a.href = pageUrl + '?ref=' + a.dataset.ref;
    if (a.dataset.ref === ref) a.classList.add('active');
  });

  // Close button on the Ask-AI card
  const close = document.querySelector('#ask-card .ac-close');
  if (close) close.addEventListener('click', () => {
    document.body.dataset.cardClosed = '';
  });

  // Surface Explorer: scroll the revealed decision module into view.
  // The block is injected by an inline script in the page, so wait a tick.
  if (ref === '89fh4384090230j00r') {
    setTimeout(() => {
      const el = document.getElementById('exp39634');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 600);
  }

  // Hide the loading overlay once the page is fully rendered. We wait for
  // window.load (CSS, images, fonts ready) plus a short grace period so the
  // dynamically-injected components have time to settle, eliminating the
  // "broken layout flash".
  function hideLoader() {
    const loader = document.getElementById('exp-loader');
    if (!loader) return;
    loader.classList.add('hide');
    setTimeout(() => loader.remove(), 350);
  }
  if (document.readyState === 'complete') {
    setTimeout(hideLoader, 250);
  } else {
    window.addEventListener('load', () => setTimeout(hideLoader, 250));
  }
  // Safety net: never leave the loader on screen for more than 4s.
  setTimeout(hideLoader, 4000);
})();
