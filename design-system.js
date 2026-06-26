/* ============================================================================
   JUDE SHI — MASTER DESIGN SYSTEM · BEHAVIOURS
   ----------------------------------------------------------------------------
   Shared, dependency-free site behaviours. Every page links this file.
   All features are OPT-IN by markup and no-op when their elements are absent,
   so the same script is safe on every page (home, work, case studies, future).

     • Nav condense ........ <nav data-nav> gets .scrolled past 40px
     • Scroll progress ..... fills #progress with scroll %
     • Reveal on scroll .... .reveal elements get .in when they enter view
     • Section dot index ... fills #sideToc from [data-toc] + scroll-spy
     • Hero parallax ....... [data-parallax] drifts on scroll (factor via attr)
     • Cursor glow ......... a soft accent glow that eases toward the pointer
   ========================================================================== */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ── Nav condense + scroll progress ─────────────────────────────────────── */
  const nav = $('[data-nav]');
  const progress = $('#progress');
  let ticking = false;
  function onScroll(){
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const h = document.documentElement;
      if (nav) nav.classList.toggle('scrolled', h.scrollTop > 40);
      if (progress){
        const max = h.scrollHeight - h.clientHeight;
        progress.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
      }
      ticking = false;
    });
  }
  if (nav || progress){ addEventListener('scroll', onScroll, { passive:true }); onScroll(); }

  /* ── Reveal on scroll ───────────────────────────────────────────────────── */
  const reveals = $$('.reveal');
  if (reveals.length){
    if (!reduce && 'IntersectionObserver' in window){
      const io = new IntersectionObserver((es) => {
        for (const e of es){ if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }
      }, { threshold:0, rootMargin:'0px 0px -5% 0px' });
      reveals.forEach(el => io.observe(el));
      /* Safety net: if the observer fails to fire (some embedded/preview contexts),
         reveal anything that is on-screen — on load, scroll and resize — so a
         .reveal can never stay stuck invisible. Self-removes once all are shown. */
      const sweep = () => {
        const vh = innerHeight || document.documentElement.clientHeight;
        let remaining = 0;
        reveals.forEach(el => {
          if (el.classList.contains('in')) return;
          const r = el.getBoundingClientRect();
          if (r.top < vh && r.bottom > 0){ el.classList.add('in'); io.unobserve(el); }
          else remaining++;
        });
        if (!remaining){ removeEventListener('scroll', onSweep); removeEventListener('resize', onSweep); }
      };
      let sweepTick = false;
      const onSweep = () => { if (sweepTick) return; sweepTick = true; requestAnimationFrame(() => { sweepTick = false; sweep(); }); };
      addEventListener('load', () => setTimeout(sweep, 200));
      addEventListener('scroll', onSweep, { passive:true });
      addEventListener('resize', onSweep, { passive:true });
    } else reveals.forEach(el => el.classList.add('in'));
  }

  /* ── Section dot index + scroll-spy ─────────────────────────────────────── */
  const toc = $('#sideToc');
  const secs = $$('[data-toc]');
  if (toc && secs.length){
    secs.forEach(s => {
      const a = document.createElement('a');
      a.href = '#' + s.id;
      a.innerHTML = '<span>' + s.getAttribute('data-toc') + '</span>';
      toc.appendChild(a);
    });
    const dots = [...toc.children];
    const spy = new IntersectionObserver((es) => {
      es.forEach(e => { if (e.isIntersecting){
        const i = secs.indexOf(e.target);
        dots.forEach((d, di) => d.classList.toggle('active', di === i));
      }});
    }, { threshold:0.5 });
    secs.forEach(s => spy.observe(s));
    // reveal the index only after the hero scrolls away
    const hero = $('[data-hero]') || secs[0];
    if (hero){
      new IntersectionObserver((es) => toc.classList.toggle('show', !es[0].isIntersecting),
        { threshold:0.3 }).observe(hero);
    } else toc.classList.add('show');
  }

  /* ── Hero parallax ──────────────────────────────────────────────────────── */
  const para = $$('[data-parallax]');
  if (para.length && !reduce){
    addEventListener('scroll', () => {
      const y = scrollY;
      if (y < innerHeight){
        para.forEach(el => {
          const f = parseFloat(el.getAttribute('data-parallax')) || 0.18;
          el.style.transform = `translateY(${y * f}px) scale(1.05)`;
        });
      }
    }, { passive:true });
  }

  /* ── Cursor glow (opt-in: add data-cursor-glow to <body>) ─────────────────── */
  if (fine && !reduce && document.body.hasAttribute('data-cursor-glow')){
    const glow = document.createElement('div');
    glow.id = 'ds-cursor-glow';
    glow.setAttribute('aria-hidden', 'true');   // purely decorative
    document.body.appendChild(glow);
    let tx = innerWidth / 2, ty = innerHeight / 2;   // target (pointer)
    let cx = tx, cy = ty;                            // current (eased)
    let lx = tx, ly = ty, lastT = 0;                 // last threshold-passing pos + its timestamp
    let s = 1, sTarget = 1;                          // glow scale: current + target
    let raf = 0, seen = false, focusT = 0, fadeT = 0;
    const MIN = 14;                                  // min px move to react — ignores small movement
    const ensure = () => {
      if (!raf){ glow.style.willChange = 'transform'; raf = requestAnimationFrame(tick); }  // promote only while animating
    };
    addEventListener('pointermove', (e) => {
      const dx = e.clientX - lx, dy = e.clientY - ly;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MIN) return;                        // too small — don't trigger
      const dt = lastT ? Math.max(8, e.timeStamp - lastT) : 16;
      lastT = e.timeStamp;
      const speed = dist / dt;                       // px per ms
      lx = e.clientX; ly = e.clientY;
      tx = e.clientX; ty = e.clientY;
      if (!seen){ seen = true; cx = tx; cy = ty; }
      glow.classList.add('on');                      // visible while moving
      sTarget = Math.min(1.7, 0.92 + speed * 0.24);  // size grows with cursor speed
      clearTimeout(focusT); clearTimeout(fadeT);
      focusT = setTimeout(() => { sTarget = 0.5;  ensure(); }, 200);   // focus when it stops
      fadeT  = setTimeout(() => {                                       // fade out when still
        glow.classList.remove('on');
        sTarget = 0.82; ensure();                    // soft outward bloom as it dissolves
      }, 1500);
      ensure();
    }, { passive:true });
    addEventListener('pointerdown', () => glow.style.setProperty('--glow-color','var(--glow-color-active)'));
    addEventListener('pointerup',   () => glow.style.removeProperty('--glow-color'));
    addEventListener('mouseleave', () => glow.classList.remove('on'));
    function tick(){
      cx += (tx - cx) * 0.6;        // near-instant position follow
      cy += (ty - cy) * 0.6;
      s  += (sTarget - s) * 0.11;   // slow, smooth size easing
      glow.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
      glow.style.setProperty('--glow-scale', s.toFixed(3));
      const moving  = Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4;
      const scaling = Math.abs(sTarget - s) > 0.003;
      if (moving || scaling){ raf = requestAnimationFrame(tick); }
      else { raf = 0; glow.style.willChange = 'auto'; }   // release the GPU layer when idle
    }
  }
})();
