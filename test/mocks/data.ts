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
		created_at: new Date("2025-01-01T00:00:00Z"),
		updated_at: new Date("2025-01-15T12:00:00Z"),
		account_id: "test-account-id",
		name: "my-web-app",
		version: 3,
		scheduling_policy: "regional",
		instances: 5,
		max_instances: 10,
		configuration: {
			image: "registry.example.com/my-web-app:latest",
			wrangler_ssh: { enabled: false },
			authorized_keys: [],
			ssh_public_key_ids: [],
			secrets: [],
			instance_type: "standard",
			vcpu: 2,
			memory: "512Mi",
			memory_mib: 512,
			disk: { size_gb: 10 },
			environment_variables: [{ name: "NODE_ENV", value: "production" }],
			labels: [],
			network: {},
			command: [],
			entrypoint: ["node", "server.js"],
			dns: {},
			ports: [{ port: 8080, protocol: "tcp" }],
			checks: [],
			provisioner: {},
			observability: {},
			durable_object_offset_instances: 0,
		},
		constraints: { region: ["us-east"] },
		jobs: false,
		affinities: { colocation: "spread", hardware_generation: "gen2" },
		priorities: {},
		durable_objects: {},
		scheduling_hint: {},
		active_rollout_id: "rollout-456",
		rollout_active_grace_period: 300,
		health: {
			instances: {
				active: 5,
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
		created_at: new Date("2025-02-01T00:00:00Z"),
		updated_at: new Date("2025-02-10T08:30:00Z"),
		account_id: "test-account-id",
		name: "api-service",
		version: 1,
		scheduling_policy: "regional",
		instances: 3,
		max_instances: 5,
		configuration: {
			image: "registry.example.com/api-service:v1.2.0",
			wrangler_ssh: { enabled: false },
			authorized_keys: [],
			ssh_public_key_ids: [],
			secrets: [],
			instance_type: "standard",
			vcpu: 1,
			memory: "256Mi",
			memory_mib: 256,
			disk: { size_gb: 5 },
			environment_variables: [],
			labels: [],
			network: {},
			command: [],
			entrypoint: [],
			dns: {},
			ports: [{ port: 3000, protocol: "tcp" }],
			checks: [],
			provisioner: {},
			observability: {},
			durable_object_offset_instances: 0,
		},
		constraints: { region: ["eu-west"] },
		jobs: false,
		affinities: { colocation: "spread", hardware_generation: "gen2" },
		priorities: {},
		durable_objects: {},
		scheduling_hint: {},
		active_rollout_id: "rollout-789",
		rollout_active_grace_period: 300,
		health: {
			instances: {
				active: 3,
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
] as Container[];

/**
 * Mock metrics groups for a single container
 */
export const mockMetricsGroups: MetricsGroup[] = [
	{
		avg: {
			cpuLoad: 0.25,
			memory: 268435456, // 256 MB
			rxBandwidthBps: 1024000,
			txBandwidthBps: 512000,
		},
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
			deploymentId: "deploy-001",
			placementId: "place-us-east-1",
		},
	},
	{
		avg: {
			cpuLoad: 0.15,
			memory: 134217728, // 128 MB
			rxBandwidthBps: 512000,
			txBandwidthBps: 256000,
		},
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
			deploymentId: "deploy-002",
			placementId: "place-us-east-2",
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
		avg: {
			cpuLoad: 0.25,
			memory: 268435456,
			rxBandwidthBps: 1024000,
			txBandwidthBps: 512000,
			...overrides.avg,
		},
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
			deploymentId: "deploy-001",
			placementId: "place-us-east-1",
			...overrides.dimensions,
		},
	};
}
