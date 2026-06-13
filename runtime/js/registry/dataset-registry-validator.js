/* ---------------------------------------------------------
Path: runtime/js/registry/dataset-registry-validator.js
File: dataset-registry-validator.js
Version: V3.2
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime V2.2
Module/Role: Validates dataset registry integrity; enforces Dataset
  Registry Contract and Boundary Contract compliance
Dependencies:
    - None (pure validation module; consumes registry input)
Created: 2026-03-18
Last Updated: 2026-04-09
Author: Bruce Pilcher
Changelog:
    V3.1: Added domain key validation. Improved error messaging with
          full dataset context. Replaced substring-based forbidden
          checks with directory-based enforcement. Added optional index
          artifact validation support. Added non-blocking priority
          warning.
    V3.2: Removed provenance from required fields — provenance is
          available at record level via _meta and is not needed on
          dataset config entries. Removed transitional packaging
          boundary block — there is no packaging layer; the pipeline
          writes canonical dataset files directly to runtime/data/.
          Updated path validation to correctly handle relative paths
          (../../data/) rather than enforcing a packaging/ prefix.
          Updated forbidden path check to catch actual pipeline-
          internal directories rather than false-positiving on
          legitimate runtime/data/ relative paths.
Related Files:
    - runtime/js/registry/dataset-registry.js
    - runtime/js/registry/datasets.js
    - runtime/js/registry/datasets.user.json
Notes:
    - Operates on fully merged registry input
    - Fail-fast validation strategy ensures early detection of
      misconfiguration
    - Dataset source paths must point to runtime/data/ via relative
      paths (../../data/<domain>-dataset.js)
    - Pipeline-internal directories (normalized/, aggregated/) are
      forbidden as source paths
--------------------------------------------------------- */

/**
 * validateRegistry
 * Validates the dataset registry according to Dataset Registry Contract V2.0.
 *
 * @param {Object} registry - Fully merged dataset registry
 */
export function validateRegistry(registry) {
  for (const [domain, config] of Object.entries(registry)) {

    // 1. Domain key validation
    if (typeof domain !== "string" || domain.trim().length === 0) {
      throw new Error(`Invalid domain key: "${domain}"`);
    }

    // 2. Domain must have datasets array
    if (!config.datasets || !Array.isArray(config.datasets)) {
      throw new Error(`Registry error: Domain "${domain}" must have a datasets array`);
    }

    const seenIds = new Set();

    for (const ds of config.datasets) {

      // 3. Required fields
      const requiredFields = ["id", "source", "enabled", "writable"];

      for (const field of requiredFields) {
        if (!(field in ds)) {
          throw new Error(
            `Missing field "${field}" in domain "${domain}": ${JSON.stringify(ds)}`
          );
        }
      }

      // 4. Type validation
      if (typeof ds.id !== "string") {
        throw new Error(
          `Invalid "id" (expected string) in domain "${domain}": ${JSON.stringify(ds)}`
        );
      }

      if (typeof ds.source !== "string") {
        throw new Error(
          `Invalid "source" (expected string) in domain "${domain}": ${JSON.stringify(ds)}`
        );
      }

      if (typeof ds.enabled !== "boolean") {
        throw new Error(
          `Invalid "enabled" (expected boolean) in domain "${domain}": ${JSON.stringify(ds)}`
        );
      }

      if (typeof ds.writable !== "boolean") {
        throw new Error(
          `Invalid "writable" (expected boolean) in domain "${domain}": ${JSON.stringify(ds)}`
        );
      }

      if ("priority" in ds && typeof ds.priority !== "number") {
        throw new Error(
          `Invalid "priority" (expected number) in domain "${domain}": ${JSON.stringify(ds)}`
        );
      }

      // 5. Dataset file naming convention
      if (!ds.source.endsWith("-dataset.js")) {
        throw new Error(
          `Invalid dataset file in domain "${domain}": source must end with ` +
          `"-dataset.js" (got "${ds.source}")`
        );
      }

      // 6. Optional index validation (future-proof)
      if ("index" in ds) {
        if (typeof ds.index !== "string") {
          throw new Error(
            `Invalid "index" (expected string) in domain "${domain}": ${JSON.stringify(ds)}`
          );
        }
        if (!ds.index.endsWith(".index.js")) {
          throw new Error(
            `Invalid index file in domain "${domain}": must end with ".index.js" ` +
            `(got "${ds.index}")`
          );
        }
      }

      // 7. Duplicate ID check
      if (seenIds.has(ds.id)) {
        throw new Error(`Duplicate dataset id "${ds.id}" in domain "${domain}"`);
      }
      seenIds.add(ds.id);

      // 8. Forbidden pipeline-internal directory references
      // Source paths must not point into pipeline working directories.
      // Legitimate paths are relative (../../data/<domain>-dataset.js).
      const forbiddenSegments = [
        "normalized/",
        "aggregated/",
        "data/raw/",
        "data/verified/",
        "pipeline/"
      ];
      for (const segment of forbiddenSegments) {
        if (ds.source.includes(segment)) {
          throw new Error(
            `Forbidden pipeline directory reference in domain "${domain}": ` +
            `"${ds.source}" — dataset sources must point to runtime/data/`
          );
        }
      }

      // 9. Priority advisory (non-blocking)
      if (!("priority" in ds)) {
        console.warn(
          `No priority defined for dataset "${ds.id}" in domain "${domain}" ` +
          `(default behavior assumed)`
        );
      }
    }
  }

  console.log("Registry validation passed ✅");
}