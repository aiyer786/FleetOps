
const FLEETOPS_TIMEZONE = "Asia/Kolkata";

export function getServiceDate(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_DATE");
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FLEETOPS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function getFleetOpsTimezone(): string {
  return FLEETOPS_TIMEZONE;
}
