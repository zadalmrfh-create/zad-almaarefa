/* Zad Al Maarefa - basic content protection
   Note: Browser-side protection can discourage casual copying/saving,
   but cannot make web content impossible to screenshot or extract.
*/
(function () {
  'use strict';

  const editable = (el) => {
    if (!el) return false;
    const tag = (el.tagName || '').toUpperCase();
    return ['INPUT','TEXTAREA','SELECT'].includes(tag) || el.isContentEditable;
  };

  // Disable right-click/context menu except in form controls.
  document.addEventListener('contextmenu', function (e) {
    if (!editable(e.target)) e.preventDefault();
  }, {capture:true});

  // Disable selection except in form controls.
  document.addEventListener('selectstart', function (e) {
    if (!editable(e.target)) e.preventDefault();
  }, {capture:true});

  // Disable drag/drop of page content (especially images/text).
  document.addEventListener('dragstart', function (e) {
    if (!editable(e.target)) e.preventDefault();
  }, {capture:true});
  document.addEventListener('drop', function (e) {
    if (!editable(e.target)) e.preventDefault();
  }, {capture:true});

  // Disable copy/cut outside editable controls.
  document.addEventListener('copy', function (e) {
    if (!editable(e.target)) e.preventDefault();
  }, {capture:true});
  document.addEventListener('cut', function (e) {
    if (!editable(e.target)) e.preventDefault();
  }, {capture:true});

  // Common save/print/source/devtools/copy shortcuts.
  document.addEventListener('keydown', function (e) {
    if (editable(e.target)) return;

    const key = (e.key || '').toLowerCase();
    const ctrlOrMeta = e.ctrlKey || e.metaKey;

    const blocked =
      (ctrlOrMeta && ['c','x','s','u','p','a'].includes(key)) ||
      (ctrlOrMeta && e.shiftKey && ['i','j','c'].includes(key)) ||
      key === 'f12' ||
      (e.ctrlKey && e.shiftKey && ['i','j','c'].includes(key));

    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, {capture:true});

  // Prevent images from being dragged.
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('img').forEach(function (img) {
      img.setAttribute('draggable', 'false');
      img.addEventListener('dragstart', function (e) { e.preventDefault(); });
    });
  });
})();
