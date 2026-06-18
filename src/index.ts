export { MetricsExporterWorkflow } from "./workflow";
export { RequestProxy } from "./request-proxy";

export default {
	async fetch(_req: Request): Promise<Response> {
		return Response.json({ status: "ok" });
	},
};
