import { z } from "zod/v4";

// Container API Schemas

const InstancesSchema = z.object({
	durable_objects_active: z.number().optional(),
	active: z.number().optional(),
	stopped: z.number().optional(),
	healthy: z.number().optional(),
	failed: z.number().optional(),
	starting: z.number().optional(),
	scheduling: z.number().optional(),
});

const HealthSchema = z.looseObject({
	instances: InstancesSchema.optional(),
});

/** Container application from Cloudflare API */
export type Container = z.infer<typeof Container>;
export const Container = z.looseObject({
	id: z.string(),
	name: z.string(),
	version: z.number(),
	instances: z.number().optional(),
	max_instances: z.number().optional(),
	health: HealthSchema.optional(),
});

// GraphQL Metrics Response Schemas

const MetricsMaxSchema = z.object({
	cpuLoad: z.number(),
	memory: z.number(),
	diskUsage: z.number(),
});

const MetricsDimensionsSchema = z.object({
	applicationId: z.string(),
	datetimeMinute: z.string(),
	deploymentId: z.string(),
	placementId: z.string(),
});

const MetricsQuantilesSchema = z.object({
	memoryP50: z.number(),
	memoryP90: z.number(),
	memoryP99: z.number(),
	diskUsageP50: z.number(),
	diskUsageP90: z.number(),
	diskUsageP99: z.number(),
	cpuLoadP50: z.number(),
	cpuLoadP90: z.number(),
	cpuLoadP99: z.number(),
});

const MetricsSumSchema = z.object({
	rxBytes: z.number(),
	txBytes: z.number(),
});

/** Metrics group from GraphQL API */
export type MetricsGroup = z.infer<typeof MetricsGroup>;
export const MetricsGroup = z.object({
	max: MetricsMaxSchema,
	dimensions: MetricsDimensionsSchema,
	quantiles: MetricsQuantilesSchema,
	sum: MetricsSumSchema,
});

const MetricsAccountSchema = z.object({
	cloudchamberMetricsAdaptiveGroups: z.array(MetricsGroup),
});

/** GraphQL metrics response */
export type CloudchamberMetricsResponse = z.infer<
	typeof CloudchamberMetricsResponse
>;
export const CloudchamberMetricsResponse = z.object({
	data: z
		.object({
			viewer: z.object({
				accounts: z.array(MetricsAccountSchema),
			}),
		})
		.nullable(),
	errors: z.array(z.unknown()).nullable(),
});
