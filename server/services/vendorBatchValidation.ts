
export interface VendorBatteryReading {
  batteryId: number;
  timestamp: string | null;
  stateOfCharge: number | null;
  reportedStatus: string | null;
}

export interface VendorBatch {
  vendorName: string;
  batchId: string;
  sequence: number | null;
  sourceTimestamp: string | null;
  readings: VendorBatteryReading[];
}

function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;

  // Require an explicit timezone: Z or +/-HH:MM
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(value)) return false;

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) return false;

  // Reject timestamps more than 5 minutes into the future.
  return timestamp <= Date.now() + 5 * 60 * 1000;
}

export function validateVendorBatch(
  input: unknown
): VendorBatch {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    throw new Error("INVALID_VENDOR_BATCH");
  }

  const batch = input as Record<string, unknown>;

  if (
    typeof batch.vendorName !== "string" ||
    !batch.vendorName.trim() ||
    typeof batch.batchId !== "string" ||
    !batch.batchId.trim()
  ) {
    throw new Error("INVALID_VENDOR_IDENTITY");
  }

  if (
    batch.sequence !== undefined &&
    batch.sequence !== null &&
    (!Number.isSafeInteger(batch.sequence) ||
      (batch.sequence as number) <= 0)
  ) {
    throw new Error("INVALID_VENDOR_SEQUENCE");
  }

  if (
    batch.sourceTimestamp !== undefined &&
    batch.sourceTimestamp !== null &&
    !isValidTimestamp(batch.sourceTimestamp)
  ) {
    throw new Error("INVALID_SOURCE_TIMESTAMP");
  }

  if (
    !Array.isArray(batch.readings) ||
    batch.readings.length === 0
  ) {
    throw new Error("INVALID_VENDOR_READINGS");
  }
  const batteryIds = batch.readings.map(
    (reading: unknown) =>
      typeof reading === "object" && reading !== null
        ? (reading as Record<string, unknown>).batteryId
        : null
  );

  if (new Set(batteryIds).size !== batteryIds.length) {
    throw new Error("DUPLICATE_BATTERY_IDS");
  }
  const readings: VendorBatteryReading[] = batch.readings.map(
    (reading: unknown) => {
      if (
        typeof reading !== "object" ||
        reading === null ||
        Array.isArray(reading)
      ) {
        throw new Error("INVALID_BATTERY_READING");
      }

      const item = reading as Record<string, unknown>;

      if (
        !Number.isSafeInteger(item.batteryId) ||
        (item.batteryId as number) <= 0
      ) {
        throw new Error("INVALID_BATTERY_ID");
      }

      if (
        item.timestamp !== undefined &&
        item.timestamp !== null &&
        !isValidTimestamp(item.timestamp)
      ) {
        throw new Error("INVALID_BATTERY_TIMESTAMP");
      }

      if (
        item.stateOfCharge !== undefined &&
        item.stateOfCharge !== null &&
        (
          typeof item.stateOfCharge !== "number" ||
          !Number.isFinite(item.stateOfCharge) ||
          item.stateOfCharge < 0 ||
          item.stateOfCharge > 100
        )
      ) {
        throw new Error("INVALID_STATE_OF_CHARGE");
      }

      if (
        item.reportedStatus !== undefined &&
        item.reportedStatus !== null &&
        typeof item.reportedStatus !== "string"
      ) {
        throw new Error("INVALID_REPORTED_STATUS");
      }

      return {
        batteryId: item.batteryId as number,
        timestamp: (item.timestamp ?? null) as string | null,
        stateOfCharge: (item.stateOfCharge ?? null) as number | null,
        reportedStatus: (item.reportedStatus ?? null) as string | null,
      };
    }
  );

  return {
    vendorName: batch.vendorName.trim(),
    batchId: batch.batchId.trim(),
    sequence: (batch.sequence ?? null) as number | null,
    sourceTimestamp: (batch.sourceTimestamp ?? null) as string | null,
    readings,
  };
}
