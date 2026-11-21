
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  calculateBatteryForecast,
} from "../services/batteryForecastService";

import {
  BatteryForecastRecord,
  ScheduledSwapRecord,
} from "../repositories/batteryForecastRepository";

describe("Battery forecast service", () => {
  const start = new Date("2026-11-22T09:00:00+05:30");

  const options = {
    chargingCapacity: 2,
    chargingDurationMinutes: 60,
  };

  function battery(
    id: number,
    state: string,
    chargingStartedAt: Date | null = null
  ): BatteryForecastRecord {
    return {
      id,
      station_id: 1,
      operational_state: state,
      needs_review: false,
      charging_started_at: chargingStartedAt,
    };
  }

  function scheduledSwap(
    intervalStart: Date,
    count: number
  ): ScheduledSwapRecord {
    return {
      interval_start: intervalStart,
      reserved_count: count,
    };
  }

  it("supports a proposed swap using an available battery", () => {
    const result = calculateBatteryForecast(
      [battery(1, "AVAILABLE")],
      [],
      start,
      new Date(start.getTime() + 10 * 60 * 1000),
      options,
      [start]
    );

    assert.equal(result[0].shortfall, 0);
    assert.equal(result[0].canSupportSwap, true);
    assert.equal(result[0].availableBatteries, 0);
  });

  it("reports insufficient supply when no charged battery is available", () => {
    const result = calculateBatteryForecast(
      [],
      [],
      start,
      new Date(start.getTime() + 10 * 60 * 1000),
      options,
      [start]
    );

    assert.equal(result[0].shortfall, 1);
    assert.equal(result[0].canSupportSwap, false);
  });

  it("counts a battery after its estimated charging completion", () => {
    const chargingStart = new Date(
      start.getTime() - 60 * 60 * 1000
    );

    const result = calculateBatteryForecast(
      [battery(1, "CHARGING", chargingStart)],
      [],
      start,
      new Date(start.getTime() + 10 * 60 * 1000),
      options
    );

    assert.equal(result[0].projectedCompletions, 1);
    assert.equal(result[0].availableBatteries, 1);
  });

  it("returns a depleted battery to charging before it becomes available again", () => {
    const result = calculateBatteryForecast(
      [battery(1, "AVAILABLE")],
      [],
      start,
      new Date(start.getTime() + 75 * 60 * 1000),
      options,
      [start]
    );

    // The initial swap consumes the charged battery.
    assert.equal(result[0].availableBatteries, 0);

    // Five minutes later, the depleted battery is returned.
    assert.equal(result[1].returnedBatteries, 1);

    // It completes charging 60 minutes after entering the queue.
    const completion = result.find(
      (point) => point.projectedCompletions === 1
    );

    assert.ok(completion);
    assert.equal(completion.availableBatteries, 1);
    assert.equal(
      completion.intervalStart.getTime(),
      start.getTime() + 65 * 60 * 1000
    );
  });

  it("does not count a charging battery with unknown start time as available", () => {
    const result = calculateBatteryForecast(
      [battery(1, "CHARGING")],
      [],
      start,
      new Date(start.getTime() + 75 * 60 * 1000),
      {
        chargingCapacity: 1,
        chargingDurationMinutes: 60,
      },
      [start]
    );

    assert.equal(result[0].shortfall, 1);

    // The unknown-start battery occupies the only charger.
    assert.equal(
      result.some((point) => point.projectedCompletions > 0),
      false
    );
  });

  it("combines existing reservations with proposed swaps", () => {
    const result = calculateBatteryForecast(
      [battery(1, "AVAILABLE")],
      [scheduledSwap(start, 1)],
      start,
      new Date(start.getTime() + 10 * 60 * 1000),
      options,
      [start]
    );

    // One existing reservation plus one proposed swap,
    // but only one charged battery.
    assert.equal(result[0].scheduledSwaps, 2);
    assert.equal(result[0].shortfall, 1);
    assert.equal(result[0].canSupportSwap, false);
  });

  it("does not exceed charging capacity when multiple batteries are waiting", () => {
    const chargingStart = new Date(start.getTime());

    const result = calculateBatteryForecast(
      [
        battery(1, "CHARGING", chargingStart),
        battery(2, "WAITING_FOR_CHARGER"),
        battery(3, "WAITING_FOR_CHARGER"),
        battery(4, "AVAILABLE"),
      ],
      [],
      start,
      new Date(start.getTime() + 130 * 60 * 1000),
      {
        chargingCapacity: 1,
        chargingDurationMinutes: 60,
      },
      [start]
    );

    const completions = result
      .filter((point) => point.projectedCompletions > 0)
      .map((point) => point.intervalStart.getTime());

    assert.deepEqual(completions, [
      start.getTime() + 60 * 60 * 1000,
      start.getTime() + 120 * 60 * 1000,
    ]);
  });

  it("accounts for multiple proposed swaps at the same interval", () => {
    const result = calculateBatteryForecast(
      [
        battery(1, "AVAILABLE"),
        battery(2, "AVAILABLE"),
      ],
      [],
      start,
      new Date(start.getTime() + 10 * 60 * 1000),
      options,
      [start, start]
    );

    assert.equal(result[0].scheduledSwaps, 2);
    assert.equal(result[0].shortfall, 0);
    assert.equal(result[0].availableBatteries, 0);
  });

  it("does not count batteries installed in trucks as charged stock", () => {
    const result = calculateBatteryForecast(
      [
        battery(1, "INSTALLED_IN_TRUCK"),
        battery(2, "AVAILABLE"),
      ],
      [],
      start,
      new Date(start.getTime() + 10 * 60 * 1000),
      options,
      [start, start]
    );

    // Only one of the two batteries is available.
    assert.equal(result[0].shortfall, 1);
    assert.equal(result[0].availableBatteries, 0);
    assert.equal(result[0].canSupportSwap, false);
  });

});
