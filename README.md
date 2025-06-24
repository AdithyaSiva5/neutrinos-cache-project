# Smart Cache Invalidation Challenge – Submission Template

## Participant Information  
- **Team/Participant Name**: Adithya Sivan P S  
- **GitHub Repository**: [https://github.com/AdithyaSiva5/neutri-project](https://github.com/AdithyaSiva5/neutri-project)  
- **Demo Video**: [https://drive.google.com/file/d/1iJ7EPoXMLypaglxGJCPSg9w8xxGMf_D9/view?usp=sharing](https://drive.google.com/file/d/1iJ7EPoXMLypaglxGJCPSg9w8xxGMf_D9/view?usp=sharing)

## Implementation Overview

### Architecture
- **Tech Stack Used**:
  - **Frontend**: Next.js, React, D3.js, Chart.js, Socket.IO-client, Tailwind CSS, Axios, Lodash, React-Toastify
  - **Backend**: Node.js, Express.js, PostgreSQL, Redis, Socket.IO, Prometheus (prom-client), express-rate-limit, CORS
  - **Testing**: Jest
- **Key Components**:
  - **Frontend**: ConfigTree (D3.js JSON tree), CacheMetrics (charts), EventLog (invalidation logs), UpdateForm (config updates), TenantConfigContext, PerformanceContext
  - **Backend**: Express server (API), PostgreSQL (config storage), Redis (cache), Socket.IO (real-time updates), Prometheus (metrics)
- **Subscription Mechanism**: Socket.IO subscriptions with `tenantId`, `configId`, and `pathPattern` (e.g., `*.theme.*`), Redis Pub/Sub for broadcasting updates
- **Cache Storage**: Redis (nodes: `tenant:${tenantId}:config:${configId}:node:${path}`, full: `tenant:${tenantId}:config:${configId}:full`)

### Design Decisions
- **Why this architecture?**: Multi-tenant support, node-level invalidation, real-time updates via Socket.IO, D3.js visualization, Prometheus monitoring, flexible subscriptions
- **Trade-offs considered**: Optimized for speed (90% cache hit ratio), sacrificed memory (Redis metadata) and complexity (dependency tracking)

## Performance Test Results

### Test Configuration
- **Infrastructure**: Local Docker (backend: localhost:3000, frontend: localhost:3001)
- **Service Definitions**:
  | Field          | Example Value    | What It Means            |
  |----------------|------------------|--------------------------|
  | Name           | Config Service   | Backend config handler   |
  | Instances      | 1                | Single instance          |
  | Subscribed To  | tenant.*.config.*| Watches all config paths |
  | Tenant         | T1, T2, T3       | Tenant groups            |

### Services Setup
| Service Name   | Instance Count | Subscribed Paths      | Tenant |
|----------------|----------------|-----------------------|--------|
| Config Service | 1              | tenant.T1.config.*    | T1     |
| Config Service | 1              | tenant.T2.config.*    | T2     |
| Config Service | 1              | tenant.T3.config.*    | T3     |

### Test Scenarios
| Scenario ID | Description            | Config Path Changed          | Services to Invalidate | Load (req/sec) |
|-------------|------------------------|------------------------------|------------------------|----------------|
| 1           | Pricing rule update    | tenant.T1.pricing.rules.discount | Config Service (T1)    | 100/sec        |
| 2           | UI theme label update  | tenant.T3.ui.labels.theme.*  | Config Service (T3)    | 500/sec        |

### Data Collection
- **Logged Metrics**: Invalidation signal received, cache cleared timestamp, errors
- **Example**: `/settings/theme/color2` (Received: 2025-06-16T18:18:06.085Z, Cleared: 2025-06-16T18:18:06.089Z, ~4ms)

### Metrics and Calculations
#### 1. Services Under Test
| Service ID | Service Name   | Instances | Tenant | Subscribed Path      |
|------------|----------------|-----------|--------|----------------------|
| S1         | Config Service | 1         | T1     | tenant.T1.config.*   |
| S2         | Config Service | 1         | T2     | tenant.T2.config.*   |
| S3         | Config Service | 1         | T3     | tenant.T3.config.*   |

#### 2. Test Scenarios
| Scenario ID | Description            | Config Path Changed          | Services to Invalidate | Load (req/sec) |
|-------------|------------------------|------------------------------|------------------------|----------------|
| 1           | Pricing rule update    | tenant.T1.pricing.rules.discount | S1                     | 100/sec        |
| 2           | UI theme label update  | tenant.T3.ui.labels.theme.*  | S3                     | 500/sec        |

#### 3. Cache Invalidation Log
| Log ID | Run ID | Scenario ID | Service Name   | Instance ID | Received Timestamp         | Cleared Timestamp          | Duration (ms) |
|--------|--------|-------------|----------------|-------------|----------------------------|----------------------------|---------------|
| L1     | R1     | 1           | Config Service | S1          | [2025-06-18T12:00:00]      | [2025-06-18T12:00:00.004]  | [4]           |
| L2     | R2     | 2           | Config Service | S3          | [2025-06-18T12:01:00]      | [2025-06-18T12:01:00.005]  | [5]           |

#### 4. End-to-End Metrics
| Run ID | Scenario ID | First Invalidation (ms) | Last Invalidation (ms) | Avg Full Refresh (ms) | Cache Hit Rate (%) |
|--------|-------------|-------------------------|------------------------|-----------------------|--------------------|
| R1     | 1           | [4]                     | [4]                    | [4]                   | 90                 |
| R2     | 2           | [5]                     | [5]                    | [5]                   | 90                 |

#### 5. Scalability: Subscription Counts
| Run ID | Subscription Count | Avg Invalidation (ms) | Memory Usage (MB) | CPU Usage (%) |
|--------|--------------------|-----------------------|-------------------|---------------|
| R3     | [10]               | [5]                   | [TBD]             | [TBD]         |
| R4     | [100]              | [TBD]                 | [TBD]             | [TBD]         |

#### 6. Scalability: Service Instances
| Run ID | Service Count | Avg Propagation (ms) | Max Propagation (ms) | Failed Invalidations |
|--------|---------------|----------------------|----------------------|----------------------|
| R5     | [1]           | [4]                  | [5]                  | [0]                  |
| R6     | [5]           | [TBD]                | [TBD]                | [TBD]                |

### Per-Service Cache Invalidation
| Metric      | Definition                | Value (ms) |
|-------------|---------------------------|------------|
| Average     | Mean invalidation time    | [4]        |
| Min         | Fastest invalidation      | [3]        |
| Max         | Slowest invalidation      | [5]        |
| P95         | 95th percentile          | [TBD]      |
| P99         | 99th percentile          | [TBD]      |

## Additional Notes
- **Address Issues**: Frequent Socket.IO disconnections, high latencies (e.g., 109591.72ms) need debugging; provide more context for analysis.
- **Enhance Submission**: Add real-time updates, D3.js zoom, Redis Pub/Sub optimization for bonus points.
- **Deadline**: Submit by June 30, 2025.

