import { z } from "zod/v4";
import {
	CloudchamberMetricsResponse,
	Container,
	type MetricsGroup,
} from "../types";

export interface CloudflareApiConfig {
	accountId: string;
	apiToken: string;
}

const ContainersListResponseSchema = z.object({
	success: z.boolean(),
	result: z.array(Container),
	errors: z.array(z.unknown()).optional(),
	messages: z.array(z.unknown()).optional(),
});

export interface GraphQLResponse<T> {
	data: T | null;
	errors: { message: string; path: string[] | null }[] | null;
}

const CONTAINERS_METRICS_QUERY = `
query GetCloudchamberMetrics($accountTag: string!, $datetimeStart: Time, $datetimeEnd: Time, $applicationId: string!) {
  viewer {
    accounts(filter: {accountTag: $accountTag}) {
      cloudchamberMetricsAdaptiveGroups(limit: 10000, filter: {applicationId: $applicationId, datetimeMinute_geq: $datetimeStart, datetimeMinute_leq: $datetimeEnd}) {
        max {
          memory
          cpuLoad
          diskUsage
        }
        sum {
          rxBytes
          txBytes
        }
        quantiles {
          memoryP50
          memoryP90
          memoryP99
          diskUsageP50
          diskUsageP90
          diskUsageP99
          cpuLoadP50
          cpuLoadP90
          cpuLoadP99
        }
        dimensions {
          datetimeMinute
          applicationId
          deploymentId
          placementId
        }
      }
    }
  }
}
`;

export class CloudflareApi {
	private readonly baseUrl = "https://api.cloudflare.com/client/v4";
	private readonly graphqlUrl = "https://api.cloudflare.com/client/v4/graphql";

	constructor(private readonly config: CloudflareApiConfig) {}

	private get headers(): HeadersInit {
		return {
			Authorization: `Bearer ${this.config.apiToken}`,
			"Content-Type": "application/json",
		};
	}

	/**
	 * List all container applications in the account
	 */
	async listContainers(): Promise<Container[]> {
		const url = `${this.baseUrl}/accounts/${this.config.accountId}/containers/applications`;

		const response = await fetch(url, {
			headers: this.headers,
		});

		if (!response.ok) {
			throw new Error(
				`Failed to list containers: ${response.status} ${response.statusText}`,
			);
		}

		const data = ContainersListResponseSchema.parse(await response.json());

		if (!data.success) {
			throw new Error(`API error: ${JSON.stringify(data.errors)}`);
		}

		return data.result;
	}

	/**
	 * Get metrics for a container application
	 * @param applicationId - Container application ID
	 * @param startTime - Start of the time range (defaults to 5 minutes ago)
	 * @param endTime - End of the time range (defaults to now)
	 */
	async getContainerMetrics(
		applicationId: string,
		startTime?: Date,
		endTime?: Date,
	): Promise<MetricsGroup[]> {
		const now = endTime ?? new Date();
		const start = startTime ?? new Date(now.getTime() - 5 * 60 * 1000);

		const variables = {
			accountTag: this.config.accountId,
			datetimeStart: start.toISOString(),
			datetimeEnd: now.toISOString(),
			applicationId,
		};

		const response = await fetch(this.graphqlUrl, {
			method: "POST",
			headers: this.headers,
			body: JSON.stringify({
				query: CONTAINERS_METRICS_QUERY,
				variables,
			}),
		});

		if (!response.ok) {
			throw new Error(
				`GraphQL request failed: ${response.status} ${response.statusText}`,
			);
		}

		const data = CloudchamberMetricsResponse.parse(await response.json());

		if (data.errors && data.errors.length > 0) {
			throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
		}

		const groups =
			data.data?.viewer?.accounts?.[0]?.cloudchamberMetricsAdaptiveGroups ?? [];

		console.log("Fetched container metrics", {
			applicationId,
			groupCount: groups.length,
		});

		return groups;
	}
}

/**
 * Create a CloudflareApi instance from environment variables
 */
export function createCloudflareApi(
	accountId: string,
	apiToken: string,
): CloudflareApi {
	return new CloudflareApi({ accountId, apiToken });
}
