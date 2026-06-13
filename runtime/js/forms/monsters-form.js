/* ---------------------------------------------------------
   Path:         runtime/js/forms/monsters-form.js
   File:         monsters-form.js
   Version:      V1.8
   Data Schema:  Monster schema v1.1
   System:       D&D Reference System – RSR V1.0
   Module/Role:  Form — collects all monster fields for add/edit operations
   Dependencies: runtime/js/forms/form-utils.js
   Created:      2026-05-07
   Last Updated: 2026-05-10
--------------------------------------------------------- */
/* Changelog:
   V1.8
   - Modified  assertValid block in collectFormData: to remove armor_type and hit_dice from required list.
   - Removed "required" from <input> for armor_type and hit_dice.
   V1.7:
   - Imports buildSortedSourceOptions, assertValid, toTitleCase, and makeBeforeUnloadGuard from form-utils.js. Local _buildSortedSourceOptions and _toTitleCase functions removed; all call sites updated.
   - Beforeunload guard replaced with makeBeforeUnloadGuard() factory.
   - Submit handler restructured: collectFormData (and its assertValid block) runs before the save button is disabled, matching the spells-form pattern. Validation errors display inline and return without disabling the button. Writer errors display inline after the button is re-enabled in finally.
   - collectFormData now validates required fields via assertValid before returning. Throws a plain string message on failure so the submit handler can display it directly. Required fields checked: name, size, creature_type, alignment, ac, armor_type, hp, hit_dice, cr, source_id.
   V1.6:
   - mountMonstersForm now accepts an optional initialValues object in its options parameter. When provided the form mounts in edit mode: _populateForm() pre-fills every field from the runtime record, the primary source select is disabled (source encoded in id cannot change), and an Additional Sources fieldset is injected below the Source fieldset so the user can add or remove supplementary source entries.
   - Sources dropdown (primary and additional rows) is now sorted alphabetically by source name via _buildSortedSourceOptions().
   - form[data-mode] set to "add" or "edit" for CSS targeting.
   - Save button reads "Save Changes" in edit mode, "Save Monster" in add mode.
   - collectFormData now reads .additional-source-row elements and returns an additionalSources array. Empty array in add mode (rows not present).
   - New module-level helpers: _toTitleCase, _buildSortedSourceOptions, _addAdditionalSourceRow, _populateForm.
   V1.5:
   - Signature changed from mountMonstersForm(container, onSubmit) to mountMonstersForm(container, { sources = [] } = {}, onSubmit) — aligns with spells-form.js and magic-items-form.js.
   - Source fieldset: free-text input and setupSourceValidation replaced with a <select> populated from the sources array. "Homebrew (no source)" appended as the final option. SERVER constant removed (no longer used).
   - collectFormData already read source_id via get('source_id') and returned it as sourceId — unchanged; the select shares the same name attribute.
   - Submit handler now disables Save before calling onSubmit, awaits it, disarms the beforeunload guard on success, catches errors and displays them in a new inline <p id="monsters-form-error" aria-live="polite">, and re-enables Save in a finally block.
   V1.4:
   - Moved damageKey() definition to module top level (before setup functions) to resolve ReferenceError in Firefox strict-mode ES module context. Removed duplicate definition from the Helpers section.
   V1.3:
   - Added setupDamageInterlock(): selecting resistant/immune on the nonmagical compound row automatically clears bludgeoning, piercing, and slashing back to none, and vice versa. Prevents redundant and contradictory combinations.
   V1.2:
   - Damage vulnerabilities / resistances / immunities replaced with a radio table: one row per damage type, columns None / Vulnerable / Resistant / Immune. A type can only appear in one list — selecting a column clears the others automatically. "Bludg./Pierc./Slash. (nonmagical)" added as a fixed damage type row; its Vulnerable radio is disabled (no such monster exists in 5e). Serializes into damage_vulnerabilities, damage_resistances, damage_immunities arrays as before.
   - Condition immunities replaced with a checkbox grid (finite canonical list). Serializes into condition_immunities array as before.
   V1.1:
   - creature_type changed from datalist input to <select> (closed canonical list)
   - alignment changed to text input with datalist (open: standard values + edge cases)
   - Add Skill / Add action-row buttons now move keyboard focus to the new name field after the row is created, supporting keyboard-only workflows
   - Source ID field validates against the sources dataset on blur; shows an inline non-blocking warning if the entered ID is not registered
   - beforeunload listener added on first field interaction; cleared on teardown; warns the user before navigating away with unsaved form data
   V1.0:
   - Initial creation.
*/

