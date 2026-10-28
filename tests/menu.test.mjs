import { test } from "node:test";
import assert from "node:assert/strict";
import { beforeCutoff, inPeriod, validDays } from "../src/lib/menu.ts";
test("Budapest delivery cutoff: 08:59 open, 09:00 closed", () => {
  assert.equal(
    beforeCutoff("2026-10-28", "delivery", new Date("2026-10-28T07:59:00Z")),
    true,
  );
  assert.equal(
    beforeCutoff("2026-10-28", "delivery", new Date("2026-10-28T08:00:00Z")),
    false,
  );
});
test("Pickup and dine-in close at 14:30 Budapest", () => {
  for (const mode of ["pickup", "dine_in"]) {
    assert.equal(
      beforeCutoff("2026-10-28", mode, new Date("2026-10-28T13:29:00Z")),
      true,
    );
    assert.equal(
      beforeCutoff("2026-10-28", mode, new Date("2026-10-28T13:30:00Z")),
      false,
    );
  }
});
test("Summer daylight-saving offset respected", () => {
  assert.equal(
    beforeCutoff("2027-07-01", "delivery", new Date("2027-07-01T06:59:00Z")),
    true,
  );
  assert.equal(
    beforeCutoff("2027-07-01", "delivery", new Date("2027-07-01T07:00:00Z")),
    false,
  );
});
test("Past days closed, future days open", () => {
  assert.equal(
    beforeCutoff("2026-10-27", "delivery", new Date("2026-10-28T00:00:00Z")),
    false,
  );
  assert.equal(
    beforeCutoff("2026-10-29", "delivery", new Date("2026-10-28T22:59:00Z")),
    true,
  );
});
test("Daily reporting uses Budapest midnight", () => {
  assert.equal(
    inPeriod("2026-10-27T23:15:00Z", "daily", new Date("2026-10-28T09:00:00Z")),
    true,
  );
  assert.equal(
    inPeriod("2026-10-27T22:59:00Z", "daily", new Date("2026-10-28T09:00:00Z")),
    false,
  );
});
test("Weekly report excludes following Monday", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  assert.equal(inPeriod("2026-10-25T23:00:00Z", "weekly", now), true);
  assert.equal(inPeriod("2026-11-01T23:00:00Z", "weekly", now), false);
});
test("Monthly report handles Budapest month boundary", () => {
  assert.equal(
    inPeriod("2026-10-31T23:10:00Z", "monthly", new Date("2026-11-05")),
    true,
  );
});
const days = Array.from({ length: 5 }, (_, i) => ({
  date: "2026-11-0" + (2 + i),
  label: "Nap",
  soup: "Leves",
  A: "A",
  B: null,
  C: "C",
}));
test("Five consecutive weekdays on Monday accepted", () =>
  assert.equal(validDays("2026-11-02", days), true));
test("Wrong start, missing day, wrong date, holiday rejected", () => {
  assert.equal(validDays("2026-11-03", days), false);
  assert.equal(validDays("2026-11-02", days.slice(1)), false);
  assert.equal(
    validDays(
      "2026-11-02",
      days.map((d, i) => (i === 1 ? { ...d, date: "2026-11-05" } : d)),
    ),
    false,
  );
  assert.equal(
    validDays(
      "2026-11-02",
      days.map((d, i) => (i === 1 ? { ...d, holiday: true } : d)),
    ),
    false,
  );
});
test("Blank soup and oversized dish rejected", () => {
  assert.equal(
    validDays(
      "2026-11-02",
      days.map((d) => ({ ...d, soup: "" })),
    ),
    false,
  );
  assert.equal(
    validDays(
      "2026-11-02",
      days.map((d) => ({ ...d, C: "x".repeat(301) })),
    ),
    false,
  );
});
