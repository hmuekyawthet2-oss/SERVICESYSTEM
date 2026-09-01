/**
 * Client-side PM Calculator
 * Mirrors the backend pmScheduler logic for real-time UI updates.
 *
 * Color Code Logic (PM Date = 10/10/2022):
 *   BLUE  : 1/9/2022  → 30/9/2022   (1 month before → before window)
 *   GREEN : 1/10/2022 → 20/10/2022  (window period)
 *   RED   : 21/10/2022 onwards       (past window, not completed)
 *   GRAY  : Before 1/9/2022          (too far away)
 */

/**
 * Add months to a date, clamping to end-of-month when needed.
 */
export function addMonths(date, months) {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);
  if (d.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    d.setDate(0);
  }
  return d;
}

/**
 * Add days to a date.
 */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Normalize a date to midnight (remove time component).
 */
function normalizeDate(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Calculate PM schedule from installation date.
 * Window: PM Date -10 days to PM Date +10 days.
 */
export function calculatePMSchedule(installationDate) {
  const install = new Date(installationDate);
  const pm1Date = addMonths(install, 6);
  const pm2Date = addMonths(pm1Date, 6);

  return {
    pm1: {
      pmDate: pm1Date,
      windowStart: addDays(pm1Date, -10),
      windowEnd: addDays(pm1Date, 10),
    },
    pm2: {
      pmDate: pm2Date,
      windowStart: addDays(pm2Date, -10),
      windowEnd: addDays(pm2Date, 10),
    },
  };
}

/**
 * Determine color status for a PM schedule entry.
 *
 * Timeline (PM Date = 10/10/2022):
 *   GRAY:  Before 1/9/2022
 *   BLUE:  1/9/2022  → 30/9/2022
 *   GREEN: 1/10/2022 → 20/10/2022
 *   RED:   21/10/2022 onwards
 */
export function getPMStatusColor(pmDate, windowStart, windowEnd, pmStatus, now = new Date()) {
  if (pmStatus === 'Completed') {
    return { status: 'Completed', color: 'green', label: 'Completed' };
  }

  const today = normalizeDate(now);
  const pm = normalizeDate(pmDate);
  const oneMonthBefore = addDays(pm, -30);
  const ws = normalizeDate(windowStart);
  const we = normalizeDate(windowEnd);

  // RED: Past window end
  if (today > we) {
    return { status: 'Overdue', color: 'red', label: 'Overdue' };
  }

  // GREEN: Within window
  if (today >= ws && today <= we) {
    return { status: 'In Window', color: 'green', label: 'PM Window Active' };
  }

  // BLUE: 1 month before PM → before window start
  if (today >= oneMonthBefore && today < ws) {
    return { status: 'Upcoming', color: 'blue', label: 'Upcoming' };
  }

  // GRAY: Too far away
  return { status: 'Scheduled', color: 'gray', label: 'Scheduled' };
}

/**
 * Format date as YYYY-MM-DD.
 */
export function formatDate(date) {
  return new Date(date).toISOString().split('T')[0];
}

/**
 * Format date for display.
 */
export function formatDateDisplay(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get badge class for a color.
 */
export function getColorBadgeClass(color) {
  const classes = {
    red: 'badge-red',
    blue: 'badge-blue',
    green: 'badge-green',
    gray: 'badge-gray',
  };
  return classes[color] || 'badge-gray';
}

/**
 * Get dot class for a color.
 */
export function getColorDotClass(color) {
  const classes = {
    red: 'status-dot-red',
    blue: 'status-dot-blue',
    green: 'status-dot-green',
    gray: 'status-dot-gray',
  };
  return classes[color] || 'status-dot-gray';
}
