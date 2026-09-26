// KrishiMitra 3D interactions: card tilt, rise-in, message pop-in, page transitions.
// Independent of WebGL, so it still works if scene3d.js can't start.
(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const TILT = '.stat-card, .scheme-card, .result-card, .hero-card, .side-kb-card';
  const RISE = '.panel, .stat-card, .scheme-card, .result-card, .hero-card';
  const POP = '.msg-bubble, .web-result-item, .msg-source-item';
  const MAX_DEG = 9;

  function bindTilt(el) {
    if (el.dataset.km3dTilt) return;
    el.dataset.km3dTilt = '1';
    el.classList.add('km3d-tilt');
    if (reduceMotion || !canHover) return;

    let frame = 0;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--mx', `${px * 100}%`);
        el.style.setProperty('--my', `${py * 100}%`);
        el.style.transform =
          `perspective(900px) rotateX(${(0.5 - py) * MAX_DEG}deg) rotateY(${(px - 0.5) * MAX_DEG}deg) translateZ(10px)`;
      });
    });
    el.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      el.style.transform = '';
    });
  }

  function rise(els) {
    if (reduceMotion) return;
    els.forEach((el, i) => {
      if (el.dataset.km3dRise) return;
      el.dataset.km3dRise = '1';
      el.style.setProperty('--i', String(Math.min(i, 12)));
      el.classList.add('km3d-rise');
      // Drop the animation class afterwards so it can't fight the tilt transform.
      el.addEventListener('animationend', () => el.classList.remove('km3d-rise'), { once: true });
    });
  }

  function enhance(root) {
    root.querySelectorAll(TILT).forEach(bindTilt);
    rise([...root.querySelectorAll(RISE)]);
  }

  function watchDynamicContent() {
    // Chat messages, scheme results and uploaded-document rows are rendered by JS after load.
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          const pops = node.matches(POP) ? [node] : [...node.querySelectorAll(POP)];
          if (!reduceMotion) pops.forEach((el) => el.classList.add('km3d-pop'));
          if (node.matches(TILT)) bindTilt(node);
          enhance(node);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  function pageTransitions() {
    if (reduceMotion) return;
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== '_self') return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !url.pathname.endsWith('.html') || url.pathname === location.pathname) return;
      e.preventDefault();
      document.documentElement.classList.add('km3d-leaving');
      setTimeout(() => { location.href = url.href; }, 200);
    });
    // Back/forward cache restores the "leaving" state, so clear it.
    window.addEventListener('pageshow', () => document.documentElement.classList.remove('km3d-leaving'));
  }

  function init() {
    enhance(document);
    watchDynamicContent();
    pageTransitions();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
