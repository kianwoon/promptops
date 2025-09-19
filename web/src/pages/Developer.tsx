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
  Loader2
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

  const pipInstallationCode = `# Install via pip
pip install promptops

# Or install with specific dependencies
pip install promptops[openai,anthropic,google]`

  const npmInstallationCode = `# Install via npm
npm install promptops

# Or install with specific dependencies
npm install promptops

# For TypeScript support
npm install --save-dev @types/promptops`

  const pythonAuthCode = `import promptops

# Initialize with your API key and secret key
client = promptops.Client(
    api_key="your_api_key_here",
    secret_key="your_secret_key_here"
)

# List prompts for a specific project and module
prompts = client.list_prompts(
    project_id="your_project_id",
    module_id="your_module_id"
)
print(f"Found {len(prompts)} prompts")

# Get a specific prompt
prompt = client.get_prompt(
    prompt_id="prompt_id_here",
    project_id="your_project_id",
    module_id="your_module_id"
)
print(f"Prompt: {prompt.name}")
print(f"Content: {prompt.content}")

# Get prompts filtered by LLM model
gpt_prompts = client.list_prompts(
    project_id="your_project_id",
    module_id="your_module_id",
    llm_model="gpt-4"
)
print(f"Found {len(gpt_prompts)} GPT-4 prompts")`

  const javascriptAuthCode = `import { PromptOps } from 'promptops';

// Initialize with your API key and secret key
const client = new PromptOps({
    apiKey: 'your_api_key_here',
    secretKey: 'your_secret_key_here'
});

// List prompts for a specific project and module
const prompts = await client.listPrompts({
    projectId: 'your_project_id',
    moduleId: 'your_module_id'
});
console.log(\`Found \${prompts.length} prompts\`);

// Get a specific prompt
const prompt = await client.getPrompt('prompt_id_here', {
    projectId: 'your_project_id',
    moduleId: 'your_module_id'
});
console.log(\`Prompt: \${prompt.name}\`);
console.log(\`Content: \${prompt.content}\`);

// Get prompts filtered by LLM model
const gptPrompts = await client.listPrompts({
    projectId: 'your_project_id',
    moduleId: 'your_module_id',
    llmModel: 'gpt-4'
});
console.log(\`Found \${gptPrompts.length} GPT-4 prompts\`);`

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

  const javascriptUsageCode = `import { PromptOps } from 'promptops';

const client = new PromptOps({
    apiKey: 'your_api_key_here',
    secretKey: 'your_secret_key_here'
});

// Use a prompt with project and module context
const result = await client.usePrompt('prompt_id_here', {
    projectId: 'your_project_id',
    moduleId: 'your_module_id',
    variables: {
        userInput: 'Hello, how are you?',
        language: 'English'
    }
});

console.log(result.content);
console.log(result.usage);

// Use with specific LLM model
const claudeResult = await client.usePrompt('prompt_id_here', {
    projectId: 'your_project_id',
    moduleId: 'your_module_id',
    llmModel: 'claude-3-sonnet',
    variables: {
        userInput: 'Hello, how are you?',
        language: 'English'
    }
});

console.log(claudeResult.content);
console.log(claudeResult.usage);`

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

