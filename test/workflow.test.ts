import type {
	WorkflowEvent,
	WorkflowStep,
	WorkflowStepConfig,
} from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatadogMetric } from "../src/api/datadog";
import type { ContainersMetricsResponse, MetricsGroup } from "../src/types";
import { MetricsExporterWorkflow } from "../src/workflow";
import { mockContainers, mockMetricsGroups } from "./mocks";

interface MetricsWorkflowParams {
	scheduledTime?: number;
}

const TEST_SCHEDULED_TIME = Date.parse("2026-04-06T10:43:00.000Z");

function makeEnv(overrides: Partial<Env> = {}): Env {
	return {
		CLOUDFLARE_ACCOUNT_ID: "test-account",
		CLOUDFLARE_API_TOKEN: "test-token",
		DATADOG_API_KEY: "test-key",
		DATADOG_SITE: "datadoghq.com",
		BATCH_SIZE: 50,
		RETRY_LIMIT: 3,
		RETRY_DELAY_SECONDS: 1,
		JURISDICTION: "",
		DATADOG_TAGS: {},
		...overrides,
	} as unknown as Env;
}

function makeEvent(
	scheduledTime = TEST_SCHEDULED_TIME,
): WorkflowEvent<MetricsWorkflowParams> {
	return {
		instanceId: "test-instance",
		payload: {},
		timestamp: new Date(scheduledTime),
		schedule: { cron: "* * * * *", scheduledTime },
	} as unknown as WorkflowEvent<MetricsWorkflowParams>;
}

// Workflows enforces a 1 MiB cap on step outputs
const STEP_RESULT_LIMIT_BYTES = 1024 * 1024;

class FakeStep {
	private cache = new Map<
		string,
		{ kind: "value"; value: unknown } | { kind: "stream"; bytes: Uint8Array }
	>();
	public callOrder: string[] = [];
	public attempts = new Map<string, number>();

	async do<T>(
		name: string,
		configOrBody: unknown,
		body?: () => Promise<T>,
	): Promise<T> {
		const fn = (body ?? configOrBody) as () => Promise<T>;
		const config = body ? (configOrBody as WorkflowStepConfig) : undefined;
		const cached = this.cache.get(name);
		if (cached) {
			return this.materialize<T>(cached);
		}
		this.callOrder.push(name);

		const retryLimit = config?.retries?.limit ?? 0;
		let lastError: unknown;
		for (let i = 0; i <= retryLimit; i++) {
			this.attempts.set(name, (this.attempts.get(name) ?? 0) + 1);
			try {
				const result = await fn();
				const entry = await this.persist(name, result);
				this.cache.set(name, entry);
				return this.materialize<T>(entry);
			} catch (error) {
				lastError = error;
			}
		}

		throw lastError;
	}

	private async persist(
		name: string,
		result: unknown,
	): Promise<
		{ kind: "value"; value: unknown } | { kind: "stream"; bytes: Uint8Array }
	> {
		if (result instanceof ReadableStream) {
			const bytes = new Uint8Array(await new Response(result).arrayBuffer());
			return { kind: "stream", bytes };
		}
		if (result !== undefined) {
			const serialized = JSON.stringify(result);
			if (
				serialized !== undefined &&
				serialized.length > STEP_RESULT_LIMIT_BYTES
			) {
				throw new Error(
					`Step ${name}: output is too large. Maximum allowed size is 1MiB.`,
				);
			}
		}
		return { kind: "value", value: result };
	}

	private materialize<T>(
		entry:
			| { kind: "value"; value: unknown }
			| { kind: "stream"; bytes: Uint8Array },
	): T {
		if (entry.kind === "stream") {
			return new Response(entry.bytes).body as unknown as T;
		}
		return entry.value as T;
	}
}

function asWorkflowStep(step: FakeStep): WorkflowStep {
	return step as unknown as WorkflowStep;
}

function runWorkflow(
	env: Env,
	event: WorkflowEvent<MetricsWorkflowParams>,
	step: WorkflowStep,
) {
	return MetricsExporterWorkflow.prototype.run.call(
		{ env } as MetricsExporterWorkflow,
		event,
		step,
	);
}