import {
  buildSortedSourceOptions,
  assertValid,
  toTitleCase,
  makeBeforeUnloadGuard,
} from './form-utils.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

const CREATURE_TYPES = [
  'aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental',
  'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead',
];

const ALIGNMENTS = [
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
  'Unaligned',
  'Any Alignment',
  'Any Chaotic Alignment', 'Any Evil Alignment',
  'Any Good Alignment', 'Any Lawful Alignment',
  'Any Non-Evil Alignment', 'Any Non-Good Alignment',
  'Any Non-Lawful Alignment', 'Any Non-Chaotic Alignment',
];

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_LABELS = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

const CR_VALUES = [
  0, 0.125, 0.25, 0.5,
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 30,
];
const CR_DISPLAY = { 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' };

const SKILL_NAMES = [
  'acrobatics', 'animal handling', 'arcana', 'athletics', 'deception',
  'history', 'insight', 'intimidation', 'investigation', 'medicine',
  'nature', 'perception', 'performance', 'persuasion', 'religion',
  'sleight of hand', 'stealth', 'survival',
];

// Each entry: { label, value, noVulnerable }
const DAMAGE_TYPES = [
  { label: 'Acid',                                    value: 'acid'          },
  { label: 'Bludgeoning',                             value: 'bludgeoning'   },
  { label: 'Cold',                                    value: 'cold'          },
  { label: 'Fire',                                    value: 'fire'          },
  { label: 'Force',                                   value: 'force'         },
  { label: 'Lightning',                               value: 'lightning'     },
  { label: 'Necrotic',                                value: 'necrotic'      },
  { label: 'Piercing',                                value: 'piercing'      },
  { label: 'Poison',                                  value: 'poison'        },
  { label: 'Psychic',                                 value: 'psychic'       },
  { label: 'Radiant',                                 value: 'radiant'       },
  { label: 'Slashing',                                value: 'slashing'      },
  { label: 'Thunder',                                 value: 'thunder'       },
  {
    label:        'Bludg. / Pierc. / Slash. (nonmagical)',
    value:        'bludgeoning, piercing, and slashing from nonmagical attacks',
    noVulnerable: true,
  },
];

const CONDITIONS = [
  'blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled',
  'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned',
  'prone', 'restrained', 'stunned', 'unconscious',
];

/**
 * Converts a damage type value string to a safe HTML name attribute.
 * Replaces spaces and commas with underscores.
 * Defined at module top level so it is available before the setup functions.
 */
function damageKey(value) {
  return value.replace(/[\s,]+/g, '_');
}

const ACTION_SECTIONS = [
  { key: 'traits',            label: 'Traits'            },
  { key: 'actions',           label: 'Actions'           },
  { key: 'bonus_actions',     label: 'Bonus Actions'     },
  { key: 'reactions',         label: 'Reactions'         },
  { key: 'legendary_actions', label: 'Legendary Actions' },
  { key: 'lair_actions',      label: 'Lair Actions'      },
  { key: 'regional_effects',  label: 'Regional Effects'  },
];

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Mounts the monsters form into the given container element.
 * Calls onSubmit(data) when the form is submitted successfully.
 * Returns a teardown function that clears the container and disarms the
 * beforeunload guard.
 *
 * @param {HTMLElement} container
 * @param {object}      [options]
 * @param {Array}       [options.sources=[]]         - Source records { id, name }
 *                        for the source selects. Sorted A–Z by form-utils.
 * @param {object|null} [options.initialValues=null] - Runtime record to pre-populate.
 *                        When provided the form mounts in edit mode: primary source
 *                        disabled, additional sources section injected, button reads
 *                        "Save Changes".
 * @param {function}    onSubmit - Async function receiving collected form data; may throw.
 * @returns {function}           - Teardown function.
 */
export function mountMonstersForm(
  container,
  { sources = [], initialValues = null } = {},
  onSubmit,
) {
  const isEdit = initialValues !== null;

  container.innerHTML = buildFormHTML(sources, isEdit);

  // Mark the form element so CSS can target add vs edit mode
  const form = container.querySelector('#monsters-form');
  form.dataset.mode = isEdit ? 'edit' : 'add';

  setupAbilityModifiers(container);
  setupSavingThrows(container);
  setupSkills(container);
  setupActionSections(container);
  setupDamageInterlock(container);

  // Pre-populate all fields when editing an existing record.
  // Programmatic value changes do not fire 'input', so the guard is not
  // armed during population.
  if (isEdit) {
    _populateForm(container, initialValues, sources);
  }

  // ── beforeunload guard ────────────────────────────────────────────────
  const guard = makeBeforeUnloadGuard();
  form.addEventListener('input', guard.arm, { once: true });

  // ── Submit handler ────────────────────────────────────────────────────
  // Validation (collectFormData) runs before the button is disabled so
  // that inline error messages appear without a flash of disabled state.
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = container.querySelector('[type="submit"]');
    const errEl   = container.querySelector('#monsters-form-error');
    errEl.hidden  = true;

    // Collect and validate — throws a plain string on failure
    let data;
    try {
      data = collectFormData(container);
    } catch (msg) {
      errEl.textContent = msg;
      errEl.hidden = false;
      return;
    }

    // Submit to writer — throws an Error on write failure
    saveBtn.disabled = true;
    try {
      await onSubmit(data);
      guard.disarm();
    } catch (err) {
      errEl.textContent = err.message ?? String(err);
      errEl.hidden = false;
    } finally {
      saveBtn.disabled = false;
    }
  });

  return function teardown() {
    guard.disarm();
    container.innerHTML = '';
  };
}

