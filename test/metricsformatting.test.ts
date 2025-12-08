import { describe, expect, it } from "vitest";
import {
	type ContainerWithMetrics,
	formatContainerMetrics,
	formatHealthMetrics,
	formatMetricsForContainer,
} from "../src/metrics";
import {
	createMockMetricsGroup,
	mockContainers,
	mockMetricsGroups,
} from "./mocks";

const TEST_ACCOUNT_ID = "test-account-123";
const TEST_TIMESTAMP = 1733414400; // 2024-12-05T16:00:00Z

describe("formatMetricsForContainer", () => {
	it("formats metrics for a single container", () => {
		const container = { id: "app-123", name: "my-app" };
		const metrics = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			[mockMetricsGroups[0]],
			TEST_TIMESTAMP,
		);

		// 4 CPU + 4 Memory + 3 Disk + 2 Bandwidth = 13 metrics per group
		expect(metrics).toHaveLength(13);
	});

	it("formats multiple metrics groups", () => {
		const container = { id: "app-123", name: "my-app" };
		const metrics = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			mockMetricsGroups, // 2 groups
			TEST_TIMESTAMP,
		);

		// 2 groups * 13 metrics = 26 metrics
		expect(metrics).toHaveLength(26);
	});

	it("includes correct tags", () => {
		const container = { id: "app-123", name: "my-app" };
		const group = createMockMetricsGroup({
			dimensions: {
				applicationId: "app-test",
				datetimeMinute: "2025-12-05T16:00:00Z",
				deploymentId: "deploy-test",
				placementId: "place-test",
			},
		});

		const metrics = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			[group],
			TEST_TIMESTAMP,
		);

		const cpuMetric = metrics.find(
			(m) =>
				m.metric === "cloudflare.containers.cpu" && m.tags.includes("stat:avg"),
		);

		expect(cpuMetric).toBeDefined();
		expect(cpuMetric?.tags).toContain(`account_id:${TEST_ACCOUNT_ID}`);
		expect(cpuMetric?.tags).toContain("application_id:app-test");
		expect(cpuMetric?.tags).toContain("application_name:my-app");
		expect(cpuMetric?.tags).toContain("deployment_id:deploy-test");
		expect(cpuMetric?.tags).toContain("placement_id:place-test");
	});

	it("returns empty array for no metrics groups", () => {
		const container = { id: "app-123", name: "my-app" };
		const metrics = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			[],
			TEST_TIMESTAMP,
		);
		expect(metrics).toHaveLength(0);
	});
});

