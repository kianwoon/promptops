import React from 'react'
import { Link } from 'react-router-dom'
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
  GitBranch
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'

export function DeveloperPage() {
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

# List available prompts
prompts = client.list_prompts()
print(f"Found {len(prompts)} prompts")

# Get a specific prompt
prompt = client.get_prompt("prompt_id_here")
print(f"Prompt: {prompt.name}")
print(f"Content: {prompt.content}")`

  const javascriptAuthCode = `import { PromptOps } from 'promptops';

// Initialize with your API key and secret key
const client = new PromptOps({
    apiKey: 'your_api_key_here',
    secretKey: 'your_secret_key_here'
});

// List available prompts
const prompts = await client.listPrompts();
console.log(\`Found \${prompts.length} prompts\`);

// Get a specific prompt
const prompt = await client.getPrompt('prompt_id_here');
console.log(\`Prompt: \${prompt.name}\`);
console.log(\`Content: \${prompt.content}\`);`

  const pythonUsageCode = `import promptops

# Initialize client
client = promptops.Client(
    api_key="your_api_key_here",
    secret_key="your_secret_key_here"
)

# Use a prompt in your application
response = client.use_prompt(
    prompt_id="your_prompt_id",
    variables={
        "user_input": "Hello, how are you?",
        "language": "English"
    }
)

print(response.content)
print(response.usage)`

  const javascriptUsageCode = `import { PromptOps } from 'promptops';

const client = new PromptOps({
    apiKey: 'your_api_key_here',
    secretKey: 'your_secret_key_here'
});

// Use a prompt with variables
const result = await client.usePrompt('prompt_id_here', {
    variables: {
        userInput: 'Hello, how are you?',
        language: 'English'
    }
});

console.log(result.content);
console.log(result.usage);`

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

