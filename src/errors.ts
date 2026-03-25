import { EXIT_INPUT_ERROR, EXIT_UNREACHABLE, EXIT_AUTH_FAILURE, EXIT_RATE_LIMITED } from "./types.js";

export class LinearBridgeError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
  ) {
    super(message);
    this.name = "LinearBridgeError";
  }
}

export class InputError extends LinearBridgeError {
  constructor(message: string) {
    super(message, EXIT_INPUT_ERROR);
    this.name = "InputError";
  }
}

export class UnreachableError extends LinearBridgeError {
  constructor(message: string = "Linear API is unreachable") {
    super(message, EXIT_UNREACHABLE);
    this.name = "UnreachableError";
  }
}

export class AuthError extends LinearBridgeError {
  constructor(message: string = "Authentication failed — check LINEAR_API_KEY") {
    super(message, EXIT_AUTH_FAILURE);
    this.name = "AuthError";
  }
}

export class RateLimitError extends LinearBridgeError {
  constructor(public readonly retryAfterSeconds?: number) {
    const msg = retryAfterSeconds
      ? `Rate limited — retry after ${retryAfterSeconds}s`
      : "Rate limited — retry later";
    super(msg, EXIT_RATE_LIMITED);
    this.name = "RateLimitError";
  }
}

/**
 * Classify a raw error from the Linear SDK into a LinearBridgeError.
 */
export function classifyError(err: unknown): LinearBridgeError {
  if (err instanceof LinearBridgeError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  // Auth errors
  if (lower.includes("authentication") || lower.includes("unauthorized") || lower.includes("401") || lower.includes("invalid api key")) {
    return new AuthError(message);
  }

  // Rate limiting
  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("too many requests")) {
    const retryMatch = message.match(/retry.+?(\d+)/i);
    const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : undefined;
    return new RateLimitError(retryAfter);
  }

  // Network / unreachable
  if (
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("etimedout") ||
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("econnreset")
  ) {
    return new UnreachableError(message);
  }

  // Not found
  if (lower.includes("not found") || lower.includes("entity not found") || lower.includes("404")) {
    return new InputError(message);
  }

  // Default to input error
  return new InputError(message);
}
