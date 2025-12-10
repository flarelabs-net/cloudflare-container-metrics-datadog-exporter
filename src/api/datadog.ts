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

			// Handle 413 Payload Too Large specifically
			if (status === 413) {
				console.error("Datadog API error: Payload too large", {
					status,
					error: errorMessage,
					hint: "Reduce the BATCH_SIZE in your workflow configuration to send fewer metrics per request",
				});
				return;
			}

			// Only retry 429 (rate limit) and 5xx (server errors)
			const isRetryable = status === 429 || (status >= 500 && status < 600);

			if (isRetryable) {
				// Retryable errors: log and throw to trigger workflow retry
				console.error("Datadog API error (retryable)", {
					status,
					error: errorMessage,
				});
				throw new Error(`Datadog API error (${status}): ${errorMessage}`);
			}

			// All other errors are non-retryable: log and return without throwing
			console.error("Datadog API error (non-retryable)", {
				status,
				error: errorMessage,
			});
			return;
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
