import { describe, expect, it } from "vitest";
import { getMetricsTimeWindow, getMetricsWindowMinutes } from "../src/workflow";

describe("schedule helpers", () => {
	it("defaults to a 1-minute metrics window when unset", () => {
		const { start, end } = getMetricsTimeWindow(
			new Date("2026-04-06T10:43:59.999Z").getTime(),
		);

		expect(start.toISOString()).toBe("2026-04-06T10:41:00.000Z");
		expect(end.toISOString()).toBe("2026-04-06T10:42:00.000Z");
	});

	it("uses the configured window length in minutes", () => {
		const { start, end } = getMetricsTimeWindow(
			new Date("2026-04-06T10:45:12.345Z").getTime(),
			5,
		);

		expect(start.toISOString()).toBe("2026-04-06T10:39:00.000Z");
		expect(end.toISOString()).toBe("2026-04-06T10:44:00.000Z");
	});

	it("parses a dashboard string or wrangler number for metrics window", () => {
		expect(getMetricsWindowMinutes("5")).toBe(5);
		expect(getMetricsWindowMinutes(10)).toBe(10);
		expect(getMetricsWindowMinutes(undefined)).toBe(1);
		expect(getMetricsWindowMinutes("invalid")).toBe(1);
		expect(getMetricsWindowMinutes(0)).toBe(1);
	});
});
