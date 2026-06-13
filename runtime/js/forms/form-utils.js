/* ---------------------------------------------------------
   Path:         runtime/js/forms/form-utils.js
   File:         form-utils.js
   Version:      V1.0
   Data Schema:  N/A
   System:       D&D Reference System (RSR)
   Module/Role:  Shared utilities for all domain add/edit forms.
                 Imported by spells-form.js, monsters-form.js,
                 magic-items-form.js (and any future domain form).
   Dependencies: none
   Created:      2026-05-10
   Last Updated: 2026-05-10
--------------------------------------------------------- */
/* Changelog:
   V1.0:
   - Initial creation. Consolidates four helpers that were duplicated
     across domain form files:
       buildSortedSourceOptions — source <select> HTML, sorted A–Z
       assertValid              — validation guard, throws first failure
       toTitleCase              — lowercase runtime name → display name
       makeBeforeUnloadGuard    — arm/disarm beforeunload in a closure
*/

// ── Source select ──────────────────────────────────────────────────────────

/**
 * Builds the full <option> innerHTML for a source <select> element.
 * Sources are sorted alphabetically by name (falling back to id).
 * A blank placeholder is prepended; "Homebrew (no source)" is appended.
 *
 * Used by the primary source select (add and edit mode) and by every
 * additional-source row injected in edit mode.
 *
 * @param {Array<{id: string, name?: string}>} sources
 * @returns {string} Concatenated <option> elements.
 */
export function buildSortedSourceOptions(sources) {
  const sorted = [...sources].sort((a, b) =>
    (a.name ?? a.id).localeCompare(b.name ?? b.id)
  );
  return [
    '<option value="">— select —</option>',
    ...sorted.map(s =>
      `<option value="${s.id}">${s.name ?? s.id}</option>`
    ),
    '<option value="homebrew">Homebrew (no source)</option>',
  ].join('\n');
}

// ── Validation ─────────────────────────────────────────────────────────────

/**
 * Validates a list of conditions in order. Throws the message string of
 * the first failing condition. No-ops if all conditions pass.
 *
 * Intended for use inside form data readers where errors are caught and
 * displayed inline. The thrown value is a plain string (not an Error
 * object) so callers can display it directly without unwrapping .message.
 *
 * @param {Array<[boolean, string]>} checks
 *   Each entry is a [condition, message] tuple.
 *   condition: true = valid (passes), false = invalid (throws message).
 *
 * @example
 * assertValid([
 *   [!!name,        'Name is required.'],
 *   [!!source,      'Source is required.'],
 *   [cr !== null,   'Challenge Rating is required.'],
 * ]);
 */
export function assertValid(checks) {
  for (const [condition, message] of checks) {
    if (!condition) throw message;
  }
}

// ── Title case ─────────────────────────────────────────────────────────────

/**
 * Converts a string to title case for display in edit-mode form fields.
 * Runtime records store names in lowercase; this converts them back to a
 * readable form for the user to review and correct before saving.
 *
 * Each whitespace-separated token has its first character uppercased and
 * the remainder lowercased. Hyphenated words are treated as a single token
 * ("mind flayer" → "Mind Flayer"; "yuan-ti" → "Yuan-ti").
 *
 * @param {string} str
 * @returns {string}
 */
export function toTitleCase(str) {
  if (!str) return '';
  return str.replace(/\S+/g, w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );
}

// ── beforeunload guard ─────────────────────────────────────────────────────

/**
 * Creates a paired arm/disarm interface for the browser's beforeunload
 * event. Each call returns a fresh closure so multiple form mounts in the
 * same page session do not share state.
 *
 * Usage:
 *   const guard = makeBeforeUnloadGuard();
 *   inputEl.addEventListener('input', guard.arm, { once: true });
 *   // on successful save or teardown:
 *   guard.disarm();
 *
 * arm() is idempotent when passed as an { once: true } listener —
 * the browser removes it after the first call so it never double-registers.
 * disarm() is always safe to call even if arm() was never triggered.
 *
 * @returns {{ arm: Function, disarm: Function }}
 */
export function makeBeforeUnloadGuard() {
  function handler(e) {
    e.preventDefault();
    e.returnValue = '';
  }
  return {
    arm:    () => window.addEventListener('beforeunload', handler),
    disarm: () => window.removeEventListener('beforeunload', handler),
  };
}
