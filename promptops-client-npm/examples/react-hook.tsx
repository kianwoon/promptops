/**
 * React Hook Example
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PromptOpsClient, PromptRequest, PromptResponse } from '../src';

interface UsePromptOpsOptions {
  baseUrl: string;
  apiKey: string;
  enableCache?: boolean;
}

interface UsePromptOpsResult {
  prompt: PromptResponse | null;
  loading: boolean;
  error: Error | null;
  getPrompt: (request: PromptRequest) => Promise<void>;
  getPromptContent: (request: PromptRequest) => Promise<string>;
}

export function usePromptOps(options: UsePromptOpsOptions): UsePromptOpsResult {
  const [client, setClient] = useState<PromptOpsClient | null>(null);
  const [prompt, setPrompt] = useState<PromptResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize client
  useEffect(() => {
    const initClient = async () => {
      try {
        const newClient = new PromptOpsClient({
          baseUrl: options.baseUrl,
          apiKey: options.apiKey,
          enableCache: options.enableCache ?? true,
        });

        await newClient.initialize();
        setClient(newClient);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize client'));
      }
    };

    initClient();

    // Cleanup on unmount
    return () => {
      if (client) {
        client.shutdown();
      }
    };
  }, [options.baseUrl, options.apiKey, options.enableCache]);

  const getPrompt = useCallback(async (request: PromptRequest) => {
    if (!client) return;

    setLoading(true);
    setError(null);

    try {
      const result = await client.getPrompt(request);
      setPrompt(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get prompt'));
    } finally {
      setLoading(false);
    }
  }, [client]);

  const getPromptContent = useCallback(async (request: PromptRequest) => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      const result = await client.getPromptContent(request);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get prompt content');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [client]);

  return {
    prompt,
    loading,
    error,
    getPrompt,
    getPromptContent,
  };
}

// Example component usage
export function PromptComponent() {
  const {
    prompt,
    loading,
    error,
    getPrompt,
    getPromptContent,
  } = usePromptOps({
    baseUrl: 'https://api.promptops.com/v1',
    apiKey: 'your-api-key-here',
    enableCache: true,
  });

  const [renderedContent, setRenderedContent] = useState<string>('');

  const handleGetPrompt = async () => {
    await getPrompt({
      promptId: 'hello-world',
      version: '1.0.0',
      variables: {
        name: 'React User',
      },
    });
  };

  const handleGetContent = async () => {
    try {
      const content = await getPromptContent({
        promptId: 'hello-world',
        version: '1.0.0',
        variables: {
          name: 'React Developer',
          framework: 'React',
        },
      });
      setRenderedContent(content);
    } catch (err) {
      console.error('Error getting content:', err);
    }
  };

  return (
    <div className="prompt-component">
      <h2>PromptOps React Example</h2>

      <div className="controls">
        <button onClick={handleGetPrompt} disabled={loading}>
          {loading ? 'Loading...' : 'Get Prompt'}
        </button>
        <button onClick={handleGetContent} disabled={loading}>
          {loading ? 'Loading...' : 'Get Rendered Content'}
        </button>
      </div>

      {error && (
        <div className="error">
          <h3>Error:</h3>
          <p>{error.message}</p>
        </div>
      )}

      {prompt && (
        <div className="prompt-info">
          <h3>Prompt: {prompt.name}</h3>
          <p><strong>ID:</strong> {prompt.id}</p>
          <p><strong>Version:</strong> {prompt.version}</p>
          <p><strong>Description:</strong> {prompt.description}</p>
          <p><strong>Content:</strong></p>
          <pre>{prompt.content}</pre>
        </div>
      )}

      {renderedContent && (
        <div className="rendered-content">
          <h3>Rendered Content:</h3>
          <pre>{renderedContent}</pre>
        </div>
      )}
    </div>
  );
}