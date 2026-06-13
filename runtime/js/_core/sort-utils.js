/* ---------------------------------------------------------
Path: runtime/js/_core/sort-utils.js
File: sort-utils.js
Version: V2.0
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime (RSR)
Module/Role: Shared sort click binding utility; wires <th> click events to URL-driven state transitions via the controller's transition() function. Domain-agnostic — reads field identity from data-field attributes emitted by table-renderer.js.
Dependencies:
  - None (pure DOM + callback)
Created: 2026-03-21
Last Updated: 2026-04-12
Author: Bruce Pilcher
Changelog:
  V1.0: DOM-only sorting (shell layer prototype — now removed)
  V1.1: Added data-value support and numeric-aware sorting
  V2.0: Full replacement. Removed DOM-mutating sort approach.
    Implements URL-driven sort via transition() callback.
    Reads data-field from <th data-sortable="true"> elements.
    Applies sorted-asc / sorted-desc classes to active column.
    Idempotent — guarded against duplicate binding.
Related Files:
  runtime/js/renderers/table-renderer.js
  runtime/js/controllers/spells-controller.js
  runtime/js/controllers/monsters-controller.js
  runtime/js/controllers/magic-items-controller.js
Notes:
  - Sorting is performed at the engine/dataset level, not in the DOM
  - This module only translates a <th> click into a transition() call
  - Sort order: clicking an already-active column toggles asc/desc; clicking a new column always defaults to asc
  - Active column indicator classes (sorted-asc, sorted-desc) are applied immediately for visual feedback; they are also re-applied correctly on re-render because renderFromState re-calls bindInteractions after each render
--------------------------------------------------------- */

/**
 * Bind sort click handlers to all sortable <th> elements within a container.
 *
 * Expects:
 *   - <th data-sortable="true" data-field="fieldName"> emitted by table-renderer.js
 *   - viewState.sort and viewState.order reflecting current sort state
 *   - transition({ sort, order }) to update URL and trigger re-render
 *
 * @param {Object}   params
 * @param {Element}  params.container  - the #results container element
 * @param {Object}   params.viewState  - current controller viewState (read-only reference)
 * @param {Function} params.transition - controller transition() function
 */
export function bindTableSortClicks({ container, viewState, transition }) {

  const table = container.querySelector("table.unified-table");
  if (!table) return;

  // 🔒 Prevent duplicate bindings
  if (table.dataset.sortClicksBound === "true") return;
  table.dataset.sortClicksBound = "true";

  // Apply indicator classes to reflect current sort state on initial render
  applySortIndicators(table, viewState.sort, viewState.order);

  const headers = table.querySelectorAll("th[data-sortable='true'][data-field]");

  headers.forEach(th => {
    th.style.cursor = "pointer";

    th.addEventListener("click", () => {
      const field = th.dataset.field;

      // Toggle order if clicking the already-active sort column; else default asc
      const newOrder =
        (viewState.sort === field && viewState.order === "asc") ? "desc" : "asc";

      transition({ sort: field, order: newOrder });
    });
  });
}

/* ---------------------------------------------------------
   Internal Helpers
--------------------------------------------------------- */

/**
 * Apply sorted-asc / sorted-desc classes to the active <th>.
 * Clears classes from all other sortable headers first.
 *
 * @param {Element} table        - the <table> element
 * @param {string|null} sortField  - currently active sort field
 * @param {string|null} sortOrder  - "asc" | "desc" | null
 */
function applySortIndicators(table, sortField, sortOrder) {
  const headers = table.querySelectorAll("th[data-sortable='true'][data-field]");

  headers.forEach(th => {
    th.classList.remove("sorted-asc", "sorted-desc");

    if (th.dataset.field === sortField && sortOrder) {
      th.classList.add(sortOrder === "asc" ? "sorted-asc" : "sorted-desc");
    }
  });
}
