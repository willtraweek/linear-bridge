import { LinearClient } from "@linear/sdk";
import { InputError } from "./errors.js";

export interface ClientConfig {
  apiKey: string;
  teamKey: string;
}

/**
 * Resolve config from CLI flags + env vars.
 * Precedence: flag > env var.
 */
export function resolveConfig(opts: { team?: string }): ClientConfig {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new InputError(
      "LINEAR_API_KEY environment variable is required.\n" +
        "Set it to your Linear personal API key."
    );
  }

  const teamKey = opts.team || process.env.LINEAR_TEAM_KEY;
  if (!teamKey) {
    throw new InputError(
      "Team key is required. Provide --team flag or set LINEAR_TEAM_KEY environment variable.\n" +
        "The team key is the short prefix in your issue identifiers (e.g., 'ENG' in ENG-42)."
    );
  }

  return { apiKey, teamKey };
}

/**
 * Create a LinearClient from resolved config.
 */
export function createClient(config: ClientConfig): LinearClient {
  return new LinearClient({ apiKey: config.apiKey });
}

/**
 * Find the team ID from the team key.
 */
export async function resolveTeamId(
  client: LinearClient,
  teamKey: string
): Promise<string> {
  const teams = await client.teams();
  const team = teams.nodes.find(
    (t) => t.key.toLowerCase() === teamKey.toLowerCase()
  );
  if (!team) {
    const available = teams.nodes.map((t) => t.key).join(", ");
    throw new InputError(
      `Team '${teamKey}' not found. Available teams: ${available}`
    );
  }
  return team.id;
}
