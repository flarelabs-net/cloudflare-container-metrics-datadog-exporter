export { MetricsExporterWorkflow } from "./workflow";

const REQUIRED_ENV_VARS = [
	"CLOUDFLARE_API_TOKEN",
	"CLOUDFLARE_ACCOUNT_ID",
	"DATADOG_API_KEY",
] as const;

function validateEnv(env: Env): string[] {
	const missing: string[] = [];
	for (const key of REQUIRED_ENV_VARS) {
		if (!env[key]) {
			missing.push(key);
		}
	}
	return missing;
}

export default {
	async scheduled(
		_controller: ScheduledController,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<void> {
		const missing = validateEnv(env);
		if (missing.length > 0) {
			console.error("Skipping workflow", {
				reason: "missing env vars",
				missing,
			});
			return;
		}

		await env.METRICS_WORKFLOW.create();
	},

	async fetch(_req: Request): Promise<Response> {
		return Response.json({ status: "ok" });
	},
};
