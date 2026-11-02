import { test } from "node:test";
import assert from "node:assert/strict";

import { computeNextRun, validateSchedule } from "../services/schedule.js";

// Helper: an Indian wall-clock time as a Date
const ist = (iso) => new Date(`${iso}+05:30`);

test("daily: later today if the time hasn't passed", () => {
  const next = computeNextRun({ frequency: "daily", time: "08:00" }, ist("2026-11-02T07:30:00"));
  assert.equal(next.toISOString(), ist("2026-11-02T08:00:00").toISOString());
});

test("daily: tomorrow if the time already passed", () => {
  const next = computeNextRun({ frequency: "daily", time: "08:00" }, ist("2026-11-02T08:00:00"));
  assert.equal(next.toISOString(), ist("2026-11-03T08:00:00").toISOString());
});

test("weekdays: Friday evening jumps to Monday", () => {
  // 6 Nov 2026 is a Friday
  const next = computeNextRun({ frequency: "weekdays", time: "09:00" }, ist("2026-11-06T18:00:00"));
  assert.equal(next.toISOString(), ist("2026-11-09T09:00:00").toISOString());
});

test("weekly: next chosen weekday", () => {
  // From Monday 2 Nov 2026 to Wednesday (3)
  const next = computeNextRun({ frequency: "weekly", time: "17:30", dayOfWeek: 3 }, ist("2026-11-02T10:00:00"));
  assert.equal(next.toISOString(), ist("2026-11-04T17:30:00").toISOString());
});

test("weekly: same weekday but time passed goes to next week", () => {
  const next = computeNextRun({ frequency: "weekly", time: "09:00", dayOfWeek: 1 }, ist("2026-11-02T10:00:00"));
  assert.equal(next.toISOString(), ist("2026-11-09T09:00:00").toISOString());
});

test("handles late-night IST times that are the previous day in UTC", () => {
  // 00:30 IST on 3 Nov = 19:00 UTC on 2 Nov
  const next = computeNextRun({ frequency: "daily", time: "00:30" }, ist("2026-11-02T23:00:00"));
  assert.equal(next.toISOString(), "2026-11-02T19:00:00.000Z");
});

test("validateSchedule rejects bad input", () => {
  assert.equal(validateSchedule({ frequency: "daily", time: "08:00" }), "");
  assert.notEqual(validateSchedule({ frequency: "hourly", time: "08:00" }), "");
  assert.notEqual(validateSchedule({ frequency: "daily", time: "25:00" }), "");
  assert.notEqual(validateSchedule({ frequency: "weekly", time: "08:00" }), "");
  assert.equal(validateSchedule({ frequency: "weekly", time: "08:00", dayOfWeek: 0 }), "");
});
