/* ---------------------------------------------------------
   Path:         runtime/js/_core/rsr-layout.js
   File:         rsr-layout.js
   Version:      V2.0
   System:       DnD-RSR — D&D 5e Dynamic Reference System
   Module/Role:  Dynamic layout measurement for index.html.
                 Sets CSS variables from real header dimensions
                 so the RSR header and view container position
                 correctly on any screen size or device.
   Dependencies: (none — no layout-loader.js in DnD-RSR)
   Created:      2026-05-24
   Last Updated: 2026-05-24
   Author:       Bruce Pilcher
   Changelog:
     V2.0: Rewritten for DnD-RSR public repo. Header is now
           inline in index.html so no layoutHeaderReady event
           is needed. Replaced event listener and resize handler
           with a ResizeObserver on #fixed-header. Observer fires
           on first render and again when scroll image loads,
           keeping --site-header-height accurate without any
           manual timing. Separate window resize handler removed
           — ResizeObserver covers viewport size changes too.
     V1.2: Replaced requestAnimationFrame with ResizeObserver
           on #rsr-header-placeholder.
     V1.1: Added --parchment-bg-offset. Moved root to module
           scope. Wrapped RSR height in requestAnimationFrame.
     V1.0: Initial version.
   Notes:
     - Two ResizeObservers, no event listeners, no resize handler
     - #fixed-header observer drives --site-header-height and
       --parchment-bg-offset
     - #rsr-header-placeholder observer drives --rsr-header-height
     - --view-top is calc(--site-header-height + --rsr-header-height)
       and updates automatically when either variable changes
--------------------------------------------------------- */

// Module-level so all functions share the same reference
const root = document.documentElement;

// ── RSR header observer ────────────────────────────────────────────────────
// Watches #rsr-header-placeholder for height changes. Fires when:
//   - the element first renders
//   - the domain controller adds the filter bar
//   - the filter bar changes on domain switch
//   - the viewport is resized and the filter bar reflows
// This means --rsr-header-height and --view-top always reflect the
// actual rendered height, regardless of when the controller runs.

const rsrHeader = document.getElementById('rsr-header-placeholder');
if (rsrHeader) {
  new ResizeObserver(entries => {
    const h = entries[0].contentRect.height;
    if (h > 0) {
      root.style.setProperty('--rsr-header-height', `${h}px`);
    }
  }).observe(rsrHeader);
}

// ── Site header observer ───────────────────────────────────────────────────
// Watches #fixed-header for height changes. Fires when:
//   - the element first renders (immediately — header is inline in index.html)
//   - the scroll image loads and adds its height
//   - the viewport is resized
// Drives --site-header-height and --parchment-bg-offset.
// No layoutHeaderReady event needed — the header is not fetched
// asynchronously in DnD-RSR.

function applyLayoutVars(siteHeaderHeight) {
  root.style.setProperty('--site-header-height', `${siteHeaderHeight}px`);

  // Align parchment background image top with the top of the scroll image
  // so parchment-Full_bkgnd-same.png and parchment-top3.png meet seamlessly.
  const scrollImg = document.getElementById('scroll-top-image');
  if (scrollImg) {
    const offset = scrollImg.getBoundingClientRect().top;
    root.style.setProperty('--parchment-bg-offset', `${offset}px`);
  }
}

const siteHeader = document.getElementById('fixed-header');
if (siteHeader) {
  new ResizeObserver(entries => {
    const h = entries[0].contentRect.height;
    if (h > 0) applyLayoutVars(h);
  }).observe(siteHeader);
}
