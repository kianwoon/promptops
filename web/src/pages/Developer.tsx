import React, { useState } from 'react'
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
  ExternalLink,
  GitBranch,
  Search,
  Database,
  Cpu,
  Play,
  Loader2,
  Settings,
  Code2,
  GitPullRequest,
  Rocket
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
      setError(`Network error: ${err.message}`)
    } finally {
      setLoading(false)
    }
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

# Initialize with your API key
client = PromptOpsClient(
    base_url="https://api.promptops.ai",
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

// Initialize with your API key
const client = new PromptOpsClient({
  baseUrl: 'https://api.promptops.ai',
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

# Initialize client
client = promptops.Client(
    api_key="your_api_key_here",
    secret_key="your_secret_key_here"
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
  baseUrl: 'https://api.promptops.ai',
  apiKey: 'your_api_key_here'
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

# Test connection
promptops test --api-key your_key --base-url https://api.promptops.ai

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

              {/* Input Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label htmlFor="llmModel">LLM Model (Optional)</Label>
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

              {/* Retrieve Button */}
              <Button
                onClick={retrievePrompts}
                disabled={loading || !projectId || !moduleId}
                className="w-full"
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

              {/* Results Display */}
              {results.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Retrieved Prompts ({results.length})</h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {results.map((prompt, index) => (
                      <Card key={index} className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{prompt.name || `Prompt ${index + 1}`}</h4>
                            <Badge variant="outline">{prompt.id}</Badge>
                          </div>
                          <p className="text-sm text-gray-600">{prompt.description || 'No description'}</p>
                          <Textarea
                            value={prompt.content || 'No content available'}
                            readOnly
                            className="min-h-[100px] text-sm"
                          />
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>Created: {new Date(prompt.created_at).toLocaleDateString()}</span>
                            <span>Version: {prompt.version || '1'}</span>
                            {prompt.llm_model && (
                              <Badge variant="secondary">{prompt.llm_model}</Badge>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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

