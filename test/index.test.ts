import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Worker", () => {
	it("should respond to health check", async () => {
		const response = await SELF.fetch("https://example.com/");
		expect(response.status).toBe(200);

		const data = (await response.json()) as { status: string };
		expect(data.status).toBe("ok");
	});
});
