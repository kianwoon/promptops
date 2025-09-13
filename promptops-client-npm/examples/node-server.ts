/**
 * Node.js Server Example using Express
 */

import express from 'express';
import { PromptOpsClient, PromptOpsError } from '../src';

const app = express();
app.use(express.json());

// Initialize PromptOps client
const client = new PromptOpsClient({
  baseUrl: process.env.PROMPTOPS_BASE_URL || 'https://api.promptops.com/v1',
  apiKey: process.env.PROMPTOPS_API_KEY || 'your-api-key-here',
  enableCache: true,
  enableTelemetry: true,
  redisUrl: process.env.REDIS_URL,
});

// Initialize client on startup
client.initialize()
  .then(() => {
    console.log('PromptOps client initialized successfully');
  })
  .catch((error) => {
    console.error('Failed to initialize PromptOps client:', error);
    process.exit(1);
  });

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await client.healthCheck();
    res.json({
      status: 'ok',
      promptops: health,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get prompt endpoint
app.post('/prompt', async (req, res) => {
  try {
    const { promptId, version, variables, modelProvider, modelName } = req.body;

    if (!promptId) {
      return res.status(400).json({ error: 'promptId is required' });
    }

    const prompt = await client.getPrompt({
      promptId,
      version,
      variables,
      modelProvider,
      modelName,
    });

    res.json(prompt);
  } catch (error) {
    if (error instanceof PromptOpsError) {
      res.status(400).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
});

// Get prompt content endpoint
app.post('/prompt/content', async (req, res) => {
  try {
    const { promptId, version, variables, modelProvider, modelName } = req.body;

    if (!promptId) {
      return res.status(400).json({ error: 'promptId is required' });
    }

    const content = await client.getPromptContent({
      promptId,
      version,
      variables,
      modelProvider,
      modelName,
    });

    res.json({ content });
  } catch (error) {
    if (error instanceof PromptOpsError) {
      res.status(400).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
});

// List prompts endpoint
app.get('/prompts', async (req, res) => {
  try {
    const { moduleId, limit } = req.query;

    const prompts = await client.listPrompts(
      moduleId as string,
      limit ? parseInt(limit as string) : undefined
    );

    res.json(prompts);
  } catch (error) {
    if (error instanceof PromptOpsError) {
      res.status(400).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
});

// Render prompt endpoint
app.post('/prompt/render', async (req, res) => {
  try {
    const { promptId, version, variables, tenantId, overrides } = req.body;

    if (!promptId) {
      return res.status(400).json({ error: 'promptId is required' });
    }

    const result = await client.renderPrompt({
      promptId,
      version,
      variables,
      tenantId,
      overrides,
    });

    res.json(result);
  } catch (error) {
    if (error instanceof PromptOpsError) {
      res.status(400).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
});

// Validate prompt endpoint
app.get('/prompt/:promptId/validate', async (req, res) => {
  try {
    const { promptId } = req.params;
    const { version } = req.query;

    const isValid = await client.validatePrompt(promptId, version as string);

    res.json({ isValid });
  } catch (error) {
    if (error instanceof PromptOpsError) {
      res.status(400).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
});

// Cache stats endpoint
app.get('/cache/stats', async (req, res) => {
  try {
    const stats = client.getCacheStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Clear cache endpoint
app.post('/cache/clear', async (req, res) => {
  try {
    const { promptId } = req.body;

    await client.clearCache(promptId);

    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await client.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await client.shutdown();
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});