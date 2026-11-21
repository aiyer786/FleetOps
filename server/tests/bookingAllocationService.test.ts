
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  allocateBookingCapacity,
} from "../services/bookingAllocationService";

describe("Booking allocation service", () => {
  const plan = {
    forecast_daily_capacity: 24,
    protected_total: 16,
    released_to_shared: 0,
    shared_booked: 0,
  };

  it("uses protected capacity before shared capacity", () => {
    const allocation = {
      protected_units: 10,
      protected_used_units: 8,
      released_units: 0,
    };

    const result = allocateBookingCapacity(
      4,
      plan,
      allocation
    );

    assert.equal(result.protectedCount, 2);
    assert.equal(result.sharedCount, 2);

    assert.deepEqual(result.sources, [
      "PROTECTED",
      "PROTECTED",
      "SHARED",
      "SHARED",
    ]);
  });

  it("uses only protected capacity when sufficient", () => {
    const allocation = {
      protected_units: 10,
      protected_used_units: 2,
      released_units: 0,
    };

    const result = allocateBookingCapacity(
      3,
      plan,
      allocation
    );

    assert.equal(result.protectedCount, 3);
    assert.equal(result.sharedCount, 0);
  });

  it("rejects a booking when shared capacity is exhausted", () => {
    const exhaustedPlan = {
      ...plan,
      shared_booked: 8,
    };

    const exhaustedAllocation = {
      protected_units: 10,
      protected_used_units: 10,
      released_units: 0,
    };

    assert.throws(
      () =>
        allocateBookingCapacity(
          1,
          exhaustedPlan,
          exhaustedAllocation
        ),
      /INSUFFICIENT_DAILY_CAPACITY/
    );
  });

  it("rejects inconsistent customer allocation counters", () => {
    const invalidAllocation = {
      protected_units: 10,
      protected_used_units: 8,
      released_units: 3,
    };

    assert.throws(
      () =>
        allocateBookingCapacity(
          1,
          plan,
          invalidAllocation
        ),
      /Customer allocation counters are inconsistent/
    );
  });

  it("rejects invalid truck counts", () => {
    assert.throws(
      () => allocateBookingCapacity(0, plan, null),
      /Truck count must be a positive integer/
    );
  });
});
