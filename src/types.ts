export type Container = {
	id: string;
	created_at: Date;
	updated_at: Date;
	account_id: string;
	name: string;
	version: number;
	scheduling_policy: string;
	instances: number;
	max_instances: number;
	configuration: Configuration;
	constraints: Constraints;
	jobs: boolean;
	affinities: Affinities;
	priorities: Priorities;
	durable_objects: DurableObjects;
	scheduling_hint: SchedulingHint;
	active_rollout_id: string;
	rollout_active_grace_period: number;
	health: Health;
};

export type Affinities = {
	colocation: string;
	hardware_generation: string;
};

export type Configuration = {
	image: string;
	wrangler_ssh: WranglerSSH;
	authorized_keys: AuthorizedKey[];
	ssh_public_key_ids: string[];
	secrets: Secret[];
	instance_type: string;
	vcpu: number;
	memory: string;
	memory_mib: number;
	disk: Disk;
	environment_variables: EnvironmentVariable[];
	labels: EnvironmentVariable[];
	network: Network;
	command: string[];
	entrypoint: string[];
	dns: DNS;
	ports: Port[];
	checks: Check[];
	provisioner: Provisioner;
	observability: Observability;
	durable_object_offset_instances: number;
};

export type AuthorizedKey = {
	name: string;
	public_key: string;
};

export type Check = {
	name: string;
	type: string;
	tls: boolean;
	port: string;
	http: HTTP;
	interval: string;
	timeout: string;
	attempts_before_failure: number;
	kind: string;
	grace_period: string;
};

export type HTTP = {
	method: string;
	body: string;
	path: string;
	headers: Headers;
};

export type Headers = Record<string, string>;

export type Disk = {
	size: string;
	size_mb: number;
};

export type DNS = {
	servers: string[];
	searches: string[];
};

export type EnvironmentVariable = {
	name: string;
	value: string;
};

export type Network = {
	assign_ipv4: string;
	ipv4_prefix_length: number;
	assign_ipv6: string;
	ipv6_prefix_length: number;
	mode: string;
	egress_from_landing_colo: boolean;
};

export type Observability = {
	logs: Logs;
};

export type Logs = {
	enabled: boolean;
};

export type Port = {
	name: string;
	port: number;
	assign_port: AssignPort[];
};

export type AssignPort = {
	start: number;
	end: number;
};

export type Provisioner = {
	type: string;
};

export type Secret = {
	name: string;
	type: string;
	secret: string;
};

export type WranglerSSH = {
	enabled: boolean;
	port: number;
};

export type Constraints = {
	region: string;
	tier: number;
	tiers: number[];
	regions: string[];
	cities: string[];
	pops: string[];
};

export type DurableObjects = {
	namespace_id: string;
};

export type Health = {
	instances: Instances;
	errors: Error[];
};

export type Error = {
	instance_id: string;
	event: Event;
};

export type Event = {
	id: string;
	time: Date;
	type: string;
	name: string;
	message: string;
	details: Headers;
	statusChange: Headers;
};

export type Instances = {
	durable_objects_active: number;
	active: number;
	stopped: number;
	healthy: number;
	failed: number;
	starting: number;
	scheduling: number;
};

export type Priorities = {
	default: number;
};

export type SchedulingHint = {
	current: Current;
	target: Current;
};

export type Current = {
	instances: number;
	configuration: Configuration;
	version: number;
};

// GraphQL Metrics Response Types

export type CloudchamberMetricsResponse = {
	data: {
		viewer: {
			accounts: MetricsAccount[];
		};
	};
	errors: unknown[] | null;
};

export type MetricsAccount = {
	cloudchamberMetricsAdaptiveGroups: MetricsGroup[];
};

export type MetricsGroup = {
	avg: {
		cpuLoad: number;
		memory: number;
		rxBandwidthBps: number;
		txBandwidthBps: number;
	};
	max: {
		cpuLoad: number;
		memory: number;
		diskUsage: number;
	};
	dimensions: {
		applicationId: string;
		datetimeMinute: string;
		deploymentId: string;
		placementId: string;
	};
	quantiles: {
		memoryP50: number;
		memoryP90: number;
		memoryP99: number;
		diskUsageP50: number;
		diskUsageP90: number;
		diskUsageP99: number;
		cpuLoadP50: number;
		cpuLoadP90: number;
		cpuLoadP99: number;
	};
	sum: {
		rxBytes: number;
		txBytes: number;
	};
};
