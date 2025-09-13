# React Integration Examples

This guide provides comprehensive examples for integrating PromptOps into React applications.

## 🚀 Installation

```bash
npm install promptops-client react-query @types/react-query
# or
yarn add promptops-client react-query @types/react-query
```

## 🏗️ Setup Patterns

### 1. React Context Provider

```typescript
// src/contexts/PromptOpsContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { PromptOpsClient } from 'promptops-client';

interface PromptOpsContextType {
  client: PromptOpsClient;
  initialized: boolean;
}

const PromptOpsContext = createContext<PromptOpsContextType | null>(null);

export const PromptOpsProvider: React.FC<{
  children: ReactNode;
  apiKey: string;
  baseUrl?: string;
}> = ({ children, apiKey, baseUrl = 'https://api.promptops.com/v1' }) => {
  const [client] = useState(() => new PromptOpsClient({
    baseUrl,
    apiKey,
    enableCache: true,
    cacheTTL: 300000, // 5 minutes
    enableTelemetry: true
  }));
  const [initialized, setInitialized] = useState(false);

  React.useEffect(() => {
    const initializeClient = async () => {
      try {
        await client.initialize();
        setInitialized(true);
      } catch (error) {
        console.error('Failed to initialize PromptOps client:', error);
      }
    };

    initializeClient();

    return () => {
      // Cleanup on unmount
      client.shutdown().catch(console.error);
    };
  }, [client]);

  return (
    <PromptOpsContext.Provider value={{ client, initialized }}>
      {children}
    </PromptOpsContext.Provider>
  );
};

export const usePromptOps = () => {
  const context = useContext(PromptOpsContext);
  if (!context) {
    throw new Error('usePromptOps must be used within PromptOpsProvider');
  }
  return context;
};
```

### 2. Custom Hooks

```typescript
// src/hooks/usePrompt.ts
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { usePromptOps } from '../contexts/PromptOpsContext';
import { PromptRequest } from 'promptops-client';

export const usePrompt = (
  request: PromptRequest,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
  }
) => {
  const { client, initialized } = usePromptOps();
  const queryClient = useQueryClient();

  return useQuery(
    ['prompt', request.promptId, request.variables],
    async () => {
      if (!initialized) {
        throw new Error('PromptOps client not initialized');
      }
      return await client.getPromptContent(request);
    },
    {
      enabled: initialized && (options?.enabled ?? true),
      staleTime: options?.staleTime ?? 300000, // 5 minutes
      cacheTime: options?.cacheTime ?? 600000, // 10 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on auth errors
        if (error?.code === 'AUTHENTICATION_ERROR') {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      }
    }
  );
};

export const usePromptMutation = () => {
  const { client } = usePromptOps();
  const queryClient = useQueryClient();

  return useMutation(
    async (request: PromptRequest) => {
      return await client.getPromptContent(request);
    },
    {
      onSuccess: (data, variables) => {
        // Invalidate related queries
        queryClient.invalidateQueries(['prompt', variables.promptId]);
      },
      onError: (error: any, variables) => {
        console.error(`Failed to get prompt ${variables.promptId}:`, error);
      }
    }
  );
};

export const usePromptList = (moduleId?: string) => {
  const { client, initialized } = usePromptOps();

  return useQuery(
    ['prompts', moduleId],
    async () => {
      if (!initialized) {
        throw new Error('PromptOps client not initialized');
      }
      return await client.listPrompts(moduleId);
    },
    {
      enabled: initialized,
      staleTime: 600000, // 10 minutes
      cacheTime: 1800000 // 30 minutes
    }
  );
};
```

## 🎯 Component Examples

### 1. Basic Prompt Component

