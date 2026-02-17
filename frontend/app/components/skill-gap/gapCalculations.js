/**
 * Gap calculation utilities. No array mutation; all values are derived.
 * Yellow skills (candidate has, job does NOT require) must NOT affect percentages.
 * Only green (candidate has AND job requires) and red (job requires, candidate does NOT have) are used.
 *
 * PREVIOUS FLAW: Backend returned "present" = full user list (green + yellow), so denominator
 * incorrectly included yellow. Percentages now use TOTAL_REQUIRED = green.length + red.length only.
 */

/**
 * Calculate gap percentages using ONLY green and red (job-required) skills.
 * Yellow must not be included in the denominator.
 * @param {Array} greenArray - Candidate has AND job requires (not mutated)
 * @param {Array} redArray - Job requires BUT candidate does NOT have (not mutated)
 * @returns {{ matchPct: number, missingPct: number, totalRequired: number }}
 */
export function calculateSkillGap(greenArray, redArray) {
  const green = Array.isArray(greenArray) ? greenArray : [];
  const red = Array.isArray(redArray) ? redArray : [];
  const totalRequired = green.length + red.length;

  if (totalRequired === 0) {
    return { matchPct: 100, missingPct: 0, totalRequired: 0 };
  }

  const matchPct = Math.round((green.length / totalRequired) * 100);
  const missingPct = Math.round((red.length / totalRequired) * 100);

  return { matchPct, missingPct, totalRequired };
}

/** @deprecated Use calculateSkillGap(green, red) for green/red/yellow model. */
export function calculateCategoryGap(presentArray, missingArray) {
  return calculateSkillGap(presentArray, missingArray);
}

/**
 * Overall match % using ONLY green and red across all categories (linear scaling).
 * Yellow never included in denominator.
 */
export function calculateOverallMatchPercentage(categoryState, categoryKeys) {
  if (!categoryState || !Array.isArray(categoryKeys) || categoryKeys.length === 0) {
    return 0;
  }

  let totalGreen = 0;
  let totalRequired = 0;

  categoryKeys.forEach(({ key }) => {
    const cat = categoryState[key];
    const green = Array.isArray(cat?.green) ? cat.green : [];
    const red = Array.isArray(cat?.red) ? cat.red : [];
    const required = green.length + red.length;
    totalGreen += green.length;
    totalRequired += required;
  });

  if (totalRequired === 0) return 100;
  return Math.round((totalGreen / totalRequired) * 100);
}
