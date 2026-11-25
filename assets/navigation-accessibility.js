/* Dialog focus/keyboard behavior, independent of account or search data loading. */
(() => {
  'use strict';
  function initDialogs() {
    const search = document.getElementById('globalSearchModal');
    const mobile = document.getElementById('mobile-overlay');
    const entries = [
      { node: search, trigger: document.getElementById('globalSearchBtn'), open: () => search && !search.hidden,
        close: () => { if (search) search.hidden = true; }, initial: () => document.getElementById('globalSearchInput') },
      { node: mobile, trigger: document.getElementById('hamBtn'), open: () => mobile?.classList.contains('open'),
        close: () => { if (typeof window.closeMob === 'function') window.closeMob(); else mobile?.classList.remove('open'); }, initial: () => mobile?.querySelector('.mob-close') }
    ].filter(item => item.node);
    let active;
    let previousOverflow;
    let inertElements = [];
    const focusable = node => [...node.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.hidden && !element.closest('[hidden],[inert]') && element.getClientRects().length);

    function restoreBackground() {
      for (const [node, wasInert] of inertElements) node.inert = wasInert;
      inertElements = [];
      if (previousOverflow !== undefined) document.body.style.overflow = previousOverflow;
      previousOverflow = undefined;
    }
    function sync() {
      for (const item of entries) {
        const open = Boolean(item.open());
        item.trigger?.setAttribute('aria-expanded', String(open));
        item.node.setAttribute('aria-hidden', String(!open));
        // Closed CSS-only drawers must not leave invisible links in the tab order.
        item.node.inert = !open;
      }
      const opened = entries.filter(item => item.open());
      const next = opened.find(item => item !== active) || opened[0];
      if (next === active) return;
      const old = active;
      restoreBackground();
      active = next;
      if (!next) {
        if (old && old.returnFocus?.isConnected) old.returnFocus.focus({ preventScroll: true });
        return;
      }
      if (old) old.close();
      next.returnFocus = next.trigger || document.activeElement;
      previousOverflow = document.body.style.overflow === 'hidden' ? '' : document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      for (const child of document.body.children) {
        if (child === next.node || child.contains(next.node) || ['SCRIPT','STYLE','LINK'].includes(child.tagName)) continue;
        inertElements.push([child, child.inert]);
        child.inert = true;
      }
      next.node.inert = false;
      const target = next.initial() || focusable(next.node)[0] || next.node;
      if (target === next.node) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    if (mobile) {
      mobile.setAttribute('role', 'dialog');
      mobile.setAttribute('aria-modal', 'true');
      mobile.setAttribute('aria-label', 'قائمة صفحات المنصة');
      mobile.querySelector('.mob-close')?.setAttribute('aria-label', 'إغلاق قائمة الصفحات');
    }
    if (search) {
      document.getElementById('globalSearchInput')?.setAttribute('aria-label', 'ابحث في زاد المعرفة');
      search.setAttribute('aria-modal', 'true');
    }
    for (const item of entries) new MutationObserver(sync).observe(item.node, { attributes: true, attributeFilter: ['hidden','class'] });
    document.addEventListener('keydown', event => {
      if (!active || !active.open()) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); active.close(); sync(); return;
      }
      if (event.key !== 'Tab') return;
      const targets = focusable(active.node);
      const first = targets[0], last = targets[targets.length - 1];
      if (!first) { event.preventDefault(); active.node.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !active.node.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !active.node.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }, true);
    document.addEventListener('focusin', event => {
      if (active?.open() && !active.node.contains(event.target)) (active.initial() || focusable(active.node)[0])?.focus();
    });
    window.matchMedia('(min-width:1025px)').addEventListener('change', event => { if (event.matches && mobile?.classList.contains('open')) { entries.find(item=>item.node===mobile).close(); sync(); } });
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDialogs, { once: true });
  else initDialogs();
})();