function buildMetricsResponse(
	applicationId: string,
	numPlacements = mockMetricsGroups.length,
): ContainersMetricsResponse {
	const baseGroup = mockMetricsGroups[0];
	const groups: MetricsGroup[] = Array.from(
		{ length: numPlacements },
		(_, i) => ({
			...baseGroup,
			dimensions: {
				...baseGroup.dimensions,
				applicationId,
				placementId: `placement-${applicationId}-${i}`,
				deploymentId: `deployment-${applicationId}-${i}`,
				durableObjectId: `do-${applicationId}-${i}`,
			},
		}),
	);
	return {
		data: {
			viewer: { accounts: [{ containersMetricsAdaptiveGroups: groups }] },
		},
		errors: null,
	};
}

interface FetchMockOptions {
	containersList?: typeof mockContainers;
	graphqlResponse?: (applicationId: string, callIndex: number) => unknown;
	datadogResponse?: (
		seriesPayload: { series: DatadogMetric[] },
		callIndex: number,
	) => Response;
}

function buildFetchMock(options: FetchMockOptions = {}) {
	const containers = options.containersList ?? mockContainers;
	const graphqlResponse =
		options.graphqlResponse ?? ((appId: string) => buildMetricsResponse(appId));
	const datadogResponse =
		options.datadogResponse ??
		((): Response => new Response(null, { status: 202 }));

	const graphqlCallsByApp = new Map<string, number>();
	let datadogCallIndex = 0;

	return vi.fn(
		async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
			const url = String(input instanceof Request ? input.url : input);
			const body = init?.body ? JSON.parse(String(init.body)) : undefined;

			if (url.endsWith("/containers/applications")) {
				return Response.json({ success: true, result: containers });
			}
			if (url.endsWith("/graphql")) {
				const appId = body.variables.applicationId as string;
				const callIndex = graphqlCallsByApp.get(appId) ?? 0;
				graphqlCallsByApp.set(appId, callIndex + 1);
				return Response.json(graphqlResponse(appId, callIndex));
			}
			if (url.includes("api.datadoghq.com")) {
				const callIndex = datadogCallIndex++;
				return datadogResponse(body, callIndex);
			}
			throw new Error(`unmocked fetch: ${url}`);
		},
	);
}

function callsTo(
	mock: ReturnType<typeof buildFetchMock>,
	predicate: (url: string) => boolean,
) {
	return mock.mock.calls.filter((c) => predicate(String(c[0])));
}

function isHealthMetric(metric: DatadogMetric) {
	return metric.metric.startsWith("cloudflare.containers.instances.");
}

function seriesKey(metric: DatadogMetric) {
	return `${metric.metric}|${[...metric.tags].sort().join(",")}|${JSON.stringify(metric.points)}`;
}