describe("formatContainerMetrics", () => {
	it("formats metrics for a single container with one metrics group", () => {
		const containersWithMetrics: ContainerWithMetrics[] = [
			{
				container: mockContainers[0],
				metrics: [mockMetricsGroups[0]],
			},
		];

		const metrics = formatContainerMetrics(
			TEST_ACCOUNT_ID,
			containersWithMetrics,
			TEST_TIMESTAMP,
		);

		// 4 CPU + 4 Memory + 3 Disk + 2 Bandwidth = 13 metrics per group
		expect(metrics).toHaveLength(13);
	});

	it("formats metrics for multiple containers with multiple groups", () => {
		const containersWithMetrics: ContainerWithMetrics[] = [
			{
				container: mockContainers[0],
				metrics: mockMetricsGroups, // 2 groups
			},
			{
				container: mockContainers[1],
				metrics: [mockMetricsGroups[0]], // 1 group
			},
		];

		const metrics = formatContainerMetrics(
			TEST_ACCOUNT_ID,
			containersWithMetrics,
			TEST_TIMESTAMP,
		);

		// 3 groups * 13 metrics = 39 metrics
		expect(metrics).toHaveLength(39);
	});

	it("includes correct tags for each metric", () => {
		const group = createMockMetricsGroup({
			dimensions: {
				applicationId: "app-test",
				datetimeMinute: "2025-12-05T16:00:00Z",
				deploymentId: "deploy-test",
				placementId: "place-test",
			},
		});

		const containersWithMetrics: ContainerWithMetrics[] = [
			{
				container: mockContainers[0],
				metrics: [group],
			},
		];

		const metrics = formatContainerMetrics(
			TEST_ACCOUNT_ID,
			containersWithMetrics,
			TEST_TIMESTAMP,
		);

		const cpuMetric = metrics.find(
			(m) =>
				m.metric === "cloudflare.containers.cpu" && m.tags.includes("stat:avg"),
		);

		expect(cpuMetric).toBeDefined();
		expect(cpuMetric?.tags).toContain(`account_id:${TEST_ACCOUNT_ID}`);
		expect(cpuMetric?.tags).toContain("application_id:app-test");
		expect(cpuMetric?.tags).toContain(
			`application_name:${mockContainers[0].name}`,
		);
		expect(cpuMetric?.tags).toContain("deployment_id:deploy-test");
		expect(cpuMetric?.tags).toContain("placement_id:place-test");
		expect(cpuMetric?.tags).toContain("stat:avg");
	});

	it("uses correct metric values from the group", () => {
		const group = createMockMetricsGroup({
			avg: {
				cpuLoad: 0.42,
				memory: 123456789,
				rxBandwidthBps: 0,
				txBandwidthBps: 0,
			},
			max: { cpuLoad: 0.99, memory: 999999999, diskUsage: 5000000000 },
			quantiles: {
				cpuLoadP50: 0.3,
				cpuLoadP90: 0.8,
				cpuLoadP99: 0.95,
				memoryP50: 100000000,
				memoryP90: 200000000,
				memoryP99: 300000000,
				diskUsageP50: 1000000000,
				diskUsageP90: 2000000000,
				diskUsageP99: 4000000000,
			},
			sum: { rxBytes: 1000000, txBytes: 500000 },
		});

		const containersWithMetrics: ContainerWithMetrics[] = [
			{
				container: mockContainers[0],
				metrics: [group],
			},
		];

		const metrics = formatContainerMetrics(
			TEST_ACCOUNT_ID,
			containersWithMetrics,
			TEST_TIMESTAMP,
		);

		// Check CPU avg
		const cpuAvg = metrics.find(
			(m) =>
				m.metric === "cloudflare.containers.cpu" && m.tags.includes("stat:avg"),
		);
		expect(cpuAvg?.points[0]).toEqual([TEST_TIMESTAMP, 0.42]);

		// Check CPU max
		const cpuMax = metrics.find(
			(m) =>
				m.metric === "cloudflare.containers.cpu" && m.tags.includes("stat:max"),
		);
		expect(cpuMax?.points[0]).toEqual([TEST_TIMESTAMP, 0.99]);

		// Check memory p99
		const memoryP99 = metrics.find(
			(m) =>
				m.metric === "cloudflare.containers.memory" &&
				m.tags.includes("stat:p99"),
		);
		expect(memoryP99?.points[0]).toEqual([TEST_TIMESTAMP, 300000000]);

		// Check bandwidth rx
		const bandwidthRx = metrics.find(
			(m) => m.metric === "cloudflare.containers.bandwidth.rx",
		);
		expect(bandwidthRx?.points[0]).toEqual([TEST_TIMESTAMP, 1000000]);
		expect(bandwidthRx?.type).toBe("count");
	});

	it("generates correct metric types", () => {
		const containersWithMetrics: ContainerWithMetrics[] = [
			{
				container: mockContainers[0],
				metrics: [mockMetricsGroups[0]],
			},
		];

		const metrics = formatContainerMetrics(
			TEST_ACCOUNT_ID,
			containersWithMetrics,
			TEST_TIMESTAMP,
		);

		// CPU, Memory, Disk should be gauges
		const cpuMetrics = metrics.filter(
			(m) => m.metric === "cloudflare.containers.cpu",
		);
		expect(cpuMetrics.every((m) => m.type === "gauge")).toBe(true);

		const memoryMetrics = metrics.filter(
			(m) => m.metric === "cloudflare.containers.memory",
		);
		expect(memoryMetrics.every((m) => m.type === "gauge")).toBe(true);

		const diskMetrics = metrics.filter(
			(m) => m.metric === "cloudflare.containers.disk",
		);
		expect(diskMetrics.every((m) => m.type === "gauge")).toBe(true);

		// Bandwidth should be counts
		const bandwidthMetrics = metrics.filter((m) =>
			m.metric.startsWith("cloudflare.containers.bandwidth"),
		);
		expect(bandwidthMetrics.every((m) => m.type === "count")).toBe(true);
	});

	it("returns empty array for empty input", () => {
		const metrics = formatContainerMetrics(TEST_ACCOUNT_ID, [], TEST_TIMESTAMP);
		expect(metrics).toHaveLength(0);
	});

	it("handles containers with no metrics", () => {
		const containersWithMetrics: ContainerWithMetrics[] = [
			{
				container: mockContainers[0],
				metrics: [],
			},
		];

		const metrics = formatContainerMetrics(
			TEST_ACCOUNT_ID,
			containersWithMetrics,
			TEST_TIMESTAMP,
		);

		expect(metrics).toHaveLength(0);
	});
});

