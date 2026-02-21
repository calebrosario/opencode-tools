import { describe, it, expect } from "@jest/globals";
import { getErrorMessage } from "../../src/util/errors";

describe("getErrorMessage", () => {
  it("should extract message from Error instances", () => {
    const error = new Error("Test error message");
    expect(getErrorMessage(error)).toBe("Test error message");
  });

  it("should return string errors as-is", () => {
    expect(getErrorMessage("String error")).toBe("String error");
  });

  it("should handle null with fallback", () => {
    expect(getErrorMessage(null)).toBe("Unknown error");
    expect(getErrorMessage(null, "Custom fallback")).toBe("Custom fallback");
  });

  it("should handle undefined with fallback", () => {
    expect(getErrorMessage(undefined)).toBe("Unknown error");
    expect(getErrorMessage(undefined, "Custom fallback")).toBe(
      "Custom fallback",
    );
  });

  it("should handle objects with message property", () => {
    const errorLike = { message: "Object error" };
    expect(getErrorMessage(errorLike)).toBe("Object error");
  });

  it("should handle empty string with fallback", () => {
    expect(getErrorMessage("")).toBe("Unknown error");
  });

  it("should handle Error with empty message", () => {
    const error = new Error("");
    expect(getErrorMessage(error)).toBe("Unknown error");
  });

  it("should stringify other types", () => {
    expect(getErrorMessage(123)).toBe("123");
    expect(getErrorMessage(true)).toBe("true");
  });

  it("should return fallback for plain objects", () => {
    expect(getErrorMessage({ foo: "bar" })).toBe("Unknown error");
  });
});
