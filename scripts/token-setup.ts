import { writeFile } from "node:fs/promises";
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

const ddSite = await consola.prompt("Select your Datadog Site:", {
	type: "select",
	options: [
		{ label: "US1 (datadoghq.com)", value: "datadoghq.com" },
		{ label: "US3 (us3.datadoghq.com)", value: "us3.datadoghq.com" },
		{ label: "US5 (us5.datadoghq.com)", value: "us5.datadoghq.com" },
		{ label: "EU1 (datadoghq.eu)", value: "datadoghq.eu" },
		{ label: "US1-FED (ddog-gov.com)", value: "ddog-gov.com" },
		{ label: "AP1 - Japan (ap1.datadoghq.com)", value: "ap1.datadoghq.com" },
		{ label: "AP2 - Australia (ap2.datadoghq.com)", value: "ap2.datadoghq.com" },
	],
});

const ddApiKeysUrl = `https://${ddSite}/organization-settings/api-keys`;
consola.start("Opening browser to Datadog API keys page...");
await setTimeout(1000);
await open(ddApiKeysUrl);

const ddApiKey = await consola.prompt("Paste your Datadog API Key:", {
	type: "text",
});

if (!ddApiKey || typeof ddApiKey !== "string") {
	consola.error("Datadog API Key is required");
	process.exit(1);
}

const envContent = `CLOUDFLARE_ACCOUNT_ID=${accountId}
CLOUDFLARE_API_TOKEN=${cfToken}
DATADOG_API_KEY=${ddApiKey}
DATADOG_SITE=${ddSite}`;

await writeFile(".dev.vars", envContent);
consola.success("Created .dev.vars file:");
consola.box(envContent);