```typescript
// src/components/PromptComponent.tsx
import React from 'react';
import { usePrompt } from '../hooks/usePrompt';
import { Spinner, Alert, AlertDescription } from './UI';

interface PromptComponentProps {
  promptId: string;
  variables?: Record<string, any>;
  fallback?: string;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
}

export const PromptComponent: React.FC<PromptComponentProps> = ({
  promptId,
  variables = {},
  fallback = 'Content not available',
  loadingComponent = <Spinner size="sm" />,
  errorComponent = <Alert severity="error">Failed to load content</Alert>
}) => {
  const { data, isLoading, error } = usePrompt({
    promptId,
    variables
  });

  if (isLoading) {
    return <>{loadingComponent}</>;
  }

  if (error) {
    return <>{errorComponent}</>;
  }

  return (
    <div className="prompt-content">
      {data || fallback}
    </div>
  );
};

// Usage example
const WelcomeMessage: React.FC<{ name: string }> = ({ name }) => {
  return (
    <PromptComponent
      promptId="welcome-message"
      variables={{ name }}
      fallback={`Welcome ${name}!`}
    />
  );
};
```

### 2. Dynamic Form with Prompt Validation

```typescript
// src/components/DynamicForm.tsx
import React, { useState } from 'react';
import { usePromptMutation } from '../hooks/usePrompt';
import { Form, Input, Button, Alert } from './UI';

interface DynamicFormProps {
  promptId: string;
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'email' | 'textarea';
    required?: boolean;
  }>;
  onSubmit: (data: Record<string, any>) => void;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  promptId,
  fields,
  onSubmit
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [validationPrompt, setValidationPrompt] = useState<string>('');
  const mutation = usePromptMutation();

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = async () => {
    try {
      const result = await mutation.mutateAsync({
        promptId: `${promptId}-validation`,
        variables: { ...formData, action: 'validate' }
      });
      setValidationPrompt(result);
      return true;
    } catch (error) {
      console.error('Validation failed:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = await validateForm();
    if (isValid) {
      onSubmit(formData);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      {fields.map(field => (
        <Form.Field key={field.name}>
          <label htmlFor={field.name}>{field.label}</label>
          {field.type === 'textarea' ? (
            <textarea
              id={field.name}
              value={formData[field.name] || ''}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              required={field.required}
            />
          ) : (
            <input
              type={field.type}
              id={field.name}
              value={formData[field.name] || ''}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              required={field.required}
            />
          )}
        </Form.Field>
      ))}

      {validationPrompt && (
        <Alert severity="info">
          <AlertDescription>{validationPrompt}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={mutation.isLoading}
      >
        {mutation.isLoading ? 'Validating...' : 'Submit'}
      </Button>
    </Form>
  );
};

// Usage example
const CustomerSupportForm: React.FC = () => {
  const handleSubmit = (data: Record<string, any>) => {
    console.log('Form submitted:', data);
    // Handle form submission
  };

  return (
    <DynamicForm
      promptId="customer-support"
      fields={[
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'issue', label: 'Issue Description', type: 'textarea', required: true }
      ]}
      onSubmit={handleSubmit}
    />
  );
};
```

### 3. Chat Interface Component

```typescript
// src/components/ChatInterface.tsx
import React, { useState, useRef, useEffect } from 'react';
import { usePromptMutation } from '../hooks/usePrompt';
import { usePromptOps } from '../contexts/PromptOpsContext';
import { MessageList, MessageInput, TypingIndicator } from './UI';

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export const ChatInterface: React.FC<{
  systemPromptId: string;
  initialMessage?: string;
}> = ({ systemPromptId, initialMessage }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mutation = usePromptMutation();
  const { client } = usePromptOps();

  useEffect(() => {
    if (initialMessage) {
      setMessages([{
        id: '1',
        content: initialMessage,
        role: 'assistant',
        timestamp: new Date()
      }]);
    }
  }, [initialMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      // Get conversation history for context
      const conversationHistory = messages
        .slice(-5) // Last 5 messages for context
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const response = await mutation.mutateAsync({
        promptId: systemPromptId,
        variables: {
          user_message: content,
          conversation_history: conversationHistory,
          current_timestamp: new Date().toISOString()
        }
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: response,
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to get response:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: 'I apologize, but I\'m having trouble responding right now. Please try again.',
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    // Clear cache for this prompt
    client.clearCache(systemPromptId).catch(console.error);
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h3>Assistant Chat</h3>
        <button onClick={handleClearChat}>Clear Chat</button>
      </div>

      <MessageList>
        {messages.map(message => (
          <MessageItem
            key={message.id}
            message={message}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </MessageList>

      <MessageInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSendMessage}
        disabled={isTyping || mutation.isLoading}
        placeholder="Type your message..."
      />
    </div>
  );
};
```

