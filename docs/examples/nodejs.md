# Node.js Integration Examples

This guide provides comprehensive examples for integrating PromptOps into Node.js applications and servers.

## 🚀 Installation

```bash
npm install promptops-client express cors helmet dotenv
# or
yarn add promptops-client express cors helmet dotenv
```

## 🏗️ Setup Patterns

### 1. Express Server Integration

```javascript
// server.js
require('dotenv').config();
const express = require('express');
const { PromptOpsClient } = require('promptops-client');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize PromptOps client
const promptOpsClient = new PromptOpsClient({
  baseUrl: process.env.PROMPTOPS_BASE_URL || 'https://api.promptops.com/v1',
  apiKey: process.env.PROMPTOPS_API_KEY,
  enableCache: true,
  cacheTTL: 300000, // 5 minutes
  enableTelemetry: true,
  retryConfig: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    jitter: true
  }
});

// Initialize client on startup
async function initializeServer() {
  try {
    await promptOpsClient.initialize();
    console.log('PromptOps client initialized successfully');

    // Health check
    const health = await promptOpsClient.healthCheck();
    console.log('Health status:', health.status);
  } catch (error) {
    console.error('Failed to initialize PromptOps client:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await promptOpsClient.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await promptOpsClient.shutdown();
  process.exit(0);
});

// Start server
initializeServer().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
```

### 2. Middleware for Request Processing

```javascript
// middleware/promptOps.js
const { PromptOpsClient } = require('promptops-client');

class PromptOpsMiddleware {
  constructor(options = {}) {
    this.client = new PromptOpsClient({
      baseUrl: options.baseUrl || process.env.PROMPTOPS_BASE_URL,
      apiKey: options.apiKey || process.env.PROMPTOPS_API_KEY,
      ...options
    });
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      await this.client.initialize();
      this.initialized = true;
    }
  }

  // Middleware to add PromptOps client to request
  middleware() {
    return async (req, res, next) => {
      if (!this.initialized) {
        await this.initialize();
      }

      req.promptOps = this.client;
      next();
    };
  }

  // Error handling middleware
  errorHandler() {
    return (error, req, res, next) => {
      if (error.name === 'AuthenticationError') {
        return res.status(401).json({
          success: false,
          error: 'Authentication failed',
          code: 'AUTH_ERROR'
        });
      }

      if (error.name === 'RateLimitError') {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_ERROR',
          retryAfter: error.retryAfter
        });
      }

      if (error.name === 'PromptNotFoundError') {
        return res.status(404).json({
          success: false,
          error: 'Prompt not found',
          code: 'PROMPT_NOT_FOUND',
          promptId: error.promptId
        });
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    };
  }
}

module.exports = PromptOpsMiddleware;
```

## 🎯 API Endpoint Examples

### 1. Customer Support API

```javascript
// routes/customerSupport.js
const express = require('express');
const router = express.Router();

// Get customer service response
router.post('/response', async (req, res) => {
  try {
    const { customerName, issueType, issueDescription, priority } = req.body;

    if (!customerName || !issueType || !issueDescription) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const response = await req.promptOps.getPromptContent({
      promptId: 'customer-service-response',
      variables: {
        customer_name: customerName,
        issue_type: issueType,
        issue_description: issueDescription,
        priority: priority || 'medium',
        current_timestamp: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      data: {
        response,
        promptId: 'customer-service-response',
        variables: {
          customerName,
          issueType,
          priority
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get ticket summary
router.post('/ticket-summary', async (req, res) => {
  try {
    const { ticketId, issueHistory, customerInfo } = req.body;

    const summary = await req.promptOps.getPromptContent({
      promptId: 'ticket-summary',
      variables: {
        ticket_id: ticketId,
        issue_history: JSON.stringify(issueHistory),
        customer_info: JSON.stringify(customerInfo),
        generated_at: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      data: {
        summary,
        ticketId
      }
    });
  } catch (error) {
    next(error);
  }
});

// Escalation recommendation
router.post('/escalation-recommendation', async (req, res) => {
  try {
    const { ticketData, customerHistory, slaStatus } = req.body;

    const recommendation = await req.promptOps.getPromptContent({
      promptId: 'escalation-recommendation',
      variables: {
        ticket_data: JSON.stringify(ticketData),
        customer_history: JSON.stringify(customerHistory),
        sla_status: slaStatus,
        analyst_name: req.user?.name || 'System'
      }
    });

    res.json({
      success: true,
      data: {
        recommendation,
        requiresEscalation: recommendation.toLowerCase().includes('escalate')
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

### 2. Content Generation API

```javascript
// routes/contentGeneration.js
const express = require('express');
const router = express.Router();