describe("MetricsExporterWorkflow", () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	describe("step structure", () => {
		it("emits Title Case steps in dependency order", async () => {
			globalThis.fetch = buildFetchMock() as typeof fetch;
			const fakeStep = new FakeStep();

			await runWorkflow(makeEnv(), makeEvent(), asWorkflowStep(fakeStep));

			expect(fakeStep.callOrder).toContain("List Containers");
			expect(fakeStep.callOrder).toContain("Export Health Metrics");
			expect(fakeStep.callOrder.indexOf("List Containers")).toBe(0);
			const healthIndex = fakeStep.callOrder.indexOf("Export Health Metrics");
			for (const c of mockContainers) {
				const fetchIndex = fakeStep.callOrder.indexOf(
					`Fetch Metrics: ${c.name}`,
				);
				expect(fetchIndex).toBeGreaterThan(-1);
				const batchSteps = fakeStep.callOrder.filter((n) =>
					n.startsWith(`Export Metrics: ${c.name} Batch `),
				);
				expect(batchSteps.length).toBeGreaterThan(0);
				for (const batchStep of batchSteps) {
					expect(fakeStep.callOrder.indexOf(batchStep)).toBeGreaterThan(
						fetchIndex,
					);
					expect(fakeStep.callOrder.indexOf(batchStep)).toBeLessThan(
						healthIndex,
					);
				}
			}
		});

		it("retries a failed step body according to retry config", async () => {
			const fakeStep = new FakeStep();
			let attempts = 0;

			const result = await fakeStep.do(
				"Retrying Step",
				{ retries: { limit: 1, delay: "1 second", backoff: "constant" } },
				async () => {
					attempts++;
					if (attempts === 1) {
						throw new Error("try again");
					}
					return "ok";
				},
			);

			expect(result).toBe("ok");
			expect(attempts).toBe(2);
			expect(fakeStep.attempts.get("Retrying Step")).toBe(2);
		});

		it("produces an identical step name set across two fresh runs given identical input", async () => {
			const env = makeEnv({ BATCH_SIZE: 5 });
			globalThis.fetch = buildFetchMock() as typeof fetch;

			const step1 = new FakeStep();
			const step2 = new FakeStep();
			await runWorkflow(env, makeEvent(), asWorkflowStep(step1));
			await runWorkflow(env, makeEvent(), asWorkflowStep(step2));

			expect([...step1.callOrder].sort()).toEqual([...step2.callOrder].sort());
		});

		it("step names stay stable across attempts even when GraphQL would return a larger response on retry", async () => {
			// Each successive call to the GraphQL endpoint for a given app id
			// returns more placements than the last (2, 4, 6, ...).
			globalThis.fetch = buildFetchMock({
				graphqlResponse: (appId, callIndex) =>
					buildMetricsResponse(appId, (callIndex + 1) * 2),
			}) as typeof fetch;

			const fakeStep = new FakeStep();
			const env = makeEnv({ BATCH_SIZE: 5 });

			await runWorkflow(env, makeEvent(), asWorkflowStep(fakeStep));
			const callsAfterAttempt1 = [...fakeStep.callOrder];

			await runWorkflow(env, makeEvent(), asWorkflowStep(fakeStep));

			expect(fakeStep.callOrder).toEqual(callsAfterAttempt1);

			const graphqlCalls = callsTo(
				globalThis.fetch as ReturnType<typeof buildFetchMock>,
				(u) => u.endsWith("/graphql"),
			);
			expect(graphqlCalls).toHaveLength(mockContainers.length);
		});
	});

	describe("retry idempotency", () => {
		it("exports container metrics before health metrics so health failures do not block them", async () => {
			const datadogPayloads: DatadogMetric[][] = [];
			const fetchMock = buildFetchMock({
				datadogResponse: (payload) => {
					datadogPayloads.push(payload.series);
					if (payload.series.some(isHealthMetric)) {
						return new Response("retry me", { status: 503 });
					}
					return new Response(null, { status: 202 });
				},
			});
			globalThis.fetch = fetchMock as typeof fetch;
			const fakeStep = new FakeStep();

			await expect(
				runWorkflow(
					makeEnv({ BATCH_SIZE: 1000, RETRY_LIMIT: 0 }),
					makeEvent(),
					asWorkflowStep(fakeStep),
				),
			).rejects.toThrow();

			expect(callsTo(fetchMock, (u) => u.endsWith("/graphql"))).toHaveLength(
				mockContainers.length,
			);
			const firstContainerMetricIndex = datadogPayloads.findIndex((series) =>
				series.some((m) => m.metric === "cloudflare.containers.cpu"),
			);
			const healthMetricIndex = datadogPayloads.findIndex((series) =>
				series.some(isHealthMetric),
			);

			expect(firstContainerMetricIndex).toBeGreaterThanOrEqual(0);
			expect(healthMetricIndex).toBeGreaterThan(firstContainerMetricIndex);
		});

		it("uses a stable timestamp for health metrics across step retries", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date(TEST_SCHEDULED_TIME));
			const healthTimestamps: number[] = [];
			let healthAttempts = 0;

			const fetchMock = buildFetchMock({
				datadogResponse: (payload) => {
					if (payload.series.some(isHealthMetric)) {
						healthTimestamps.push(payload.series[0].points[0][0]);
						healthAttempts++;
						if (healthAttempts === 1) {
							vi.setSystemTime(new Date(TEST_SCHEDULED_TIME + 60_000));
							return new Response("retry me", { status: 503 });
						}
					}
					return new Response(null, { status: 202 });
				},
			});
			globalThis.fetch = fetchMock as typeof fetch;

			try {
				await runWorkflow(
					makeEnv({ BATCH_SIZE: 1000, RETRY_LIMIT: 1 }),
					makeEvent(),
					asWorkflowStep(new FakeStep()),
				);
			} finally {
				vi.useRealTimers();
			}

			expect(healthTimestamps).toEqual([
				Math.floor(TEST_SCHEDULED_TIME / 1000),
				Math.floor(TEST_SCHEDULED_TIME / 1000),
			]);
		});

		it("exports container metrics with custom tags and GraphQL timestamps", async () => {
			const datadogPayloads: DatadogMetric[][] = [];
			const fetchMock = buildFetchMock({
				datadogResponse: (payload) => {
					datadogPayloads.push(payload.series);
					return new Response(null, { status: 202 });
				},
			});
			globalThis.fetch = fetchMock as typeof fetch;

			await runWorkflow(
				makeEnv({ BATCH_SIZE: 1000, DATADOG_TAGS: { env: "test" } }),
				makeEvent(),
				asWorkflowStep(new FakeStep()),
			);

			const containerMetric = datadogPayloads
				.flat()
				.find((metric) => metric.metric === "cloudflare.containers.cpu");

			expect(containerMetric).toBeDefined();
			expect(containerMetric?.tags).toContain("env:test");
			expect(containerMetric?.points[0][0]).toBe(
				Math.floor(
					Date.parse(mockMetricsGroups[0].dimensions.datetimeMinute) / 1000,
				),
			);
		});

		it("does not re-send any Datadog batch successfully accepted on a prior attempt", async () => {
			const env = makeEnv({ BATCH_SIZE: 1000, RETRY_LIMIT: 0 });
			const acceptedSeries: DatadogMetric[][] = [];
			let attempt = 1;

			const fetchMock = buildFetchMock({
				datadogResponse: (payload, callIndex) => {
					if (attempt === 1 && callIndex >= 1) {
						return new Response("Service Unavailable", { status: 503 });
					}
					acceptedSeries.push(payload.series);
					return new Response(null, { status: 202 });
				},
			});
			globalThis.fetch = fetchMock as typeof fetch;

			const fakeStep = new FakeStep();

			await expect(
				runWorkflow(env, makeEvent(), asWorkflowStep(fakeStep)),
			).rejects.toThrow();
			expect(acceptedSeries.length).toBeGreaterThan(0);
			const acceptedSeriesCountAfterAttempt1 = acceptedSeries.length;
			const acceptedOnAttempt1 = new Set(
				acceptedSeries.flatMap((series) => series.map(seriesKey)),
			);

			attempt = 2;
			await runWorkflow(env, makeEvent(), asWorkflowStep(fakeStep));

			expect(
				callsTo(fetchMock, (u) => u.endsWith("/containers/applications")),
			).toHaveLength(1);

			expect(callsTo(fetchMock, (u) => u.endsWith("/graphql"))).toHaveLength(
				mockContainers.length,
			);

			for (const series of acceptedSeries.slice(
				acceptedSeriesCountAfterAttempt1,
			)) {
				for (const m of series) {
					const key = seriesKey(m);
					expect(
						acceptedOnAttempt1.has(key),
						`re-sent accepted Datadog series: ${key}`,
					).toBe(false);
				}
			}
		});

		it("does not re-send batches for a container whose batches already succeeded on a prior attempt", async () => {
			// One batch per container makes the Datadog call sequence
			// deterministic: index 0 = container A, 1 = container B, 2 = health.
			const env = makeEnv({ BATCH_SIZE: 1000, RETRY_LIMIT: 0 });
			const acceptedSeries: DatadogMetric[][] = [];
			let attempt = 1;

			const fetchMock = buildFetchMock({
				datadogResponse: (payload, callIndex) => {
					// On attempt 1, fail after both container batches are accepted.
					if (attempt === 1 && callIndex >= 2) {
						return new Response("retry me", { status: 503 });
					}
					acceptedSeries.push(payload.series);
					return new Response(null, { status: 202 });
				},
			});
			globalThis.fetch = fetchMock as typeof fetch;

			const fakeStep = new FakeStep();

			await expect(
				runWorkflow(env, makeEvent(), asWorkflowStep(fakeStep)),
			).rejects.toThrow();

			attempt = 2;
			await runWorkflow(env, makeEvent(), asWorkflowStep(fakeStep));

			const firstContainer = mockContainers[0];
			const firstAppGraphqlCalls = fetchMock.mock.calls.filter((c) => {
				if (!String(c[0]).endsWith("/graphql")) return false;
				const init = c[1] as RequestInit | undefined;
				const body = init?.body ? JSON.parse(String(init.body)) : undefined;
				return body?.variables?.applicationId === firstContainer.id;
			});
			expect(firstAppGraphqlCalls).toHaveLength(1);

			const seen = new Set<string>();
			for (const series of acceptedSeries) {
				for (const m of series) {
					const key = seriesKey(m);
					expect(seen.has(key), `duplicate Datadog series: ${key}`).toBe(false);
					seen.add(key);
				}
			}
			expect(seen.size).toBeGreaterThan(0);
		});

		it("does not re-send successful batches when a later batch in the same container fails", async () => {
			const env = makeEnv({ BATCH_SIZE: 17, RETRY_LIMIT: 0 });
			const acceptedSeries: DatadogMetric[][] = [];
			let attempt = 1;

			const fetchMock = buildFetchMock({
				containersList: [mockContainers[0]],
				graphqlResponse: (appId) => buildMetricsResponse(appId, 4),
				datadogResponse: (payload) => {
					const placementTags = payload.series.flatMap((metric) =>
						metric.tags.filter((tag) => tag.startsWith("placement_id:")),
					);
					if (
						attempt === 1 &&
						placementTags.some((tag) => tag.endsWith("-2"))
					) {
						return new Response("retry me", { status: 503 });
					}
					acceptedSeries.push(payload.series);
					return new Response(null, { status: 202 });
				},
			});
			globalThis.fetch = fetchMock as typeof fetch;
			const fakeStep = new FakeStep();

			await expect(
				runWorkflow(env, makeEvent(), asWorkflowStep(fakeStep)),
			).rejects.toThrow();

			const acceptedSeriesCountAfterAttempt1 = acceptedSeries.length;
			const acceptedOnAttempt1 = new Set(
				acceptedSeries.flatMap((series) => series.map(seriesKey)),
			);
			expect(acceptedSeriesCountAfterAttempt1).toBeGreaterThan(1);

			attempt = 2;
			await runWorkflow(env, makeEvent(), asWorkflowStep(fakeStep));

			for (const series of acceptedSeries.slice(
				acceptedSeriesCountAfterAttempt1,
			)) {
				for (const metric of series) {
					const key = seriesKey(metric);
					expect(
						acceptedOnAttempt1.has(key),
						`re-sent accepted Datadog series: ${key}`,
					).toBe(false);
				}
			}
		});
	});

	describe("large payloads", () => {
		it("processes a Fetch Metrics step whose serialized output exceeds 1 MiB", async () => {
			const groupsPerContainer = 2500;
			const fetchMock = buildFetchMock({
				containersList: [mockContainers[0]],
				graphqlResponse: (appId) =>
					buildMetricsResponse(appId, groupsPerContainer),
			});
			globalThis.fetch = fetchMock as typeof fetch;
			const fakeStep = new FakeStep();

			const result = await runWorkflow(
				makeEnv({ BATCH_SIZE: 5000 }),
				makeEvent(),
				asWorkflowStep(fakeStep),
			);

			expect(result.status).toBe("completed");
			// 17 Datadog metrics per group: 4 cpu (p50/p90/p99/max) + 1 cpu.time
			// + 4 memory + 4 disk + 1 disk.available + 2 bandwidth + 1 uptime.
			expect(result.metricsCount).toBe(groupsPerContainer * 17);

			// Sanity-check that the payload really would have exceeded 1 MiB if it were not streamed
			const sampleSize = JSON.stringify(
				Array.from({ length: groupsPerContainer }, (_, i) => ({
					...mockMetricsGroups[0],
					dimensions: {
						...mockMetricsGroups[0].dimensions,
						placementId: `placement-${mockContainers[0].id}-${i}`,
						deploymentId: `deployment-${mockContainers[0].id}-${i}`,
						durableObjectId: `do-${mockContainers[0].id}-${i}`,
					},
				})),
			).length;
			expect(sampleSize).toBeGreaterThan(STEP_RESULT_LIMIT_BYTES);
		});
	});

	describe("env validation", () => {
		it("fails fast with a non-retryable error when required env vars are missing", async () => {
			const fetchMock = buildFetchMock();
			globalThis.fetch = fetchMock as typeof fetch;
			const fakeStep = new FakeStep();

			await expect(
				runWorkflow(
					makeEnv({ CLOUDFLARE_API_TOKEN: "", DATADOG_API_KEY: "" }),
					makeEvent(),
					asWorkflowStep(fakeStep),
				),
			).rejects.toThrow(/Missing required environment variables/);

			// Validation runs before any work, so no steps or fetches occur.
			expect(fakeStep.callOrder).toHaveLength(0);
			expect(fetchMock).not.toHaveBeenCalled();
		});
	});
});
