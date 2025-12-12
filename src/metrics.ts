import { z } from "zod/v4";
import type { DatadogMetric } from "./api/datadog";
import type { Container, MetricsGroup } from "./types";

export interface ContainerInfo {
	id: string;
	name: string;
	version: number;
}

const DatadogTagsSchema = z.record(z.string(), z.string()).optional();

function parseCustomTags(datadogTags: unknown): string[] {
	const parsed = DatadogTagsSchema.safeParse(datadogTags);
	if (!parsed.success) {
		console.warn("Invalid DATADOG_TAGS format, ignoring custom tags", {
			error: parsed.error.message,
		});
		return [];
	}
	if (!parsed.data) {
		return [];
	}
	return Object.entries(parsed.data).map(([key, value]) => `${key}:${value}`);
}

/**
 * Format metrics for a single container into Datadog metrics
 */
export function formatMetricsForContainer(
	accountId: string,
	container: ContainerInfo,
	metricsGroups: MetricsGroup[],
	timestamp?: number,
	datadogTags?: unknown,
): DatadogMetric[] {
	const customTags = parseCustomTags(datadogTags);
	const ts = timestamp ?? Math.floor(Date.now() / 1000);
	const metrics: DatadogMetric[] = [];

	for (const group of metricsGroups) {
		const baseTags = [
			`account_id:${accountId}`,
			`application_id:${group.dimensions.applicationId}`,
			`application_name:${container.name}`,
			`version:${container.version}`,
			`instance_id:${group.dimensions.deploymentId}`,
			`placement_id:${group.dimensions.placementId}`,
			...customTags,
		];

		// CPU metrics
		metrics.push(
			{
				metric: "cloudflare.containers.cpu",
				type: "gauge",
				points: [[ts, group.quantiles.cpuLoadP50]],
				tags: [...baseTags, "stat:p50"],
			},
			{
				metric: "cloudflare.containers.cpu",
				type: "gauge",
				points: [[ts, group.quantiles.cpuLoadP90]],
				tags: [...baseTags, "stat:p90"],
			},
			{
				metric: "cloudflare.containers.cpu",
				type: "gauge",
				points: [[ts, group.quantiles.cpuLoadP99]],
				tags: [...baseTags, "stat:p99"],
			},
			{
				metric: "cloudflare.containers.cpu",
				type: "gauge",
				points: [[ts, group.max.cpuLoad]],
				tags: [...baseTags, "stat:max"],
			},
		);

		// Memory metrics
		metrics.push(
			{
				metric: "cloudflare.containers.memory",
				type: "gauge",
				points: [[ts, group.quantiles.memoryP50]],
				tags: [...baseTags, "stat:p50"],
			},
			{
				metric: "cloudflare.containers.memory",
				type: "gauge",
				points: [[ts, group.quantiles.memoryP90]],
				tags: [...baseTags, "stat:p90"],
			},
			{
				metric: "cloudflare.containers.memory",
				type: "gauge",
				points: [[ts, group.quantiles.memoryP99]],
				tags: [...baseTags, "stat:p99"],
			},
			{
				metric: "cloudflare.containers.memory",
				type: "gauge",
				points: [[ts, group.max.memory]],
				tags: [...baseTags, "stat:max"],
			},
		);

		// Disk metrics
		metrics.push(
			{
				metric: "cloudflare.containers.disk",
				type: "gauge",
				points: [[ts, group.quantiles.diskUsageP50]],
				tags: [...baseTags, "stat:p50"],
			},
			{
				metric: "cloudflare.containers.disk",
				type: "gauge",
				points: [[ts, group.quantiles.diskUsageP90]],
				tags: [...baseTags, "stat:p90"],
			},
			{
				metric: "cloudflare.containers.disk",
				type: "gauge",
				points: [[ts, group.quantiles.diskUsageP99]],
				tags: [...baseTags, "stat:p99"],
			},
			{
				metric: "cloudflare.containers.disk",
				type: "gauge",
				points: [[ts, group.max.diskUsage]],
				tags: [...baseTags, "stat:max"],
			},
		);

		// Bandwidth metrics
		metrics.push(
			{
				metric: "cloudflare.containers.bandwidth.rx",
				type: "count",
				points: [[ts, group.sum.rxBytes]],
				tags: baseTags,
			},
			{
				metric: "cloudflare.containers.bandwidth.tx",
				type: "count",
				points: [[ts, group.sum.txBytes]],
				tags: baseTags,
			},
		);
	}

	return metrics;
}


