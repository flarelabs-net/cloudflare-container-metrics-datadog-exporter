export type DatadogPoint = [number, number];

export interface DatadogMetric {
	metric: string;
	type: "gauge" | "count" | "rate";
	points: DatadogPoint[];
	tags: string[];
}

export interface DatadogApiConfig {
	/**
	 * Datadog API key
	 */
	apiKey: string;

	/**
	 * Datadog site (default: 'datadoghq.com')
	 */
	site?: string;
}

const METRICS_SERIES_ENDPOINT = "api/v1/series";

export class DatadogApi {
	private readonly apiKey: string;
	private readonly site: string;
	private readonly endpoint: string;

	constructor(config: DatadogApiConfig) {
		this.apiKey = config.apiKey;
		this.site = config.site ?? "datadoghq.com";
		this.endpoint = `https://api.${this.site}/${METRICS_SERIES_ENDPOINT}`;
	}

	/**
	 * Send metrics to Datadog
	 */
	async sendMetrics(metrics: DatadogMetric[]): Promise<void> {
		if (metrics.length === 0) {
			return;
		}

		console.log("Sending metrics to Datadog", {
			count: metrics.length,
			site: this.site,
		});

		const response = await fetch(this.endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"DD-API-KEY": this.apiKey,
			},
			body: JSON.stringify({ series: metrics }),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Datadog API error (${response.status}): ${text}`);
		} else {
			// This way we can avoid worker logs about stalled http responses
			await response.text();
		}
	}
}

/**
 * Create a DatadogApi instance
 */
export function createDatadogApi(apiKey: string, site?: string): DatadogApi {
	return new DatadogApi({ apiKey, site });
}
