/* Progressive enhancement: keep every link, group secondary links for readable text. */
(() => {
  'use strict';
  function trackHeaderClearance(header) {
    if (!document.querySelector('#hero.zad-home-hero') || header.dataset.clearanceReady === 'true') return;
    header.dataset.clearanceReady = 'true';
    const root = document.documentElement;
    let scheduled = false;
    let previous = -1;
    function measure() {
      scheduled = false;
      const bounds = header.getBoundingClientRect();
      if (!bounds.height) return;
      const clearance = Math.ceil(Math.max(0, bounds.top) + bounds.height + 24);
      if (clearance === previous) return;
      previous = clearance;
      root.style.setProperty('--zad-header-clearance', clearance + 'px');
      root.classList.add('zad-header-measured');
    }
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(measure);
    }
    // Account controls, translated labels and font loading can add another row.
    if (typeof ResizeObserver === 'function') new ResizeObserver(measure).observe(header);
    window.addEventListener('resize', schedule, { passive: true });
    document.fonts?.ready.then(schedule);
    measure();
  }
  function setupHeader() {
    const header = document.getElementById('navbar');
    if (!header) return;
    trackHeaderClearance(header);
    const nav = document.querySelector('#navbar .nav-links');
    if (!nav || nav.dataset.grouped === 'true') return;
    const primary = new Set(['#hero', '#categories', 'sections/library.html', 'teachers/index.html']);
    const secondary = [...nav.querySelectorAll(':scope > a.nav-link')].filter(link => !primary.has((link.getAttribute('href') || '').replace(/^\.\//, '')));
    if (!secondary.length) return;
    const group = document.createElement('div');
    group.className = 'zad-nav-more';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'zad-nav-more-trigger';
    trigger.textContent = 'المزيد';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'zadSecondaryNavigation');
    const menu = document.createElement('div');
    menu.id = 'zadSecondaryNavigation';
    menu.className = 'zad-nav-more-links';
    menu.hidden = true;
    secondary.forEach(link => menu.append(link));
    group.append(trigger, menu);
    nav.insertBefore(group, nav.querySelector('.theme-toggle'));
    nav.dataset.grouped = 'true';
    document.getElementById('navbar').classList.add('zad-readable-nav');

    function setOpen(open, restoreFocus = false) {
      menu.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
      if (!open && restoreFocus) trigger.focus();
    }
    trigger.addEventListener('click', () => setOpen(menu.hidden));
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault(); setOpen(true); menu.querySelector('a')?.focus();
      }
    });
    group.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); setOpen(false, true); }
    });
    group.addEventListener('focusout', () => queueMicrotask(() => {
      if (!group.contains(document.activeElement)) setOpen(false);
    }));
    document.addEventListener('click', event => { if (!group.contains(event.target)) setOpen(false); });
    window.matchMedia('(max-width:1024px)').addEventListener('change', () => setOpen(false));
    // The mobile drawer keeps its existing independent list of all page links.
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupHeader, { once: true });
  else setupHeader();
})();
