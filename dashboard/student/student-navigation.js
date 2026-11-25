import { studentTabFromURL, studentTabURL, focusStudentPanel } from './student-navigation-core.js';

function initStudentNavigation() {
  const nav = document.querySelector('.student-tabs');
  if (!nav || nav.dataset.navigationReady === 'true') return;
  nav.dataset.navigationReady = 'true';
  const buttons = [...nav.querySelectorAll('[data-student-tab]')];
  const panels = [...document.querySelectorAll('[data-student-panel]')];
  const available = buttons.map(button => button.dataset.studentTab)
    .filter(id => panels.some(panel => panel.dataset.studentPanel === id));
  let currentTab;

  buttons.forEach(button => {
    const id = button.dataset.studentTab;
    button.type = 'button';
    button.id ||= 'student-tab-' + id;
    const owned = panels.filter(panel => panel.dataset.studentPanel === id);
    owned.forEach((panel, index) => {
      panel.id ||= 'student-panel-' + id + '-' + index;
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', button.id);
      panel.setAttribute('tabindex', '-1');
    });
    button.setAttribute('aria-controls', owned.map(panel => panel.id).join(' '));
  });

  function openTab(id, { historyMode = 'push', focus = true, scroll = true } = {}) {
    if (!available.includes(id)) return false;
    for (const button of buttons) {
      const selected = button.dataset.studentTab === id;
      button.classList.toggle('active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    for (const panel of panels) {
      const selected = panel.dataset.studentPanel === id;
      panel.classList.toggle('active', selected);
      panel.hidden = !selected;
    }
    for (const button of document.querySelectorAll('[data-stage4-open]')) {
      const selected = button.dataset.stage4Open === id;
      button.classList.toggle('active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    const destination = studentTabURL(location.href, id, available);
    if (historyMode !== 'none' && destination !== location.pathname + location.search + location.hash) {
      const method = historyMode === 'replace' ? 'replaceState' : 'pushState';
      history[method](history.state, '', destination);
    }
    const firstPanel = panels.find(panel => panel.dataset.studentPanel === id);
    if (focus) focusStudentPanel(firstPanel, { scroll });
    currentTab = id;
    window.dispatchEvent(new CustomEvent('zad:student-tab-changed', { detail: { tab: id } }));
    return true;
  }

  nav.addEventListener('click', event => {
    const button = event.target.closest('[data-student-tab]');
    if (!button || !nav.contains(button)) return;
    openTab(button.dataset.studentTab);
  });
  window.addEventListener('popstate', () => openTab(studentTabFromURL(location.href, available), { historyMode: 'none' }));
  window.addEventListener('hashchange', () => openTab(studentTabFromURL(location.href, available), { historyMode: 'replace' }));
  window.zadStudentNavigation = Object.freeze({
    open: openTab,
    get current() { return currentTab; }
  });
  const initial = studentTabFromURL(location.href, available);
  openTab(initial, { historyMode: 'replace', focus: initial !== 'overview', scroll: initial !== 'overview' });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initStudentNavigation, { once: true });
else initStudentNavigation();
