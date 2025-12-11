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
					}),
				}),
			);
		});
	});
});
