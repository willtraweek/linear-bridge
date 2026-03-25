import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { resolveConfig } from "../src/client.js";
import { InputError } from "../src/errors.js";

describe("resolveConfig", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.LINEAR_API_KEY;
    delete process.env.LINEAR_TEAM_KEY;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  test("throws when LINEAR_API_KEY is missing", () => {
    expect(() => resolveConfig({})).toThrow(InputError);
    expect(() => resolveConfig({})).toThrow(/LINEAR_API_KEY/);
  });

  test("throws when team key is missing", () => {
    process.env.LINEAR_API_KEY = "lin_api_test";
    expect(() => resolveConfig({})).toThrow(InputError);
    expect(() => resolveConfig({})).toThrow(/team key/i);
  });

  test("resolves from env vars", () => {
    process.env.LINEAR_API_KEY = "lin_api_test";
    process.env.LINEAR_TEAM_KEY = "ENG";
    const config = resolveConfig({});
    expect(config.apiKey).toBe("lin_api_test");
    expect(config.teamKey).toBe("ENG");
  });

  test("--team flag overrides LINEAR_TEAM_KEY env var", () => {
    process.env.LINEAR_API_KEY = "lin_api_test";
    process.env.LINEAR_TEAM_KEY = "ENG";
    const config = resolveConfig({ team: "DESIGN" });
    expect(config.teamKey).toBe("DESIGN");
  });

  test("--team flag works without LINEAR_TEAM_KEY env var", () => {
    process.env.LINEAR_API_KEY = "lin_api_test";
    const config = resolveConfig({ team: "ENG" });
    expect(config.teamKey).toBe("ENG");
  });
});
