import { DurableObject } from "cloudflare:workers";

/**
 * Durable Object that proxies fetch requests from a specific region.
 * Used to ensure GraphQL queries run in a region close to the data source.
 */
export class RequestProxy extends DurableObject<Env> {
	async fetch(request: Request): Promise<Response> {
		return fetch(request);
	}
}
