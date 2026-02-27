import type {
	CloudchamberMetricsResponse,
	Container,
	MetricsGroup,
} from "../../src/types";

/**
 * Mock container data
 */
export const mockContainers: Container[] = [
	{
		id: "app-123-abc",
		name: "my-web-app",
		version: 3,
		instances: 5,
		max_instances: 10,
		health: {
			instances: {
				active: 5,
				assigned: 5,
				healthy: 5,
				stopped: 0,
				failed: 0,
				scheduling: 0,
				starting: 0,
				durable_objects_active: 0,
			},
			errors: [],
		},
	},
	{
		id: "app-456-def",
		name: "api-service",
		version: 1,
		instances: 3,
		max_instances: 5,
		health: {
			instances: {
				active: 3,
				assigned: 2,
				healthy: 2,
				stopped: 0,
				failed: 1,
				scheduling: 0,
				starting: 0,
				durable_objects_active: 0,
			},
			errors: [],
		},
	},
];

/**
 * Mock metrics groups for a single container
 */
export const mockMetricsGroups: MetricsGroup[] = [
	{
		max: {
			cpuLoad: 0.75,
			memory: 402653184, // 384 MB
			diskUsage: 2147483648, // 2 GB
		},
		quantiles: {
			memoryP50: 234881024, // 224 MB
			memoryP90: 335544320, // 320 MB
			memoryP99: 385875968, // 368 MB
			diskUsageP50: 1073741824, // 1 GB
			diskUsageP90: 1610612736, // 1.5 GB
			diskUsageP99: 2040109465, // ~1.9 GB
			cpuLoadP50: 0.2,
			cpuLoadP90: 0.5,
			cpuLoadP99: 0.7,
		},
		sum: {
			rxBytes: 104857600, // 100 MB
			txBytes: 52428800, // 50 MB
		},
		dimensions: {
			applicationId: "app-123-abc",
			datetimeMinute: "2025-12-05T16:00:00Z",
			deploymentId: "instance-001",
			placementId: "placement-us-east-1",
			durableObjectId: "do-abc-123",
		},
	},
	{
		max: {
			cpuLoad: 0.45,
			memory: 201326592, // 192 MB
			diskUsage: 1073741824, // 1 GB
		},
		quantiles: {
			memoryP50: 117440512, // 112 MB
			memoryP90: 167772160, // 160 MB
			memoryP99: 192937984, // 184 MB
			diskUsageP50: 536870912, // 512 MB
			diskUsageP90: 805306368, // 768 MB
			diskUsageP99: 1020054732, // ~973 MB
			cpuLoadP50: 0.1,
			cpuLoadP90: 0.3,
			cpuLoadP99: 0.4,
		},
		sum: {
			rxBytes: 52428800, // 50 MB
			txBytes: 26214400, // 25 MB
		},
		dimensions: {
			applicationId: "app-123-abc",
			datetimeMinute: "2025-12-05T16:00:00Z",
			deploymentId: "instance-002",
			placementId: "placement-us-east-2",
		},
	},
];

/**
 * Mock GraphQL response for container metrics
 */
export const mockGraphQLResponse: CloudchamberMetricsResponse = {
	data: {
		viewer: {
			accounts: [
				{
					cloudchamberMetricsAdaptiveGroups: mockMetricsGroups,
				},
			],
		},
	},
	errors: null,
};

/**
 * Mock containers list API response
 */
export const mockContainersListResponse = {
	success: true,
	result: mockContainers,
	errors: [],
	messages: [],
};

/**
 * Create a mock metrics group with custom values
 */
export function createMockMetricsGroup(
	overrides: Partial<MetricsGroup> = {},
): MetricsGroup {
	return {
		max: {
			cpuLoad: 0.75,
			memory: 402653184,
			diskUsage: 2147483648,
			...overrides.max,
		},
		quantiles: {
			memoryP50: 234881024,
			memoryP90: 335544320,
			memoryP99: 385875968,
			diskUsageP50: 1073741824,
			diskUsageP90: 1610612736,
			diskUsageP99: 2040109465,
			cpuLoadP50: 0.2,
			cpuLoadP90: 0.5,
			cpuLoadP99: 0.7,
			...overrides.quantiles,
		},
		sum: {
			rxBytes: 104857600,
			txBytes: 52428800,
			...overrides.sum,
		},
		dimensions: {
			applicationId: "app-123-abc",
			datetimeMinute: new Date().toISOString(),
			deploymentId: "instance-001",
			placementId: "placement-us-east-1",
			durableObjectId: "do-abc-123",
			...overrides.dimensions,
		},
	};
}
