/* ---------------------------------------------------------
   Path:         runtime/js/controllers/sources-controller.js
   File:         sources-controller.js
   Version:      V0.1
   Data Schema:  source record
   System:       D&D Reference System – RSR
   Module/Role:  Controller stub — appMode=browse for the sources domain.
                 Full implementation deferred to a later session.
                 Exists to satisfy the dynamic import in reference.html
                 and prevent a MIME-type crash on page load.
   Dependencies: none
   Created:      2026-05-10
   Last Updated: 2026-05-10
--------------------------------------------------------- */
/* Changelog:
   V0.1:
   - Initial stub. Exports run() which renders a "not yet implemented"
     notice into #results. Prevents the dynamic import failure that
     blocked the reference page from loading when domain=sources.
*/

/**
 * Entry point called by reference.html when domain=sources.
 * Full browse/stack implementation is deferred.
 */
export function run() {
  const container = document.getElementById('results');
  if (container) {
    container.innerHTML = `
<div style="padding: 2rem; font-family: sans-serif;">
  <p><strong>Sources</strong> browse view is not yet implemented.</p>
  <p>You can add source records via
     <a href="?domain=sources&appMode=edit">Add a Source</a>.</p>
</div>`;
  }
}
