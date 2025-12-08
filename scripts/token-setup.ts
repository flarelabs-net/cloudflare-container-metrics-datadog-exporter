import { writeFile, readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import consola from "consola";
import open from "open";

const accountId = await consola.prompt("Enter your Cloudflare Account ID:", {
	type: "text",
});

if (!accountId || typeof accountId !== "string") {
	consola.error("Account ID is required");
	process.exit(1);
}

const permissions = JSON.stringify([
	{ key: "account_analytics", type: "read" },
	{ key: "containers", type: "read" },
]);

const url = `https://dash.cloudflare.com/${accountId}/api-tokens?permissionGroupKeys=${encodeURIComponent(permissions)}&name=${encodeURIComponent("Container Metrics Exporter")}`;

consola.start("Opening browser to token creation page...");
await setTimeout(1000);
await open(url);

const cfToken = await consola.prompt("Paste your Cloudflare API Token:", {
	type: "text",
});

if (!cfToken || typeof cfToken !== "string") {
	consola.error("Cloudflare API Token is required");
	process.exit(1);
}

const ddApiKey = await consola.prompt("Enter your Datadog API Key:", {
	type: "text",
});

if (!ddApiKey || typeof ddApiKey !== "string") {
	consola.error("Datadog API Key is required");
	process.exit(1);
}

const ddSite = await consola.prompt(
	"Enter your Datadog Site (optional, e.g. datadoghq.eu):",
	{
		type: "text",
		default: "",
	},
);

let envContent = `CLOUDFLARE_ACCOUNT_ID=${accountId}
CLOUDFLARE_API_TOKEN=${cfToken}
DATADOG_API_KEY=${ddApiKey}`;

if (ddSite && typeof ddSite === "string" && ddSite.trim()) {
	envContent += `\nDATADOG_SITE=${ddSite.trim()}`;
}

// Add accountId to wrangler.jsonc
const wranglerJson = JSON.parse(await readFile("./wrangler.jsonc", "utf-8"));
wranglerJson.account_id = accountId;
await writeFile("./wrangler.jsonc", JSON.stringify(wranglerJson, null, 2));

await writeFile(".dev.vars", envContent);
consola.success("Created .dev.vars file:");
consola.box(envContent);
