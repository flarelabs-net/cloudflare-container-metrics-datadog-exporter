import { describe, expect, it } from "vitest";
import { getMetricsTimeWindow } from "../src/workflow";

describe("schedule helpers", () => {
	it("uses the scheduled minute to calculate the previous complete window", () => {
		const { start, end } = getMetricsTimeWindow(new Date("2026-04-06T10:43:59.999Z").getTime());

		expect(start.toISOString()).toBe("2026-04-06T10:41:00.000Z");
		expect(end.toISOString()).toBe("2026-04-06T10:42:00.000Z");
	});
});
