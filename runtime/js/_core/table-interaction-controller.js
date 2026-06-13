/* ---------------------------------------------------------
Path: shell/table-interaction-controller.js
File: table-interaction-controller.js
Version: V1.1
Data Schema: V1.0
System: D&D Reference System – Reference System Runtime (RSR) V1.0
Module / Role:
  Table Interaction Controller (Shell Layer)
  Binds DOM row click events to a render dispatch callback.
  Translates user interaction (table row selection) into a domain
  selection request for entity/card rendering.

Responsibilities:
  - Attach click listener to table container element
  - Detect row selection via `tr[data-record-id]`
  - Extract record identity from dataset
  - Forward selection to `renderReference` dispatcher
  - Maintain strict separation from rendering and formatting logic

Non-Responsibilities:
  - Does NOT perform rendering
  - Does NOT transform data models
  - Does NOT manage application state beyond selection event capture

Dependencies:
  - renderReference (injected dispatcher callback)
  - DOM API (EventTarget, Element.closest, dataset)

Inputs:
  - container: HTMLElement (table root element)
  - domain: string (dataset/domain identifier)
  - renderReference: function (dispatches render requests)

Outputs:
  - Invokes renderReference with:
    {
      domain,
      viewType: "entity",
      renderMode: "card",
      selectedId
    }

Side Effects:
  - Registers click event listener on container (idempotent; guarded against duplicate binding)

Created: 2026-04-01
Last Updated: 2026-04-04
Author: Bruce Pilcher
Changelog:
  V1.1 - Added idempotent binding guard to prevent duplicate event listeners; removed debug logging; cleaned unused inputs
  V1.0 - Initial implementation of table row click-to-card view transition

Notes:
  - Acts as a thin interaction bridge between table UI and RSR dispatcher layer
  - Selection is identified exclusively via `data-record-id`
--------------------------------------------------------- */

export function bindTableRowSelection({
  container,
  domain,
  renderReference
}) {
  // 🔒 Prevent duplicate bindings
  if (container.dataset.rowSelectionBound === "true") return;
  container.dataset.rowSelectionBound = "true";

  container.addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-record-id]");
    if (!row) return;

    const selectedId = row.dataset.recordId;

    renderReference({
      domain,
      viewType: "entity",
      renderMode: "card",
      selectedId
    });
  });
}