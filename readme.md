# Container Metrics Exporter

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

This will prompt for your Cloudflare Account ID, open the browser to create an API token with the required permissions, and collect your Datadog credentials. It automatically creates a `.dev.vars` file.

### Verify

```bash
npx wrangler dev
curl "http://localhost:8787/cdn-cgi/handler/scheduled"
```

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
| `cpu` | gauge | vCPU | CPU load |
| `memory` | gauge | MiB | Memory usage |
| `disk` | gauge | MB | Disk usage |
| `bandwidth.rx` | count | bytes | Bytes received |
| `bandwidth.tx` | count | bytes | Bytes transmitted |

**Tags:** `account_id`, `application_id`, `application_name`, `deployment_id`, `placement_id`, `stat`

The `stat` tag indicates the aggregation: `p50`, `p90`, `p99`, `max` (bandwidth metrics don't have a stat tag).

## Datadog Dashboard

A pre-built dashboard is included in `datadog-dashboard.json`. To import it:

1. In Datadog, go to **Dashboards** → **New Dashboard** → **New Dashboard**
2. Click the cog icon (⚙️) in the top right
3. Select **Import dashboard JSON**
4. Paste the contents of `datadog-dashboard.json`

See [Datadog's documentation](https://docs.datadoghq.com/dashboards/configure/#copy-import-or-export-dashboard-json) for more details.

## Workflow Behavior

The exporter runs as a Cloudflare Workflow triggered every minute via cron. Each workflow step uses the default retry configuration:

- **Retries**: 3 attempts
- **Delay**: 1 second initial delay
- **Backoff**: Exponential (1s, 2s, 4s)

Steps will automatically retry on transient failures (API errors, network issues).

