import { describe, expect, it, vi } from "vitest";
import { formatHealthMetrics, formatMetricsForContainer } from "../src/metrics";
import { chunk } from "../src/utils";
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
		const metrics = formatMetricsForContainer(TEST_ACCOUNT_ID, container, [
			mockMetricsGroups[0],
		]);

		// 5 CPU + 4 Memory + 5 Disk + 2 Bandwidth + 1 Uptime = 17 metrics per group
		expect(metrics).toHaveLength(17);
	});

	it("formats multiple metrics groups", () => {
		const container = { id: "app-123", name: "my-app", version: 1 };
		const metrics = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			mockMetricsGroups, // 2 groups
		);

		// 2 groups * 17 metrics = 34 metrics
		expect(metrics).toHaveLength(34);
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

		const metrics = formatMetricsForContainer(TEST_ACCOUNT_ID, container, [
			group,
		]);

		const cpuMetric = metrics.find(
			(m) =>
				m.metric === "cloudflare.containers.cpu" && m.tags.includes("stat:p50"),
		);

		expect(cpuMetric).toBeDefined();
		expect(cpuMetric?.tags).toContain(`account_id:${TEST_ACCOUNT_ID}`);
		expect(cpuMetric?.tags).toContain("application_id:app-test");
		expect(cpuMetric?.tags).toContain("application_name:my-app");
		expect(cpuMetric?.tags).toContain("version:1");
		expect(cpuMetric?.tags).toContain("instance_id:do-test-456");
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

		const metrics = formatMetricsForContainer(TEST_ACCOUNT_ID, container, [
			group,
		]);

		const cpuMetric = metrics.find(
			(m) =>
				m.metric === "cloudflare.containers.cpu" && m.tags.includes("stat:p50"),
		);

		expect(cpuMetric).toBeDefined();
		expect(
			cpuMetric?.tags.some((t) => t.startsWith("durable_object_id:")),
		).toBe(false);

		// instance_id falls back to deployment_id when there is no DO
		expect(cpuMetric?.tags).toContain("instance_id:instance-test");
	});

	it("omits version tag when the application has none", () => {
		const container = { id: "app-123", name: "my-app" };
		const group = createMockMetricsGroup();

		const metrics = formatMetricsForContainer(TEST_ACCOUNT_ID, container, [
			group,
		]);

		expect(metrics.length).toBeGreaterThan(0);
		for (const metric of metrics) {
			expect(metric.tags.some((t) => t.startsWith("version:"))).toBe(false);
		}
	});

	it("includes custom tags when provided", () => {
		const container = { id: "app-123", name: "my-app", version: 1 };
		const datadogTags = { env: "production", team: "platform" };
		const metrics = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			[mockMetricsGroups[0]],
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

		const consoleWarnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => {});

		const metrics = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			[mockMetricsGroups[0]],
			invalidTags,
		);

		expect(metrics).toHaveLength(17);
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
			datadogTags,
		);

		expect(metrics).toHaveLength(17);
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
			undefined,
		);

		expect(metrics).toHaveLength(17);
		const cpuMetric = metrics.find(
			(m) =>
				m.metric === "cloudflare.containers.cpu" && m.tags.includes("stat:p50"),
		);
		expect(cpuMetric).toBeDefined();
		expect(cpuMetric?.tags).toContain(`account_id:${TEST_ACCOUNT_ID}`);
	});

	it("returns empty array for no metrics groups", () => {
		const container = { id: "app-123", name: "my-app", version: 1 };
		const metrics = formatMetricsForContainer(TEST_ACCOUNT_ID, container, []);
		expect(metrics).toHaveLength(0);
	});

	it("is deterministic", () => {
		const container = { id: "app-123", name: "my-app", version: 1 };
		const datadogTags = { env: "production", team: "platform" };

		const first = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			mockMetricsGroups,
			datadogTags,
		);
		const second = formatMetricsForContainer(
			TEST_ACCOUNT_ID,
			container,
			mockMetricsGroups,
			datadogTags,
		);

		expect(second).toEqual(first);
	});
});

