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

		it("sets a descriptive user agent on GraphQL requests", async () => {
			const customFetcher = vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						data: {
							viewer: {
								accounts: [{ cloudchamberMetricsAdaptiveGroups: [] }],
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
