# Container Metrics Exporter

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/flarelabs-net/cloudflare-container-metrics-datadog-exporter.git)

Exports Cloudflare Containers metrics to Datadog using the [Cloudflare GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/). Runs as a [Cloudflare Workflow](https://developers.cloudflare.com/workflows/) triggered every minute to scrape metrics for all containers in an account.

## Setup

### Requirements

- Node.js 24+
- npm

### Installation

```bash
git clone https://github.com/flarelabs-net/cloudflare-container-metrics-datadog-exporter.git
cd cloudflare-container-metrics-datadog-exporter
npm install
```

### Configuration

```bash
npm run token-setup
```

This will prompt for your Cloudflare Account ID, open the browser to create an API token with the required permissions, and collect your Datadog API Key. It automatically creates a `.dev.vars` file.

#### Optional: Jurisdiction

To run GraphQL queries from a specific jurisdiction (closer to the data source), set the `JURISDICTION` variable in `wrangler.jsonc`:

```jsonc
"vars": {
  "BATCH_SIZE": 5000,
  "RETRY_LIMIT": 3,
  "RETRY_DELAY_SECONDS": 1,
  "JURISDICTION": "eu", // e.g., "eu", "fedramp"
  "DATADOG_TAGS": {}
}
```

This uses a Durable Object to proxy requests from the specified jurisdiction.

#### Optional: Custom Datadog Tags

Add custom tags to all metrics by setting the `DATADOG_TAGS` variable in `wrangler.jsonc`:

```jsonc
"vars": {
  "BATCH_SIZE": 5000,
  "RETRY_LIMIT": 3,
  "RETRY_DELAY_SECONDS": 1,
  "JURISDICTION": "eu",
  "DATADOG_TAGS": {
    "env": "production",
    "team": "platform",
    "service": "containers"
  }
}
```

These tags will be added to all health and resource metrics sent to Datadog.

### Verify

```bash
npx wrangler dev
```
In another terminal, trigger a workflow instance manually:

```
npx wrangler workflows trigger metrics-exporter-workflow --local
```
You should see logs from the exporter in the `wrangler dev` terminal.

The workflow otherwise runs automatically every minute via the `schedules` configured on the Workflow binding in `wrangler.jsonc`.


Alternatively, you can hit "e" in the same terminal as your wrangler dev to take you to a local explorer dashboard. From there, manually trigger the workflow.

### Deploy

```bash
npx wrangler deploy
npx wrangler secret bulk .dev.vars
```

## Metrics

All metrics are prefixed with `cloudflare.containers.`.

### Instance Health (per-application)

| Metric | Type | Description |
|--------|------|-------------|
| `instances.active` | gauge | Number of active instances |
| `instances.assigned` | gauge | Number of assigned instances |
| `instances.healthy` | gauge | Number of healthy instances |
| `instances.stopped` | gauge | Number of stopped instances |
| `instances.failed` | gauge | Number of failed instances |
| `instances.scheduling` | gauge | Number of scheduling instances |
| `instances.starting` | gauge | Number of starting instances |
| `instances.max` | gauge | Max instances configured |

**Tags:** `account_id`, `application_id`, `application_name`

### Instance Health (global totals)

| Metric | Type | Description |
|--------|------|-------------|
| `instances.total.active` | gauge | Total active instances |
| `instances.total.assigned` | gauge | Total assigned instances |
| `instances.total.healthy` | gauge | Total healthy instances |
| `instances.total.stopped` | gauge | Total stopped instances |
| `instances.total.failed` | gauge | Total failed instances |
| `instances.total.scheduling` | gauge | Total scheduling instances |
| `instances.total.starting` | gauge | Total starting instances |
| `instances.total.max` | gauge | Total max instances |

**Tags:** `account_id`

Use `instances.total.max - instances.total.healthy` to calculate available capacity.

### Resource Metrics

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `cpu` | gauge | ratio | CPU utilization with `stat=max|p50|p90|p99` |
| `cpu.time` | count | seconds | CPU time consumed over the interval |
| `memory` | gauge | bytes | Memory usage with `stat=max|p50|p90|p99` |
| `disk` | gauge | bytes | Disk usage with `stat=max|p50|p90|p99` |
| `disk.available` | gauge | bytes | Available disk capacity |
| `bandwidth.rx` | count | bytes | Bytes received over the interval |
| `bandwidth.tx` | count | bytes | Bytes transmitted over the interval |
| `uptime` | gauge | ms | Container uptime |

**Tags:** `account_id`, `application_id`, `application_name`, `version`, `instance_id`, `placement_id`, `stat`

- `version` - The container application version number
- `instance_id` - The instance identifier (same as the ID seen in the Cloudflare dashboard)
- `placement_id` - The placement identifier (specific realization of an instance, useful for tracking restarts/churn)
- `stat` - Present on aggregated gauge families and can be `max`, `p50`, `p90`, or `p99`

## Datadog Dashboard

A pre-built dashboard is included in `datadog-dashboard.json`. To import it:

1. In Datadog, go to **Dashboards** → **New Dashboard** → **New Dashboard**
2. Click the cog icon (⚙️) in the top right
3. Select **Import dashboard JSON**
4. Paste the contents of `datadog-dashboard.json`

See [Datadog's documentation](https://docs.datadoghq.com/dashboards/configure/#copy-import-or-export-dashboard-json) for more details.

## Workflow Behavior

The exporter runs as a Cloudflare Workflow triggered every minute by a [scheduled Workflow](https://developers.cloudflare.com/workflows/build/trigger-workflows/#schedule-a-workflow-directly) (the `schedules` array on the Workflow binding in `wrangler.jsonc`). The platform creates a new Workflow instance on each cron firing — no separate `scheduled` Worker handler is required. Each workflow step uses configurable retry settings:

- **Retries**: Configurable via `RETRY_LIMIT` (default: 3 attempts)
- **Delay**: Configurable via `RETRY_DELAY_SECONDS` (default: 1 second initial delay)
- **Backoff**: Exponential (e.g., 1s, 2s, 4s)

Steps will automatically retry on transient failures (API errors, network issues).

### Configuration Options

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `BATCH_SIZE` | number | 5000 | Maximum metrics per Datadog API request |
| `RETRY_LIMIT` | number | 3 | Number of retry attempts for failed workflow steps |
| `RETRY_DELAY_SECONDS` | number | 1 | Initial delay in seconds before retry (exponential backoff) |
| `JURISDICTION` | string | "" | Durable Object jurisdiction for GraphQL queries (e.g., "eu", "fedramp") |
| `DATADOG_TAGS` | object | {} | Custom tags to add to all metrics |
