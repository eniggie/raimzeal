import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";

async function getGitHubToken(): Promise<string> {
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const xReplitToken = process.env["REPL_IDENTITY"]
    ? "repl " + process.env["REPL_IDENTITY"]
    : process.env["WEB_REPL_RENEWAL"]
      ? "depl " + process.env["WEB_REPL_RENEWAL"]
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error("Missing Replit env vars. Connect GitHub in the Integrations tab.");
  }

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "github");
  url.searchParams.set("environment", "production");

  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) throw new Error(`Failed to fetch GitHub credentials: ${resp.status}`);

  const data = await resp.json() as {
    items?: Array<{ settings?: { access_token?: string } }>
  };
  const token = data.items?.[0]?.settings?.access_token;
  if (!token) throw new Error("GitHub access_token not found. Connect GitHub in Integrations.");
  return token;
}

async function syncToGitHub(): Promise<void> {
  console.log("Fetching GitHub OAuth token…");
  const token = await getGitHubToken();

  const lockFile = ".git/config.lock";
  if (existsSync(lockFile)) {
    console.log("Removing stale .git/config.lock…");
    rmSync(lockFile);
  }

  const remote = `https://x-access-token:${token}@github.com/eniggie/raimzeal.git`;
  console.log("Pushing to GitHub…");
  // Redact the token from any failure output. execSync throws an Error whose
  // message embeds the full command — including the tokenised remote URL — and
  // this script runs automatically after every merge, so an ordinary push
  // failure (non-fast-forward, network blip) would otherwise write a live OAuth
  // token into the logs where it could be harvested.
  const redact = (s: string) => s.split(token).join("***");
  try {
    execSync(`git push --force "${remote}" HEAD:main`, { stdio: "inherit" });
  } catch (err) {
    throw new Error(redact(err instanceof Error ? err.message : String(err)));
  }
  console.log("Synced to GitHub successfully.");
}

syncToGitHub().catch((err: unknown) => {
  console.error("GitHub sync failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
