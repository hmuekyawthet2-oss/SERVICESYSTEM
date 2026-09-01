/**
 * PM Scheduler Engine
 *
 * Color Code Logic (based on PM Date):
 *
 * Example: PM Date = 10/10/2022
 *   Window = [1/10/2022 – 20/10/2022]  (PM Date -10 days to PM Date +10 days)
 *
 *   BLUE  (Upcoming) : 1/9/2022  → 30/9/2022
 *                       (1 month before PM date → day before window opens)
 *
 *   GREEN (In Window) : 1/10/2022 → 20/10/2022
 *                       (window_start → window_end, inclusive)
 *
 *   RED   (Overdue)   : 21/10/2022 onwards
 *                       (day after window ends, PM not completed)
 *
 *   GRAY  (Scheduled) : Before blue period — too far out
 */

// ============================================================
// Date Helpers
// ============================================================

/**
 * Add months to a date, clamping day to end-of-month when needed.
 * Example: Jan 31 + 1 month = Feb 28 (or 29 in leap year)
 */
function addMonths(date, months) {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  d.setMonth(targetMonth);

  // Handle month overflow (e.g., Jan 31 + 1 month should be Feb 28/29, not Mar 2/3)
  if (d.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    d.setDate(0); // Set to last day of previous month
  }
  return d;
}

/**
 * Add days to a date.
 */
function addDays(date, days) {
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
 * Check if 'checkDate' falls within [start, end] inclusive.
 */
function isWithinRange(checkDate, start, end) {
  const c = normalizeDate(checkDate);
  const s = normalizeDate(start);
  const e = normalizeDate(end);
  return c >= s && c <= e;
}

// ============================================================
// PM Schedule Calculations
// ============================================================

/**
 * Generate PM schedule data from an installation date.
 *
 * @param {Date|string} installationDate - The machine installation date
 * @returns {Object} PM schedule data with calculated dates and windows
 */
function calculatePMSchedule(installationDate) {
  const installDate = new Date(installationDate);

  // 1st PM Date = Installation Date + 6 Months
  const pm1Date = addMonths(installDate, 6);

  // 2nd PM Date = 1st PM Date + 6 Months
  const pm2Date = addMonths(pm1Date, 6);

  // PM Windows: [PM Date - 10 days] to [PM Date + 10 days]
  const pm1WindowStart = addDays(pm1Date, -10);
  const pm1WindowEnd = addDays(pm1Date, 10);

  const pm2WindowStart = addDays(pm2Date, -10);
  const pm2WindowEnd = addDays(pm2Date, 10);

  return {
    pm1: {
      pmDate: pm1Date,
      windowStart: pm1WindowStart,
      windowEnd: pm1WindowEnd,
    },
    pm2: {
      pmDate: pm2Date,
      windowStart: pm2WindowStart,
      windowEnd: pm2WindowEnd,
    },
  };
}

// ============================================================
// Dynamic Status & Color Code Logic
// ============================================================

/**
 * Determine the visual status and color for a PM schedule entry.
 *
 * Timeline (PM Date = 10/10/2022):
 *   GRAY:  Before 1/9/2022          (too far away)
 *   BLUE:  1/9/2022 → 30/9/2022    (1 month before → day before window)
 *   GREEN: 1/10/2022 → 20/10/2022  (window_start → window_end)
 *   RED:   21/10/2022 onwards       (past window, not completed)
 *
 * @param {Date|string} pmDate - The target PM date
 * @param {Date|string} windowStart - The start of the PM window (pmDate - 10 days)
 * @param {Date|string} windowEnd - The end of the PM window (pmDate + 10 days)
 * @param {string} pmStatus - The current PM status ('Scheduled', 'Completed', etc.)
 * @param {Date} [now=new Date()] - Current date for comparison
 * @returns {Object} { status, color, label }
 */
function getPMStatusColor(pmDate, windowStart, windowEnd, pmStatus, now = new Date()) {
  // If already completed, always show green
  if (pmStatus === 'Completed') {
    return { status: 'Completed', color: 'green', label: 'Completed' };
  }

  const today = normalizeDate(now);
  const pm = normalizeDate(pmDate);
  const oneMonthBefore = addDays(pm, -30);
  const ws = normalizeDate(windowStart);
  const we = normalizeDate(windowEnd);

  // RED: Current date is past the window end → Overdue
  // Example: today >= 21/10/2022 (day after window_end = 20/10/2022)
  if (today > we) {
    return { status: 'Overdue', color: 'red', label: 'Overdue - Action Required' };
  }

  // GREEN: Current date falls within the PM window → Active
  // Example: today is 1/10/2022 – 20/10/2022
  if (today >= ws && today <= we) {
    return { status: 'In Window', color: 'green', label: 'PM Window Active' };
  }

  // BLUE: Current date is between [1 month before PM] and [day before window start]
  // Example: today is 1/9/2022 – 30/9/2022
  if (today >= oneMonthBefore && today < ws) {
    return { status: 'Upcoming', color: 'blue', label: 'Upcoming - Within 1 Month' };
  }

  // GRAY: Before the blue period — too far away
  return { status: 'Scheduled', color: 'gray', label: 'Scheduled' };
}

/**
 * Get combined status for a machine's PM schedule (considers both PM1 and PM2).
 * Returns the most urgent status.
 *
 * @param {Array} pmSchedules - Array of PM schedule objects for a machine
 * @param {Date} [now=new Date()] - Current date
 * @returns {Object} Combined status with the highest priority color
 */
function getCombinedPMStatus(pmSchedules, now = new Date()) {
  if (!pmSchedules || pmSchedules.length === 0) {
    return { status: 'No Schedule', color: 'gray', label: 'No PM Scheduled' };
  }

  // Priority order: red > blue > green > gray
  const colorPriority = { red: 4, blue: 3, green: 2, gray: 1 };
  let highestPriority = { status: 'Unknown', color: 'gray', label: 'Unknown' };

  for (const schedule of pmSchedules) {
    const statusInfo = getPMStatusColor(
      schedule.pm_date,
      schedule.window_start,
      schedule.window_end,
      schedule.status,
      now
    );

    if (colorPriority[statusInfo.color] > colorPriority[highestPriority.color]) {
      highestPriority = statusInfo;
      highestPriority.pm_number = schedule.pm_number;
    }
  }

  return highestPriority;
}

/**
 * Bulk update: Refresh all PM statuses based on current date.
 * Returns a summary of status changes.
 */
function refreshPMStatuses(schedules) {
  const results = [];
  for (const schedule of schedules) {
    const statusInfo = getPMStatusColor(
      schedule.pm_date,
      schedule.window_start,
      schedule.window_end,
      schedule.status
    );
    results.push({
      id: schedule.id,
      machine_id: schedule.machine_id,
      pm_number: schedule.pm_number,
      new_status: statusInfo.status,
      color: statusInfo.color,
      changed: statusInfo.status !== schedule.status,
    });
  }
  return results;
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  addMonths,
  addDays,
  normalizeDate,
  isWithinRange,
  calculatePMSchedule,
  getPMStatusColor,
  getCombinedPMStatus,
  refreshPMStatuses,
};