// ── HTML builder ───────────────────────────────────────────────────────────

function buildFormHTML(sources, isEdit = false) {
  const crOptions = CR_VALUES
    .map(cr => `<option value="${cr}">${CR_DISPLAY[cr] ?? cr}</option>`)
    .join('');

  const sizeOptions = SIZES
    .map(s => `<option value="${s}">${s}</option>`)
    .join('');

  const creatureTypeOptions = CREATURE_TYPES
    .map(t => `<option value="${t}">${t}</option>`)
    .join('');

  const alignmentOptions = ALIGNMENTS
    .map(a => `<option value="${a}">`)
    .join('');

  const skillOptions = SKILL_NAMES
    .map(s => `<option value="${s}">`)
    .join('');

  // Sources sorted A–Z via shared utility.
  // Additional source selects are built per-row by _addAdditionalSourceRow.
  const sourceOptions = buildSortedSourceOptions(sources);

  const abilityRows = ABILITIES.map(ab => `
    <label>${ABILITY_LABELS[ab]}
      <input type="number" name="${ab}" min="1" max="30" required>
      <span class="mod-display" data-ability="${ab}"></span>
    </label>`).join('');

  const saveRows = ABILITIES.map(ab => `
    <span class="save-row">
      <label><input type="checkbox" name="save_${ab}_check"> ${ABILITY_LABELS[ab]}</label>
      <input type="number" name="save_${ab}_val" placeholder="mod" class="save-mod" disabled>
    </span>`).join('');

  const damageRows = DAMAGE_TYPES.map(({ label, value, noVulnerable }) => {
    const safeName = `dmg_${damageKey(value)}`;
    const vulnDisabled = noVulnerable
      ? ' disabled title="No monster is vulnerable to nonmagical weapon damage"'
      : '';
    return `
      <tr>
        <td class="dmg-label">${label}</td>
        <td class="dmg-radio"><input type="radio" name="${safeName}" value="none" checked></td>
        <td class="dmg-radio"><input type="radio" name="${safeName}" value="vulnerable"${vulnDisabled}></td>
        <td class="dmg-radio"><input type="radio" name="${safeName}" value="resistant"></td>
        <td class="dmg-radio"><input type="radio" name="${safeName}" value="immune"></td>
      </tr>`;
  }).join('');

  const conditionCheckboxes = CONDITIONS.map(c => `
    <label class="condition-label">
      <input type="checkbox" name="cond_${c}" value="${c}"> ${c}
    </label>`).join('');

  const actionSectionBlocks = ACTION_SECTIONS.map(({ key, label }) => {
    const singular = label.endsWith('s') ? label.slice(0, -1) : label;
    return `
  <details class="action-section" data-section="${key}">
    <summary>
      <span class="section-label">${label}</span>
      <span class="row-count">(0)</span>
    </summary>
    <div class="action-rows" id="${key}-rows"></div>
    <button type="button" class="add-action-btn" data-section="${key}">+ Add ${singular}</button>
  </details>`;
  }).join('');

  const saveLabel = isEdit ? 'Save Changes' : 'Save Monster';

  return `
<form id="monsters-form" novalidate>

  <fieldset>
    <legend>Identity</legend>
    <label>Name
      <input type="text" name="name" required>
    </label>
    <label>Size
      <select name="size" required>
        <option value="">— select —</option>
        ${sizeOptions}
      </select>
    </label>
    <label>Creature Type
      <select name="creature_type" required>
        <option value="">— select —</option>
        ${creatureTypeOptions}
      </select>
    </label>
    <label>Subtype
      <input type="text" name="subtype" placeholder="leave blank if none">
    </label>
    <label>Alignment
      <input type="text" name="alignment" list="alignment-list" required
             placeholder="e.g. Neutral Evil">
      <datalist id="alignment-list">${alignmentOptions}</datalist>
    </label>
  </fieldset>

  <fieldset>
    <legend>Defense</legend>
    <label>AC
      <input type="number" name="ac" min="0" required>
    </label>
    <label>Armor Type
      <input type="text" name="armor_type" placeholder="e.g. Natural Armor">
    </label>
    <label>HP
      <input type="number" name="hp" min="1" required>
    </label>
    <label>Hit Dice
      <input type="text" name="hit_dice" placeholder="e.g. 18d10">
    </label>
  </fieldset>

  <fieldset>
    <legend>Speed</legend>
    <label>Walk   <input type="number" name="speed_walk"   min="0" placeholder="0"> ft.</label>
    <label>Fly    <input type="number" name="speed_fly"    min="0" placeholder="0"> ft.</label>
    <label>Swim   <input type="number" name="speed_swim"   min="0" placeholder="0"> ft.</label>
    <label>Climb  <input type="number" name="speed_climb"  min="0" placeholder="0"> ft.</label>
    <label>Burrow <input type="number" name="speed_burrow" min="0" placeholder="0"> ft.</label>
    <label><input type="checkbox" name="speed_hover"> Hover</label>
  </fieldset>

  <fieldset>
    <legend>Ability Scores</legend>
    <datalist id="skill-names-list">${skillOptions}</datalist>
    ${abilityRows}
  </fieldset>

  <fieldset>
    <legend>Saving Throws <small>(check to include)</small></legend>
    ${saveRows}
  </fieldset>

  <fieldset>
    <legend>Skills</legend>
    <div id="skills-rows"></div>
    <button type="button" id="add-skill-btn">+ Add Skill</button>
  </fieldset>

  <fieldset>
    <legend>Damage</legend>
    <table class="damage-table">
      <thead>
        <tr>
          <th class="dmg-label">Type</th>
          <th class="dmg-radio">—</th>
          <th class="dmg-radio">Vulnerable</th>
          <th class="dmg-radio">Resistant</th>
          <th class="dmg-radio">Immune</th>
        </tr>
      </thead>
      <tbody>
        ${damageRows}
      </tbody>
    </table>
  </fieldset>

  <fieldset>
    <legend>Condition Immunities</legend>
    <div class="condition-grid">
      ${conditionCheckboxes}
    </div>
  </fieldset>

  <fieldset>
    <legend>Senses</legend>
    <label>Darkvision  <input type="number" name="sense_darkvision"  min="0" placeholder="0"> ft.</label>
    <label>Blindsight  <input type="number" name="sense_blindsight"  min="0" placeholder="0"> ft.</label>
    <label>Tremorsense <input type="number" name="sense_tremorsense" min="0" placeholder="0"> ft.</label>
    <label>Truesight   <input type="number" name="sense_truesight"   min="0" placeholder="0"> ft.</label>
    <label>Passive Perception
      <input type="number" name="passive_perception" min="1" required>
    </label>
  </fieldset>

  <fieldset>
    <legend>Languages</legend>
    <label>Languages
      <input type="text" name="languages" placeholder="comma-separated, e.g. Common, Elvish">
    </label>
  </fieldset>

  <fieldset>
    <legend>Challenge</legend>
    <label>CR
      <select name="cr" required>
        <option value="">— select —</option>
        ${crOptions}
      </select>
    </label>
    <label>XP
      <input type="number" name="xp" min="0" placeholder="leave blank to derive from CR">
    </label>
  </fieldset>

  <fieldset>
    <legend>Source</legend>
    <label>Source
      <select name="source_id" required>
        ${sourceOptions}
      </select>
    </label>
    <label>Page
      <input type="number" name="source_page" min="0">
    </label>
  </fieldset>

  ${actionSectionBlocks}

  <p id="monsters-form-error" class="form-error" aria-live="polite" hidden></p>

  <div class="form-actions">
    <button type="submit">${saveLabel}</button>
  </div>

</form>`.trim();
}