// Generate blog post
router.post('/blog-post', async (req, res) => {
  try {
    const { topic, targetAudience, tone, keywords, wordCount } = req.body;

    const blogPost = await req.promptOps.getPromptContent({
      promptId: 'blog-post-generator',
      variables: {
        topic,
        target_audience: targetAudience || 'general',
        tone: tone || 'professional',
        keywords: keywords ? keywords.join(', ') : '',
        word_count: wordCount || 800,
        current_date: new Date().toLocaleDateString()
      }
    });

    res.json({
      success: true,
      data: {
        content: blogPost,
        metadata: {
          topic,
          targetAudience,
          tone,
          wordCount,
          generatedAt: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Generate social media content
router.post('/social-media', async (req, res) => {
  try {
    const { platform, content, hashtags, brandVoice } = req.body;

    const socialContent = await req.promptOps.getPromptContent({
      promptId: 'social-media-content',
      variables: {
        platform: platform || 'twitter',
        content,
        hashtags: hashtags ? hashtags.join(', ') : '',
        brand_voice: brandVoice || 'professional',
        character_limit: getCharacterLimit(platform)
      }
    });

    res.json({
      success: true,
      data: {
        content: socialContent,
        platform,
        characterCount: socialContent.length
      }
    });
  } catch (error) {
    next(error);
  }
});

function getCharacterLimit(platform) {
  const limits = {
    twitter: 280,
    linkedin: 3000,
    facebook: 5000,
    instagram: 2200
  };
  return limits[platform] || 280;
}

// Product description generator
router.post('/product-description', async (req, res) => {
  try {
    const { productName, features, benefits, targetMarket, pricing } = req.body;

    const description = await req.promptOps.getPromptContent({
      promptId: 'product-description',
      variables: {
        product_name: productName,
        features: features ? features.join(', ') : '',
        benefits: benefits ? benefits.join(', ') : '',
        target_market: targetMarket || 'general',
        price_range: pricing || '$0-100',
        unique_selling_points: generateUSP(features, benefits)
      }
    });

    res.json({
      success: true,
      data: {
        description,
        productName,
        metadata: {
          featureCount: features?.length || 0,
          benefitCount: benefits?.length || 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

function generateUSP(features, benefits) {
  // Simple USP generation logic
  const allPoints = [...(features || []), ...(benefits || [])];
  return allPoints.slice(0, 3).join('; ');
}

module.exports = router;
```

### 3. Chat API with Session Management

```javascript
// routes/chat.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// In-memory session storage (use Redis in production)
const sessions = new Map();

function createSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

// Start new chat session
router.post('/session', async (req, res) => {
  try {
    const { userId, systemPromptId = 'general-assistant' } = req.body;

    const sessionId = createSessionId();
    const session = {
      id: sessionId,
      userId,
      systemPromptId,
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };

    sessions.set(sessionId, session);

    // Get initial greeting
    const greeting = await req.promptOps.getPromptContent({
      promptId: systemPromptId,
      variables: {
        action: 'greeting',
        user_id: userId,
        session_id: sessionId
      }
    });

    session.messages.push({
      role: 'assistant',
      content: greeting,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: {
        sessionId,
        greeting,
        systemPromptId
      }
    });
  } catch (error) {
    next(error);
  }
});

// Send message
router.post('/message', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Add user message to session
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    // Get conversation history for context
    const conversationHistory = session.messages
      .slice(-10) // Last 10 messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    // Generate response
    const response = await req.promptOps.getPromptContent({
      promptId: session.systemPromptId,
      variables: {
        user_message: message,
        conversation_history: conversationHistory,
        session_id: sessionId,
        user_id: session.userId,
        current_timestamp: new Date().toISOString()
      }
    });

    // Add assistant response to session
    session.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date()
    });

    session.lastActivity = new Date();

    res.json({
      success: true,
      data: {
        response,
        sessionId,
        messageCount: session.messages.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get session history
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        userId: session.userId,
        messages: session.messages,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity
      }
    });
  } catch (error) {
    next(error);
  }
});

// End session
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Clear cache for this session's prompts
    await req.promptOps.clearCache(session.systemPromptId);

    sessions.delete(sessionId);

    res.json({
      success: true,
      data: {
        sessionId,
        message: 'Session ended successfully'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Clean up old sessions (call this periodically)
function cleanupOldSessions() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  for (const [sessionId, session] of sessions.entries()) {
    if (session.lastActivity < oneHourAgo) {
      sessions.delete(sessionId);
    }
  }
}

module.exports = { router, cleanupOldSessions };
```

## 🔧 Service Layer Examples

### 1. Prompt Service with Caching

```javascript
// services/PromptService.js
const { PromptOpsClient } = require('promptops-client');

class PromptService {
  constructor(options = {}) {
    this.client = new PromptOpsClient({
      baseUrl: options.baseUrl || process.env.PROMPTOPS_BASE_URL,
      apiKey: options.apiKey || process.env.PROMPTOPS_API_KEY,
      enableCache: true,
      cacheTTL: options.cacheTTL || 300000,
      ...options
    });
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
  }

  async initialize() {
    await this.client.initialize();
  }

  async getPrompt(promptId, variables = {}, options = {}) {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result = await this.client.getPromptContent({
        promptId,
        variables,
        ...options
      });

      this.metrics.successfulRequests++;
      this.updateResponseTime(Date.now() - startTime);

      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.updateResponseTime(Date.now() - startTime);
      throw error;
    }
  }

  async getPromptWithRetry(promptId, variables = {}, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.getPrompt(promptId, variables);
      } catch (error) {
        lastError = error;

        if (error.name === 'AuthenticationError' || attempt === maxRetries) {
          break;
        }

        if (error.name === 'RateLimitError') {
          const delay = Math.min(error.retryAfter * 1000, Math.pow(2, attempt) * 1000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Exponential backoff for other errors
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  updateResponseTime(responseTime) {
    const total = this.metrics.totalRequests;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (total - 1) + responseTime) / total;
  }

  getMetrics() {
    const successRate = this.metrics.totalRequests > 0
      ? this.metrics.successfulRequests / this.metrics.totalRequests
      : 0;

    return {
      ...this.metrics,
      successRate,
      cacheStats: this.client.getCacheStats()
    };
  }

  async shutdown() {
    await this.client.shutdown();
  }
}

module.exports = PromptService;
```

### 2. Content Management Service

```javascript
// services/ContentService.js
const PromptService = require('./PromptService');

class ContentService {
  constructor(promptService) {
    this.promptService = promptService;
  }

  async generateContent(type, options) {
    switch (type) {
      case 'blog':
        return this.generateBlogPost(options);
      case 'email':
        return this.generateEmail(options);
      case 'social':
        return this.generateSocialMedia(options);
      case 'product':
        return this.generateProductDescription(options);
      default:
        throw new Error(`Unknown content type: ${type}`);
    }
  }

  async generateBlogPost({ topic, audience, tone, keywords, wordCount }) {
    return await this.promptService.getPromptWithRetry(
      'blog-post-generator',
      {
        topic,
        target_audience: audience || 'general',
        tone: tone || 'professional',
        keywords: keywords ? keywords.join(', ') : '',
        word_count: wordCount || 800,
        current_date: new Date().toLocaleDateString()
      }
    );
  }

  async generateEmail({ purpose, recipient, tone, keyPoints, callToAction }) {
    return await this.promptService.getPromptWithRetry(
      'email-generator',
      {
        email_purpose: purpose,
        recipient_type: recipient,
        tone: tone || 'professional',
        key_points: keyPoints ? keyPoints.join('\n- ') : '',
        call_to_action: callToAction || 'Please respond at your convenience.',
        current_date: new Date().toLocaleDateString()
      }
    );
  }

  async generateSocialMedia({ platform, content, hashtags, brandVoice }) {
    const characterLimit = this.getCharacterLimit(platform);

    return await this.promptService.getPromptWithRetry(
      'social-media-content',
      {
        platform,
        content,
        hashtags: hashtags ? hashtags.join(', ') : '',
        brand_voice: brandVoice || 'professional',
        character_limit: characterLimit
      }
    );
  }

  async generateProductDescription({ name, features, benefits, targetMarket, priceRange }) {
    return await this.promptService.getPromptWithRetry(
      'product-description',
      {
        product_name: name,
        features: features ? features.join(', ') : '',
        benefits: benefits ? benefits.join(', ') : '',
        target_market: targetMarket || 'general',
        price_range: priceRange || '$0-100',
        unique_selling_points: this.generateUSP(features, benefits)
      }
    );
  }

  getCharacterLimit(platform) {
    const limits = {
      twitter: 280,
      linkedin: 3000,
      facebook: 5000,
      instagram: 2200
    };
    return limits[platform] || 280;
  }

  generateUSP(features, benefits) {
    const allPoints = [...(features || []), ...(benefits || [])];
    return allPoints.slice(0, 3).join('; ');
  }

  async generateContentBatch(contentRequests) {
    const results = [];

    for (const request of contentRequests) {
      try {
        const content = await this.generateContent(request.type, request.options);
        results.push({
          success: true,
          content,
          request
        });
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          request
        });
      }
    }

    return results;
  }
}

module.exports = ContentService;
```

### 3. Analytics Service

```javascript
// services/AnalyticsService.js
class AnalyticsService {
  constructor() {
    this.events = [];
    this.promptUsage = new Map();
    this.startTime = Date.now();
  }

  trackEvent(event) {
    this.events.push({
      ...event,
      timestamp: new Date()
    });

    // Track prompt usage
    if (event.type === 'prompt_request' && event.promptId) {
      const current = this.promptUsage.get(event.promptId) || {
        count: 0,
        averageResponseTime: 0,
        errors: 0
      };

      current.count++;
      if (event.responseTime) {
        current.averageResponseTime =
          (current.averageResponseTime * (current.count - 1) + event.responseTime) / current.count;
      }
      if (event.error) {
        current.errors++;
      }

      this.promptUsage.set(event.promptId, current);
    }
  }

  getPromptUsage(promptId) {
    return this.promptUsage.get(promptId);
  }

  getTopPrompts(limit = 10) {
    return Array.from(this.promptUsage.entries())
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, limit)
      .map(([promptId, stats]) => ({
        promptId,
        ...stats
      }));
  }

  getSystemMetrics() {
    const uptime = Date.now() - this.startTime;
    const totalEvents = this.events.length;
    const errorRate = this.events.filter(e => e.error).length / totalEvents;

    return {
      uptime,
      totalEvents,
      errorRate,
      averageResponseTime: this.getAverageResponseTime(),
      topPrompts: this.getTopPrompts(5)
    };
  }

  getAverageResponseTime() {
    const responseTimes = this.events
      .filter(e => e.responseTime)
      .map(e => e.responseTime);

    if (responseTimes.length === 0) return 0;

    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }

  generateReport(timeRange = '24h') {
    const now = new Date();
    const startTime = new Date(now.getTime() - this.parseTimeRange(timeRange));

    const eventsInRange = this.events.filter(
      event => new Date(event.timestamp) >= startTime
    );

    return {
      timeRange,
      period: {
        start: startTime,
        end: now
      },
      summary: {
        totalEvents: eventsInRange.length,
        uniquePrompts: new Set(eventsInRange.filter(e => e.promptId).map(e => e.promptId)).size,
        errorRate: eventsInRange.filter(e => e.error).length / eventsInRange.length,
        averageResponseTime: this.getAverageResponseTimeForEvents(eventsInRange)
      },
      promptBreakdown: this.getPromptBreakdown(eventsInRange),
      hourlyDistribution: this.getHourlyDistribution(eventsInRange, startTime, now)
    };
  }

  parseTimeRange(timeRange) {
    const ranges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    return ranges[timeRange] || ranges['24h'];
  }

  getAverageResponseTimeForEvents(events) {
    const responseTimes = events
      .filter(e => e.responseTime)
      .map(e => e.responseTime);

    if (responseTimes.length === 0) return 0;

    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }

  getPromptBreakdown(events) {
    const breakdown = new Map();

    events.filter(e => e.promptId).forEach(event => {
      const current = breakdown.get(event.promptId) || {
        requests: 0,
        errors: 0,
        totalResponseTime: 0
      };

      current.requests++;
      if (event.error) current.errors++;
      if (event.responseTime) current.totalResponseTime += event.responseTime;

      breakdown.set(event.promptId, current);
    });

    return Array.from(breakdown.entries()).map(([promptId, stats]) => ({
      promptId,
      ...stats,
      averageResponseTime: stats.totalResponseTime / stats.requests,
      errorRate: stats.errors / stats.requests
    }));
  }

  getHourlyDistribution(events, start, end) {
    const hours = Math.ceil((end - start) / (60 * 60 * 1000));
    const distribution = Array(hours).fill(0).map((_, i) => ({
      hour: new Date(start.getTime() + i * 60 * 60 * 1000),
      count: 0
    }));

    events.forEach(event => {
      const eventTime = new Date(event.timestamp);
      const hourIndex = Math.floor((eventTime - start) / (60 * 60 * 1000));
      if (hourIndex >= 0 && hourIndex < hours) {
        distribution[hourIndex].count++;
      }
    });

    return distribution;
  }
}

module.exports = AnalyticsService;
```

## 🚀 Complete Server Example

```javascript
// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const PromptOpsMiddleware = require('./middleware/promptOps');
const customerSupportRoutes = require('./routes/customerSupport');
const contentGenerationRoutes = require('./routes/contentGeneration');
const { router: chatRoutes, cleanupOldSessions } = require('./routes/chat');
const PromptService = require('./services/PromptService');
const ContentService = require('./services/ContentService');
const AnalyticsService = require('./services/AnalyticsService');

const app = express();
const PORT = process.env.PORT || 3000;

// Services
const analyticsService = new AnalyticsService();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request tracking middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    analyticsService.trackEvent({
      type: 'http_request',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: Date.now() - startTime,
      userAgent: req.get('User-Agent')
    });
  });

  next();
});

// PromptOps middleware
const promptOpsMiddleware = new PromptOpsMiddleware();
app.use(promptOpsMiddleware.middleware());
app.use(promptOpsMiddleware.errorHandler());

// Services initialization
const promptService = new PromptService();
const contentService = new ContentService(promptService);

// Initialize services
Promise.all([
  promptService.initialize(),
  promptOpsMiddleware.initialize()
]).then(() => {
  console.log('All services initialized');
}).catch(error => {
  console.error('Failed to initialize services:', error);
  process.exit(1);
});

// Routes
app.use('/api/customer-support', customerSupportRoutes);
app.use('/api/content', contentGenerationRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    const health = await req.promptOps.healthCheck();
    const metrics = promptService.getMetrics();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      promptOps: health,
      metrics
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Analytics endpoints
app.get('/api/analytics/prompts', (req, res) => {
  const topPrompts = analyticsService.getTopPrompts(20);
  res.json({ prompts: topPrompts });
});

app.get('/api/analytics/system', (req, res) => {
  const metrics = analyticsService.getSystemMetrics();
  res.json(metrics);
});

app.get('/api/analytics/report', (req, res) => {
  const timeRange = req.query.timeRange || '24h';
  const report = analyticsService.generateReport(timeRange);
  res.json(report);
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Periodic cleanup
setInterval(() => {
  cleanupOldSessions();
  console.log('Cleaned up old sessions');
}, 60 * 60 * 1000); // Every hour

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await promptService.shutdown();
  await promptOpsMiddleware.client.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await promptService.shutdown();
  await promptOpsMiddleware.client.shutdown();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Analytics: http://localhost:${PORT}/api/analytics/system`);
});
```

---

*For more Node.js examples, check the [examples directory](../../promptops-client-npm/examples/) in the JavaScript client repository.*