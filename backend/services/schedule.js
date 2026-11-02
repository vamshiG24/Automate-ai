// Schedule maths for automations. Pure functions (no database) so they are
// easy to unit test. All times are wall-clock times in India (UTC+5:30,
// no daylight saving), which is the app's default timezone.

const IST_OFFSET_MS = 330 * 60 * 1000;

export const FREQUENCIES = ["daily", "weekdays", "weekly"];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Returns an error message, or "" when the schedule is valid
export const validateSchedule = (schedule) => {
  if (!schedule || typeof schedule !== "object") return "Schedule is required.";
  if (!FREQUENCIES.includes(schedule.frequency)) return "Frequency must be daily, weekdays or weekly.";
  if (typeof schedule.time !== "string" || !TIME_PATTERN.test(schedule.time)) return "Time must be HH:MM (24-hour).";
  if (
    schedule.frequency === "weekly" &&
    !(Number.isInteger(schedule.dayOfWeek) && schedule.dayOfWeek >= 0 && schedule.dayOfWeek <= 6)
  ) {
    return "Pick a day of the week (0 = Sunday ... 6 = Saturday).";
  }
  return "";
};

/**
 * Next time (a UTC Date) this schedule should run, strictly after `from`.
 * @param schedule { frequency: "daily"|"weekdays"|"weekly", time: "HH:MM", dayOfWeek: 0-6 }
 */
export const computeNextRun = (schedule, from = new Date()) => {
  const [hours, minutes] = schedule.time.split(":").map(Number);
  // Shift so the UTC getters read Indian wall-clock date parts
  const local = new Date(from.getTime() + IST_OFFSET_MS);

  for (let addDays = 0; addDays <= 8; addDays += 1) {
    const wallClock = Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() + addDays,
      hours,
      minutes
    );
    const runAt = new Date(wallClock - IST_OFFSET_MS);
    const day = new Date(wallClock).getUTCDay();

    if (runAt <= from) continue;
    if (schedule.frequency === "weekdays" && (day === 0 || day === 6)) continue;
    if (schedule.frequency === "weekly" && day !== schedule.dayOfWeek) continue;

    return runAt;
  }

  throw new Error("Could not compute the next run time.");
};