// ── Setup functions ────────────────────────────────────────────────────────

function setupAbilityModifiers(container) {
  ABILITIES.forEach(ab => {
    const input   = container.querySelector(`[name="${ab}"]`);
    const display = container.querySelector(`.mod-display[data-ability="${ab}"]`);
    input.addEventListener('input', () => {
      const score = parseInt(input.value, 10);
      if (!isNaN(score)) {
        const mod = Math.floor((score - 10) / 2);
        display.textContent = mod >= 0 ? `(+${mod})` : `(${mod})`;
      } else {
        display.textContent = '';
      }
    });
  });
}

function setupSavingThrows(container) {
  ABILITIES.forEach(ab => {
    const checkbox = container.querySelector(`[name="save_${ab}_check"]`);
    const modInput = container.querySelector(`[name="save_${ab}_val"]`);
    checkbox.addEventListener('change', () => {
      modInput.disabled = !checkbox.checked;
      if (!checkbox.checked) modInput.value = '';
    });
  });
}

function setupSkills(container) {
  container.querySelector('#add-skill-btn').addEventListener('click', () => {
    const nameInput = addSkillRow(container);
    nameInput.focus();
  });
}

function setupActionSections(container) {
  container.querySelectorAll('.add-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const nameInput = addActionRow(container, btn.dataset.section);
      nameInput.focus();
    });
  });
}

