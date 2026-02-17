/**
 * Calculate total years of experience from roles (start_date, end_date).
 * Overrides AI total if we can compute from roles.
 */
function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  const yearMonth = s.match(/^(\d{4})-(\d{1,2})$/);
  if (yearMonth) return { year: parseInt(yearMonth[1], 10), month: parseInt(yearMonth[2], 10) };
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return { year: parseInt(yearOnly[1], 10), month: 6 };
  return null;
}

function monthsBetween(start, end) {
  if (!start || !end) return 0;
  const m1 = start.year * 12 + (start.month || 1);
  const m2 = end.year * 12 + (end.month || 12);
  return Math.max(0, m2 - m1 + 1);
}

/**
 * @param {Array<{ start_date?: string, end_date?: string }>} roles
 * @returns {{ totalYears: number, fromRoles: boolean }}
 */
function calculateTotalYOE(roles) {
  if (!Array.isArray(roles) || roles.length === 0) {
    return { totalYears: 0, fromRoles: false };
  }

  let totalMonths = 0;
  for (const r of roles) {
    const start = parseDate(r.start_date);
    const end = parseDate(r.end_date) || parseDate('present') || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
    if (start) totalMonths += monthsBetween(start, end);
  }
  const totalYears = Math.round((totalMonths / 12) * 10) / 10;
  return { totalYears, fromRoles: totalMonths > 0 };
}

module.exports = { calculateTotalYOE, parseDate };
