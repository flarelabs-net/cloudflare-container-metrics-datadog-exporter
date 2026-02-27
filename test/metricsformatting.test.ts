import { describe, expect, it, vi } from "vitest";
import { formatHealthMetrics, formatMetricsForContainer } from "../src/metrics";
import {
	createMockMetricsGroup,
	mockContainers,
	mockMetricsGroups,
} from "./mocks";

const TEST_ACCOUNT_ID = "test-account-123";
const TEST_TIMESTAMP = 1733414400; // 2024-12-05T16:00:00Z

describe("formatMetricsForContainer", () => {
	it("formats metrics for a single container", () => {
		const container = { id: "app-123", name: "my-app", version: 1 };
		const metrics = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			[mockMetricsGroups[0]],
			TEST_TIMESTAMP,
		);

		// 4 CPU + 4 Memory + 4 Disk + 2 Bandwidth = 14 metrics per group
		expect(metrics).toHaveLength(14);
	});

	it("formats multiple metrics groups", () => {
		const container = { id: "app-123", name: "my-app", version: 1 };
		const metrics = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			mockMetricsGroups, // 2 groups
			TEST_TIMESTAMP,
		);

		// 2 groups * 14 metrics = 28 metrics
		expect(metrics).toHaveLength(28);
	});

	it("includes correct tags", () => {
		const container = { id: "app-123", name: "my-app", version: 1 };
		const group = createMockMetricsGroup({
			dimensions: {
				applicationId: "app-test",
				datetimeMinute: "2025-12-05T16:00:00Z",
				deploymentId: "instance-test",
				placementId: "placement-test",
				durableObjectId: "do-test-456",
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
				m.metric === "cloudflare.containers.cpu" && m.tags.includes("stat:p50"),
		);

		expect(cpuMetric).toBeDefined();
		expect(cpuMetric?.tags).toContain(`account_id:${TEST_ACCOUNT_ID}`);
		expect(cpuMetric?.tags).toContain("application_id:app-test");
		expect(cpuMetric?.tags).toContain("application_name:my-app");
		expect(cpuMetric?.tags).toContain("version:1");
		expect(cpuMetric?.tags).toContain("instance_id:instance-test");
		expect(cpuMetric?.tags).toContain("placement_id:placement-test");
		expect(cpuMetric?.tags).toContain("durable_object_id:do-test-456");
	});

	it("omits durable_object_id tag when not present", () => {
		const container = { id: "app-123", name: "my-app", version: 1 };
		const group = createMockMetricsGroup({
			dimensions: {
				applicationId: "app-test",
				datetimeMinute: "2025-12-05T16:00:00Z",
				deploymentId: "instance-test",
				placementId: "placement-test",
				durableObjectId: undefined,
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
				m.metric === "cloudflare.containers.cpu" && m.tags.includes("stat:p50"),
		);

		expect(cpuMetric).toBeDefined();
		expect(
			cpuMetric?.tags.some((t) => t.startsWith("durable_object_id:")),
		).toBe(false);
	});

	it("includes custom tags when provided", () => {
		const container = { id: "app-123", name: "my-app", version: 1 };
		const datadogTags = { env: "production", team: "platform" };
		const metrics = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			[mockMetricsGroups[0]],
			TEST_TIMESTAMP,
			datadogTags,
		);

		const cpuMetric = metrics.find(
			(m) =>
				m.metric === "cloudflare.containers.cpu" && m.tags.includes("stat:p50"),
		);

		expect(cpuMetric).toBeDefined();
		expect(cpuMetric?.tags).toContain("env:production");
		expect(cpuMetric?.tags).toContain("team:platform");
	});

	it("handles invalid datadogTags gracefully", () => {
		const container = { id: "app-123", name: "my-app", version: 1 };
		const invalidTags = { env: "prod", count: 123 } as unknown;

		const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();

		const metrics = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			[mockMetricsGroups[0]],
			TEST_TIMESTAMP,
			invalidTags,
		);

		expect(metrics).toHaveLength(14);
		const cpuMetric = metrics.find(
			(m) =>
				m.metric === "cloudflare.containers.cpu" && m.tags.includes("stat:p50"),
		);
		expect(cpuMetric?.tags).not.toContain("count:123");
		expect(cpuMetric?.tags).not.toContain("env:prod");
		expect(consoleWarnSpy).toHaveBeenCalledWith(
			"Invalid DATADOG_TAGS format, ignoring custom tags",
			expect.objectContaining({ error: expect.any(String) }),
		);

		consoleWarnSpy.mockRestore();
	});

	it("handles empty datadogTags object", () => {
		const container = { id: "app-123", name: "my-app", version: 1 };
		const datadogTags = {};

		const metrics = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			[mockMetricsGroups[0]],
			TEST_TIMESTAMP,
			datadogTags,
		);

		expect(metrics).toHaveLength(14);
		const cpuMetric = metrics.find(
			(m) =>
				m.metric === "cloudflare.containers.cpu" && m.tags.includes("stat:p50"),
		);
		expect(cpuMetric).toBeDefined();
		expect(cpuMetric?.tags).toContain(`account_id:${TEST_ACCOUNT_ID}`);
	});

	it("handles undefined datadogTags", () => {
		const container = { id: "app-123", name: "my-app", version: 1 };

		const metrics = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			[mockMetricsGroups[0]],
			TEST_TIMESTAMP,
			undefined,
		);

		expect(metrics).toHaveLength(14);
		const cpuMetric = metrics.find(
			(m) =>
				m.metric === "cloudflare.containers.cpu" && m.tags.includes("stat:p50"),
		);
		expect(cpuMetric).toBeDefined();
		expect(cpuMetric?.tags).toContain(`account_id:${TEST_ACCOUNT_ID}`);
	});

	it("returns empty array for no metrics groups", () => {
		const container = { id: "app-123", name: "my-app", version: 1 };
		const metrics = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			[],
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

		// 2 containers × 8 per-app metrics + 8 global totals = 24 metrics
		expect(metrics).toHaveLength(24);

		// Find global metrics (only account_id tag, no application tags)
		const findGlobalMetric = (name: string) =>
			metrics.find(
				(m) =>
					m.metric === name &&
					m.tags.length === 1 &&
					m.tags[0].startsWith("account_id:"),
			);

		// mockContainers[0]: active=5, assigned=5, healthy=5, stopped=0, failed=0, max=10
		// mockContainers[1]: active=3, assigned=2, healthy=2, stopped=0, failed=1, max=5
		expect(
			findGlobalMetric("cloudflare.containers.instances.total.active")
				?.points[0],
		).toEqual([TEST_TIMESTAMP, 8]);
		expect(
			findGlobalMetric("cloudflare.containers.instances.total.assigned")
				?.points[0],
		).toEqual([TEST_TIMESTAMP, 7]);
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

	it("includes custom tags when provided", () => {
		const datadogTags = { env: "staging", region: "us-west" };
		const metrics = formatHealthMetrics(
			TEST_ACCOUNT_ID,
			mockContainers,
			TEST_TIMESTAMP,
			datadogTags,
		);

		// All metrics should include custom tags
		const firstMetric = metrics[0];
		expect(firstMetric.tags).toContain("env:staging");
		expect(firstMetric.tags).toContain("region:us-west");
	});

	it("handles invalid datadogTags gracefully", () => {
		const invalidTags = { valid: "tag", invalid: 999 } as unknown;

		const metrics = formatHealthMetrics(
			TEST_ACCOUNT_ID,
			mockContainers,
			TEST_TIMESTAMP,
			invalidTags,
		);

		expect(metrics).toHaveLength(24);
		const firstMetric = metrics[0];
		expect(firstMetric.tags).not.toContain("valid:tag");
		expect(firstMetric.tags).not.toContain("invalid:999");
	});

	it("handles empty datadogTags object", () => {
		const datadogTags = {};

		const metrics = formatHealthMetrics(
			TEST_ACCOUNT_ID,
			mockContainers,
			TEST_TIMESTAMP,
			datadogTags,
		);

		expect(metrics).toHaveLength(24);
		const firstMetric = metrics[0];
		expect(firstMetric.tags).toContain(`account_id:${TEST_ACCOUNT_ID}`);
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

		// Only global totals (8 metrics) when no containers
		expect(metrics).toHaveLength(8);

		for (const metric of metrics) {
			expect(metric.points[0][1]).toBe(0);
		}
	});
});