/**
 * Enforces mutual exclusivity between the nonmagical compound damage row and
 * the three plain rows it overlaps with (bludgeoning, piercing, slashing).
 */
function setupDamageInterlock(container) {
  const NONMAGICAL_VALUE = 'bludgeoning, piercing, and slashing from nonmagical attacks';
  const PLAIN_VALUES     = ['bludgeoning', 'piercing', 'slashing'];

  const nonmagicalKey = damageKey(NONMAGICAL_VALUE);
  const plainKeys     = PLAIN_VALUES.map(damageKey);

  const clearGroup = (key) => {
    const noneRadio = container.querySelector(`[name="dmg_${key}"][value="none"]`);
    if (noneRadio) noneRadio.checked = true;
  };

  container.querySelectorAll(`[name="dmg_${nonmagicalKey}"]`).forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value !== 'none') plainKeys.forEach(clearGroup);
    });
  });

  plainKeys.forEach(key => {
    container.querySelectorAll(`[name="dmg_${key}"]`).forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value !== 'none') clearGroup(nonmagicalKey);
      });
    });
  });
}

// ── Row helpers ────────────────────────────────────────────────────────────

function addSkillRow(container) {
  const row = document.createElement('div');
  row.className = 'skill-row';
  row.innerHTML =
    '<input type="text" list="skill-names-list" placeholder="Skill name" class="skill-name">' +
    '<input type="number" class="skill-mod" placeholder="mod">' +
    '<button type="button" class="remove-row-btn">Remove</button>';
  row.querySelector('.remove-row-btn').addEventListener('click', () => row.remove());
  container.querySelector('#skills-rows').appendChild(row);
  return row.querySelector('.skill-name');
}

function addActionRow(container, key) {
  const rowsDiv = container.querySelector(`#${key}-rows`);
  const row = document.createElement('div');
  row.className = 'action-row';
  row.innerHTML =
    '<input type="text" class="action-name" placeholder="Name">' +
    '<textarea class="action-desc" rows="3" placeholder="Description"></textarea>' +
    '<button type="button" class="remove-row-btn">Remove</button>';
  row.querySelector('.remove-row-btn').addEventListener('click', () => {
    row.remove();
    updateRowCount(container, key);
  });
  rowsDiv.appendChild(row);
  updateRowCount(container, key);
  return row.querySelector('.action-name');
}

