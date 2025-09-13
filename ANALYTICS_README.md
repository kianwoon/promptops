# PromptOps Analytics System

## Overview

The PromptOps Analytics System provides comprehensive usage tracking, performance monitoring, and business intelligence for your PromptOps deployment. This system enables data-driven decision making, cost optimization, and operational excellence.

## 🚀 Key Features

### 1. **Comprehensive Usage Tracking**
- Real-time usage monitoring for all API endpoints
- Token consumption tracking by model provider and prompt
- Cost estimation and budget monitoring
- Success rate and error analysis
- Cache performance metrics

### 2. **Advanced Analytics**
- Multi-dimensional data aggregation (hourly, daily, weekly, monthly)
- Time-series analysis with flexible time ranges
- Top performers identification (most used prompts, models, projects)
- Growth rate analysis and trend detection
- Comparative analysis across time periods

### 3. **Performance Monitoring**
- System resource monitoring (CPU, memory, disk)
- Database performance metrics
- Response time analysis
- Query performance optimization insights
- Network and application metrics

### 4. **Alerting System**
- Configurable alerts for usage spikes, cost thresholds, and performance issues
- Multi-severity alert levels (low, medium, high, critical)
- Real-time notifications and acknowledgment workflows
- Alert history and trend analysis

### 5. **Data Export & Reporting**
- Multiple export formats (CSV, JSON, Parquet)
- Customizable data filters and date ranges
- Automated report generation
- Data retention policies with archiving

### 6. **Business Intelligence Dashboard**
- Real-time dashboard with interactive charts
- Responsive design for mobile and desktop
- Customizable time ranges and filters
- Executive summary with key metrics

## 📊 Architecture

### Data Flow

```
Client Libraries → Usage Logs → Raw Database
                                    ↓
                        Analytics Service
                                    ↓
          Aggregated Tables → Analytics API → Dashboard
                                    ↓
                    Alerts & Notifications
```

### Components

1. **Data Collection Layer**
   - Client telemetry managers (Python/JavaScript)
   - Usage logging API endpoints
   - Performance monitoring service

2. **Data Processing Layer**
   - Hourly and daily aggregation jobs
   - Background task scheduler
   - Data retention and archiving

3. **Analytics Layer**
   - Query-optimized database tables
   - Caching system for performance
   - Business logic for metrics calculation

4. **Presentation Layer**
   - RESTful API endpoints
   - Interactive web dashboard
   - Data export functionality

## 🛠️ Installation & Setup

### Prerequisites

- Python 3.11+
- PostgreSQL 12+
- Redis 6+
- Node.js 16+ (for JavaScript client)

### Step 1: Database Setup

```bash
# Create analytics tables
python -m app.setup_analytics

# This will:
# - Create all necessary database tables
# - Set up optimal indexes
# - Configure default alerts
# - Initialize retention policies
```

### Step 2: Start Background Services

```python
# In your application startup code:
from app.analytics_scheduler import start_analytics_scheduler
from app.performance_monitor import start_performance_monitoring

# Start background services
await start_analytics_scheduler()
await start_performance_monitoring()
```

### Step 3: Configure Client Libraries

#### Python Client
```python
from promptops import PromptOpsClient, ClientConfig

config = ClientConfig(
    base_url="https://your-promptops-instance.com",
    api_key="your-api-key",
    telemetry={
        "enabled": True,
        "endpoint": "https://your-promptops-instance.com/v1/client/usage/log",
        "batch_size": 100,
        "flush_interval": 30
    }
)

client = PromptOpsClient(config)
await client.initialize()
```

#### JavaScript Client
```javascript
import { PromptOpsClient } from '@promptops/client';

const client = new PromptOpsClient({
    baseUrl: 'https://your-promptops-instance.com',
    apiKey: 'your-api-key',
    enableTelemetry: true,
    telemetryEndpoint: 'https://your-promptops-instance.com/v1/client/usage/log'
});

await client.initialize();
```

### Step 4: Access Dashboard

Navigate to `/analytics` in your application or serve the dashboard template:

```python
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
import uvicorn

app = FastAPI()

@app.get("/analytics", response_class=HTMLResponse)
async def analytics_dashboard():
    with open("templates/analytics_dashboard.html", "r") as f:
        return HTMLResponse(content=f.read())

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## 📈 API Reference

### Usage Statistics

```bash
GET /v1/analytics/usage/overview?start_date=2024-01-01&end_date=2024-01-31&group_by=day
```

**Response:**
```json
{
  "summary": {
    "total_requests": 15420,
    "total_tokens_requested": 3284750,
    "total_tokens_used": 2856320,
    "total_cost_usd": "142.816",
    "average_response_time_ms": 125.4,
    "success_rate": 0.987,
    "period": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-31T23:59:59Z",
      "group_by": "day"
    }
  },
  "time_series": [...],
  "top_prompts": [...]
}
```

### Performance Metrics

```bash
GET /v1/analytics/performance/metrics?start_date=2024-01-01&end_date=2024-01-31
```

### Alerts Management

```bash
# Get active alerts
GET /v1/analytics/alerts?severity=high&limit=10

# Acknowledge alert
POST /v1/analytics/alerts/{alert_id}/acknowledge
```

### Data Export

```bash
# Create export job
POST /v1/analytics/exports?export_type=csv&format=full&start_date=2024-01-01&end_date=2024-01-31