### 4. Content Generation Component

```typescript
// src/components/ContentGenerator.tsx
import React, { useState } from 'react';
import { usePromptMutation } from '../hooks/usePrompt';

interface ContentGeneratorProps {
  promptId: string;
  onGenerated: (content: string) => void;
}

export const ContentGenerator: React.FC<ContentGeneratorProps> = ({
  promptId,
  onGenerated
}) => {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('professional');
  const [length, setLength] = useState('medium');
  const [generatedContent, setGeneratedContent] = useState('');
  const mutation = usePromptMutation();

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    try {
      const content = await mutation.mutateAsync({
        promptId,
        variables: {
          topic,
          tone,
          length,
          current_date: new Date().toLocaleDateString()
        }
      });

      setGeneratedContent(content);
      onGenerated(content);
    } catch (error) {
      console.error('Failed to generate content:', error);
    }
  };

  const handleRegenerate = () => {
    setGeneratedContent('');
    handleGenerate();
  };

  return (
    <div className="content-generator">
      <div className="controls">
        <input
          type="text"
          placeholder="Enter topic..."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />

        <select
          value={tone}
          onChange={(e) => setTone(e.target.value)}
        >
          <option value="professional">Professional</option>
          <option value="casual">Casual</option>
          <option value="formal">Formal</option>
          <option value="friendly">Friendly</option>
        </select>

        <select
          value={length}
          onChange={(e) => setLength(e.target.value)}
        >
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
        </select>

        <button
          onClick={handleGenerate}
          disabled={!topic.trim() || mutation.isLoading}
        >
          {mutation.isLoading ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {generatedContent && (
        <div className="generated-content">
          <div className="content-header">
            <h4>Generated Content</h4>
            <button onClick={handleRegenerate}>Regenerate</button>
          </div>
          <div className="content-body">
            {generatedContent.split('\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

## 🔧 Advanced Patterns

### 1. Real-time Updates with WebSocket

```typescript
// src/hooks/useRealtimePrompt.ts
import { useEffect, useState } from 'react';
import { usePromptOps } from '../contexts/PromptOpsContext';

export const useRealtimePrompt = (promptId: string) => {
  const { client } = usePromptOps();
  const [realtimeContent, setRealtimeContent] = useState<string>('');
  const [connection, setConnection] = useState<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket('wss://api.promptops.com/v1/realtime');

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Subscribe to prompt updates
      ws.send(JSON.stringify({
        action: 'subscribe',
        promptId
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'prompt_updated' && data.promptId === promptId) {
        setRealtimeContent(data.content);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      // Attempt to reconnect
      setTimeout(() => {
        const newWs = new WebSocket('wss://api.promptops.com/v1/realtime');
        setConnection(newWs);
      }, 5000);
    };

    setConnection(ws);

    return () => {
      ws.close();
    };
  }, [promptId]);

  return { realtimeContent, connection };
};
```

### 2. A/B Testing with Prompts

```typescript
// src/components/PromptABTest.tsx
import React, { useState, useEffect } from 'react';
import { usePrompt } from '../hooks/usePrompt';

interface PromptABTestProps {
  promptA: string;
  promptB: string;
  variables: Record<string, any>;
  onVariantSelected: (variant: 'A' | 'B') => void;
}

