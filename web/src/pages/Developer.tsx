import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authenticatedFetch } from '@/lib/httpInterceptor'
import {
  Code,
  Download,
  CheckCircle,
  ArrowRight,
  Github,
  Package,
  Terminal,
  FileCode,
  Key,
  Shield,
  Zap,
  Copy,
  GitBranch,
  Search,
  Database,
  Cpu,
  Play,
  Loader2,
  Settings,
  Code2,
  GitPullRequest,
  Rocket,
  Eye,
  EyeOff,
  Activity,
  LineChart,
  BarChart3,
  Building2,
  Users,
  Heart,
  ShoppingCart,
  GraduationCap,
  Briefcase,
  Scale,
  UserCheck,
  FileText,
  TrendingUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

export function DeveloperPage() {
  // State for prompt retrieval
  const [projectId, setProjectId] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [llmModel, setLlmModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState('')

  // Enhanced state for testing functionality
  const [testVariables, setTestVariables] = useState('')
  const [showVariables, setShowVariables] = useState(false)
  const [testResults, setTestResults] = useState<any[]>([])

  // Available LLM models
  const availableModels = [
    { value: 'gpt-4', label: 'GPT-4', provider: 'openai' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'openai' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet', provider: 'anthropic' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus', provider: 'anthropic' },
    { value: 'gemini-pro', label: 'Gemini Pro', provider: 'google' },
    { value: 'llama-2', label: 'Llama 2', provider: 'meta' }
  ]

  // Function to retrieve prompts
  const retrievePrompts = async () => {
    if (!projectId || !moduleId) {
      setError('Project ID and Module ID are required')
      return
    }

    setLoading(true)
    setError('')
    setResults([])

    try {
      // Build query parameters
      const params = new URLSearchParams({
        project_id: projectId,
        module_id: moduleId,
      })

      if (llmModel) {
        // Parse model to get provider and name
        const model = availableModels.find(m => m.value === llmModel)
        if (model) {
          params.append('llm_model', llmModel)
        }
      }

      const response = await authenticatedFetch(`/v1/prompts?${params.toString()}`)

      if (response.ok) {
        const data = await response.json()
        setResults(data.items || data)
      } else {
        const errorData = await response.json()
        setError(errorData.detail || 'Failed to retrieve prompts')
      }
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  // Enhanced testing functions
  const testSinglePrompt = async (prompt: any) => {
    if (!apiKey) {
      setError('API key is required for testing')
      return
    }

    // Loading state removed
    try {
      let variables = {}
      if (testVariables) {
        try {
          variables = JSON.parse(testVariables)
        } catch (e) {
          setError('Invalid JSON in test variables')
          return
        }
      }

      const startTime = Date.now()
      const response = await authenticatedFetch('/api/v1/execute-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          prompt_id: prompt.id,
          variables,
          model: llmModel || 'gpt-4',
        }),
      })

      const data = await response.json()
      const duration = Date.now() - startTime

      const testResult = {
        promptName: prompt.name || `Prompt ${prompt.id}`,
        promptId: prompt.id,
        model: llmModel || 'gpt-4',
        variables,
        success: response.ok,
        response: data.response || data.error || 'No response',
        duration,
        tokens: data.tokens || 0,
        timestamp: new Date().toISOString(),
      }

      setTestResults(prev => [...prev, testResult])
    } catch (err) {
      const testResult = {
        promptName: prompt.name || `Prompt ${prompt.id}`,
        promptId: prompt.id,
        model: llmModel || 'gpt-4',
        variables: testVariables ? JSON.parse(testVariables) : {},
        success: false,
        response: err instanceof Error ? err.message : 'Unknown error',
        duration: 0,
        tokens: 0,
        timestamp: new Date().toISOString(),
      }
      setTestResults(prev => [...prev, testResult])
    } finally {
      // Loading state removed
    }
  }

  const testPrompts = async () => {
    if (!apiKey) {
      setError('API key is required for testing')
      return
    }

    if (results.length === 0) {
      setError('No prompts to test')
      return
    }

    // Loading state removed
    try {
      let variables = {}
      if (testVariables) {
        try {
          variables = JSON.parse(testVariables)
        } catch (e) {
          setError('Invalid JSON in test variables')
          return
        }
      }

      const testPromises = results.map(async (prompt) => {
        const startTime = Date.now()
        try {
          const response = await authenticatedFetch('/api/v1/execute-prompt', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey,
            },
            body: JSON.stringify({
              prompt_id: prompt.id,
              variables,
              model: llmModel || 'gpt-4',
            }),
          })

          const data = await response.json()
          const duration = Date.now() - startTime

          return {
            promptName: prompt.name || `Prompt ${prompt.id}`,
            promptId: prompt.id,
            model: llmModel || 'gpt-4',
            variables,
            success: response.ok,
            response: data.response || data.error || 'No response',
            duration,
            tokens: data.tokens || 0,
            timestamp: new Date().toISOString(),
          }
        } catch (error) {
          return {
            promptName: prompt.name || `Prompt ${prompt.id}`,
            promptId: prompt.id,
            model: llmModel || 'gpt-4',
            variables,
            success: false,
            response: error instanceof Error ? error.message : 'Unknown error',
            duration: 0,
            tokens: 0,
            timestamp: new Date().toISOString(),
          }
        }
      })

      const testResultsData = await Promise.all(testPromises)
      setTestResults(prev => [...prev, ...testResultsData])
    } catch (error) {
      setError('Failed to test prompts')
    } finally {
      // Loading state removed
    }
  }

  const compareResults = () => {
    // This function is called by the Compare Results button
    // The actual comparison logic is handled in the UI component
    console.log('Comparing test results:', testResults)
  }

  const pipInstallationCode = `# Install the Python client
pip install promptops-client

# Or with optional dependencies
pip install promptops-client[redis]      # Redis caching
pip install promptops-client[otel]       # OpenTelemetry
pip install promptops-client[all]        # All optional features

# CLI tool is automatically installed
promptops --help`

  const npmInstallationCode = `# Install the JavaScript/TypeScript client
npm install promptops-client

# CLI tool installation
npm install -g promptops-client    # Global CLI access
npx promptops --help              # Run CLI without global install

# TypeScript types are included`

  const pythonAuthCode = `from promptops import PromptOpsClient

# Initialize with automatic environment detection
# The client will automatically detect development vs production
client = PromptOpsClient(
    api_key="your_api_key_here"
)

# Or specify environment manually
client = PromptOpsClient(
    base_url="http://localhost:8000",  # Development
    api_key="your_api_key_here"
)

# List prompts for a specific project and module
prompts = await client.list_prompts(
    module_id="your_module_id",
    project_id="your_project_id"
)
print(f"Found {len(prompts)} prompts")

# Get a specific prompt with version
prompt = await client.get_prompt(
    prompt_id="prompt_id_here",
    version="1.0.0"
)
print(f"Prompt: {prompt.name}")
print(f"Content: {prompt.content}")

# Render a prompt with variables
variables = PromptVariables(variables={
    "user_name": "John",
    "task": "Write a summary"
})
rendered = await client.render_prompt(
    prompt_id="prompt_id_here",
    variables=variables
)
print(f"Rendered: {rendered.rendered_content}")`

  const javascriptAuthCode = `import { PromptOpsClient } from 'promptops-client';

// Initialize with automatic environment detection
// The client will automatically detect development vs production
const client = new PromptOpsClient({
  apiKey: 'your_api_key_here'
});

// Or specify environment manually
const client = new PromptOpsClient({
  environment: 'development',  // or 'production'
  apiKey: 'your_api_key_here'
});

// Initialize the client
await client.initialize();

// List prompts for a specific project and module
const prompts = await client.listPrompts(
  'your_module_id',
  'your_project_id'
);
console.log(\`Found \${prompts.length} prompts\`);

// Get a specific prompt with variables
const content = await client.getPromptContent({
  promptId: 'your_prompt_id',
  version: '1.0.0',
  variables: {
    userName: 'John',
    task: 'Write a summary'
  }
});
console.log('Rendered content:', content);

// Check model compatibility
const isCompatible = await client.getModelCompatibility(
  'your_prompt_id',
  'openai',
  'gpt-4'
);
console.log('GPT-4 compatible:', isCompatible);`

  const pythonUsageCode = `import promptops

# Initialize client with environment detection
client = promptops.Client(
    api_key="your_api_key_here",
    # Optional: specify environment for development
    # environment="development"
)

# Use a prompt in your application with project and module context
response = client.use_prompt(
    prompt_id="your_prompt_id",
    project_id="your_project_id",
    module_id="your_module_id",
    variables={
        "user_input": "Hello, how are you?",
        "language": "English"
    }
)

print(response.content)
print(response.usage)

# Use with specific LLM model
claude_response = client.use_prompt(
    prompt_id="your_prompt_id",
    project_id="your_project_id",
    module_id="your_module_id",
    llm_model="claude-3-sonnet",
    variables={
        "user_input": "Hello, how are you?",
        "language": "English"
    }
)

print(claude_response.content)
print(claude_response.usage)`

  const javascriptUsageCode = `import { PromptOpsClient } from 'promptops-client';

const client = new PromptOpsClient({
  apiKey: 'your_api_key_here',
  // Optional: specify environment for development
  // environment: 'development'
});

await client.initialize();

// Use a prompt with variables
const result = await client.renderPrompt({
  promptId: 'your_prompt_id',
  variables: {
    userInput: 'Hello, how are you?',
    language: 'English'
  },
  modelProvider: 'openai',
  modelName: 'gpt-4'
});

console.log(result.renderedContent);

// Interactive mode
const health = await client.healthCheck();
console.log('Client health:', health.status);

// Performance optimization
const stats = client.getCacheStats();
console.log('Cache hit rate:', (stats.hitRate * 100).toFixed(2) + '%');`

  const cliExamplesCode = `# Python CLI Examples

# List available prompts
promptops list --api-key your_key --module-id your_module

# Get a specific prompt
promptops get hello-world --api-key your_key --version 1.0.0

# Render a prompt with variables
promptops render greeting --api-key your_key \\
  --variables '{"name": "Developer", "company": "TechCorp"}'

# Test connection with automatic environment detection
promptops test --api-key your_key

# Or specify environment manually
promptops test --api-key your_key --base-url http://localhost:8000

# Show statistics
promptops stats --api-key your_key

# Interactive mode
promptops interactive --api-key your_key

# Validate prompt
promptops validate hello-world --api-key your_key

# JavaScript CLI Examples

# List available prompts
npx promptops list --api-key your_key --module-id your_module

# Get a specific prompt
npx promptops get hello-world --api-key your_key

# Render with JSON variables
npx promptops render greeting --api-key your_key \\
  --variables '{"name": "Developer", "framework": "TypeScript"}'

# Health check
npx promptops health --api-key your_key

# Cache management
npx promptops cache-stats --api-key your_key
npx promptops clear-cache --api-key your_key --prompt-id greeting

# Interactive mode
npx promptops interactive --api-key your_key`

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Code copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <section className="py-16 bg-white border-b border-gray-200">
        <div className="px-6 max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-6">
              <Code className="w-4 h-4 mr-2" />
              Developer Documentation
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Build with PromptOps
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Integrate professional prompt management into your applications with our Python and JavaScript SDKs.
              Treat prompts as source code with version control, governance, and multi-model support.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button size="lg" className="w-full sm:w-auto">
                  <Download className="mr-2 w-5 h-5" />
                  Get Started Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                <Github className="mr-2 w-5 h-5" />
                View on GitHub
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Installation Section */}
      <section className="py-16 bg-gray-50">
        <div className="px-6 max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Installation
            </h2>
            <p className="text-xl text-gray-600">
              Choose your preferred package manager and get started in minutes
            </p>
          </div>

          <Tabs defaultValue="pip" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pip" className="flex items-center space-x-2">
                <Package className="w-4 h-4" />
                <span>Python (pip)</span>
              </TabsTrigger>
              <TabsTrigger value="npm" className="flex items-center space-x-2">
                <Package className="w-4 h-4" />
                <span>JavaScript (npm)</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pip" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Terminal className="w-5 h-5" />
                    <span>Pip Installation</span>
                  </CardTitle>
                  <CardDescription>
                    Install PromptOps SDK for Python using pip
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                      <code>{pipInstallationCode}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(pipInstallationCode)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="npm" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Terminal className="w-5 h-5" />
                    <span>NPM Installation</span>
                  </CardTitle>
                  <CardDescription>
                    Install PromptOps SDK for JavaScript/Node.js using npm
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                      <code>{npmInstallationCode}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(npmInstallationCode)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Authentication Section */}
      <section className="py-16 bg-white">
        <div className="px-6 max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Authentication
            </h2>
            <p className="text-xl text-gray-600">
              Initialize the client with your API credentials
            </p>
          </div>

          <Tabs defaultValue="python" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="python" className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded" style={{ clipPath: 'polygon(0 0, 75% 0, 100% 50%, 75% 100%, 0 100%, 50% 50%)' }} />
                <span>Python</span>
              </TabsTrigger>
              <TabsTrigger value="javascript" className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-500 rounded" style={{ clipPath: 'polygon(0 0, 100% 0, 80% 100%, 0 100%)' }} />
                <span>JavaScript</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="python" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Key className="w-5 h-5" />
                    <span>Python Authentication</span>
                  </CardTitle>
                  <CardDescription>
                    Initialize the PromptOps client with your API key and secret key
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                      <code>{pythonAuthCode}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(pythonAuthCode)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="javascript" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Key className="w-5 h-5" />
                    <span>JavaScript Authentication</span>
                  </CardTitle>
                  <CardDescription>
                    Initialize the PromptOps client with your API key and secret key
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                      <code>{javascriptAuthCode}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(javascriptAuthCode)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-8 max-w-2xl mx-auto">
            <Alert>
              <AlertTitle>
                <Shield className="w-5 h-5 mr-2" />
                Getting Your API Keys
              </AlertTitle>
              <AlertDescription>
                You need API keys to authenticate with PromptOps. Get your API keys from your account dashboard by navigating to "API Keys" in the sidebar.
                Each key is scoped to specific projects and permissions for enhanced security.
              </AlertDescription>
              <Link to="/keys" className="mt-4 inline-flex items-center text-blue-600 hover:text-blue-800 font-medium">
                Go to API Keys Dashboard
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Alert>
          </div>
        </div>
      </section>

      {/* Environment Configuration Section */}
      <section className="py-16 bg-gray-50">
        <div className="px-6 max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Environment Configuration
            </h2>
            <p className="text-xl text-gray-600">
              Automatic environment detection for seamless development and deployment
            </p>
          </div>

          <Tabs defaultValue="automatic" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="automatic" className="flex items-center space-x-2">
                <Zap className="w-4 h-4" />
                <span>Auto-Detection</span>
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Manual Config</span>
              </TabsTrigger>
              <TabsTrigger value="docker" className="flex items-center space-x-2">
                <Database className="w-4 h-4" />
                <span>Deployment</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="automatic" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="w-5 h-5" />
                    <span>Automatic Environment Detection</span>
                  </CardTitle>
                  <CardDescription>
                    The client automatically detects your environment and configures the appropriate settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <code>{`# Python - Automatic Detection
from promptops import PromptOpsClient

# Automatically detects development vs production
client = PromptOpsClient(api_key="your_key")

# The client will:
# ✓ Detect localhost accessibility (development)
# ✓ Use production URLs for non-local environments
# ✓ Apply appropriate timeouts and retry settings
# ✓ Enable connection testing by default`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`# Python - Automatic Detection
from promptops import PromptOpsClient

# Automatically detects development vs production
client = PromptOpsClient(api_key="your_key")

# The client will:
# ✓ Detect localhost accessibility (development)
# ✓ Use production URLs for non-local environments
# ✓ Apply appropriate timeouts and retry settings
# ✓ Enable connection testing by default`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <code>{`# JavaScript - Automatic Detection
import { PromptOpsClient } from 'promptops-client';

const client = new PromptOpsClient({
  apiKey: 'your_api_key_here'
});

// Automatically configures:
// - Base URL based on environment
// - Connection timeouts
// - Retry mechanisms
// - Health checking

await client.initialize();`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`# JavaScript - Automatic Detection
import { PromptOpsClient } from 'promptops-client';

const client = new PromptOpsClient({
  apiKey: 'your_api_key_here'
});

// Automatically configures:
// - Base URL based on environment
// - Connection timeouts
// - Retry mechanisms
// - Health checking

await client.initialize();`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="manual" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="w-5 h-5" />
                    <span>Manual Configuration</span>
                  </CardTitle>
                  <CardDescription>
                    Override automatic detection with custom settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3">Development Environment</h4>
                        <div className="relative">
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                            <code>{`# Python Development
client = PromptOpsClient(
    api_key="your_key",
    environment="development",
    base_url="http://localhost:8000",
    connection_timeout=5.0,
    enable_connection_test=True
)`}</code>
                          </pre>
                          <Button
                            variant="outline"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(`# Python Development
client = PromptOpsClient(
    api_key="your_key",
    environment="development",
    base_url="http://localhost:8000",
    connection_timeout=5.0,
    enable_connection_test=True
)`)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3">Production Environment</h4>
                        <div className="relative">
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                            <code>{`# Python Production
client = PromptOpsClient(
    api_key="your_key",
    environment="production",
    base_url="https://api.promptops.ai",
    connection_timeout=30.0,
    max_retries=5
)`}</code>
                          </pre>
                          <Button
                            variant="outline"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(`# Python Production
client = PromptOpsClient(
    api_key="your_key",
    environment="production",
    base_url="https://api.promptops.ai",
    connection_timeout=30.0,
    max_retries=5
)`)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <h4 className="font-semibold mb-3">Environment Variables</h4>
                      <div className="relative">
                        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                          <code>{`# Set via environment variables
export PROMPTOPS_ENVIRONMENT=development
export PROMPTOPS_BASE_URL=http://localhost:8000
export PROMPTOPS_API_KEY=your_key_here
export PROMPTOPS_CONNECTION_TIMEOUT=5.0

# Client will automatically use environment settings
client = PromptOpsClient()`}</code>
                        </pre>
                        <Button
                          variant="outline"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(`# Set via environment variables
export PROMPTOPS_ENVIRONMENT=development
export PROMPTOPS_BASE_URL=http://localhost:8000
export PROMPTOPS_API_KEY=your_key_here
export PROMPTOPS_CONNECTION_TIMEOUT=5.0

# Client will automatically use environment settings
client = PromptOpsClient()`)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="docker" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Database className="w-5 h-5" />
                    <span>Container Deployment</span>
                  </CardTitle>
                  <CardDescription>
                    Use PromptOps clients in containerized environments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <code>{`# Dockerfile example
FROM python:3.11-slim

WORKDIR /app

# Install PromptOps client
RUN pip install promptops-client

# Copy application code
COPY . .

# Set environment variables for container
ENV PROMPTOPS_ENVIRONMENT=production
ENV PROMPTOPS_BASE_URL=https://api.promptops.ai

# Default command
CMD ["python", "app.py"]`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`# Dockerfile example
FROM python:3.11-slim

WORKDIR /app

# Install PromptOps client
RUN pip install promptops-client

# Copy application code
COPY . .

# Set environment variables for container
ENV PROMPTOPS_ENVIRONMENT=production
ENV PROMPTOPS_BASE_URL=https://api.promptops.ai

# Default command
CMD ["python", "app.py"]`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <code>{`# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    environment:
      - PROMPTOPS_API_KEY=\${PROMPTOPS_API_KEY}
      - PROMPTOPS_ENVIRONMENT=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    environment:
      - PROMPTOPS_API_KEY=\${PROMPTOPS_API_KEY}
      - PROMPTOPS_ENVIRONMENT=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-8 max-w-2xl mx-auto">
            <Alert>
              <AlertTitle>
                <Shield className="w-5 h-5 mr-2" />
                Environment Best Practices
              </AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Use automatic detection for local development</li>
                  <li>• Set explicit environment configuration for production</li>
                  <li>• Use environment variables for sensitive data</li>
                  <li>• Enable connection testing in development environments</li>
                  <li>• Configure appropriate timeouts for your use case</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </section>

      {/* Usage Examples */}
      <section className="py-16 bg-gray-50">
        <div className="px-6 max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Usage Examples
            </h2>
            <p className="text-xl text-gray-600">
              See how to use prompts in your applications
            </p>
          </div>

          <Tabs defaultValue="python" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="python" className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded" style={{ clipPath: 'polygon(0 0, 75% 0, 100% 50%, 75% 100%, 0 100%, 50% 50%)' }} />
                <span>Python</span>
              </TabsTrigger>
              <TabsTrigger value="javascript" className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-500 rounded" style={{ clipPath: 'polygon(0 0, 100% 0, 80% 100%, 0 100%)' }} />
                <span>JavaScript</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="python" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileCode className="w-5 h-5" />
                    <span>Python Usage</span>
                  </CardTitle>
                  <CardDescription>
                    Use prompts in your Python applications with variables
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                      <code>{pythonUsageCode}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(pythonUsageCode)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="javascript" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileCode className="w-5 h-5" />
                    <span>JavaScript Usage</span>
                  </CardTitle>
                  <CardDescription>
                    Use prompts in your JavaScript applications with variables
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                      <code>{javascriptUsageCode}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(javascriptUsageCode)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* CLI Tools Section */}
      <section className="py-16 bg-white">
        <div className="px-6 max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Command Line Interface
            </h2>
            <p className="text-xl text-gray-600">
              Powerful CLI tools for prompt management and development workflows
            </p>
          </div>

          <Tabs defaultValue="examples" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="examples" className="flex items-center space-x-2">
                <Terminal className="w-4 h-4" />
                <span>Examples</span>
              </TabsTrigger>
              <TabsTrigger value="features" className="flex items-center space-x-2">
                <Zap className="w-4 h-4" />
                <span>Features</span>
              </TabsTrigger>
              <TabsTrigger value="setup" className="flex items-center space-x-2">
                <Play className="w-4 h-4" />
                <span>Quick Setup</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="examples" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Terminal className="w-5 h-5" />
                    <span>CLI Usage Examples</span>
                  </CardTitle>
                  <CardDescription>
                    Common CLI commands for both Python and JavaScript
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{cliExamplesCode}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(cliExamplesCode)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features" className="mt-8">
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Cpu className="w-5 h-5" />
                      <span>Core Features</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Interactive Mode</h4>
                        <p className="text-sm text-gray-600">Real-time prompt testing and debugging</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Variable Substitution</h4>
                        <p className="text-sm text-gray-600">Dynamic variable injection from CLI</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Health Monitoring</h4>
                        <p className="text-sm text-gray-600">Connection and service health checks</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Cache Management</h4>
                        <p className="text-sm text-gray-600">View and clear cache statistics</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Database className="w-5 h-5" />
                      <span>Advanced Capabilities</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Model Compatibility</h4>
                        <p className="text-sm text-gray-600">Check prompt compatibility across models</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Batch Operations</h4>
                        <p className="text-sm text-gray-600">Process multiple prompts efficiently</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Multiple Formats</h4>
                        <p className="text-sm text-gray-600">JSON and text output formats</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Configuration Files</h4>
                        <p className="text-sm text-gray-600">Save settings in config files</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="setup" className="mt-8">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Play className="w-5 h-5" />
                      <span>Developer Environment Setup</span>
                    </CardTitle>
                    <CardDescription>
                      Quick setup for development with automated scripts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <code>{`# Clone and setup development environment
git clone https://github.com/promptops/promptops.git
cd promptops

# Run the automated setup script
./setup-dev.sh

# This script will:
# ✓ Set up Python virtual environment
# ✓ Install JavaScript dependencies
# ✓ Configure development tools
# ✓ Set up pre-commit hooks
# ✓ Create environment templates
# ✓ Run validation tests

# Quick start with CLI
promptops --help
npx promptops --help`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`# Clone and setup development environment
git clone https://github.com/promptops/promptops.git
cd promptops

# Run the automated setup script
./setup-dev.sh

# This script will:
# ✓ Set up Python virtual environment
# ✓ Install JavaScript dependencies
# ✓ Configure development tools
# ✓ Set up pre-commit hooks
# ✓ Create environment templates
# ✓ Run validation tests

# Quick start with CLI
promptops --help
npx promptops --help`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Python Development</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Virtual environment setup</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Pre-commit hooks configured</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Testing framework ready</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Type checking enabled</span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">JavaScript Development</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>npm dependencies installed</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>TypeScript support enabled</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Build system configured</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Linting and formatting ready</span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Advanced CLI Section */}
      <section className="py-16 bg-gray-50">
        <div className="px-6 max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Advanced CLI Features
            </h2>
            <p className="text-xl text-gray-600">
              Professional-grade tools for prompt management and development workflows
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  <span>Configuration Management</span>
                </CardTitle>
                <CardDescription>
                  Save and manage CLI settings across projects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Project Configs</h4>
                      <p className="text-sm text-gray-600">Environment-specific settings</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Template Generation</h4>
                      <p className="text-sm text-gray-600">Auto-generate config files</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Secrets Management</h4>
                      <p className="text-sm text-gray-600">Secure credential storage</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Code2 className="w-5 h-5 text-purple-600" />
                  <span>Development Tools</span>
                </CardTitle>
                <CardDescription>
                  Streamline your prompt development workflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Local Testing</h4>
                      <p className="text-sm text-gray-600">Test prompts without API calls</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Batch Processing</h4>
                      <p className="text-sm text-gray-600">Process multiple prompts at once</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Debug Mode</h4>
                      <p className="text-sm text-gray-600">Detailed logging and tracing</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <GitPullRequest className="w-5 h-5 text-green-600" />
                  <span>CI/CD Integration</span>
                </CardTitle>
                <CardDescription>
                  Automate prompt validation and deployment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">GitHub Actions</h4>
                      <p className="text-sm text-gray-600">Pre-built workflow templates</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Pre-commit Hooks</h4>
                      <p className="text-sm text-gray-600">Automated prompt validation</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Release Automation</h4>
                      <p className="text-sm text-gray-600">Semantic versioning support</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Rocket className="w-5 h-5" />
                  <span>Pro CLI Commands</span>
                </CardTitle>
                <CardDescription>
                  Advanced commands for power users and automation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{`# Advanced Python CLI Usage

# Initialize project configuration
promptops init --project my-app --environment development

# Run comprehensive tests
promptops test --suite integration --coverage --report-html

# Deploy prompts to staging
promptops deploy --environment staging --prompts prompts/ --dry-run

# Monitor performance metrics
promptops monitor --metrics latency,success_rate --timeframe 24h

# Advanced JavaScript CLI Usage

# Create project scaffold
npx promptops create my-typescript-app --template typescript

# Run validation pipeline
npx promptops validate --all --strict --fail-on-warning

# Generate documentation
npx promptops docs --output ./docs --format markdown

# Setup CI/CD pipeline
npx promptops ci-setup --platform github --branch main`}</code>
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(`# Advanced Python CLI Usage

# Initialize project configuration
promptops init --project my-app --environment development

# Run comprehensive tests
promptops test --suite integration --coverage --report-html

# Deploy prompts to staging
promptops deploy --environment staging --prompts prompts/ --dry-run

# Monitor performance metrics
promptops monitor --metrics latency,success_rate --timeframe 24h

# Advanced JavaScript CLI Usage

# Create project scaffold
npx promptops create my-typescript-app --template typescript

# Run validation pipeline
npx promptops validate --all --strict --fail-on-warning

# Generate documentation
npx promptops docs --output ./docs --format markdown

# Setup CI/CD pipeline
npx promptops ci-setup --platform github --branch main`)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* A/B Testing Section */}
      <section className="py-16 bg-gray-50">
        <div className="px-6 max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              A/B Testing Capabilities
            </h2>
            <p className="text-xl text-gray-600">
              Optimize your prompts with sophisticated A/B testing and statistical analysis
            </p>
          </div>

          <Tabs defaultValue="overview" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" className="flex items-center space-x-2">
                <GitBranch className="w-4 h-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="examples" className="flex items-center space-x-2">
                <Code className="w-4 h-4" />
                <span>Examples</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>Analytics</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-8">
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <GitBranch className="w-5 h-5 text-blue-600" />
                      <span>Smart Traffic Allocation</span>
                    </CardTitle>
                    <CardDescription>
                      Advanced algorithms for optimal user distribution
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Multi-Armed Bandit</h4>
                        <p className="text-sm text-gray-600">Adaptive traffic allocation based on performance</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">User Segmentation</h4>
                        <p className="text-sm text-gray-600">Target specific user groups for testing</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Session Consistency</h4>
                        <p className="text-sm text-gray-600">Maintain user experience across sessions</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5 text-purple-600" />
                      <span>Statistical Analysis</span>
                    </CardTitle>
                    <CardDescription>
                      Real-time insights and confidence calculations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Bayesian Analysis</h4>
                        <p className="text-sm text-gray-600">Probabilistic confidence intervals</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Real-time Monitoring</h4>
                        <p className="text-sm text-gray-600">Live performance metrics</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Statistical Significance</h4>
                        <p className="text-sm text-gray-600">Automated winner detection</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="examples" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Code className="w-5 h-5" />
                    <span>A/B Testing Implementation</span>
                  </CardTitle>
                  <CardDescription>
                    Examples of how to implement A/B testing with PromptOps
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <code>{`# Python A/B Testing Example
from promptops import PromptOpsClient

client = PromptOpsClient(api_key="your_key")

# Create an A/B test experiment
experiment = await client.create_experiment(
    name="Email Subject Line Test",
    prompt_id="email_generator",
    variants=[
        {
            "name": "variant_a",
            "weight": 0.5,
            "variables": {"tone": "professional"}
        },
        {
            "name": "variant_b",
            "weight": 0.5,
            "variables": {"tone": "casual"}
        }
    ],
    success_metric="open_rate",
    target_audience="new_users"
)

# Track user assignment and results
user_variant = await client.get_user_variant(
    experiment_id=experiment.id,
    user_id="user_123"
)

# Record conversion event
await client.record_conversion(
    experiment_id=experiment.id,
    user_id="user_123",
    variant_name=user_variant.name,
    conversion_value=1.0
)`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`# Python A/B Testing Example
from promptops import PromptOpsClient

client = PromptOpsClient(api_key="your_key")

# Create an A/B test experiment
experiment = await client.create_experiment(
    name="Email Subject Line Test",
    prompt_id="email_generator",
    variants=[
        {
            "name": "variant_a",
            "weight": 0.5,
            "variables": {"tone": "professional"}
        },
        {
            "name": "variant_b",
            "weight": 0.5,
            "variables": {"tone": "casual"}
        }
    ],
    success_metric="open_rate",
    target_audience="new_users"
)

# Track user assignment and results
user_variant = await client.get_user_variant(
    experiment_id=experiment.id,
    user_id="user_123"
)

# Record conversion event
await client.record_conversion(
    experiment_id=experiment.id,
    user_id="user_123",
    variant_name=user_variant.name,
    conversion_value=1.0
)`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <code>{`# JavaScript A/B Testing Example
import { PromptOpsClient } from 'promptops-client';

const client = new PromptOpsClient({
  apiKey: 'your_api_key_here'
});

await client.initialize();

// Create A/B test with adaptive allocation
const experiment = await client.createExperiment({
  name: 'Chatbot Response Style',
  promptId: 'customer_support',
  variants: [
    {
      name: 'detailed',
      weight: 0.5,
      variables: { style: 'detailed', maxLength: 200 }
    },
    {
      name: 'concise',
      weight: 0.5,
      variables: { style: 'concise', maxLength: 100 }
    }
  ],
  allocationStrategy: 'adaptive', // Uses multi-armed bandit
  successMetrics: ['response_time', 'user_satisfaction']
});

// Get variant for user session
const assignment = await client.getAssignment({
  experimentId: experiment.id,
  userId: 'user_456',
  sessionId: 'session_789'
});

// Track performance metrics
await client.trackEvent({
  experimentId: experiment.id,
  userId: 'user_456',
  variantName: assignment.variantName,
  eventName: 'message_sent',
  metadata: { responseTime: 1500 }
});`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`# JavaScript A/B Testing Example
import { PromptOpsClient } from 'promptops-client';

const client = new PromptOpsClient({
  apiKey: 'your_api_key_here'
});

await client.initialize();

// Create A/B test with adaptive allocation
const experiment = await client.createExperiment({
  name: 'Chatbot Response Style',
  promptId: 'customer_support',
  variants: [
    {
      name: 'detailed',
      weight: 0.5,
      variables: { style: 'detailed', maxLength: 200 }
    },
    {
      name: 'concise',
      weight: 0.5,
      variables: { style: 'concise', maxLength: 100 }
    }
  ],
  allocationStrategy: 'adaptive', // Uses multi-armed bandit
  successMetrics: ['response_time', 'user_satisfaction']
});

// Get variant for user session
const assignment = await client.getAssignment({
  experimentId: experiment.id,
  userId: 'user_456',
  sessionId: 'session_789'
});

// Track performance metrics
await client.trackEvent({
  experimentId: experiment.id,
  userId: 'user_456',
  variantName: assignment.variantName,
  eventName: 'message_sent',
  metadata: { responseTime: 1500 }
});`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5" />
                    <span>Analytics & Monitoring</span>
                  </CardTitle>
                  <CardDescription>
                    Real-time insights and statistical analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <code>{`# Get experiment results and analytics
results = await client.get_experiment_results(
    experiment_id="exp_123",
    include_statistics=True
)

print(f"Total participants: {results.total_participants}")
print(f"Conversion rates: {results.conversion_rates}")
print(f"Confidence intervals: {results.confidence_intervals}")
print(f"Statistical significance: {results.is_significant}")

# Get real-time metrics
metrics = await client.get_experiment_metrics(
    experiment_id="exp_123",
    timeframe="24h"
)

for metric in metrics:
    print(f"{metric.name}: {metric.value} ({metric.change_trend})")`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`# Get experiment results and analytics
results = await client.get_experiment_results(
    experiment_id="exp_123",
    include_statistics=True
)

print(f"Total participants: {results.total_participants}")
print(f"Conversion rates: {results.conversion_rates}")
print(f"Confidence intervals: {results.confidence_intervals}")
print(f"Statistical significance: {results.is_significant}")

# Get real-time metrics
metrics = await client.get_experiment_metrics(
    experiment_id="exp_123",
    timeframe="24h"
)

for metric in metrics:
    print(f"{metric.name}: {metric.value} ({metric.change_trend})"`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <h4 className="font-semibold text-blue-600">95%+</h4>
                          <p className="text-sm text-gray-600">Confidence Level</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <h4 className="font-semibold text-green-600">Real-time</h4>
                          <p className="text-sm text-gray-600">Results Update</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <h4 className="font-semibold text-purple-600">Adaptive</h4>
                          <p className="text-sm text-gray-600">Traffic Allocation</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-8 max-w-2xl mx-auto">
            <Alert>
              <AlertTitle>
                <Zap className="w-5 h-5 mr-2" />
                A/B Testing Best Practices
              </AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Start with clear hypotheses and success metrics</li>
                  <li>• Use adaptive allocation for optimal performance</li>
                  <li>• Monitor experiments for statistical significance</li>
                  <li>• Consider user experience and consistency</li>
                  <li>• Document results and learnings for future tests</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </section>

      {/* Performance Monitoring Section */}
      <section className="py-16 bg-gray-50">
        <div className="px-6 max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Performance Monitoring
            </h2>
            <p className="text-xl text-gray-600">
              Comprehensive monitoring and analytics for your prompt operations
            </p>
          </div>

          <Tabs defaultValue="overview" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" className="flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="metrics" className="flex items-center space-x-2">
                <LineChart className="w-4 h-4" />
                <span>Metrics</span>
              </TabsTrigger>
              <TabsTrigger value="optimization" className="flex items-center space-x-2">
                <Zap className="w-4 h-4" />
                <span>Optimization</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-8">
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Activity className="w-5 h-5 text-blue-600" />
                      <span>Real-time Monitoring</span>
                    </CardTitle>
                    <CardDescription>
                      Track performance metrics with OpenTelemetry integration
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span className="text-sm">Latency tracking and percentile analysis</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span className="text-sm">Success rate and error monitoring</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span className="text-sm">Token usage and cost optimization</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span className="text-sm">Custom metrics and events</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Shield className="w-5 h-5 text-purple-600" />
                      <span>Adaptive Performance</span>
                    </CardTitle>
                    <CardDescription>
                      Intelligent optimization based on usage patterns
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span className="text-sm">Smart caching with invalidation</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span className="text-sm">Adaptive retry mechanisms</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span className="text-sm">Connection pooling and management</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span className="text-sm">Resource utilization optimization</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <LineChart className="w-5 h-5" />
                    <span>Performance Metrics</span>
                  </CardTitle>
                  <CardDescription>
                    Comprehensive metrics collection and analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <h4 className="font-semibold text-blue-600">Latency</h4>
                          <p className="text-sm text-gray-600">P50, P95, P99</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <h4 className="font-semibold text-green-600">Success Rate</h4>
                          <p className="text-sm text-gray-600">Error Tracking</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <h4 className="font-semibold text-purple-600">Token Usage</h4>
                          <p className="text-sm text-gray-600">Cost Analysis</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{`# Python Performance Monitoring Example
from promptops import PromptOpsClient
from prometheus_client import start_http_server, Counter, Histogram
import time

client = PromptOpsClient(api_key="your_api_key")

# Define custom metrics
REQUEST_COUNT = Counter('promptops_requests_total', 'Total requests', ['endpoint', 'status'])
REQUEST_LATENCY = Histogram('promptops_request_duration_seconds', 'Request latency')

async def monitored_prompt_execution():
    start_time = time.time()

    try:
        # Execute prompt with monitoring
        result = await client.execute_prompt(
            prompt_id="customer_support",
            variables={"user_query": "Help with billing"}
        )

        # Record success metrics
        REQUEST_COUNT.labels(endpoint='execute_prompt', status='success').inc()
        REQUEST_LATENCY.observe(time.time() - start_time)

        return result

    except Exception as e:
        # Record error metrics
        REQUEST_COUNT.labels(endpoint='execute_prompt', status='error').inc()
        REQUEST_LATENCY.observe(time.time() - start_time)
        raise`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`# Python Performance Monitoring Example
from promptops import PromptOpsClient
from prometheus_client import start_http_server, Counter, Histogram
import time

client = PromptOpsClient(api_key="your_api_key")

# Define custom metrics
REQUEST_COUNT = Counter('promptops_requests_total', 'Total requests', ['endpoint', 'status'])
REQUEST_LATENCY = Histogram('promptops_request_duration_seconds', 'Request latency')

async def monitored_prompt_execution():
    start_time = time.time()

    try:
        # Execute prompt with monitoring
        result = await client.execute_prompt(
            prompt_id="customer_support",
            variables={"user_query": "Help with billing"}
        )

        # Record success metrics
        REQUEST_COUNT.labels(endpoint='execute_prompt', status='success').inc()
        REQUEST_LATENCY.observe(time.time() - start_time)

        return result

    except Exception as e:
        # Record error metrics
        REQUEST_COUNT.labels(endpoint='execute_prompt', status='error').inc()
        REQUEST_LATENCY.observe(time.time() - start_time)
        raise`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{`// JavaScript Performance Monitoring Example
import { PromptOpsClient } from 'promptops-client';
import { Histogram, Counter } from 'prom-client';

const client = new PromptOpsClient({
  apiKey: 'your_api_key_here',
  enableMetrics: true
});

// Create custom metrics
const requestCounter = new Counter({
  name: 'promptops_requests_total',
  help: 'Total number of requests',
  labelNames: ['endpoint', 'status']
});

const latencyHistogram = new Histogram({
  name: 'promptops_request_duration_seconds',
  help: 'Request latency in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

async function monitoredPromptExecution() {
  const startTime = Date.now();

  try {
    const result = await client.executePrompt({
      promptId: 'customer_support',
      variables: { userQuery: 'Help with billing' }
    });

    // Record success metrics
    requestCounter.inc({ endpoint: 'execute_prompt', status: 'success' });
    latencyHistogram.observe((Date.now() - startTime) / 1000);

    return result;
  } catch (error) {
    // Record error metrics
    requestCounter.inc({ endpoint: 'execute_prompt', status: 'error' });
    latencyHistogram.observe((Date.now() - startTime) / 1000);
    throw error;
  }
}`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`// JavaScript Performance Monitoring Example
import { PromptOpsClient } from 'promptops-client';
import { Histogram, Counter } from 'prom-client';

const client = new PromptOpsClient({
  apiKey: 'your_api_key_here',
  enableMetrics: true
});

// Create custom metrics
const requestCounter = new Counter({
  name: 'promptops_requests_total',
  help: 'Total number of requests',
  labelNames: ['endpoint', 'status']
});

const latencyHistogram = new Histogram({
  name: 'promptops_request_duration_seconds',
  help: 'Request latency in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

async function monitoredPromptExecution() {
  const startTime = Date.now();

  try {
    const result = await client.executePrompt({
      promptId: 'customer_support',
      variables: { userQuery: 'Help with billing' }
    });

    // Record success metrics
    requestCounter.inc({ endpoint: 'execute_prompt', status: 'success' });
    latencyHistogram.observe((Date.now() - startTime) / 1000);

    return result;
  } catch (error) {
    // Record error metrics
    requestCounter.inc({ endpoint: 'execute_prompt', status: 'error' });
    latencyHistogram.observe((Date.now() - startTime) / 1000);
    throw error;
  }
}`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="optimization" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="w-5 h-5" />
                    <span>Performance Optimization</span>
                  </CardTitle>
                  <CardDescription>
                    Advanced optimization features and best practices
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-2">Smart Caching</h4>
                          <p className="text-sm text-gray-600">
                            Intelligent caching with automatic invalidation based on prompt changes
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-2">Connection Pooling</h4>
                          <p className="text-sm text-gray-600">
                            Optimized connection management for high-throughput applications
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{`# Python Optimization Example
from promptops import PromptOpsClient

# Configure client with optimization settings
client = PromptOpsClient(
    api_key="your_api_key",
    enable_caching=True,
    cache_ttl=300,  # 5 minutes
    max_connections=10,
    retry_attempts=3,
    retry_backoff_factor=0.5
)

# Enable performance monitoring
client.enable_performance_monitoring({
    enable_tracing=True,
    sample_rate=0.1,  # Sample 10% of requests
    custom_metrics=True
})

# Batch processing for improved performance
async def batch_process_prompts(prompt_requests):
    """Process multiple prompts efficiently"""
    results = await client.batch_execute_prompts(prompt_requests)

    # Performance metrics are automatically collected
    return results

# Usage with optimization
requests = [
    {"prompt_id": "greeting", "variables": {"name": "Alice"}},
    {"prompt_id": "greeting", "variables": {"name": "Bob"}},
    {"prompt_id": "greeting", "variables": {"name": "Charlie"}}
]

results = await batch_process_prompts(requests)`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`# Python Optimization Example
from promptops import PromptOpsClient

# Configure client with optimization settings
client = PromptOpsClient(
    api_key="your_api_key",
    enable_caching=True,
    cache_ttl=300,  # 5 minutes
    max_connections=10,
    retry_attempts=3,
    retry_backoff_factor=0.5
)

# Enable performance monitoring
client.enable_performance_monitoring({
    enable_tracing=True,
    sample_rate=0.1,  # Sample 10% of requests
    custom_metrics=True
})

# Batch processing for improved performance
async def batch_process_prompts(prompt_requests):
    """Process multiple prompts efficiently"""
    results = await client.batch_execute_prompts(prompt_requests)

    # Performance metrics are automatically collected
    return results

# Usage with optimization
requests = [
    {"prompt_id": "greeting", "variables": {"name": "Alice"}},
    {"prompt_id": "greeting", "variables": {"name": "Bob"}},
    {"prompt_id": "greeting", "variables": {"name": "Charlie"}}
]

results = await batch_process_prompts(requests)`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-8 max-w-2xl mx-auto">
            <Alert>
              <AlertTitle>
                <Activity className="w-5 h-5 mr-2" />
                Performance Monitoring Best Practices
              </AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Enable monitoring in production environments</li>
                  <li>• Set appropriate sampling rates to balance overhead</li>
                  <li>• Use custom metrics for business-specific KPIs</li>
                  <li>• Monitor resource usage and set up alerts</li>
                  <li>• Regularly review and optimize based on metrics</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </section>

      {/* Docker Deployment Section */}
      <section className="py-16 bg-gray-50">
        <div className="px-6 max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Docker Deployment
            </h2>
            <p className="text-xl text-gray-600">
              Containerize and deploy your PromptOps applications with Docker
            </p>
          </div>

          <Tabs defaultValue="quickstart" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="quickstart" className="flex items-center space-x-2">
                <Rocket className="w-4 h-4" />
                <span>Quick Start</span>
              </TabsTrigger>
              <TabsTrigger value="examples" className="flex items-center space-x-2">
                <FileCode className="w-4 h-4" />
                <span>Examples</span>
              </TabsTrigger>
              <TabsTrigger value="production" className="flex items-center space-x-2">
                <Settings className="w-4 h-4" />
                <span>Production</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="quickstart" className="mt-8">
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Package className="w-5 h-5 text-blue-600" />
                      <span>Python Application</span>
                    </CardTitle>
                    <CardDescription>
                      Containerize your Python PromptOps applications
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{`# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "app.py"]`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "app.py"]`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Package className="w-5 h-5 text-green-600" />
                      <span>Node.js Application</span>
                    </CardTitle>
                    <CardDescription>
                      Containerize your JavaScript PromptOps applications
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{`# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
USER nextjs

# Expose port
EXPOSE 3000

# Run the application
CMD ["npm", "start"]`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
USER nextjs

# Expose port
EXPOSE 3000

# Run the application
CMD ["npm", "start"]`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="examples" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileCode className="w-5 h-5" />
                    <span>Complete Examples</span>
                  </CardTitle>
                  <CardDescription>
                    Full deployment examples with Docker Compose
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{`# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/promptops
      - REDIS_URL=redis://redis:6379
      - PROMPTOPS_API_KEY=\${PROMPTOPS_API_KEY}
    depends_on:
      - db
      - redis
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=promptops
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/promptops
      - REDIS_URL=redis://redis:6379
      - PROMPTOPS_API_KEY=\${PROMPTOPS_API_KEY}
    depends_on:
      - db
      - redis
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=promptops
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="production" className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Settings className="w-5 h-5" />
                    <span>Production Deployment</span>
                  </CardTitle>
                  <CardDescription>
                    Best practices for production deployments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-2">Security</h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Use non-root users</li>
                            <li>• Multi-stage builds</li>
                            <li>• Environment variables</li>
                            <li>• Security scanning</li>
                          </ul>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-2">Performance</h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• Resource limits</li>
                            <li>• Health checks</li>
                            <li>• Load balancing</li>
                            <li>• Auto-scaling</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{`# .dockerignore
.git
.gitignore
README.md
.env
.env.local
.env.development
*.log
node_modules
__pycache__
*.pyc
.pytest_cache
.coverage
.vscode
.idea

# Production Dockerfile with multi-stage build
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --user -r requirements.txt

# Production stage
FROM python:3.11-slim as production

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \\
    curl \\
    && rm -rf /var/lib/apt/lists/* \\
    && useradd -m -u 1000 appuser

# Copy installed packages from builder
COPY --from=builder /root/.local /home/appuser/.local

# Copy application code
COPY --chown=appuser:appuser . .

# Set PATH
ENV PATH=/home/appuser/.local/bin:$PATH

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "app.py"]`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`# .dockerignore
.git
.gitignore
README.md
.env
.env.local
.env.development
*.log
node_modules
__pycache__
*.pyc
.pytest_cache
.coverage
.vscode
.idea

# Production Dockerfile with multi-stage build
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --user -r requirements.txt

# Production stage
FROM python:3.11-slim as production

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \\
    curl \\
    && rm -rf /var/lib/apt/lists/* \\
    && useradd -m -u 1000 appuser

# Copy installed packages from builder
COPY --from=builder /root/.local /home/appuser/.local

# Copy application code
COPY --chown=appuser:appuser . .

# Set PATH
ENV PATH=/home/appuser/.local/bin:$PATH

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "app.py"]`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-8 max-w-2xl mx-auto">
            <Alert>
              <AlertTitle>
                <Package className="w-5 h-5 mr-2" />
                Docker Deployment Best Practices
              </AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Use multi-stage builds for smaller image sizes</li>
                  <li>• Implement health checks for container monitoring</li>
                  <li>• Use environment variables for configuration</li>
                  <li>• Set appropriate resource limits and requests</li>
                  <li>• Regularly update base images for security</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </section>

      {/* Interactive Prompt Retrieval Section */}
      <section className="py-16 bg-gray-50">
        <div className="px-6 max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Interactive Prompt Retrieval
            </h2>
            <p className="text-xl text-gray-600">
              Test and retrieve prompts for your projects using our interactive interface
            </p>
          </div>

          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Search className="w-5 h-5" />
                <span>Retrieve Prompts</span>
              </CardTitle>
              <CardDescription>
                Enter your project details to retrieve available prompts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Error Display */}
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Enhanced Input Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="projectId">Project ID *</Label>
                  <Input
                    id="projectId"
                    placeholder="Enter project ID"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="moduleId">Module ID *</Label>
                  <Input
                    id="moduleId"
                    placeholder="Enter module ID"
                    value={moduleId}
                    onChange={(e) => setModuleId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="llmModel">LLM Model</Label>
                  <Select value={llmModel} onValueChange={setLlmModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select LLM model" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{model.provider}</Badge>
                            <span>{model.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* API Key Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="Enter your API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secretKey">Secret Key</Label>
                  <Input
                    id="secretKey"
                    type="password"
                    placeholder="Enter your secret key"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                  />
                </div>
              </div>

              {/* Test Variables Input */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Test Variables (JSON)</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVariables(!showVariables)}
                  >
                    {showVariables ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                {showVariables && (
                  <Textarea
                    placeholder='{"name": "Alice", "topic": "AI", "style": "formal"}'
                    value={testVariables}
                    onChange={(e) => setTestVariables(e.target.value)}
                    className="min-h-[80px]"
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={retrievePrompts}
                  disabled={loading || !projectId || !moduleId}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Retrieving...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 w-4 h-4" />
                      Retrieve Prompts
                    </>
                  )}
                </Button>
                <Button
                  onClick={testPrompts}
                  disabled={loading || !projectId || !moduleId || results.length === 0}
                  variant="outline"
                  className="flex-1"
                >
                  <Play className="mr-2 w-4 h-4" />
                  Test Prompts
                </Button>
                <Button
                  onClick={compareResults}
                  disabled={loading || testResults.length < 2}
                  variant="outline"
                  className="flex-1"
                >
                  <BarChart3 className="mr-2 w-4 h-4" />
                  Compare Results
                </Button>
              </div>

              {/* Results Tabs */}
              {results.length > 0 && (
                <Tabs defaultValue="prompts" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="prompts">Prompts ({results.length})</TabsTrigger>
                    <TabsTrigger value="test">Test Results ({testResults.length})</TabsTrigger>
                    <TabsTrigger value="compare">Compare</TabsTrigger>
                  </TabsList>

                  <TabsContent value="prompts" className="mt-4">
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {results.map((prompt, index) => (
                        <Card key={index} className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">{prompt.name || `Prompt ${index + 1}`}</h4>
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline">{prompt.id}</Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => testSinglePrompt(prompt)}
                                >
                                  <Play className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600">{prompt.description || 'No description'}</p>
                            <Textarea
                              value={prompt.content || 'No content available'}
                              readOnly
                              className="min-h-[100px] text-sm"
                            />
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <div className="flex items-center space-x-4">
                                <span>Created: {new Date(prompt.created_at).toLocaleDateString()}</span>
                                <span>Version: {prompt.version || '1'}</span>
                                {prompt.llm_model && (
                                  <Badge variant="secondary">{prompt.llm_model}</Badge>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(prompt.content || '')}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="test" className="mt-4">
                    {testResults.length > 0 ? (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {testResults.map((result, index) => (
                          <Card key={index} className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium">{result.promptName}</h4>
                                <div className="flex items-center space-x-2">
                                  <Badge variant={result.success ? "default" : "destructive"}>
                                    {result.success ? "Success" : "Error"}
                                  </Badge>
                                  <Badge variant="outline">{result.model}</Badge>
                                </div>
                              </div>
                              {result.variables && (
                                <div className="text-sm">
                                  <strong>Variables:</strong> {JSON.stringify(result.variables)}
                                </div>
                              )}
                              <div className="text-sm">
                                <strong>Response:</strong>
                                <div className="mt-1 p-2 bg-gray-50 rounded text-xs">
                                  {result.response}
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>Duration: {result.duration}ms</span>
                                <span>Tokens: {result.tokens}</span>
                                <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Play className="w-8 h-8 mx-auto mb-2" />
                        <p>Test prompts to see results here</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="compare" className="mt-4">
                    {testResults.length >= 2 ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {testResults.slice(-2).map((result, index) => (
                            <Card key={index} className="p-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium">{result.promptName}</h4>
                                  <Badge variant="outline">{result.model}</Badge>
                                </div>
                                <div className="text-sm">
                                  <strong>Response:</strong>
                                  <div className="mt-1 p-2 bg-gray-50 rounded text-xs max-h-32 overflow-y-auto">
                                    {result.response}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span>Duration: {result.duration}ms</span>
                                  <span>Tokens: {result.tokens}</span>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                        <Card className="p-4">
                          <h4 className="font-medium mb-2">Comparison Summary</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="text-center">
                              <div className="font-semibold text-blue-600">
                                {Math.min(...testResults.slice(-2).map(r => r.duration))}ms
                              </div>
                              <div className="text-xs text-gray-500">Fastest</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-green-600">
                                {Math.min(...testResults.slice(-2).map(r => r.tokens))}
                              </div>
                              <div className="text-xs text-gray-500">Min Tokens</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-purple-600">
                                {Math.max(...testResults.slice(-2).map(r => r.tokens))}
                              </div>
                              <div className="text-xs text-gray-500">Max Tokens</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-orange-600">
                                {testResults.slice(-2).reduce((acc, r) => acc + r.duration, 0) / 2}ms
                              </div>
                              <div className="text-xs text-gray-500">Avg Duration</div>
                            </div>
                          </div>
                        </Card>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <BarChart3 className="w-8 h-8 mx-auto mb-2" />
                        <p>Test at least 2 prompts to compare results</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-16 bg-gray-50">
        <div className="px-6 max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Industry Use Cases
            </h2>
            <p className="text-xl text-gray-600">
              Discover how PromptOps enables FEAT-compliant AI solutions across industries
            </p>
          </div>

          <Tabs defaultValue="banking" className="max-w-6xl mx-auto">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="banking" className="flex items-center space-x-2">
                <Building2 className="w-4 h-4" />
                <span>BFSI</span>
              </TabsTrigger>
              <TabsTrigger value="healthcare" className="flex items-center space-x-2">
                <Heart className="w-4 h-4" />
                <span>Healthcare</span>
              </TabsTrigger>
              <TabsTrigger value="ecommerce" className="flex items-center space-x-2">
                <ShoppingCart className="w-4 h-4" />
                <span>E-commerce</span>
              </TabsTrigger>
              <TabsTrigger value="feat" className="flex items-center space-x-2">
                <Scale className="w-4 h-4" />
                <span>FEAT Framework</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="banking" className="mt-8">
              <div className="space-y-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <span>Banking & Financial Services (BFSI)</span>
                    </CardTitle>
                    <CardDescription>
                      Secure, compliant AI solutions for financial institutions with MAS FEAT compliance
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center space-x-2">
                          <UserCheck className="w-4 h-4" />
                          <span>Credit Risk Assessment</span>
                        </h4>
                        <p className="text-sm text-gray-600 mb-3">
                          AI-powered credit scoring with bias detection and fair lending practices
                        </p>
                        <div className="relative">
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                            <code>{`# BFSI Credit Risk Assessment with FEAT Compliance
from promptops import PromptOpsClient
from promptops.feat import MASFEATTemplates

client = PromptOpsClient(api_key="your_api_key")

# FEAT-compliant credit assessment prompt
credit_prompt = await client.create_prompt(
    name="credit_risk_assessment",
    content=\"""
    You are a credit risk assessment AI assistant for a Singaporean bank.

    Assess creditworthiness based on:
    - Credit history and payment patterns
    - Income stability and employment history
    - Debt-to-income ratio and existing obligations
    - Banking relationship history

    FEAT Requirements:
    - Fairness: Consider all applicants equally regardless of demographics
    - Ethics: Protect privacy, avoid discrimination
    - Accountability: Document assessment criteria clearly
    - Transparency: Explain factors influencing decisions

    Applicant Data:
    - Credit Score: {credit_score}
    - Annual Income: ${annual_income}
    - Employment Status: {employment_status}
    - Loan Amount: ${loan_amount}

    Provide:
    1. Risk assessment (Low/Medium/High)
    2. Key factors influencing decision
    3. Confidence level (0-100%)
    4. Recommended action
    5. Fairness disclaimer
    \""",
    tags=["bfsi", "credit-risk", "feat-compliant"]
)

# Apply FEAT validation
feat_validation = await client.validate_feat_compliance(
    prompt_id=credit_prompt.id,
    framework="mas_feat",
    requirements=["fairness", "ethics", "accountability", "transparency"]
)

print(f"FEAT Compliance Score: {feat_validation.compliance_score}%")
print(f"Fairness Indicators: {feat_validation.fairness_metrics}")
print(f"Risk Assessment: {feat_validation.ai_assessment}"}`}</code>
                          </pre>
                          <Button
                            variant="outline"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(`# BFSI Credit Risk Assessment with FEAT Compliance
from promptops import PromptOpsClient
from promptops.feat import MASFEATTemplates

client = PromptOpsClient(api_key="your_api_key")

# FEAT-compliant credit assessment prompt
credit_prompt = await client.create_prompt(
    name="credit_risk_assessment",
    content=\"""
    You are a credit risk assessment AI assistant for a Singaporean bank.

    Assess creditworthiness based on:
    - Credit history and payment patterns
    - Income stability and employment history
    - Debt-to-income ratio and existing obligations
    - Banking relationship history

    FEAT Requirements:
    - Fairness: Consider all applicants equally regardless of demographics
    - Ethics: Protect privacy, avoid discrimination
    - Accountability: Document assessment criteria clearly
    - Transparency: Explain factors influencing decisions

    Applicant Data:
    - Credit Score: {credit_score}
    - Annual Income: ${annual_income}
    - Employment Status: {employment_status}
    - Loan Amount: ${loan_amount}

    Provide:
    1. Risk assessment (Low/Medium/High)
    2. Key factors influencing decision
    3. Confidence level (0-100%)
    4. Recommended action
    5. Fairness disclaimer
    \""",
    tags=["bfsi", "credit-risk", "feat-compliant"]
)

# Apply FEAT validation
feat_validation = await client.validate_feat_compliance(
    prompt_id=credit_prompt.id,
    framework="mas_feat",
    requirements=["fairness", "ethics", "accountability", "transparency"]
)

print(f"FEAT Compliance Score: {feat_validation.compliance_score}%")
print(f"Fairness Indicators: {feat_validation.fairness_metrics}")
print(f"Risk Assessment: {feat_validation.ai_assessment}"}`)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 flex items-center space-x-2">
                          <FileText className="w-4 h-4" />
                          <span>Anti-Money Laundering (AML)</span>
                        </h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Transaction monitoring with explainable AI and audit trails
                        </p>
                        <div className="relative">
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                            <code>{`# AML Transaction Monitoring
from promptops import PromptOpsClient

client = PromptOpsClient(api_key="your_api_key")

# AML monitoring with transparency
aml_check = await client.use_prompt(
    prompt_id="aml_monitoring_v2",
    project_id="compliance_bfsi",
    module_id="regulatory_technology",
    variables={
        "transaction_amount": "50000",
        "transaction_type": "wire_transfer",
        "customer_risk_profile": "medium",
        "destination_country": "SG",
        "business_relationship": "existing"
    },
    # Enable audit trail for compliance
    enable_audit=True,
    compliance_framework="MAS_AML_CFT"
)

print(f"AML Risk Score: {aml_check.risk_assessment.score}")
print(f"Suspicious Indicators: {aml_check.suspicious_indicators}")
print(f"Audit Trail ID: {aml_check.audit_id}")
print(f"Compliance Status: {aml_check.compliance_status}")

# Generate regulatory report
regulatory_report = await client.generate_compliance_report(
    assessment_id=aml_check.id,
    format="MAS_Annual_Report",
    include_recommendations=True
)`}</code>
                          </pre>
                          <Button
                            variant="outline"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(`# AML Transaction Monitoring
from promptops import PromptOpsClient

client = PromptOpsClient(api_key="your_api_key")

# AML monitoring with transparency
aml_check = await client.use_prompt(
    prompt_id="aml_monitoring_v2",
    project_id="compliance_bfsi",
    module_id="regulatory_technology",
    variables={
        "transaction_amount": "50000",
        "transaction_type": "wire_transfer",
        "customer_risk_profile": "medium",
        "destination_country": "SG",
        "business_relationship": "existing"
    },
    # Enable audit trail for compliance
    enable_audit=True,
    compliance_framework="MAS_AML_CFT"
)

print(f"AML Risk Score: {aml_check.risk_assessment.score}")
print(f"Suspicious Indicators: {aml_check.suspicious_indicators}")
print(f"Audit Trail ID: {aml_check.audit_id}")
print(f"Compliance Status: {aml_check.compliance_status}")

# Generate regulatory report
regulatory_report = await client.generate_compliance_report(
    assessment_id=aml_check.id,
    format="MAS_Annual_Report",
    include_recommendations=True
)`)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-900 mb-2 flex items-center space-x-2">
                        <Scale className="w-4 h-4" />
                        <span>BFSI FEAT Compliance Features</span>
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h5 className="font-medium text-blue-800">Fairness</h5>
                          <ul className="mt-1 space-y-1 text-blue-700">
                            <li>• Bias detection in credit decisions</li>
                            <li>• Equal opportunity lending</li>
                            <li>• Demographic fairness testing</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-blue-800">Ethics</h5>
                          <ul className="mt-1 space-y-1 text-blue-700">
                            <li>• Privacy-preserving AI</li>
                            <li>• Customer consent management</li>
                            <li>• Responsible AI deployment</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-blue-800">Accountability</h5>
                          <ul className="mt-1 space-y-1 text-blue-700">
                            <li>• Full audit trails</li>
                            <li>• Decision documentation</li>
                            <li>• Regulatory reporting</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-blue-800">Transparency</h5>
                          <ul className="mt-1 space-y-1 text-blue-700">
                            <li>• Explainable AI decisions</li>
                            <li>• Clear risk communication</li>
                            <li>• Customer-facing explanations</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="healthcare" className="mt-8">
              <div className="space-y-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Heart className="w-5 h-5 text-red-600" />
                      <span>Healthcare & Medical Applications</span>
                    </CardTitle>
                    <CardDescription>
                      HIPAA-compliant AI solutions for healthcare with patient privacy protection
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center space-x-2">
                          <Users className="w-4 h-4" />
                          <span>Medical Triage & Symptom Analysis</span>
                        </h4>
                        <p className="text-sm text-gray-600 mb-3">
                          AI-powered symptom assessment with patient safety and ethical guidelines
                        </p>
                        <div className="relative">
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                            <code>{`# Healthcare Triage with FEAT Compliance
from promptops import PromptOpsClient

client = PromptOpsClient(api_key="your_api_key")

# Medical triage with privacy protection
triage_assessment = await client.use_prompt(
    prompt_id="medical_triage_v3",
    project_id="healthcare_ai",
    module_id="patient_care",
    variables={
        "patient_age": "45",
        "symptoms": "chest_pain, shortness_of_breath",
        "duration": "2_hours",
        "medical_history": "hypertension",
        "vital_signs": "BP:160/95, HR:95"
    },
    # Healthcare-specific settings
    healthcare_mode=True,
    privacy_level="HIPAA",
    emergency_detection=True,
    human_oversight_required=True
)

print(f"Urgency Level: {triage_assessment.urgency_level}")
print(f"Recommended Action: {triage_assessment.recommended_action}")
print(f"Confidence: {triage_assessment.confidence}%")
print(f"Human Review Required: {triage_assessment.requires_human_review}")

# Generate patient-friendly explanation
patient_explanation = await client.use_prompt(
    prompt_id="patient_communication",
    variables={
        "assessment": triage_assessment,
        "complexity_level": "simple",
        "language": "english"
    }
)

print(f"Patient Explanation: {patient_explanation.content}")`}</code>
                          </pre>
                          <Button
                            variant="outline"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(`# Healthcare Triage with FEAT Compliance
from promptops import PromptOpsClient

client = PromptOpsClient(api_key="your_api_key")

# Medical triage with privacy protection
triage_assessment = await client.use_prompt(
    prompt_id="medical_triage_v3",
    project_id="healthcare_ai",
    module_id="patient_care",
    variables={
        "patient_age": "45",
        "symptoms": "chest_pain, shortness_of_breath",
        "duration": "2_hours",
        "medical_history": "hypertension",
        "vital_signs": "BP:160/95, HR:95"
    },
    # Healthcare-specific settings
    healthcare_mode=True,
    privacy_level="HIPAA",
    emergency_detection=True,
    human_oversight_required=True
)

print(f"Urgency Level: {triage_assessment.urgency_level}")
print(f"Recommended Action: {triage_assessment.recommended_action}")
print(f"Confidence: {triage_assessment.confidence}%")
print(f"Human Review Required: {triage_assessment.requires_human_review}")

# Generate patient-friendly explanation
patient_explanation = await client.use_prompt(
    prompt_id="patient_communication",
    variables={
        "assessment": triage_assessment,
        "complexity_level": "simple",
        "language": "english"
    }
)

print(f"Patient Explanation: {patient_explanation.content}"`)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 flex items-center space-x-2">
                          <FileText className="w-4 h-4" />
                          <span>Clinical Documentation & EHR</span>
                        </h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Automated clinical note generation with accuracy validation
                        </p>
                        <div className="relative">
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                            <code>{`# Clinical Documentation Assistant
from promptops import PromptOpsClient

client = PromptOpsClient(api_key="your_api_key")

# Clinical note generation with validation
clinical_notes = await client.use_prompt(
    prompt_id="clinical_documentation_v2",
    project_id="ehr_system",
    module_id="clinical_support",
    variables={
        "patient_id": "PATIENT_12345",
        "appointment_type": "follow_up",
        "doctor_notes": "Patient reports improved symptom management",
        "vital_signs": "BP:130/80, HR:72, Temp:98.6°F",
        "medications": "Lisinopril 10mg daily",
        "allergies": "Penicillin",
        "assessment": "Hypertension well-controlled"
    },
    # Clinical validation settings
    enable_clinical_validation=True,
    accuracy_threshold=0.95,
    pii_detection=True,
    required_sections=["subjective", "objective", "assessment", "plan"]
)

print(f"Clinical Notes: {clinical_notes.generated_notes}")
print(f"Validation Score: {clinical_notes.validation_score}")
print(f"PII Detected: {clinical_notes.pii_detected}")
print(f"Required Sections: {clinical_notes.sections_completed}")

# Physician review workflow
if clinical_notes.requires_review:
    review_request = await client.create_review_request(
        content_id=clinical_notes.id,
        review_type="clinical_validation",
        priority="normal",
        due_hours=24
    )
    print(f"Review Request ID: {review_request.id}")`}</code>
                          </pre>
                          <Button
                            variant="outline"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(`# Clinical Documentation Assistant
from promptops import PromptOpsClient

client = PromptOpsClient(api_key="your_api_key")

# Clinical note generation with validation
clinical_notes = await client.use_prompt(
    prompt_id="clinical_documentation_v2",
    project_id="ehr_system",
    module_id="clinical_support",
    variables={
        "patient_id": "PATIENT_12345",
        "appointment_type": "follow_up",
        "doctor_notes": "Patient reports improved symptom management",
        "vital_signs": "BP:130/80, HR:72, Temp:98.6°F",
        "medications": "Lisinopril 10mg daily",
        "allergies": "Penicillin",
        "assessment": "Hypertension well-controlled"
    },
    # Clinical validation settings
    enable_clinical_validation=True,
    accuracy_threshold=0.95,
    pii_detection=True,
    required_sections=["subjective", "objective", "assessment", "plan"]
)

print(f"Clinical Notes: {clinical_notes.generated_notes}")
print(f"Validation Score: {clinical_notes.validation_score}")
print(f"PII Detected: {clinical_notes.pii_detected}")
print(f"Required Sections: {clinical_notes.sections_completed}")

# Physician review workflow
if clinical_notes.requires_review:
    review_request = await client.create_review_request(
        content_id=clinical_notes.id,
        review_type="clinical_validation",
        priority="normal",
        due_hours=24
    )
    print(f"Review Request ID: {review_request.id}"`)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-semibold text-red-900 mb-2 flex items-center space-x-2">
                        <Heart className="w-4 h-4" />
                        <span>Healthcare FEAT Compliance Features</span>
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h5 className="font-medium text-red-800">Fairness</h5>
                          <ul className="mt-1 space-y-1 text-red-700">
                            <li>• Equal access to care recommendations</li>
                            <li>• Bias-free medical assessments</li>
                            <li>• Cultural competency in care</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-red-800">Ethics</h5>
                          <ul className="mt-1 space-y-1 text-red-700">
                            <li>• Patient privacy protection</li>
                            <li>• Informed consent automation</li>
                            <li>• Human oversight requirements</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-red-800">Accountability</h5>
                          <ul className="mt-1 space-y-1 text-red-700">
                            <li>• Clinical validation workflows</li>
                            <li>• Audit trails for patient safety</li>
                            <li>• Medical liability protection</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-red-800">Transparency</h5>
                          <ul className="mt-1 space-y-1 text-red-700">
                            <li>• Explainable medical reasoning</li>
                            <li>• Patient-friendly communications</li>
                            <li>• Clear limitations disclosure</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="ecommerce" className="mt-8">
              <div className="space-y-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <ShoppingCart className="w-5 h-5 text-green-600" />
                      <span>E-commerce & Retail</span>
                    </CardTitle>
                    <CardDescription>
                      Personalized shopping experiences with ethical AI and consumer protection
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center space-x-2">
                          <TrendingUp className="w-4 h-4" />
                          <span>Personalized Recommendations</span>
                        </h4>
                        <p className="text-sm text-gray-600 mb-3">
                          AI-powered product recommendations with bias mitigation
                        </p>
                        <div className="relative">
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                            <code>{`# E-commerce Recommendations with FEAT
from promptops import PromptOpsClient

client = PromptOpsClient(api_key="your_api_key")

# Personalized product recommendations
recommendations = await client.use_prompt(
    prompt_id="product_recommendations_v2",
    project_id="ecommerce_platform",
    module_id="personalization",
    variables={
        "user_id": "USER_789",
        "browsing_history": ["laptops", "wireless_mouse", "usb_hub"],
        "purchase_history": ["gaming_laptop_2023", "mechanical_keyboard"],
        "price_range": "$1000-2000",
        "category": "electronics",
        "session_duration": "15_minutes"
    },
    # FEAT compliance settings
    enable_bias_detection=True,
    fairness_algorithm="demographic_fairness",
    transparency_level="high",
    max_recommendations=10
)

print(f"Recommendations: {recommendations.products}")
print(f"Fairness Score: {recommendations.fairness_metrics.score}")
print(f"Bias Detected: {recommendations.bias_detected}")
print(f"Transparency Reason: {recommendations.recommendation_reason}")

# A/B test recommendation algorithms
ab_test = await client.create_ab_test(
    name="recommendation_algorithm_fairness",
    prompt_id="product_recommendations_v2",
    variants=[
        {
            "name": "current_algorithm",
            "weight": 0.5,
            "variables": {"algorithm_version": "v1"}
        },
        {
            "name": "fairness_improved",
            "weight": 0.5,
            "variables": {"algorithm_version": "v2_fairness"}
        }
    ],
    success_metric="conversion_rate",
    fairness_metric="demographic_parity",
    target_audience="all_users"
)

print(f"A/B Test ID: {ab_test.id}")
print(f"Fairness Monitoring: {ab_test.fairness_monitoring_enabled}")`}</code>
                          </pre>
                          <Button
                            variant="outline"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(`# E-commerce Recommendations with FEAT
from promptops import PromptOpsClient

client = PromptOpsClient(api_key="your_api_key")

# Personalized product recommendations
recommendations = await client.use_prompt(
    prompt_id="product_recommendations_v2",
    project_id="ecommerce_platform",
    module_id="personalization",
    variables={
        "user_id": "USER_789",
        "browsing_history": ["laptops", "wireless_mouse", "usb_hub"],
        "purchase_history": ["gaming_laptop_2023", "mechanical_keyboard"],
        "price_range": "$1000-2000",
        "category": "electronics",
        "session_duration": "15_minutes"
    },
    # FEAT compliance settings
    enable_bias_detection=True,
    fairness_algorithm="demographic_fairness",
    transparency_level="high",
    max_recommendations=10
)

print(f"Recommendations: {recommendations.products}")
print(f"Fairness Score: {recommendations.fairness_metrics.score}")
print(f"Bias Detected: {recommendations.bias_detected}")
print(f"Transparency Reason: {recommendations.recommendation_reason}")

# A/B test recommendation algorithms
ab_test = await client.create_ab_test(
    name="recommendation_algorithm_fairness",
    prompt_id="product_recommendations_v2",
    variants=[
        {
            "name": "current_algorithm",
            "weight": 0.5,
            "variables": {"algorithm_version": "v1"}
        },
        {
            "name": "fairness_improved",
            "weight": 0.5,
            "variables": {"algorithm_version": "v2_fairness"}
        }
    ],
    success_metric="conversion_rate",
    fairness_metric="demographic_parity",
    target_audience="all_users"
)

print(f"A/B Test ID: {ab_test.id}")
print(f"Fairness Monitoring: {ab_test.fairness_monitoring_enabled}"`)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 flex items-center space-x-2">
                          <Users className="w-4 h-4" />
                          <span>Customer Service Automation</span>
                        </h4>
                        <p className="text-sm text-gray-600 mb-3">
                          AI-powered customer support with human escalation paths
                        </p>
                        <div className="relative">
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                            <code>{`# Customer Service with Human Oversight
from promptops import PromptOpsClient

client = PromptOpsClient(api_key="your_api_key")

# Customer support with escalation paths
customer_service = await client.use_prompt(
    prompt_id="customer_support_v3",
    project_id="ecommerce_support",
    module_id="service_automation",
    variables={
        "customer_id": "CUST_456",
        "issue_type": "order_not_received",
        "order_id": "ORD_789123",
        "customer_tier": "premium",
        "urgency_level": "high",
        "language": "english"
    },
    # Service automation settings
    enable_escalation=True,
    sentiment_analysis=True,
    customer_context=True,
    human_oversight_threshold="medium_complexity"
)

print(f"AI Response: {customer_service.ai_response}")
print(f"Escalation Required: {customer_service.requires_escalation}")
print(f"Sentiment Score: {customer_service.sentiment.score}")
print(f"Customer Satisfaction: {customer_service.predicted_csat}")

# Human handoff workflow
if customer_service.requires_escalation:
    escalation_request = await client.create_escalation_request(
        customer_service.id,
        escalation_reason="complex_order_issue",
        priority="high",
        assigned_department="customer_care",
        customer_context={
            "order_history": customer_service.order_history,
            "customer_tier": "premium",
            "issue_details": customer_service.issue_analysis
        }
    )
    print(f"Escalation ID: {escalation_request.id}")
    print(f"Assigned Agent: {escalation_request.assigned_agent}")

# Generate customer satisfaction survey
survey = await client.use_prompt(
    prompt_id="satisfaction_survey",
    variables={
        "service_interaction": customer_service,
        "resolution_type": "escalated" if customer_service.requires_escalation else "automated"
    }
)
print(f"Survey Questions: {survey.survey_questions}")`}</code>
                          </pre>
                          <Button
                            variant="outline"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(`# Customer Service with Human Oversight
from promptops import PromptOpsClient

client = PromptOpsClient(api_key="your_api_key")

# Customer support with escalation paths
customer_service = await client.use_prompt(
    prompt_id="customer_support_v3",
    project_id="ecommerce_support",
    module_id="service_automation",
    variables={
        "customer_id": "CUST_456",
        "issue_type": "order_not_received",
        "order_id": "ORD_789123",
        "customer_tier": "premium",
        "urgency_level": "high",
        "language": "english"
    },
    # Service automation settings
    enable_escalation=True,
    sentiment_analysis=True,
    customer_context=True,
    human_oversight_threshold="medium_complexity"
)

print(f"AI Response: {customer_service.ai_response}")
print(f"Escalation Required: {customer_service.requires_escalation}")
print(f"Sentiment Score: {customer_service.sentiment.score}")
print(f"Customer Satisfaction: {customer_service.predicted_csat}")

# Human handoff workflow
if customer_service.requires_escalation:
    escalation_request = await client.create_escalation_request(
        customer_service.id,
        escalation_reason="complex_order_issue",
        priority="high",
        assigned_department="customer_care",
        customer_context={
            "order_history": customer_service.order_history,
            "customer_tier": "premium",
            "issue_details": customer_service.issue_analysis
        }
    )
    print(f"Escalation ID: {escalation_request.id}")
    print(f"Assigned Agent: {escalation_request.assigned_agent}")

# Generate customer satisfaction survey
survey = await client.use_prompt(
    prompt_id="satisfaction_survey",
    variables={
        "service_interaction": customer_service,
        "resolution_type": "escalated" if customer_service.requires_escalation else "automated"
    }
)
print(f"Survey Questions: {survey.survey_questions}"`)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-2 flex items-center space-x-2">
                        <ShoppingCart className="w-4 h-4" />
                        <span>E-commerce FEAT Compliance Features</span>
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h5 className="font-medium text-green-800">Fairness</h5>
                          <ul className="mt-1 space-y-1 text-green-700">
                            <li>• Bias-free product recommendations</li>
                            <li>• Equal pricing for all customers</li>
                            <li>• Fair search result rankings</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-green-800">Ethics</h5>
                          <ul className="mt-1 space-y-1 text-green-700">
                            <li>• Transparent pricing algorithms</li>
                            <li>• Consumer data protection</li>
                            <li>• Honest product representations</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-green-800">Accountability</h5>
                          <ul className="mt-1 space-y-1 text-green-700">
                            <li>• Customer service escalation paths</li>
                            <li>• Purchase decision audit trails</li>
                            <li>• Return policy transparency</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-green-800">Transparency</h5>
                          <ul className="mt-1 space-y-1 text-green-700">
                            <li>• Clear recommendation explanations</li>
                            <li>• AI disclosure in customer service</li>
                            <li>• Pricing algorithm visibility</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="feat" className="mt-8">
              <div className="space-y-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Scale className="w-5 h-5 text-purple-600" />
                      <span>MAS FEAT Compliance Framework</span>
                    </CardTitle>
                    <CardDescription>
                      Integrate Monetary Authority of Singapore's FEAT principles into your AI applications
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center space-x-2">
                          <FileText className="w-4 h-4" />
                          <span>FEAT Compliance Validation</span>
                        </h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Automated compliance checking against MAS FEAT guidelines
                        </p>
                        <div className="relative">
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                            <code>{`# MAS FEAT Compliance Integration
from promptops import PromptOpsClient
from promptops.feat import MASFEATTemplates, ComplianceValidator

client = PromptOpsClient(api_key="your_api_key")
validator = ComplianceValidator()

# Create FEAT-compliant prompt using templates
feat_prompt = await client.create_prompt(
    name="feat_compliant_customer_service",
    content=MASFEATTemplates.get_customer_service_template(),
    tags=["feat-compliant", "customer-service", "mas-guidelines"]
)

# Validate compliance automatically
compliance_result = await validator.validate_prompt(
    prompt_id=feat_prompt.id,
    framework="MAS_FEAT_2024",
    requirements={
        "fairness": {
            "bias_detection": True,
            "equal_opportunity": True,
            "demographic_fairness": True
        },
        "ethics": {
            "privacy_protection": True,
            "human_oversight": True,
            "consent_management": True
        },
        "accountability": {
            "audit_trail": True,
            "decision_documentation": True,
            "human_intervention": True
        },
        "transparency": {
            "explainability": True,
            "ai_disclosure": True,
            "limitation_communication": True
        }
    }
)

print(f"Compliance Score: {compliance_result.overall_score}%")
print(f"Fairness: {compliance_result.fairness.score}/100")
print(f"Ethics: {compliance_result.ethics.score}/100")
print(f"Accountability: {compliance_result.accountability.score}/100")
print(f"Transparency: {compliance_result.transparency.score}/100")

# Generate compliance report
compliance_report = await validator.generate_compliance_report(
    validation_result=compliance_result,
    format="MAS_Annual_Report",
    include_recommendations=True,
    target_audience="regulators"
)

print(f"Report Generated: {compliance_report.report_url}")
print(f"Areas for Improvement: {compliance_report.recommendations}")`}</code>
                          </pre>
                          <Button
                            variant="outline"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(`# MAS FEAT Compliance Integration
from promptops import PromptOpsClient
from promptops.feat import MASFEATTemplates, ComplianceValidator

client = PromptOpsClient(api_key="your_api_key")
validator = ComplianceValidator()

# Create FEAT-compliant prompt using templates
feat_prompt = await client.create_prompt(
    name="feat_compliant_customer_service",
    content=MASFEATTemplates.get_customer_service_template(),
    tags=["feat-compliant", "customer-service", "mas-guidelines"]
)

# Validate compliance automatically
compliance_result = await validator.validate_prompt(
    prompt_id=feat_prompt.id,
    framework="MAS_FEAT_2024",
    requirements={
        "fairness": {
            "bias_detection": True,
            "equal_opportunity": True,
            "demographic_fairness": True
        },
        "ethics": {
            "privacy_protection": True,
            "human_oversight": True,
            "consent_management": True
        },
        "accountability": {
            "audit_trail": True,
            "decision_documentation": True,
            "human_intervention": True
        },
        "transparency": {
            "explainability": True,
            "ai_disclosure": True,
            "limitation_communication": True
        }
    }
)

print(f"Compliance Score: {compliance_result.overall_score}%")
print(f"Fairness: {compliance_result.fairness.score}/100")
print(f"Ethics: {compliance_result.ethics.score}/100")
print(f"Accountability: {compliance_result.accountability.score}/100")
print(f"Transparency: {compliance_result.transparency.score}/100")

# Generate compliance report
compliance_report = await validator.generate_compliance_report(
    validation_result=compliance_result,
    format="MAS_Annual_Report",
    include_recommendations=True,
    target_audience="regulators"
)

print(f"Report Generated: {compliance_report.report_url}")
print(f"Areas for Improvement: {compliance_report.recommendations}"`)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 flex items-center space-x-2">
                          <TrendingUp className="w-4 h-4" />
                          <span>Continuous Compliance Monitoring</span>
                        </h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Real-time monitoring and alerting for compliance issues
                        </p>
                        <div className="relative">
                          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                            <code>{`# Continuous FEAT Compliance Monitoring
from promptops import PromptOpsClient
from promptops.monitoring import ComplianceMonitor

client = PromptOpsClient(api_key="your_api_key")
monitor = ComplianceMonitor()

# Set up continuous monitoring
monitoring_config = await monitor.create_monitoring_config(
    prompt_ids=["customer_service_bot", "loan_approval_ai", "recommendation_engine"],
    compliance_framework="MAS_FEAT",
    monitoring_rules={
        "fairness": {
            "bias_threshold": 0.1,
            "demographic_parity_threshold": 0.05,
            "alert_on_violation": True
        },
        "ethics": {
            "privacy_violation_threshold": 0,
            "human_oversight_required": True,
            "consent_verification": True
        },
        "accountability": {
            "audit_log_retention_days": 365,
            "decision_documentation_required": True,
            "escalation_path_required": True
        },
        "transparency": {
            "explainability_score_threshold": 0.8,
            "ai_disclosure_required": True,
            "limitation_disclosure_required": True
        }
    },
    alert_channels=[
        {"type": "email", "recipients": ["compliance@company.com"]},
        {"type": "slack", "webhook": "https://hooks.slack.com/..."},
        {"type": "dashboard", "dashboard_id": "feat_compliance"}
    ]
)

# Start monitoring
await monitor.start_monitoring(monitoring_config.id)

# Get compliance dashboard
dashboard = await monitor.get_compliance_dashboard(
    time_range="30d",
    metrics=["fairness", "ethics", "accountability", "transparency"],
    group_by=["prompt_id", "department"]
)

print(f"Overall Compliance Score: {dashboard.overall_score}%")
print(f"Critical Alerts: {len(dashboard.critical_alerts)}")
print(f"Improvement Areas: {dashboard.improvement_areas}")

# Generate weekly compliance report
weekly_report = await monitor.generate_weekly_report(
    include_trends=True,
    include_recommendations=True,
    format="executive_summary"
)

print(f"Weekly Report: {weekly_report.url}")
print(f"Trend Analysis: {weekly_report.trend_analysis}")`}</code>
                          </pre>
                          <Button
                            variant="outline"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => copyToClipboard(`# Continuous FEAT Compliance Monitoring
from promptops import PromptOpsClient
from promptops.monitoring import ComplianceMonitor

client = PromptOpsClient(api_key="your_api_key")
monitor = ComplianceMonitor()

# Set up continuous monitoring
monitoring_config = await monitor.create_monitoring_config(
    prompt_ids=["customer_service_bot", "loan_approval_ai", "recommendation_engine"],
    compliance_framework="MAS_FEAT",
    monitoring_rules={
        "fairness": {
            "bias_threshold": 0.1,
            "demographic_parity_threshold": 0.05,
            "alert_on_violation": True
        },
        "ethics": {
            "privacy_violation_threshold": 0,
            "human_oversight_required": True,
            "consent_verification": True
        },
        "accountability": {
            "audit_log_retention_days": 365,
            "decision_documentation_required": True,
            "escalation_path_required": True
        },
        "transparency": {
            "explainability_score_threshold": 0.8,
            "ai_disclosure_required": True,
            "limitation_disclosure_required": True
        }
    },
    alert_channels=[
        {"type": "email", "recipients": ["compliance@company.com"]},
        {"type": "slack", "webhook": "https://hooks.slack.com/..."},
        {"type": "dashboard", "dashboard_id": "feat_compliance"}
    ]
)

# Start monitoring
await monitor.start_monitoring(monitoring_config.id)

# Get compliance dashboard
dashboard = await monitor.get_compliance_dashboard(
    time_range="30d",
    metrics=["fairness", "ethics", "accountability", "transparency"],
    group_by=["prompt_id", "department"]
)

print(f"Overall Compliance Score: {dashboard.overall_score}%")
print(f"Critical Alerts: {len(dashboard.critical_alerts)}")
print(f"Improvement Areas: {dashboard.improvement_areas}")

# Generate weekly compliance report
weekly_report = await monitor.generate_weekly_report(
    include_trends=True,
    include_recommendations=True,
    format="executive_summary"
)

print(f"Weekly Report: {weekly_report.url}")
print(f"Trend Analysis: {weekly_report.trend_analysis}"`)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h4 className="font-semibold text-purple-900 mb-2 flex items-center space-x-2">
                        <Scale className="w-4 h-4" />
                        <span>FEAT Compliance Implementation Guide</span>
                      </h4>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-medium text-purple-800 mb-2">Fairness Implementation</h5>
                          <ul className="text-sm space-y-1 text-purple-700">
                            <li>• Implement bias detection algorithms</li>
                            <li>• Use diverse training data</li>
                            <li>• Test for demographic parity</li>
                            <li>• Monitor for disparate impact</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-purple-800 mb-2">Ethics Implementation</h5>
                          <ul className="text-sm space-y-1 text-purple-700">
                            <li>• Establish human oversight processes</li>
                            <li>• Implement privacy by design</li>
                            <li>• Ensure informed consent</li>
                            <li>• Consider societal impact</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-purple-800 mb-2">Accountability Implementation</h5>
                          <ul className="text-sm space-y-1 text-purple-700">
                            <li>• Maintain comprehensive audit trails</li>
                            <li>• Document decision criteria</li>
                            <li>• Enable human intervention</li>
                            <li>• Establish review processes</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-purple-800 mb-2">Transparency Implementation</h5>
                          <ul className="text-sm space-y-1 text-purple-700">
                            <li>• Provide clear AI disclosures</li>
                            <li>• Explain AI decisions</li>
                            <li>• Communicate limitations</li>
                            <li>• Make policies accessible</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="px-6 max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Developers Choose PromptOps
            </h2>
            <p className="text-xl text-gray-600">
              Built for professional prompt engineering teams
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <GitBranch className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Git-Level Version Control</h3>
                <p className="text-gray-600">
                  Branch, merge, and review prompts just like code. Full audit trails and rollback capabilities.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Enterprise Security</h3>
                <p className="text-gray-600">
                  Project-scoped API keys, fine-grained permissions, and SOC 2 compliance for enterprise deployments.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Multi-Model Support</h3>
                <p className="text-gray-600">
                  Use the same prompt across GPT, Claude, Gemini, and Llama with model-specific optimizations.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="px-6 max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Transform Your AI Development?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join developers treating prompts as source code with the tools they need to build professional AI applications.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto border-white text-white hover:bg-white hover:text-blue-600">
              Schedule a Demo
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

