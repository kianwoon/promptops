/**
 * CommonJS Usage Example
 */

const { PromptOpsClient, PromptOpsError } = require('../dist/index');

async function commonjsExample() {
  try {
    // Initialize the client
    const client = new PromptOpsClient({
      baseUrl: 'https://api.promptops.com/v1',
      apiKey: 'your-api-key-here',
      enableCache: true,
      enableTelemetry: true,
    });

    // Initialize the client
    await client.initialize();

    // Get a prompt
    const prompt = await client.getPrompt({
      promptId: 'hello-world',
      version: '1.0.0',
      variables: {
        name: 'World',
        temperature: 0.7,
      },
    });

    console.log('Prompt:', prompt.name);
    console.log('Content:', prompt.content);

    // Get prompt content with variable substitution
    const content = await client.getPromptContent({
      promptId: 'hello-world',
      version: '1.0.0',
      variables: {
        name: 'Developer',
        framework: 'JavaScript',
      },
    });

    console.log('Rendered content:', content);

    // List all prompts
    const prompts = await client.listPrompts();
    console.log('Available prompts:', prompts.map(p => p.name));

    // Render a prompt
    const renderResult = await client.renderPrompt({
      promptId: 'hello-world',
      version: '1.0.0',
      variables: {
        name: 'User',
        context: 'example',
      },
    });

    console.log('Render result:', renderResult);

    // Check cache stats
    const cacheStats = client.getCacheStats();
    console.log('Cache stats:', cacheStats);

    // Health check
    const health = await client.healthCheck();
    console.log('Health status:', health);

  } catch (error) {
    if (error instanceof PromptOpsError) {
      console.error('PromptOps Error:', {
        code: error.code,
        message: error.message,
        details: error.details,
      });
    } else {
      console.error('Unknown error:', error);
    }
  }
}

// Run the example
commonjsExample().catch(console.error);