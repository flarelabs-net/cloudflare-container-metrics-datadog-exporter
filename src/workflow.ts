import {
	WorkflowEntrypoint,
	type WorkflowEvent,
	type WorkflowStep,
	type WorkflowStepConfig,
} from "cloudflare:workers";
import pAll from "p-all";
import { createCloudflareApi } from "./api/cloudflare";
import { createDatadogApi } from "./api/datadog";
import { formatHealthMetrics, formatMetricsForContainer } from "./metrics";
import type { Container } from "./types";
import { chunk } from "./utils";

interface MetricsWorkflowParams {
	scheduledTime?: number;
}

/**
 * Calculate the metrics time window.
 * With ~40-50s delay in Cloudflare metrics, we fetch the previous complete minute.
 * The returned range is half-open: [start, end).
 * e.g., if cron runs at 10:43:xx, we fetch metrics from 10:41:00 up to but not including 10:42:00.
 */
export function getMetricsTimeWindow(
	scheduledTimeMs: number,
	windowMinutes = 1,
): {
	start: Date;
	end: Date;
} {
	const scheduledMinute = scheduledTimeMs - (scheduledTimeMs % 60_000);
	const end = new Date(scheduledMinute - 60_000);
	const start = new Date(end.getTime() - Math.max(1, windowMinutes) * 60_000);

	return { start, end };
}

export class MetricsExporterWorkflow extends WorkflowEntrypoint<
	Env,
	MetricsWorkflowParams
> {
	async run(event: WorkflowEvent<MetricsWorkflowParams>, step: WorkflowStep) {
		const batchSize = this.env.BATCH_SIZE ?? 5000;
		const retryLimit = this.env.RETRY_LIMIT ?? 3;
		const retryDelaySeconds = this.env.RETRY_DELAY_SECONDS ?? 1;

		const retryStepConfig: WorkflowStepConfig = {
			retries: {
				limit: retryLimit,
				delay: `${retryDelaySeconds} seconds` as const,
				backoff: "exponential" as const,
			},
		};

		const scheduledTime =
			event.payload?.scheduledTime ?? event.timestamp.getTime();

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

		const { start, end } = getMetricsTimeWindow(scheduledTime);
		console.log("Workflow started", {
			instanceId: event.instanceId,
			scheduledTime: new Date(scheduledTime).toISOString(),
			start: start.toISOString(),
			end: end.toISOString(),
		});

		const containers = await step.do(
			"List Containers",
			retryStepConfig,
			async (): Promise<Container[]> => {
				const result = await cloudflare.listContainers();
				console.log("Fetched containers", { count: result.length });
				return result;
			},
		);

		let totalMetrics = 0;
		for (const container of containers) {
			const metricsGroups = await step.do(
				`Fetch Metrics: ${container.name}`,
				retryStepConfig,
				async () => cloudflare.getContainerMetrics(container.id, start, end),
			);

			const metrics = formatMetricsForContainer(
				this.env.CLOUDFLARE_ACCOUNT_ID,
				container,
				metricsGroups,
				this.env.DATADOG_TAGS,
			);

			const batches = chunk(metrics, batchSize);

			await pAll(
				batches.map(
					(batch, i) => () =>
						step.do(
							`Export Metrics: ${container.name} Batch ${i + 1}/${batches.length}`,
							retryStepConfig,
							async () => {
								await datadog.sendMetrics(batch);
							},
						),
				),
				{ concurrency: 6 },
			);

			totalMetrics += metrics.length;
		}

		await step.do("Export Health Metrics", retryStepConfig, async () => {
			const healthMetrics = formatHealthMetrics(
				this.env.CLOUDFLARE_ACCOUNT_ID,
				containers,
				Math.floor(scheduledTime / 1000),
				this.env.DATADOG_TAGS,
			);
			await datadog.sendMetrics(healthMetrics);
		});

		return { status: "completed", metricsCount: totalMetrics };
	}
}