describe("formatHealthMetrics", () => {
	it("aggregates health across all containers", () => {
		const metrics = formatHealthMetrics(
			TEST_ACCOUNT_ID,
			mockContainers,
			TEST_TIMESTAMP,
		);

		// 2 containers × 7 per-app metrics + 7 global totals = 21 metrics
		expect(metrics).toHaveLength(21);

		// Find global metrics (only account_id tag, no application tags)
		const findGlobalMetric = (name: string) =>
			metrics.find(
				(m) =>
					m.metric === name &&
					m.tags.length === 1 &&
					m.tags[0].startsWith("account_id:"),
			);

		// mockContainers[0]: active=5, healthy=5, stopped=0, failed=0, max=10
		// mockContainers[1]: active=3, healthy=2, stopped=0, failed=1, max=5
		expect(
			findGlobalMetric("cloudflare.containers.instances.total.active")
				?.points[0],
		).toEqual([TEST_TIMESTAMP, 8]);
		expect(
			findGlobalMetric("cloudflare.containers.instances.total.healthy")
				?.points[0],
		).toEqual([TEST_TIMESTAMP, 7]);
		expect(
			findGlobalMetric("cloudflare.containers.instances.total.failed")
				?.points[0],
		).toEqual([TEST_TIMESTAMP, 1]);
		expect(
			findGlobalMetric("cloudflare.containers.instances.total.max")?.points[0],
		).toEqual([TEST_TIMESTAMP, 15]);
	});

	it("includes account_id tag", () => {
		const metrics = formatHealthMetrics(
			TEST_ACCOUNT_ID,
			mockContainers,
			TEST_TIMESTAMP,
		);

		for (const metric of metrics) {
			expect(metric.tags).toContain(`account_id:${TEST_ACCOUNT_ID}`);
		}
	});

	it("all health metrics are gauges", () => {
		const metrics = formatHealthMetrics(
			TEST_ACCOUNT_ID,
			mockContainers,
			TEST_TIMESTAMP,
		);

		for (const metric of metrics) {
			expect(metric.type).toBe("gauge");
		}
	});

	it("returns zeros for empty containers list", () => {
		const metrics = formatHealthMetrics(TEST_ACCOUNT_ID, [], TEST_TIMESTAMP);

		// Only global totals (7 metrics) when no containers
		expect(metrics).toHaveLength(7);

		for (const metric of metrics) {
			expect(metric.points[0][1]).toBe(0);
		}
	});
});
