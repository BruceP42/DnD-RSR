/* ---------------------------------------------------------
   Path:         runtime/js/_core/pipeline-banner.js
   File:         pipeline-banner.js
   Version:      V2.1
   Data Schema:  N/A
   System:       DnD-RSR — D&D 5e Dynamic Reference System
   Module/Role:  Core — startup banner that notifies the user
                 when a pipeline run is needed. Checks for the
                 flag file via a GET request to the same server
                 the page is served from. If the flag is present
                 a dismissible banner is rendered above the main
                 UI. Banner does not block the app loading.
   Dependencies: server.py serving pipeline-needed.flag from
                 the project root as a static asset.
   Created:      2026-05-09
   Last Updated: 2026-05-24
   Author:       Bruce Pilcher
   Changelog:
     V2.1: Path updated for DnD-RSR. FLAG_URL changed from
           /pipeline/pipeline-needed.flag to /pipeline-needed.flag
           — flag file lives at project root in DnD-RSR, not
           inside the pipeline/ subdirectory.
     V2.0: FLAG_URL now derived from window.location.origin —
           no hardcoded port or hostname. Works on any port,
           hostname, or device.
     V1.1: Banner given position:fixed; z-index:9999 to escape
           body normal-flow stacking context.
     V1.0: Initial creation.
--------------------------------------------------------- */

// ── Constants ──────────────────────────────────────────────────────────────

// Derives the server address automatically from wherever the page is served.
// Works on any port, any hostname, any device — no hardcoding needed.
// Flag file lives at project root in DnD-RSR.
const FLAG_URL = `${window.location.origin}/pipeline-needed.flag`;

// ── Flag check ─────────────────────────────────────────────────────────────

/**
 * Returns true if the pipeline-needed flag file exists on the server.
 * Returns false if the server returns 404 or is unreachable.
 * Never throws.
 */
async function _flagExists() {
  try {
    const res = await fetch(FLAG_URL, { method: 'GET', cache: 'no-store' });
    return res.ok;
  } catch {
    // Server unreachable — treat as flag absent; banner should not block.
    return false;
  }
}

// ── Banner render ──────────────────────────────────────────────────────────

function _renderBanner() {
  const banner = document.createElement('div');
    banner.id = 'pipeline-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:9999;';
  banner.innerHTML = `
<span class="pipeline-banner-msg">
  &#9881; Dataset out of date &mdash; a pipeline run is needed.
</span>
<button type="button"
        id="pipeline-run-btn"
        class="pipeline-btn pipeline-btn-run"
        disabled
        title="Pipeline not available on this device">
  Run pipeline
</button>
<button type="button"
        id="pipeline-dismiss-btn"
        class="pipeline-btn pipeline-btn-dismiss">
  Dismiss
</button>`;

  // Insert as first child of <body>, above all other elements.
  document.body.prepend(banner);

  document.getElementById('pipeline-dismiss-btn').addEventListener('click', () => {
    banner.remove();
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Checks for the pipeline-needed flag and, if present, renders the
 * dismissible pipeline banner above the main UI.
 *
 * Call this once on page load. The function is async but the caller
 * does not need to await it — the banner appears after the flag check
 * resolves without blocking the rest of the app.
 *
 * @returns {Promise<void>}
 */
export async function initPipelineBanner() {
  const exists = await _flagExists();
  if (exists) _renderBanner();
}