/**
 * Format container health data into Datadog metrics
 */
export function formatHealthMetrics(
	accountId: string,
	containers: Container[],
	timestamp?: number,
	datadogTags?: unknown,
): DatadogMetric[] {
	const customTags = parseCustomTags(datadogTags);
	const ts = timestamp ?? Math.floor(Date.now() / 1000);
	const baseTags = [`account_id:${accountId}`, ...customTags];
	const metrics: DatadogMetric[] = [];

	const totals = {
		active: 0,
		healthy: 0,
		stopped: 0,
		failed: 0,
		scheduling: 0,
		starting: 0,
		maxInstances: 0,
	};

	for (const container of containers) {
		const appTags = [
			...baseTags,
			`application_id:${container.id}`,
			`application_name:${container.name}`,
		];

		const instances = container.health?.instances;
		const active = instances?.active ?? 0;
		const healthy = instances?.healthy ?? 0;
		const stopped = instances?.stopped ?? 0;
		const failed = instances?.failed ?? 0;
		const scheduling = instances?.scheduling ?? 0;
		const starting = instances?.starting ?? 0;
		const maxInstances = container.max_instances ?? 0;

		// Aggregate totals
		totals.active += active;
		totals.healthy += healthy;
		totals.stopped += stopped;
		totals.failed += failed;
		totals.scheduling += scheduling;
		totals.starting += starting;
		totals.maxInstances += maxInstances;

		// Per-application metrics
		metrics.push(
			{
				metric: "cloudflare.containers.instances.active",
				type: "gauge",
				points: [[ts, active]],
				tags: appTags,
			},
			{
				metric: "cloudflare.containers.instances.healthy",
				type: "gauge",
				points: [[ts, healthy]],
				tags: appTags,
			},
			{
				metric: "cloudflare.containers.instances.stopped",
				type: "gauge",
				points: [[ts, stopped]],
				tags: appTags,
			},
			{
				metric: "cloudflare.containers.instances.failed",
				type: "gauge",
				points: [[ts, failed]],
				tags: appTags,
			},
			{
				metric: "cloudflare.containers.instances.scheduling",
				type: "gauge",
				points: [[ts, scheduling]],
				tags: appTags,
			},
			{
				metric: "cloudflare.containers.instances.starting",
				type: "gauge",
				points: [[ts, starting]],
				tags: appTags,
			},
			{
				metric: "cloudflare.containers.instances.max",
				type: "gauge",
				points: [[ts, maxInstances]],
				tags: appTags,
			},
		);
	}

	// Global totals (no application tags)
	metrics.push(
		{
			metric: "cloudflare.containers.instances.total.active",
			type: "gauge",
			points: [[ts, totals.active]],
			tags: baseTags,
		},
		{
			metric: "cloudflare.containers.instances.total.healthy",
			type: "gauge",
			points: [[ts, totals.healthy]],
			tags: baseTags,
		},
		{
			metric: "cloudflare.containers.instances.total.stopped",
			type: "gauge",
			points: [[ts, totals.stopped]],
			tags: baseTags,
		},
		{
			metric: "cloudflare.containers.instances.total.failed",
			type: "gauge",
			points: [[ts, totals.failed]],
			tags: baseTags,
		},
		{
			metric: "cloudflare.containers.instances.total.scheduling",
			type: "gauge",
			points: [[ts, totals.scheduling]],
			tags: baseTags,
		},
		{
			metric: "cloudflare.containers.instances.total.starting",
			type: "gauge",
			points: [[ts, totals.starting]],
			tags: baseTags,
		},
		{
			metric: "cloudflare.containers.instances.total.max",
			type: "gauge",
			points: [[ts, totals.maxInstances]],
			tags: baseTags,
		},
	);

	return metrics;
}
