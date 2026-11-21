
type NumericValue = number | string;

interface StationDayPlan {
  forecast_daily_capacity: NumericValue;
  protected_total: NumericValue;
  released_to_shared: NumericValue;
  shared_booked: NumericValue;
}

interface CustomerAllocation {
  protected_units: NumericValue;
  protected_used_units: NumericValue;
  released_units: NumericValue;
}

export type AllocationSource = "PROTECTED" | "SHARED";

interface AllocationResult {
  sources: AllocationSource[];
  protectedCount: number;
  sharedCount: number;
  protectedRemaining: number;
  sharedRemaining: number;
}

function toNumber(value: NumericValue): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Invalid capacity value.");
  }

  return parsed;
}

export function allocateBookingCapacity(
  truckCount: number,
  plan: StationDayPlan,
  allocation: CustomerAllocation | null
): AllocationResult {
  if (!Number.isInteger(truckCount) || truckCount <= 0) {
    throw new Error("Truck count must be a positive integer.");
  }

  const forecastCapacity = toNumber(plan.forecast_daily_capacity);
  const protectedTotal = toNumber(plan.protected_total);
  const releasedToShared = toNumber(plan.released_to_shared);
  const sharedBooked = toNumber(plan.shared_booked);

  if (
    protectedTotal > forecastCapacity ||
    releasedToShared > protectedTotal ||
    sharedBooked > forecastCapacity - protectedTotal + releasedToShared
  ) {
    throw new Error("Station-day capacity counters are inconsistent.");
  }

  const protectedUnits = allocation
    ? toNumber(allocation.protected_units)
    : 0;

  const protectedUsed = allocation
    ? toNumber(allocation.protected_used_units)
    : 0;

  const releasedUnits = allocation
    ? toNumber(allocation.released_units)
    : 0;

  if (protectedUsed + releasedUnits > protectedUnits) {
    throw new Error("Customer allocation counters are inconsistent.");
  }

  const protectedRemaining =
    protectedUnits - protectedUsed - releasedUnits;

  const sharedRemaining =
    forecastCapacity -
    protectedTotal +
    releasedToShared -
    sharedBooked;

  // Protected entitlement is always consumed first.
  const protectedCount = Math.min(
    truckCount,
    protectedRemaining
  );

  const sharedCount = truckCount - protectedCount;

  if (sharedCount > sharedRemaining) {
    throw new Error("INSUFFICIENT_DAILY_CAPACITY");
  }

  const sources: AllocationSource[] = [
    ...Array<AllocationSource>(protectedCount).fill("PROTECTED"),
    ...Array<AllocationSource>(sharedCount).fill("SHARED"),
  ];

  return {
    sources,
    protectedCount,
    sharedCount,
    protectedRemaining,
    sharedRemaining,
  };
}