function updateRowCount(container, key) {
  const count = container.querySelector(`#${key}-rows`).children.length;
  container.querySelector(`details[data-section="${key}"] .row-count`).textContent = `(${count})`;
}

// ── Data collection ────────────────────────────────────────────────────────

function collectFormData(container) {
  const get     = name => container.querySelector(`[name="${name}"]`)?.value.trim() ?? '';
  const getNum  = name => { const v = get(name); return v === '' ? null : Number(v); };
  const checked = name => container.querySelector(`[name="${name}"]`)?.checked ?? false;

  // Speed
  const speed = {};
  for (const key of ['walk', 'fly', 'swim', 'climb', 'burrow']) {
    const v = getNum(`speed_${key}`);
    if (v !== null && v > 0) speed[key] = `${v} ft.`;
  }
  if (checked('speed_hover')) speed.hover = true;

  // Ability scores — flat (writer nests for runtime)
  const abilityScores = {};
  for (const ab of ABILITIES) abilityScores[ab] = getNum(ab) ?? 10;

  // Saving throws
  const saving_throws = {};
  for (const ab of ABILITIES) {
    if (checked(`save_${ab}_check`)) {
      const val = getNum(`save_${ab}_val`);
      if (val !== null) saving_throws[ab] = val;
    }
  }

  // Skills
  const skills = {};
  container.querySelectorAll('.skill-row').forEach(row => {
    const name = row.querySelector('.skill-name').value.trim().toLowerCase();
    const mod  = row.querySelector('.skill-mod').value.trim();
    if (name && mod !== '') skills[name] = Number(mod);
  });

  // Damage radio table
  const damage_vulnerabilities = [];
  const damage_resistances     = [];
  const damage_immunities      = [];

  for (const { value } of DAMAGE_TYPES) {
    const safeName = `dmg_${damageKey(value)}`;
    const selected = container.querySelector(`[name="${safeName}"]:checked`)?.value ?? 'none';
    if (selected === 'vulnerable') damage_vulnerabilities.push(value);
    else if (selected === 'resistant') damage_resistances.push(value);
    else if (selected === 'immune')    damage_immunities.push(value);
  }

  // Condition immunities
  const condition_immunities = CONDITIONS.filter(c => checked(`cond_${c}`));

  // Senses
  const senses = {};
  for (const sense of ['darkvision', 'blindsight', 'tremorsense', 'truesight']) {
    const v = getNum(`sense_${sense}`);
    if (v !== null && v > 0) senses[sense] = `${v} ft.`;
  }
  senses.passive_perception = getNum('passive_perception') ?? 10;

  // Languages
  const langRaw = get('languages');
  const languages = langRaw ? langRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  // Action sections
  const actionData = {};
  for (const { key } of ACTION_SECTIONS) {
    actionData[key] = [];
    container.querySelectorAll(`#${key}-rows .action-row`).forEach(row => {
      const name = row.querySelector('.action-name').value.trim();
      const desc = row.querySelector('.action-desc').value.trim();
      if (name || desc) actionData[key].push({ name, desc });
    });
  }

  // Additional sources (only present in edit mode; empty array in add mode)
  const additionalSources = [];
  container.querySelectorAll('.additional-source-row').forEach(row => {
    const source  = row.querySelector('.additional-source-select')?.value;
    const pageRaw = row.querySelector('.additional-source-page')?.value ?? '';
    if (source) {
      additionalSources.push({
        source,
        page: pageRaw !== '' ? Number(pageRaw) : null,
      });
    }
  });

  // ── Validation ─────────────────────────────────────────────────────────
  // assertValid throws a plain string so the submit handler can display it
  // directly without unwrapping .message. Runs after collection so all
  // field values are available for the condition expressions.
  const cr = get('cr');
  assertValid([
    [!!get('name'),         'Name is required.'],
    [!!get('size'),         'Size is required.'],
    [!!get('creature_type'),'Creature type is required.'],
    [!!get('alignment'),    'Alignment is required.'],
    [getNum('ac') !== null, 'AC is required.'],
    [getNum('hp') !== null, 'HP is required.'],
    [cr !== '',             'Challenge Rating is required.'],
    [!!get('source_id'),    'Source is required.'],
  ]);

  return {
    name:                   get('name'),
    size:                   get('size'),
    creature_type:          get('creature_type'),
    subtype:                get('subtype'),
    alignment:              get('alignment'),
    ac:                     getNum('ac'),
    armor_type:             get('armor_type'),
    hp:                     getNum('hp'),
    hit_dice:               get('hit_dice'),
    speed,
    ...abilityScores,
    saving_throws,
    skills,
    damage_vulnerabilities,
    damage_resistances,
    damage_immunities,
    condition_immunities,
    senses,
    languages,
    cr:                     cr !== '' ? Number(cr) : null,
    xp:                     getNum('xp'),
    ...actionData,
    sourceId:               get('source_id'),
    page:                   getNum('source_page'),
    additionalSources,
  };
}

