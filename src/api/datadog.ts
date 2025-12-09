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

		const errorMessage = await this.parseErrorResponse(response);

		if (!response.ok) {
			const status = response.status;

			// Non-retryable errors: log and return without throwing
			if (status === 400 || status === 401 || status === 403) {
				console.error("Datadog API error (non-retryable)", {
					status,
					error: errorMessage,
				});
				return;
			}

			// Retryable errors (429, 5xx): log and throw to trigger workflow retry
			console.error("Datadog API error (retryable)", {
				status,
				error: errorMessage,
			});
			throw new Error(`Datadog API error (${status}): ${errorMessage}`);
		}
	}

	private async parseErrorResponse(response: Response): Promise<string> {
		try {
			const text = await response.text();
			const json = JSON.parse(text);
			if (json.errors && typeof json.errors === "string") {
				return json.errors;
			}
			return text;
		} catch {
			return "Unknown error";
		}
	}
}

/**
 * Create a DatadogApi instance
 */
export function createDatadogApi(apiKey: string, site?: string): DatadogApi {
	return new DatadogApi({ apiKey, site });
}