export const PromptABTest: React.FC<PromptABTestProps> = ({
  promptA,
  promptB,
  variables,
  onVariantSelected
}) => {
  const [variant, setVariant] = useState<'A' | 'B'>('A');
  const [impressions, setImpressions] = useState({ A: 0, B: 0 });
  const [clicks, setClicks] = useState({ A: 0, B: 0 });

  const { data: contentA } = usePrompt({
    promptId: promptA,
    variables
  });

  const { data: contentB } = usePrompt({
    promptId: promptB,
    variables
  });

  // Simple A/B assignment (50/50 split)
  useEffect(() => {
    const assignedVariant = Math.random() < 0.5 ? 'A' : 'B';
    setVariant(assignedVariant);
    setImpressions(prev => ({ ...prev, [assignedVariant]: prev[assignedVariant] + 1 }));
  }, []);

  const handleInteraction = () => {
    setClicks(prev => ({ ...prev, [variant]: prev[variant] + 1 }));
    onVariantSelected(variant);
  };

  const clickRateA = impressions.A > 0 ? clicks.A / impressions.A : 0;
  const clickRateB = impressions.B > 0 ? clicks.B / impressions.B : 0;

  return (
    <div className="ab-test">
      {/* Current variant */}
      <div className={`variant variant-${variant.toLowerCase()}`}>
        <div className="variant-label">Variant {variant}</div>
        <div
          className="content"
          onClick={handleInteraction}
          style={{ cursor: 'pointer' }}
        >
          {variant === 'A' ? contentA : contentB}
        </div>
      </div>

      {/* Debug info (remove in production) */}
      <div className="debug-info" style={{ fontSize: '12px', marginTop: '10px' }}>
        <div>Impressions - A: {impressions.A}, B: {impressions.B}</div>
        <div>Clicks - A: {clicks.A}, B: {clicks.B}</div>
        <div>Click Rate - A: {(clickRateA * 100).toFixed(1)}%, B: {(clickRateB * 100).toFixed(1)}%</div>
      </div>
    </div>
  );
};
```

## 🚀 Best Practices

### 1. Error Boundaries

```typescript
// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary">
          <h2>Something went wrong.</h2>
          <p>We're having trouble loading this content.</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrap your PromptOps components
const SafePromptComponent: React.FC<PromptComponentProps> = (props) => {
  return (
    <ErrorBoundary fallback={<div>Content temporarily unavailable</div>}>
      <PromptComponent {...props} />
    </ErrorBoundary>
  );
};
```

### 2. Performance Optimization

```typescript
// src/hooks/useOptimizedPrompt.ts
import { useMemo } from 'react';
import { usePrompt } from './usePrompt';

export const useOptimizedPrompt = (
  promptId: string,
  variables: Record<string, any>,
  options?: {
    debounceMs?: number;
    cacheKey?: string;
  }
) => {
  const cacheKey = useMemo(
    () => options?.cacheKey || `${promptId}-${JSON.stringify(variables)}`,
    [promptId, variables, options?.cacheKey]
  );

  // Memoize the request to prevent unnecessary re-fetches
  const request = useMemo(
    () => ({
      promptId,
      variables
    }),
    [promptId, JSON.stringify(variables)]
  );

  return usePrompt(request, {
    ...options,
    // Add additional optimization options
    staleTime: options?.debounceMs || 5000
  });
};
```

## 📚 Complete Application Example

```typescript
// src/App.tsx
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { PromptOpsProvider } from './contexts/PromptOpsContext';
import { WelcomeMessage } from './components/WelcomeMessage';
import { ChatInterface } from './components/ChatInterface';
import { ContentGenerator } from './components/ContentGenerator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.code === 'AUTHENTICATION_ERROR') return false;
        return failureCount < 3;
      },
      refetchOnWindowFocus: false
    }
  }
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <PromptOpsProvider apiKey={process.env.REACT_APP_PROMPTOPS_API_KEY!}>
        <div className="app">
          <header>
            <h1>My Application</h1>
            <WelcomeMessage name="User" />
          </header>

          <main>
            <section>
              <h2>Customer Support Chat</h2>
              <ChatInterface
                systemPromptId="customer-support-system"
                initialMessage="Hello! How can I help you today?"
              />
            </section>

            <section>
              <h2>Content Generator</h2>
              <ContentGenerator
                promptId="blog-post-generator"
                onGenerated={(content) => console.log('Generated:', content)}
              />
            </section>
          </main>
        </div>
      </PromptOpsProvider>
    </QueryClientProvider>
  );
};

export default App;
```

---

*For more React examples, check the [examples directory](../../promptops-client-npm/examples/) in the JavaScript client repository.*