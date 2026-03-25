import { LinearClient } from "@linear/sdk";
import { resolveConfig, createClient, resolveTeamId } from "./client.js";
import { classifyError, LinearBridgeError } from "./errors.js";
import { output } from "./output.js";
import type { GlobalOpts } from "./types.js";

export interface RunContext {
  client: LinearClient;
  teamId: string;
  teamKey: string;
}

/**
 * Shared command runner. Handles client init, team resolution, error
 * classification, output formatting, and exit codes.
 */
export async function runCommand<T>(
  opts: GlobalOpts,
  fn: (ctx: RunContext) => Promise<T>
): Promise<void> {
  try {
    const config = resolveConfig(opts);
    const client = createClient(config);
    const teamId = await resolveTeamId(client, config.teamKey);

    const result = await fn({ client, teamId, teamKey: config.teamKey });
    output(result, opts.human);
  } catch (err) {
    const classified = classifyError(err);
    process.stderr.write(`Error: ${classified.message}\n`);
    process.exit(classified.exitCode);
  }
}
