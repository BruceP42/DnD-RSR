/* ---------------------------------------------------------
Path: runtime/js/render-dispatcher.js
File: render-dispatcher.js
Version: V2.2
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime (RSR)
Module / Role: Minimal render dispatcher (registry-driven); orchestrates table/card rendering and handles row-selection override to card view via selectedId → record.id resolution

Dependencies:
  - runtime/js/resolve-template.js
  - runtime/js/resolve-renderer.js
  - runtime/js/validators/validator.js

Created: 2026-03-21
Last Updated: 2026-04-05
Author: Bruce Pilcher
Reviewed By:

Changelog:
  V1.0: Initial dispatcher with tableRenderer support
  V1.1: Refactored to contract-compliant orchestration layer; clarified separation of concerns
  V1.3: Simplified dispatcher; supported table/card renderMode routing; reduced abstraction overhead
  V1.4: Introduced row-selection override (selectedId → entity lookup → cardRenderer path); aligned UI interaction contract; added runtime identity enforcement between selectedId and record.id; clarified dispatcher role as minimal orchestration layer with selection-aware rendering behavior
  V1.5: Added strict runtime validation for viewType and renderMode; introduced early contract enforcement layer; corrected selectedId override to use entity viewType; added dataset ID debug instrumentation for troubleshooting selection resolution; improved failure determinism and renderer routing safety
  V1.6:
  - Removed debug logging (dataset sampling, passthrough, dataset size)
  - Reinforced dispatcher role as pure orchestration layer
  - Clarified dependency boundary (no DOM dependency)
  V1.7:
  - Fixed validation ordering: existence check now runs before value checks
  - domain missing no longer falls through to a misleading viewType error
  V1.8:
  - Added template guard to selectedId override path
  - Both render paths now symmetrically validate template before passing to renderer
  V1.9:
  - Removed window.renderReference global assignment
  - Module now exposes renderReference via ESM export only
  - window assignment moved to test harness (non-module context) per Directory Contract V5.3
  V2.0:
  - Replaced inline validViewTypes/validRenderModes arrays with
    registry-driven validateRenderRequest()
  - Validation is now domain-aware and fully extensible
  - Adding new domains/renderModes requires zero dispatcher changes
  V2.1:
  - Replaced inline switch with registry-driven resolveRenderer()
  - Removed direct renderer imports (tableRenderer, cardRenderer)
  - Dispatcher now fully free of renderer-specific knowledge
  - Adding new render modes requires zero dispatcher changes
  V2.2:
  - Fixed selectedId override path to use resolveRenderer()
  - Removed last direct cardRenderer reference from dispatcher

Related Files:
  runtime/js/templates/resolve-template.js
  runtime/js/renderers/table-renderer.js
  runtime/js/renderers/card-renderer.js
  shell/table-interaction-controller.js

Notes:
  - Enforces identity contract: selectedId MUST match record.id for entity resolution
  - Row-selection override bypasses table rendering and forces card view rendering for a single entity
  - Remains a thin orchestration layer; does not perform transformation or formatting logic
  - PipelineSpec reserved for future formatter pipeline reactivation
  - renderReference is exposed via ESM export only; window assignment is strictly forbidden per Directory Contract V5.3

---------------------------------------------------------

IMPORTANT IDENTITY CONTRACT:
---------------------------------------------------------
- selectedId (UI layer) represents the ID of a clicked row
- record.id (data layer) represents the dataset primary key

These values MUST match by contract:
    selectedId === record.id

They are intentionally NOT renamed to avoid coupling:
- UI interaction semantics (selectedId)
- dataset schema semantics (record.id)

This mapping is enforced here at runtime via lookup.
---------------------------------------------------------
*/

import { resolveTemplate } from "./resolve-template.js";
import { resolveRenderer } from "./resolve-renderer.js";
import { validateRenderRequest } from "./validators/validator.js";

/**
 * Render a reference object using:
 * data → formatter pipeline → renderer (table/card)
 */
export function renderReference({
  domain,
  viewType,
  renderMode,
  data = [],
  selectedId, // UI-level selection from interaction layer
  pipelineSpec = {}, // reserved for future pipeline reactivation
  options = {}
}) {
// ----------------------------
// 1. Validation
// ----------------------------

// Validation is delegated to the centralised validation authority.
// To add a new domain, viewType, or renderMode: update the relevant registry in runtime/js/validation/<domain>/registry.js only.
// No dispatcher changes required.

validateRenderRequest({ domain, viewType, renderMode });

  // ----------------------------
  // 1.1 Selection override (row click → card view)
  // ----------------------------
//  console.log("[DATASET IDS SAMPLE]", data.slice(0, 5).map(x => x.id)); // temporary debugger
if (selectedId && viewType === "summary") {
    const entity = data.find(x => x.id === selectedId);
  
    if (!entity) {
        throw new Error(
            `[RenderDispatcher] Entity not found for selectedId: ${selectedId}`
        );
    }

    const entityTemplate = resolveTemplate({
        domain,
        viewType: "entity",
        renderMode: "card"
    });

    if (!entityTemplate || typeof entityTemplate !== "object") {
        throw new Error(
            `[RenderDispatcher] Invalid template (${domain}/entity/card)`
        );
    }

    const overrideRenderer = resolveRenderer({
      domain,
      viewType: "entity",
      renderMode: "card"
    });
    
    return overrideRenderer.render({
      data: [entity],
      template: entityTemplate,
      viewType: "entity",
      renderMode: "card",
      context: {
        domain,
        viewType: "entity",
        renderMode: "card",
        data: [entity]
      },
      options
    });
}

  // ----------------------------
  // 2. Resolve template
  // ----------------------------
  const template = resolveTemplate({
    domain,
    viewType,
    renderMode
  });

  if (!template || typeof template !== "object") {
    throw new Error(
      `[RenderDispatcher] Invalid template (${domain}/${viewType}/${renderMode})`
    );
  }

  // ----------------------------
  // 3. Dataset validation
  // ----------------------------
  if (!Array.isArray(data)) {
    throw new Error("[RenderDispatcher] Input must be Array<Record>");
  }

  const rawDataset = data;

  // ----------------------------
  // 4. Pipeline (currently bypassed)
  // ----------------------------
  const formattedData = rawDataset;

//  console.log("[DATA INPUT]", rawDataset);  // temporary debugger
//  console.log("[DATA PASSTHROUGH]", formattedData);  // temporary debugger

  // ----------------------------
  // 5. Runtime context enrichment
  // ----------------------------
  const resolved = formattedData;

//  console.log("[RenderDispatcher] Final dataset size:", resolved.length); // temporary debugger

  const enrichedData = {
    domain,
    viewType,
    renderMode,
    data: resolved
  };

  // ----------------------------
  // 6. Renderer dispatch
  // ----------------------------
// NOTE:
// Renderer selection is fully registry-driven via resolve-renderer.js.
// To add a new domain or render mode: add an entry to the relevant
// runtime/js/renderers/<domain>/registry.js only.
// No dispatcher changes required.
const renderer = resolveRenderer({ domain, viewType, renderMode });

return renderer.render({
  data: enrichedData.data,
  template,
  viewType,
  renderMode,
  context: enrichedData,
  options
});
}