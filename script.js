// =====================================================================
// Experiment router (minimal)
// All markup lives in index.html; all visual rules live in style.css.
// This file just wires the few pieces of behaviour we can't do in CSS:
//   1. Set body[data-ref] from the URL — drives every variant rule
//   2. Login modal: pick a user, redirect to ?ref=...
//   3. Header account menu: show user name, dropdown with "Sair" (logout)
//   4. Close button on the Ask-AI card
//   5. Scroll the Surface Explorer block into view
// =====================================================================

(function () {
  if (!/(?:^|\/)(?:index\.html)?$/i.test(window.location.pathname)) return;

  const ref = new URLSearchParams(window.location.search).get('ref');
  if (ref) document.body.dataset.ref = ref;

  const pageUrl = window.location.origin + window.location.pathname;

  // Build a {ref: persona name} map from the persona <select> options.
  const users = {};
  document.querySelectorAll('#lm-select option[value]').forEach(o => {
    if (!o.value) return;
    users[o.value] = o.textContent.trim();
  });

  // ---- Header account menu (visible only when logged in) ----
  if (ref && users[ref]) {
    const account = document.getElementById('sh-account');
    const btn     = document.getElementById('sh-account-btn');
    const name    = document.getElementById('sh-account-name');
    const menu    = document.getElementById('sh-account-menu');
    const logout  = document.getElementById('sh-logout');
    if (account && btn && name && menu && logout) {
      name.textContent = users[ref];
      account.hidden = false;

      const closeMenu = () => {
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      };
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const open = menu.hidden;
        menu.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('click', e => {
        if (!account.contains(e.target)) closeMenu();
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeMenu();
      });
      logout.addEventListener('click', () => {
        // Restart the experience: drop ?ref so the login modal shows again
        window.location.href = pageUrl;
      });
    }
  }

  // Close button on the Ask-AI card → always return to the "Need help?" pill
  const close = document.querySelector('#ask-card .ac-close');
  if (close) close.addEventListener('click', () => {
    delete document.body.dataset.chatOpen;
    document.body.dataset.cardClosed = '';
    const cardEl = document.getElementById('ask-card');
    if (cardEl) cardEl.classList.remove('ac-engaged');
    // Make sure the blue "Need help?" pill is visible again, even on
    // variants whose CSS hides it by default (e.g. Daniel/control).
    document.querySelectorAll('.sa-default-entry-container').forEach(el => {
      el.style.setProperty('display', 'flex', 'important');
    });
  });

  // "Need help? Let's chat" pill: clicking it (re)opens the Ask-AI card.
  // Use event delegation because the pill is injected by the page script
  // after our DOMContentLoaded handler runs.
  document.addEventListener('click', e => {
    // "No thanks" on the highlight popover (Daniel/control variant) →
    // hide the dark popover and show the small blue "Need help?" pill.
    const noThanks = e.target.closest('.sa-highlight-entry-no-thanks-button');
    if (noThanks) {
      e.preventDefault();
      e.stopPropagation();
      const popover = noThanks.closest('.sa-highlight-entry-container');
      if (popover) popover.style.setProperty('display', 'none', 'important');
      document.body.dataset.highlightDismissed = '';
      // Force the blue pill visible even on variants that hide it by default.
      document.querySelectorAll('.sa-default-entry-container').forEach(el => {
        el.style.setProperty('display', 'flex', 'important');
      });
      return;
    }

    // "Chat now" on the highlight popover OR the small "Need help?" pill
    // → open the Ask-AI card and hide the highlight popover.
    const opener = e.target.closest(
      '.sa-highlight-entry-chat-now-button, .sa-default-entry-button, .sa-default-entry-container'
    );
    if (!opener) return;
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll('.sa-highlight-entry-container').forEach(el => {
      el.style.setProperty('display', 'none', 'important');
    });
    // Also hide the small blue pill while the chat is open.
    document.querySelectorAll('.sa-default-entry-container').forEach(el => {
      el.style.setProperty('display', 'none', 'important');
    });
    document.body.dataset.highlightDismissed = '';
    delete document.body.dataset.cardClosed;
    document.body.dataset.chatOpen = '';
    const cardEl = document.getElementById('ask-card');
    if (cardEl) {
      cardEl.classList.add('ac-engaged');
      const focusTarget = cardEl.querySelector('.ac-input');
      if (focusTarget) setTimeout(() => focusTarget.focus(), 0);
    }
  }, true);

  // ---- Ask-AI card chat (calls /api/chat -> Foundry agent) ----
  const card     = document.getElementById('ask-card');
  const input    = card && card.querySelector('.ac-input');
  const sendBtn  = card && card.querySelector('.ac-send');
  const msgsEl   = card && card.querySelector('.ac-messages');
  let conversationId = null;
  let sending = false;

  function appendMsg(role, text, extraClass) {
    if (!msgsEl) return null;
    const el = document.createElement('div');
    el.className = 'ac-msg ' + role + (extraClass ? ' ' + extraClass : '');
    el.textContent = text;
    msgsEl.appendChild(el);
    msgsEl.classList.add('has-msgs');
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return el;
  }

  async function sendMessage(presetText) {
    if (sending) return;
    const text = (typeof presetText === 'string' ? presetText : (input ? input.value : '')).trim();
    if (!text) return;
    sending = true;
    if (input) input.value = '';
    if (sendBtn) sendBtn.disabled = true;
    appendMsg('user', text);
    const loading = appendMsg('bot', 'Thinking…', 'loading');
    try {
      // Force absolute URL on the current host: the page has <base href="https://www.microsoft.com/">,
      // which would otherwise make '/api/chat' resolve to microsoft.com.
      const apiUrl = window.location.origin + '/api/chat';
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (loading) loading.remove();
      if (!res.ok) {
        appendMsg('bot', data.error || ('Error ' + res.status), 'error');
      } else {
        conversationId = data.conversationId || conversationId;
        appendMsg('bot', data.reply || '(no response)');
      }
    } catch (err) {
      if (loading) loading.remove();
      appendMsg('bot', 'Network error: ' + err.message, 'error');
    } finally {
      sending = false;
      if (sendBtn) sendBtn.disabled = false;
      if (input) input.focus();
    }
  }

  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (input) input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  // Chips: clicking a chip sends its text, hides all chips and reveals
  // the chat UI (relevant for variant A which starts with chips only).
  card && card.querySelectorAll('.ac-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const text = chip.textContent.trim();
      if (input) input.value = text;
      card.querySelectorAll('.ac-chips').forEach(group => { group.style.display = 'none'; });
      card.classList.add('ac-engaged');
      sendMessage(text);
    });
  });

  // Login modal: pick a persona from the select, then "Login" redirects.
  if (!ref) {
    const select = document.getElementById('lm-select');
    const loginBtn = document.getElementById('lm-login');
    if (select) select.addEventListener('change', () => {
      if (loginBtn) loginBtn.disabled = !select.value;
    });
    if (loginBtn) loginBtn.addEventListener('click', () => {
      const selectedRef = select && select.value;
      if (!selectedRef) return;
      window.location.href = pageUrl + '?ref=' + selectedRef;
    });
  }

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
