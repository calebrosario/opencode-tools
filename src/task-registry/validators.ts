// Validation Layer for DB-to-Domain Conversions
// Provides runtime type safety for converting database rows to domain objects

import { TaskStatus, Task } from "../types";
import { OpenCodeError } from "../util/error";

const VALID_STATUS_VALUES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export function validateTaskStatus(
  value: unknown,
): asserts value is TaskStatus {
  if (typeof value !== "string" || !VALID_STATUS_VALUES.includes(value)) {
    throw new OpenCodeError(
      "INVALID_TASK_STATUS",
      `Invalid task status: ${value}. Must be one of: ${VALID_STATUS_VALUES.join(", ")}`,
    );
  }
}

export function validateTaskOwner(
  value: unknown,
): asserts value is string | undefined {
  if (value !== null && typeof value !== "string") {
    throw new OpenCodeError(
      "INVALID_TASK_OWNER",
      `Task owner must be a string or null. Received: ${typeof value}`,
    );
  }
}

export function validateTaskMetadata(
  value: unknown,
): asserts value is Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value !== "object") {
    throw new OpenCodeError(
      "INVALID_TASK_METADATA",
      `Task metadata must be an object or null. Received: ${typeof value}`,
    );
  }
}

export function isPostgresDate(value: unknown): value is Date {
  return value instanceof Date;
}

export function convertPostgresDate(value: unknown): Date {
  if (isPostgresDate(value)) {
    return value as Date;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new OpenCodeError(
        "INVALID_TASK_DATE",
        `Invalid date format: ${value}`,
      );
    }
    return date;
  }

  throw new OpenCodeError(
    "INVALID_TASK_DATE",
    `Task date must be a Date object or ISO string. Received: ${typeof value}`,
  );
}
