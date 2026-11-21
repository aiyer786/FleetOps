
import {
  BatteryForecastRecord,
  ScheduledSwapRecord,
} from "../repositories/batteryForecastRepository";

const INTERVAL_MINUTES = 5;
const DEFAULT_CHARGING_MINUTES = 60;

interface ForecastOptions {
  chargingDurationMinutes?: number;
  chargingCapacity: number;
}

interface ForecastResult {
  intervalStart: Date;
  availableBatteries: number;
  projectedCompletions: number;
  scheduledSwaps: number;
  returnedBatteries: number;
  shortfall: number;
  canSupportSwap: boolean;
}

interface ChargingBattery {
  completionTime: number | null;
}

export function calculateBatteryForecast(
  batteries: BatteryForecastRecord[],
  scheduledSwaps: ScheduledSwapRecord[],
  windowStart: Date,
  windowEnd: Date,
  options: ForecastOptions,
  proposedSwapTimes: Date[] = []
): ForecastResult[] {
  const chargingDuration =
    options.chargingDurationMinutes ?? DEFAULT_CHARGING_MINUTES;

  const intervalMs = INTERVAL_MINUTES * 60 * 1000;
  const swapDurationMs = intervalMs;
  const chargingDurationMs = chargingDuration * 60 * 1000;

  if (options.chargingCapacity <= 0 || chargingDuration <= 0) {
    throw new Error("Charging capacity and duration must be positive.");
  }

  let chargedStock = batteries.filter(
    (battery) =>
      battery.operational_state === "AVAILABLE" &&
      !battery.needs_review
  ).length;

  const chargingQueue: ChargingBattery[] = batteries
    .filter(
      (battery) =>
        battery.operational_state === "CHARGING" &&
        !battery.needs_review
    )
    .map((battery) => ({
      // Unknown charging start means we cannot safely
      // predict its completion. It still occupies a charger.
      completionTime: battery.charging_started_at
        ? battery.charging_started_at.getTime() + chargingDurationMs
        : null,
    }));

  let activeCharging = chargingQueue.length;

  let waitingCount = batteries.filter(
    (battery) =>
      battery.operational_state === "WAITING_FOR_CHARGER" &&
      !battery.needs_review
  ).length;

  const scheduledByTime = new Map<number, number>();

  for (const swap of scheduledSwaps) {
    const time = new Date(swap.interval_start).getTime();

    scheduledByTime.set(
      time,
      (scheduledByTime.get(time) ?? 0) + swap.reserved_count
    );
  }
// Include the candidate booking being evaluated.
  for (const proposedTime of proposedSwapTimes) {
    const time = new Date(proposedTime).getTime();

    scheduledByTime.set(
      time,
      (scheduledByTime.get(time) ?? 0) + 1
    );
  }
  // Depleted batteries return five minutes after their swap starts.
  const returnsByTime = new Map<number, number>();

  const results: ForecastResult[] = [];

  for (
    let currentTime = windowStart.getTime();
    currentTime < windowEnd.getTime();
    currentTime += intervalMs
  ) {
    let projectedCompletions = 0;

    // 1. Process completed charging cycles.
    for (let i = chargingQueue.length - 1; i >= 0; i--) {
      const battery = chargingQueue[i];

      if (
        battery.completionTime !== null &&
        battery.completionTime <= currentTime
      ) {
        chargingQueue.splice(i, 1);
        activeCharging--;
        chargedStock++;
        projectedCompletions++;
      }
    }

    // 2. Return depleted batteries from completed swaps.
    const returnedBatteries = returnsByTime.get(currentTime) ?? 0;

    waitingCount += returnedBatteries;
    returnsByTime.delete(currentTime);

    // 3. Start charging waiting batteries when capacity permits.
    while (
      waitingCount > 0 &&
      activeCharging < options.chargingCapacity
    ) {
      waitingCount--;
      activeCharging++;

      chargingQueue.push({
        completionTime: currentTime + chargingDurationMs,
      });
    }

    // 4. Account for already scheduled swaps.
    const scheduledCount = scheduledByTime.get(currentTime) ?? 0;

    const supportedCount = Math.min(chargedStock, scheduledCount);
    const shortfall = scheduledCount - supportedCount;

    chargedStock -= supportedCount;

    // Only supported swaps return depleted batteries.
    if (supportedCount > 0) {
      const returnTime = currentTime + swapDurationMs;

      returnsByTime.set(
        returnTime,
        (returnsByTime.get(returnTime) ?? 0) + supportedCount
      );
    }

    results.push({
      intervalStart: new Date(currentTime),
      availableBatteries: chargedStock,
      projectedCompletions,
      scheduledSwaps: scheduledCount,
      returnedBatteries,
      shortfall,
      canSupportSwap: shortfall === 0,
    });
  }

  return results;
}
