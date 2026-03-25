import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { LinearClient } from "@linear/sdk";
import { InputError } from "./errors.js";

const CACHE_FILE = ".linear-bridge-cache.json";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheData {
  teamKey: string;
  teamId: string;
  states: string[];
  fetchedAt: number;
}

function getCachePath(): string {
  return join(process.cwd(), CACHE_FILE);
}

function readCache(): CacheData | null {
  try {
    const raw = readFileSync(getCachePath(), "utf-8");
    return JSON.parse(raw) as CacheData;
  } catch {
    return null;
  }
}

function writeCache(data: CacheData): void {
  const path = getCachePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

async function fetchStates(
  client: LinearClient,
  teamId: string,
  teamKey: string
): Promise<CacheData> {
  const team = await client.team(teamId);
  const statesConnection = await team.states();
  const states = statesConnection.nodes.map((s) => s.name);
  const data: CacheData = {
    teamKey,
    teamId,
    states,
    fetchedAt: Date.now(),
  };
  writeCache(data);
  return data;
}

/**
 * Get cached workflow states for a team. Fetches from Linear API if cache is
 * stale (>24h) or missing.
 */
export async function getCachedStates(
  client: LinearClient,
  teamId: string,
  teamKey: string
): Promise<string[]> {
  const cached = readCache();
  if (
    cached &&
    cached.teamKey.toLowerCase() === teamKey.toLowerCase() &&
    Date.now() - cached.fetchedAt < TTL_MS
  ) {
    return cached.states;
  }
  const data = await fetchStates(client, teamId, teamKey);
  return data.states;
}

/**
 * Validate a state name against cached states. If not found, re-fetches
 * from API and retries.
 */
export async function validateState(
  client: LinearClient,
  teamId: string,
  teamKey: string,
  stateName: string
): Promise<void> {
  let states = await getCachedStates(client, teamId, teamKey);
  if (containsState(states, stateName)) return;

  // Cache might be stale — re-fetch
  const data = await fetchStates(client, teamId, teamKey);
  states = data.states;
  if (containsState(states, stateName)) return;

  throw new InputError(
    `Invalid state '${stateName}'. Valid states for team ${teamKey}:\n  ${states.join(", ")}`
  );
}

function containsState(states: string[], name: string): boolean {
  return states.some((s) => s.toLowerCase() === name.toLowerCase());
}