// ── Edit-mode population ───────────────────────────────────────────────────

/**
 * Pre-fills every form field from a runtime monster record.
 * Called only when initialValues is provided (edit mode).
 * Programmatic value changes do not fire input events, so the
 * beforeunload guard is not armed during population.
 *
 * @param {HTMLElement} container
 * @param {object}      initialValues - Runtime monster record.
 * @param {Array}       sources       - Source records for additional source selects.
 */
function _populateForm(container, initialValues, sources) {
  const set = (name, val) => {
    const el = container.querySelector(`[name="${name}"]`);
    if (el) el.value = val ?? '';
  };

  // ── Identity ─────────────────────────────────────────────────────────
  set('name',          toTitleCase(initialValues.name ?? ''));
  set('size',          initialValues.size ?? '');
  set('creature_type', initialValues.creature_type ?? '');
  set('subtype',       initialValues.subtype ?? '');
  set('alignment',     initialValues.alignment ?? '');

  // ── Defense ──────────────────────────────────────────────────────────
  set('ac',         initialValues.ac ?? '');
  set('armor_type', initialValues.armor_type ?? '');
  set('hp',         initialValues.hp ?? '');
  set('hit_dice',   initialValues.hit_dice ?? '');

  // ── Speed ─────────────────────────────────────────────────────────────
  for (const key of ['walk', 'fly', 'swim', 'climb', 'burrow']) {
    const val = initialValues.speed?.[key];
    if (val) set(`speed_${key}`, parseInt(val, 10) || '');
  }
  const hoverEl = container.querySelector('[name="speed_hover"]');
  if (hoverEl) hoverEl.checked = initialValues.speed?.hover === true;

  // ── Ability scores — dispatch input to refresh modifier displays ──────
  for (const ab of ABILITIES) {
    const input = container.querySelector(`[name="${ab}"]`);
    if (input) {
      input.value = initialValues.ability_scores?.[ab] ?? '';
      input.dispatchEvent(new Event('input'));
    }
  }

  // ── Saving throws ─────────────────────────────────────────────────────
  for (const ab of ABILITIES) {
    const val = initialValues.saving_throws?.[ab];
    if (val !== undefined) {
      const checkbox = container.querySelector(`[name="save_${ab}_check"]`);
      const modInput = container.querySelector(`[name="save_${ab}_val"]`);
      if (checkbox) checkbox.checked = true;
      if (modInput) { modInput.disabled = false; modInput.value = val; }
    }
  }

  // ── Skills ────────────────────────────────────────────────────────────
  for (const [skillName, mod] of Object.entries(initialValues.skills ?? {})) {
    const nameInput = addSkillRow(container);
    nameInput.value = skillName;
    nameInput.closest('.skill-row').querySelector('.skill-mod').value = mod;
  }

  // ── Damage radios ─────────────────────────────────────────────────────
  for (const { value } of DAMAGE_TYPES) {
    const safeName = `dmg_${damageKey(value)}`;
    let selection = 'none';
    if      (initialValues.damage_vulnerabilities?.includes(value)) selection = 'vulnerable';
    else if (initialValues.damage_resistances?.includes(value))     selection = 'resistant';
    else if (initialValues.damage_immunities?.includes(value))      selection = 'immune';
    const radio = container.querySelector(`[name="${safeName}"][value="${selection}"]`);
    if (radio) radio.checked = true;
  }

  // ── Condition immunities ──────────────────────────────────────────────
  for (const cond of (initialValues.condition_immunities ?? [])) {
    const checkbox = container.querySelector(`[name="cond_${cond}"]`);
    if (checkbox) checkbox.checked = true;
  }

  // ── Senses ────────────────────────────────────────────────────────────
  for (const sense of ['darkvision', 'blindsight', 'tremorsense', 'truesight']) {
    const val = initialValues.senses?.[sense];
    if (val) set(`sense_${sense}`, parseInt(val, 10) || '');
  }
  set('passive_perception', initialValues.senses?.passive_perception ?? '');

  // ── Languages ─────────────────────────────────────────────────────────
  set('languages', (initialValues.languages ?? []).join(', '));

  // ── Challenge ─────────────────────────────────────────────────────────
  set('cr', initialValues.cr ?? '');
  if (initialValues.xp_given) set('xp', initialValues.xp ?? '');

  // ── Primary source — disable; page remains editable ───────────────────
  const sourceSelect = container.querySelector('[name="source_id"]');
  if (sourceSelect) {
    sourceSelect.value    = initialValues.sources?.[0]?.source ?? '';
    sourceSelect.disabled = true;
  }
  set('source_page', initialValues.sources?.[0]?.page ?? '');

  // ── Additional sources section ─────────────────────────────────────────
  // Injected after the Source fieldset; not present in add mode.
  const sourceFieldset = sourceSelect?.closest('fieldset');
  if (sourceFieldset) {
    const additionalFieldset = document.createElement('fieldset');
    additionalFieldset.className = 'additional-sources-fieldset';
    additionalFieldset.innerHTML = `
      <legend>Additional Sources</legend>
      <p class="field-hint">The primary source cannot be changed. Add other books
        or supplements where this monster also appears.</p>
      <div id="additional-sources-rows"></div>
      <button type="button" id="add-additional-source-btn">+ Add Source</button>
    `;
    sourceFieldset.after(additionalFieldset);

    // Populate existing additional sources (sources[1..])
    for (const src of (initialValues.sources ?? []).slice(1)) {
      _addAdditionalSourceRow(container, sources, src);
    }

    container.querySelector('#add-additional-source-btn')
      ?.addEventListener('click', () => {
        _addAdditionalSourceRow(container, sources, null);
      });
  }

  // ── Action sections ───────────────────────────────────────────────────
  for (const { key } of ACTION_SECTIONS) {
    for (const { name, desc } of (initialValues[key] ?? [])) {
      const nameInput = addActionRow(container, key);
      nameInput.value = name;
      nameInput.closest('.action-row').querySelector('.action-desc').value = desc;
    }
  }

  // Open any action <details> that have pre-populated rows
  for (const { key } of ACTION_SECTIONS) {
    const details = container.querySelector(`details[data-section="${key}"]`);
    const rowsEl  = container.querySelector(`#${key}-rows`);
    if (details && rowsEl?.children.length > 0) details.open = true;
  }
}

// ── Additional source row helper ───────────────────────────────────────────

/**
 * Creates one additional-source row (select + page input + Remove button),
 * optionally pre-fills it from an existing { source, page } object, and
 * appends it to #additional-sources-rows.
 *
 * @param {HTMLElement}  container
 * @param {Array}        sources  - Source records for the select options.
 * @param {object|null}  existing - { source, page } to pre-fill, or null for blank.
 */
function _addAdditionalSourceRow(container, sources, existing) {
  const row = document.createElement('div');
  row.className = 'additional-source-row';
  row.innerHTML = `
    <select class="additional-source-select">
      ${buildSortedSourceOptions(sources)}
    </select>
    <input type="number" class="additional-source-page" min="0" placeholder="Page">
    <button type="button" class="remove-row-btn">Remove</button>
  `;

  if (existing?.source) {
    row.querySelector('.additional-source-select').value = existing.source;
  }
  if (existing?.page != null && existing.page !== '') {
    row.querySelector('.additional-source-page').value = existing.page;
  }

  row.querySelector('.remove-row-btn').addEventListener('click', () => row.remove());
  container.querySelector('#additional-sources-rows')?.appendChild(row);
}
