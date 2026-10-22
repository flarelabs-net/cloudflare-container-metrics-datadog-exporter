import { describe, expect, it, vi } from "vitest";
import { createCloudflareApi } from "../src/api/cloudflare";

describe("CloudflareApi", () => {
	describe("fetcher binding", () => {
		it("uses global fetch without binding errors when no custom fetcher provided", async () => {
			const mockFetch = vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						success: true,
						result: [],
					}),
				),
			);

			// Temporarily replace global fetch
			const originalFetch = globalThis.fetch;
			globalThis.fetch = mockFetch;

			try {
				const api = createCloudflareApi("test-account", "test-token");
				await api.listContainers();

				expect(mockFetch).toHaveBeenCalledTimes(1);
			} finally {
				globalThis.fetch = originalFetch;
			}
		});

		it("uses custom fetcher when provided", async () => {
			const customFetcher = vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						success: true,
						result: [],
					}),
				),
			);

			const api = createCloudflareApi(
				"test-account",
				"test-token",
				customFetcher,
			);
			await api.listContainers();

			expect(customFetcher).toHaveBeenCalledTimes(1);
			expect(customFetcher).toHaveBeenCalledWith(
				"https://api.cloudflare.com/client/v4/accounts/test-account/containers/applications",
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer test-token",
						"User-Agent": "cloudflare-container-metrics-datadog-exporter",
					}),
				}),
			);
		});

		it("lists applications that use Durable Object scheduling", async () => {
			const customFetcher = vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						success: true,
						result: [
							{
								id: "app-default",
								name: "default-app",
								version: 2,
								instances: 7,
								max_instances: 20,
								health: { instances: { active: 230, healthy: 0 } },
							},
							{
								// The shape the API returns for scheduling_policy "durable_object":
								// no version, instances or max_instances.
								id: "app-do",
								name: "do-app",
								scheduling_policy: "durable_object",
								health: { instances: { active: 324, starting: 2 } },
							},
						],
					}),
				),
			);

			const api = createCloudflareApi(
				"test-account",
				"test-token",
				customFetcher,
			);
			const containers = await api.listContainers();

			expect(containers.map((c) => c.name)).toEqual(["default-app", "do-app"]);
			expect(containers[1]?.version).toBeUndefined();
		});

		it("sets a descriptive user agent on GraphQL requests", async () => {
			const customFetcher = vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						data: {
							viewer: {
								accounts: [{ containersMetricsAdaptiveGroups: [] }],
							},
						},
						errors: null,
					}),
				),
			);

			const api = createCloudflareApi(
				"test-account",
				"test-token",
				customFetcher,
			);

			await api.getContainerMetrics(
				"app-id",
				new Date("2026-04-06T10:41:00.000Z"),
				new Date("2026-04-06T10:42:00.000Z"),
			);

			expect(customFetcher).toHaveBeenCalledWith(
				"https://api.cloudflare.com/client/v4/graphql",
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer test-token",
						"User-Agent": "cloudflare-container-metrics-datadog-exporter",
					}),
				}),
			);
		});
	});
});