describe("formatHealthMetrics", () => {
	it("is deterministic when the caller provides a timestamp", () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date("2026-04-06T10:43:00.000Z"));
			const first = formatHealthMetrics(
				TEST_ACCOUNT_ID,
				mockContainers,
				TEST_TIMESTAMP,
			);

			vi.setSystemTime(new Date("2026-04-06T10:44:00.000Z"));
			const second = formatHealthMetrics(
				TEST_ACCOUNT_ID,
				mockContainers,
				TEST_TIMESTAMP,
			);

			expect(second).toEqual(first);
		} finally {
			vi.useRealTimers();
		}
	});

	it("uses the provided timestamp for every health metric point", () => {
		const metrics = formatHealthMetrics(
			TEST_ACCOUNT_ID,
			mockContainers,
			TEST_TIMESTAMP,
		);

		for (const metric of metrics) {
			expect(metric.points[0][0]).toBe(TEST_TIMESTAMP);
		}
	});

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

describe("APPLICATION_NAME_TAGS", () => {
	const shardRule = { app_group: "^(.+?)(?:-s\\d+)?$" };

	it("tags resource metrics with the capture group of the application name", () => {
		for (const name of ["my-app", "my-app-s1", "my-app-s15"]) {
			const metrics = formatMetricsForContainer(
				TEST_ACCOUNT_ID,
				{ id: "app-123", name, version: 1 },
				[mockMetricsGroups[0]],
				undefined,
				shardRule,
			);
			for (const metric of metrics) {
				expect(metric.tags).toContain("app_group:my-app");
				expect(metric.tags).toContain(`application_name:${name}`);
			}
		}
	});

	it("tags per-application health metrics but not the account totals", () => {
		const containers = [
			{ id: "a", name: "my-app", version: 1, max_instances: 10 },
			{ id: "b", name: "my-app-s2", version: 1, max_instances: 10 },
		];
		const metrics = formatHealthMetrics(
			TEST_ACCOUNT_ID,
			containers,
			TEST_TIMESTAMP,
			undefined,
			shardRule,
		);
		const perApp = metrics.filter((m) => !m.metric.includes(".total."));
		const totals = metrics.filter((m) => m.metric.includes(".total."));
		expect(perApp.length).toBeGreaterThan(0);
		for (const metric of perApp) {
			expect(metric.tags).toContain("app_group:my-app");
		}
		for (const metric of totals) {
			expect(metric.tags.some((t) => t.startsWith("app_group:"))).toBe(false);
		}
	});

	it("adds nothing when the pattern does not match", () => {
		const metrics = formatHealthMetrics(
			TEST_ACCOUNT_ID,
			[{ id: "a", name: "other", version: 1 }],
			TEST_TIMESTAMP,
			undefined,
			{ app_group: "^my-(.+)$" },
		);
		for (const metric of metrics) {
			expect(metric.tags.some((t) => t.startsWith("app_group:"))).toBe(false);
		}
	});

	it("ignores an invalid pattern and keeps the valid ones", () => {
		const consoleWarnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => {});
		const metrics = formatHealthMetrics(
			TEST_ACCOUNT_ID,
			[{ id: "a", name: "my-app-s3", version: 1 }],
			TEST_TIMESTAMP,
			undefined,
			{ broken: "(", ...shardRule },
		);
		const active = metrics.find(
			(m) => m.metric === "cloudflare.containers.instances.active",
		);
		expect(active?.tags).toContain("app_group:my-app");
		expect(active?.tags.some((t) => t.startsWith("broken:"))).toBe(false);
		expect(consoleWarnSpy).toHaveBeenCalledWith(
			"Invalid APPLICATION_NAME_TAGS pattern, ignoring tag",
			expect.objectContaining({ key: "broken" }),
		);
		consoleWarnSpy.mockRestore();
	});

	it("ignores a config that is not a string map", () => {
		const consoleWarnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => {});
		const metrics = formatHealthMetrics(
			TEST_ACCOUNT_ID,
			[{ id: "a", name: "my-app", version: 1 }],
			TEST_TIMESTAMP,
			undefined,
			{ app_group: 123 },
		);
		expect(metrics.length).toBeGreaterThan(0);
		expect(consoleWarnSpy).toHaveBeenCalledWith(
			"Invalid APPLICATION_NAME_TAGS format, ignoring application name tags",
			expect.objectContaining({ error: expect.any(String) }),
		);
		consoleWarnSpy.mockRestore();
	});
});
