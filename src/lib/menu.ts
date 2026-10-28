export type MenuDay = {
  date: string;
  label: string;
  soup: string;
  A: string | null;
  B: string | null;
  C: string | null;
  holiday?: boolean;
};
export function validDays(start: unknown, days: unknown): days is MenuDay[] {
  if (
    typeof start !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !Array.isArray(days) ||
    days.length !== 5
  )
    return false;
  const monday = new Date(start + "T00:00:00Z");
  if (
    !Number.isFinite(+monday) ||
    monday.getUTCDay() !== 1 ||
    monday.toISOString().slice(0, 10) !== start
  )
    return false;
  return days.every((d, i) => {
    const at = new Date(monday);
    at.setUTCDate(at.getUTCDate() + i);
    return (
      d &&
      d.date === at.toISOString().slice(0, 10) &&
      typeof d.soup === "string" &&
      d.soup.trim().length > 0 &&
      d.soup.length <= 300 &&
      ["A", "B", "C"].every(
        (k) =>
          d[k] === null ||
          (typeof d[k] === "string" &&
            d[k].trim().length > 0 &&
            d[k].length <= 300),
      ) &&
      !d.holiday
    );
  });
}
export function budapestParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return {
    date: parts.slice(0, 10),
    minutes: Number(parts.slice(11, 13)) * 60 + Number(parts.slice(14, 16)),
  };
}
export function beforeCutoff(
  day: string,
  fulfillment: string,
  now = new Date(),
) {
  const t = budapestParts(now);
  return (
    t.date < day ||
    (t.date === day && t.minutes < (fulfillment === "delivery" ? 540 : 870))
  );
}

export function inPeriod(
  created: string,
  period: "daily" | "weekly" | "monthly",
  now = new Date(),
) {
  const day = budapestParts(new Date(created)).date;
  const today = budapestParts(now).date;
  if (period === "daily") return day === today;
  if (period === "monthly") return day.slice(0, 7) === today.slice(0, 7);
  const monday = new Date(today + "T00:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const end = new Date(monday);
  end.setUTCDate(end.getUTCDate() + 6);
  return (
    day >= monday.toISOString().slice(0, 10) &&
    day <= end.toISOString().slice(0, 10)
  );
}
