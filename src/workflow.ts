import {
	WorkflowEntrypoint,
	type WorkflowEvent,
	type WorkflowStep,
} from "cloudflare:workers";
import pAll from "p-all";
import { createCloudflareApi } from "./api/cloudflare";
import { createDatadogApi } from "./api/datadog";
import { formatHealthMetrics, formatMetricsForContainer } from "./metrics";
import { chunk } from "./utils";

/**
 * Calculate the metrics time window.
 * With ~40-50s delay in Cloudflare metrics, we fetch the previous complete minute.
 * e.g., if cron runs at 10:43:xx, we fetch metrics from 10:41:00 to 10:42:00
 */
function getMetricsTimeWindow(now: Date = new Date()): {
	start: Date;
	end: Date;
} {
	const currentMinute = new Date(now);
	currentMinute.setSeconds(0, 0);

	const end = new Date(currentMinute.getTime() - 60 * 1000);
	const start = new Date(end.getTime() - 60 * 1000);

	return { start, end };
}

export class MetricsExporterWorkflow extends WorkflowEntrypoint<Env> {
	async run(_event: WorkflowEvent<unknown>, step: WorkflowStep) {
		const batchSize = this.env.BATCH_SIZE ?? 5000;
		const retryLimit = this.env.RETRY_LIMIT ?? 3;
		const retryDelaySeconds = this.env.RETRY_DELAY_SECONDS ?? 1;

		const stepConfig = {
			retries: {
				limit: retryLimit,
				delay: `${retryDelaySeconds} seconds` as const,
				backoff: "exponential" as const,
			},
		};

		// Create a fetcher that proxies requests through a Durable Object in a specific jurisdiction
		// This ensures GraphQL queries run close to the data source
		let fetcher: typeof fetch | undefined;
		if (this.env.JURISDICTION) {
			const jurisdiction = this.env.REQUEST_PROXY.jurisdiction(
				this.env.JURISDICTION as DurableObjectJurisdiction,
			);
			const id = jurisdiction.idFromName("metrics-proxy");
			const stub = jurisdiction.get(id);
			fetcher = (input, init) => stub.fetch(new Request(input, init));
		}

		const cloudflare = createCloudflareApi(
			this.env.CLOUDFLARE_ACCOUNT_ID,
			this.env.CLOUDFLARE_API_TOKEN,
			fetcher,
		);

		const datadog = createDatadogApi(
			this.env.DATADOG_API_KEY,
			this.env.DATADOG_SITE,
		);

		const { start, end } = getMetricsTimeWindow();
		console.log("Workflow started", {
			start: start.toISOString(),
			end: end.toISOString(),
		});

		const containers = await step.do(
			"fetch containers",
			stepConfig,
			async () => {
				const result = await cloudflare.listContainers();
				console.log("Fetched containers", { count: result.length });

				const healthMetrics = formatHealthMetrics(
					this.env.CLOUDFLARE_ACCOUNT_ID,
					result,
					undefined,
					this.env.DATADOG_TAGS,
				);
				await datadog.sendMetrics(healthMetrics);

				return result.map((c) => ({
					id: c.id,
					name: c.name,
					version: c.version,
				}));
			},
		);

		let totalMetrics = 0;

		for (const container of containers) {
			const count = await step.do(
				`Download Metrics: ${container.name}`,
				stepConfig,
				async () => {
					const metricsGroups = await cloudflare.getContainerMetrics(
						container.id,
						start,
						end,
					);

					const metrics = formatMetricsForContainer(
						this.env.CLOUDFLARE_ACCOUNT_ID,
						container,
						metricsGroups,
						undefined,
						this.env.DATADOG_TAGS,
					);

					const batches = chunk(metrics, batchSize);

					await pAll(
						batches.map(
							(batch, i) => () =>
								step.do(
									`Export Metrics: ${container.name} batch ${i + 1}/${batches.length}`,
									stepConfig,
									async () => {
										await datadog.sendMetrics(batch);
									},
								),
						),
						{ concurrency: 6 },
					);

					return metrics.length;
				},
			);
			totalMetrics += count;
		}

		return { status: "completed", metricsCount: totalMetrics };
	}
}
