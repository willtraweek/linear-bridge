import { describe, expect, test } from "bun:test";
import {
  classifyError,
  InputError,
  UnreachableError,
  AuthError,
  RateLimitError,
  LinearBridgeError,
} from "../src/errors.js";
import {
  EXIT_INPUT_ERROR,
  EXIT_UNREACHABLE,
  EXIT_AUTH_FAILURE,
  EXIT_RATE_LIMITED,
} from "../src/types.js";

describe("classifyError", () => {
  test("passes through LinearBridgeError unchanged", () => {
    const err = new InputError("test");
    expect(classifyError(err)).toBe(err);
  });

  test("classifies authentication errors", () => {
    const result = classifyError(new Error("Authentication failed"));
    expect(result).toBeInstanceOf(AuthError);
    expect(result.exitCode).toBe(EXIT_AUTH_FAILURE);
  });

  test("classifies 401 as auth error", () => {
    const result = classifyError(new Error("Request failed with status 401"));
    expect(result).toBeInstanceOf(AuthError);
  });

  test("classifies invalid api key", () => {
    const result = classifyError(new Error("Invalid API key provided"));
    expect(result).toBeInstanceOf(AuthError);
  });

  test("classifies rate limit errors", () => {
    const result = classifyError(new Error("Rate limit exceeded"));
    expect(result).toBeInstanceOf(RateLimitError);
    expect(result.exitCode).toBe(EXIT_RATE_LIMITED);
  });

  test("classifies 429 as rate limit", () => {
    const result = classifyError(new Error("Request failed with status 429"));
    expect(result).toBeInstanceOf(RateLimitError);
  });

  test("extracts retry-after from rate limit message", () => {
    const result = classifyError(new Error("Rate limit, retry after 60 seconds"));
    expect(result).toBeInstanceOf(RateLimitError);
    expect((result as RateLimitError).retryAfterSeconds).toBe(60);
  });

  test("classifies network errors as unreachable", () => {
    for (const msg of ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "fetch failed", "ECONNRESET"]) {
      const result = classifyError(new Error(msg));
      expect(result).toBeInstanceOf(UnreachableError);
      expect(result.exitCode).toBe(EXIT_UNREACHABLE);
    }
  });

  test("classifies not found as input error", () => {
    const result = classifyError(new Error("Entity not found"));
    expect(result).toBeInstanceOf(InputError);
    expect(result.exitCode).toBe(EXIT_INPUT_ERROR);
  });

  test("classifies unknown errors as input error", () => {
    const result = classifyError(new Error("something weird happened"));
    expect(result).toBeInstanceOf(InputError);
  });

  test("handles non-Error objects", () => {
    const result = classifyError("string error");
    expect(result).toBeInstanceOf(LinearBridgeError);
  });
});

describe("error exit codes", () => {
  test("InputError has exit code 1", () => {
    expect(new InputError("test").exitCode).toBe(1);
  });

  test("UnreachableError has exit code 2", () => {
    expect(new UnreachableError().exitCode).toBe(2);
  });

  test("AuthError has exit code 3", () => {
    expect(new AuthError().exitCode).toBe(3);
  });

  test("RateLimitError has exit code 4", () => {
    expect(new RateLimitError().exitCode).toBe(4);
  });

  test("RateLimitError includes retry-after in message", () => {
    const err = new RateLimitError(30);
    expect(err.message).toContain("30s");
  });
});