# Get export status
GET /v1/analytics/exports

# Download export
GET /v1/analytics/exports/{export_id}/download
```

## 🔧 Configuration

### Database Optimization

The analytics system includes optimized database schemas and indexes:

```sql
-- Key indexes for performance
CREATE INDEX idx_client_usage_tenant_time ON client_usage_logs(tenant_id, timestamp);
CREATE INDEX idx_analytics_hourly_composite ON usage_analytics_hourly(tenant_id, user_id, project_id, hour_start);
CREATE INDEX idx_analytics_daily_tenant_date ON usage_analytics_daily(tenant_id, date);
```

### Retention Policies

Configure data retention in the database:

```sql
-- Set 90-day retention for raw logs
UPDATE data_retention_policies
SET retention_period_days = 90
WHERE table_name = 'client_usage_logs';

-- Set 3-year retention for aggregated daily data
UPDATE data_retention_policies
SET retention_period_days = 1095
WHERE table_name = 'usage_analytics_daily';
```

### Alert Configuration

Create custom alerts:

```python
from app.analytics_models import Alert, AlertType, AlertSeverity, MetricType

alert = Alert(
    name="Custom Cost Alert",
    description="Alert when monthly costs exceed $500",
    alert_type=AlertType.COST_THRESHOLD,
    severity=AlertSeverity.HIGH,
    metric=MetricType.COST_USD,
    operator=">",
    threshold=500.0,
    window_duration=43200,  # 30 days
    tenant_id="your-tenant-id"
)
```

## 🚀 Performance Considerations

### Scalability

- **Horizontal Scaling**: Analytics queries are designed to scale horizontally
- **Database Sharding**: Consider sharding by tenant_id for large deployments
- **Read Replicas**: Use read replicas for analytics queries to reduce load on primary database

### Caching Strategy

- **Query Results**: Frequently accessed queries are cached for 5 minutes
- **Dashboard Data**: Dashboard summaries cached with TTL
- **Aggregated Data**: Hourly and daily aggregates provide fast query performance

### Database Optimization

- **Partitioning**: Consider time-based partitioning for large tables
- **Index Strategy**: Composite indexes optimized for common query patterns
- **Vacuum & Analyze**: Regular maintenance for PostgreSQL performance

## 🔍 Monitoring & Troubleshooting

### System Health Checks

```python
from app.performance_monitor import get_performance_monitor

monitor = get_performance_monitor()
health = monitor.get_system_health()

print(f"Health Score: {health['health_score']}")
print(f"Status: {health['health_status']}")
```

### Common Issues

**High Memory Usage**
- Check cache configuration
- Monitor connection pool size
- Review data retention policies

**Slow Queries**
- Verify indexes are properly configured
- Check for long-running aggregation jobs
- Monitor database connection count

**Missing Data**
- Verify background services are running
- Check scheduler logs for errors
- Ensure client telemetry is properly configured

## 📊 Analytics Queries

### Top 10 Most Expensive Prompts

```sql
SELECT
    prompt_id,
    SUM(total_cost_usd) as total_cost,
    COUNT(*) as usage_count,
    AVG(total_cost_usd) as avg_cost_per_use
FROM usage_analytics_hourly
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY prompt_id
ORDER BY total_cost DESC
LIMIT 10;
```

### Hourly Usage Pattern Analysis

```sql
SELECT
    EXTRACT(HOUR FROM hour_start) as hour_of_day,
    AVG(request_count) as avg_requests,
    AVG(total_tokens_used) as avg_tokens,
    AVG(total_cost_usd) as avg_cost
FROM usage_analytics_hourly
WHERE hour_start >= NOW() - INTERVAL '30 days'
GROUP BY hour_of_day
ORDER BY hour_of_day;
```

### Success Rate by Model Provider

```sql
SELECT
    model_provider,
    SUM(request_count) as total_requests,
    SUM(successful_requests) as successful_requests,
    (SUM(successful_requests) * 100.0 / SUM(request_count)) as success_rate
FROM usage_analytics_hourly
WHERE hour_start >= NOW() - INTERVAL '7 days'
    AND model_provider IS NOT NULL
GROUP BY model_provider
ORDER BY success_rate DESC;
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all analytics tests
pytest tests/test_analytics.py -v

# Run specific test categories
pytest tests/test_analytics.py::TestAnalyticsService -v
pytest tests/test_analytics.py::TestPerformanceMonitor -v
```

## 📝 Migration Guide

### From Basic Usage Tracking

1. **Backup existing data**
2. **Run setup script to create new tables**
3. **Start background aggregation services**
4. **Backfill historical data (optional)**
5. **Update client libraries to use enhanced telemetry**

### Performance Optimization

1. **Add recommended indexes**
2. **Configure retention policies**
3. **Set up caching**
4. **Monitor system performance**
5. **Tune based on usage patterns**

## 🤝 Contributing

When contributing to the analytics system:

1. **Add tests** for new functionality
2. **Update documentation** for API changes
3. **Consider performance impact** of new queries
4. **Follow existing code patterns** and conventions
5. **Test with realistic data volumes**

## 📄 License

This analytics system is part of the PromptOps project and follows the same license terms.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review test cases for usage examples
3. Check system logs for error messages
4. Monitor database performance metrics
5. Contact support for production issues

---

**Built with ❤️ for data-driven prompt operations**