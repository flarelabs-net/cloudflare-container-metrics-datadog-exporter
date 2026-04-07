import type {
	Container,
	ContainersMetricsResponse,
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
			cpuUtilization: 0.75,
			memory: 402653184, // 384 MiB
			diskUsage: 2147483648, // 2 GiB
			diskAvailable: 3221225472, // 3 GiB
			containerUptime: 120000,
		},
		quantiles: {
			memoryP50: 234881024, // 224 MiB
			memoryP90: 335544320, // 320 MiB
			memoryP99: 385875968, // 368 MiB
			diskUsageP50: 1073741824, // 1 GiB
			diskUsageP90: 1610612736, // 1.5 GiB
			diskUsageP99: 2040109465, // ~1.9 GiB
			cpuUtilizationP50: 0.2,
			cpuUtilizationP90: 0.5,
			cpuUtilizationP99: 0.7,
		},
		sum: {
			rxBytes: 104857600, // 100 MiB
			txBytes: 52428800, // 50 MiB
			cpuTimeSec: 45,
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
			cpuUtilization: 0.45,
			memory: 201326592, // 192 MiB
			diskUsage: 1073741824, // 1 GiB
			diskAvailable: 2147483648, // 2 GiB
			containerUptime: 60000,
		},
		quantiles: {
			memoryP50: 117440512, // 112 MiB
			memoryP90: 167772160, // 160 MiB
			memoryP99: 192937984, // 184 MiB
			diskUsageP50: 536870912, // 512 MiB
			diskUsageP90: 805306368, // 768 MiB
			diskUsageP99: 1020054732, // ~973 MiB
			cpuUtilizationP50: 0.1,
			cpuUtilizationP90: 0.3,
			cpuUtilizationP99: 0.4,
		},
		sum: {
			rxBytes: 52428800, // 50 MiB
			txBytes: 26214400, // 25 MiB
			cpuTimeSec: 20,
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
export const mockGraphQLResponse: ContainersMetricsResponse = {
	data: {
		viewer: {
			accounts: [
				{
					containersMetricsAdaptiveGroups: mockMetricsGroups,
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
			cpuUtilization: 0.75,
			memory: 402653184,
			diskUsage: 2147483648,
			diskAvailable: 3221225472,
			containerUptime: 120000,
			...overrides.max,
		},
		quantiles: {
			memoryP50: 234881024,
			memoryP90: 335544320,
			memoryP99: 385875968,
			diskUsageP50: 1073741824,
			diskUsageP90: 1610612736,
			diskUsageP99: 2040109465,
			cpuUtilizationP50: 0.2,
			cpuUtilizationP90: 0.5,
			cpuUtilizationP99: 0.7,
			...overrides.quantiles,
		},
		sum: {
			rxBytes: 104857600,
			txBytes: 52428800,
			cpuTimeSec: 45,
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
