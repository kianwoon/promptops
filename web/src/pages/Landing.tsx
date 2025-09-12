import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  ArrowRight, 
  CheckCircle, 
  Shield, 
  Zap, 
  Users, 
  BarChart3, 
  Github,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Chrome,
  FileText,
  Rocket
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton'
import { useAuth } from '@/contexts/AuthContext'

export function Landing() {
  const { isAuthenticated, user } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  })

  const features = [
    {
      icon: BarChart3,
      title: "Prompt as Source Code",
      description: "Git-level discipline for prompts with versioning, branching, and audit trails"
    },
    {
      icon: Shield,
      title: "Enterprise Prompt Governance",
      description: "Multi-model prompt management with validation, testing, and compliance controls"
    },
    {
      icon: Zap,
      title: "Prompt-Dense Workflows",
      description: "Scale AI operations with template reuse, variants, and performance monitoring"
    },
    {
      icon: Users,
      title: "Professional Prompt Engineering",
      description: "Collaborative prompt development with review cycles and approval workflows"
    }
  ]

  const useCases = [
    "Enterprise AI Development Teams",
    "Prompt Engineering Departments",
    "AI Product Management",
    "Machine Learning Operations",
    "Enterprise AI Governance",
    "Multi-Model Deployment Teams"
  ]

  const stats = [
    { label: "Prompt Version Control", value: "Git-Level", description: "Branching, merging, and audit trails" },
    { label: "Multi-Model Support", value: "12+ Models", description: "GPT, Claude, Gemini, Llama & more" },
    { label: "Prompt Performance", value: "< 25ms", description: "Edge-cached prompt delivery" },
    { label: "Enterprise Ready", value: "SOC 2", description: "Governance & compliance built-in" }
  ]

  return (
    <div className="flex-1">

      {/* Hero Section */}
      <section className="px-6 py-8 relative">
        <div className={`grid md:grid-cols-2 gap-6 items-center max-w-7xl mx-auto ${isAuthenticated ? 'gap-4' : 'gap-6'}`}>
          <div>
            <div className={`inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium ${isAuthenticated ? 'mb-2' : 'mb-4'}`}>
              <Zap className="w-4 h-4 mr-2" />
              Git-Level Discipline for AI Prompts
            </div>
            
            <h1 className={`text-5xl font-bold text-gray-900 leading-tight ${isAuthenticated ? 'mb-2' : 'mb-4'}`}>
              Bring Git-Level Discipline to
              <span className="text-blue-600"> Enterprise AI Prompts</span>
            </h1>
            
            <p className={`text-xl text-gray-600 leading-relaxed ${isAuthenticated ? 'mb-4' : 'mb-6'}`}>
              PromptOps treats prompts as the new source code of enterprise AI. 
              Built for professional prompt engineers managing complex, prompt-dense workflows across multiple models.
            </p>
            
            <div className={`flex flex-col sm:flex-row gap-4 ${isAuthenticated ? 'mb-4' : 'mb-8'}`}>
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard">
                    <Button size="lg" className="w-full sm:w-auto">
                      Go to Dashboard
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    <Github className="mr-2 w-5 h-5" />
                    View on GitHub
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/register">
                    <Button size="lg" className="w-full sm:w-auto">
                      Start Free Trial
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    <Github className="mr-2 w-5 h-5" />
                    View on GitHub
                  </Button>
                </>
              )}
            </div>
            
            <div className={`flex items-center text-sm text-gray-500 ${isAuthenticated ? 'space-x-4' : 'space-x-8'}`}>
              {isAuthenticated ? (
                <>
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    <span className="text-xs">14-day trial</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    <span className="text-xs">Cancel anytime</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    No credit card required
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    14-day free trial
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    Cancel anytime
                  </div>
                </>
              )}
            </div>
          </div>
          
          {!isAuthenticated ? (
          <div className="block">
            <Card className="shadow-2xl">
              <CardHeader>
                <CardTitle className="text-xl">Quick Login</CardTitle>
                <CardDescription>
                  Sign in to your PromptOps account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        className="pl-10"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-10"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  
                  <Link to="/dashboard" className="w-full">
                    <Button type="button" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  
                  <div className="mt-4">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-card text-muted-foreground">Or continue with</span>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <GoogleLoginButton className="w-full" />
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <span className="text-sm text-gray-600">Don't have an account? </span>
                    <Link to="/register" className="text-sm text-blue-600 hover:underline">
                      Sign up
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="block">
            <Card className="shadow-2xl">
              <CardHeader>
                <CardTitle className="text-xl">Welcome to PromptOps</CardTitle>
                <CardDescription>
                  You're signed in as {user?.email}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Animated dashboard preview */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg p-6">
                    <div className="animate-pulse space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-3 w-3 bg-green-500 rounded-full animate-bounce"></div>
                        <div className="text-sm font-medium text-gray-700">PromptOps Dashboard Active</div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <div className="text-xs text-gray-500 mb-1">Active Templates</div>
                          <div className="text-xl font-bold text-blue-600">24</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <div className="text-xs text-gray-500 mb-1">Deployments</div>
                          <div className="text-xl font-bold text-green-600">8</div>
                        </div>
                      </div>

                      {/* Real-time activity feed */}
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="text-xs text-gray-500 mb-2">Recent Activity</div>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-gray-600">Template updated: enterprise_chat_v2</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-gray-600">Deployment successful: production</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="h-2 w-2 bg-purple-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-gray-600">New evaluation: model_comparison</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">System Performance</span>
                          <div className="flex items-center space-x-1">
                            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-600">Optimal</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full w-3/4 animate-pulse"></div>
                        </div>
                      </div>

                      {/* Model status indicators */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-1">
                            <div className="text-xs font-bold text-blue-600">GPT</div>
                          </div>
                          <div className="text-xs text-gray-600">Active</div>
                        </div>
                        <div className="text-center">
                          <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-1">
                            <div className="text-xs font-bold text-green-600">Claude</div>
                          </div>
                          <div className="text-xs text-gray-600">Active</div>
                        </div>
                        <div className="text-center">
                          <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-1">
                            <div className="text-xs font-bold text-purple-600">Gemini</div>
                          </div>
                          <div className="text-xs text-gray-600">Active</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Link to="/dashboard" className="w-full">
                    <Button className="w-full">
                      <ArrowRight className="mr-2 w-4 h-4" />
                      Go to Dashboard
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        </div>
      </section>

      {/* Content Section above Stats Ticker */}
      <section className="py-2 bg-gray-50">
        <div className="px-6 max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Template Library</h3>
              <p className="text-gray-600">Access your professionally crafted prompt templates optimized for different use cases and models.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Rocket className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Deployment Hub</h3>
              <p className="text-gray-600">Deploy your prompts across multiple environments with version control and rollback capabilities.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Performance Analytics</h3>
              <p className="text-gray-600">Track prompt performance, user satisfaction, and optimization opportunities across all models.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Animated Stats Ticker */}
      {isAuthenticated && (
        <section className="py-8 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="px-6 max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-white">
              <div className="text-center">
                <div className="text-3xl font-bold mb-2 animate-pulse">24</div>
                <div className="text-sm opacity-90">Active Templates</div>
                <div className="text-xs opacity-75 mt-1">+2 today</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold mb-2 animate-pulse">8</div>
                <div className="text-sm opacity-90">Deployments</div>
                <div className="text-xs opacity-75 mt-1">All active</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold mb-2 animate-pulse">156</div>
                <div className="text-sm opacity-90">Prompt Versions</div>
                <div className="text-xs opacity-75 mt-1">Across all models</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold mb-2 animate-pulse">99.9%</div>
                <div className="text-sm opacity-90">Uptime</div>
                <div className="text-xs opacity-75 mt-1">This month</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section id="features" className="py-16 bg-white">
        <div className="px-6 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              The Professional Prompt Engineering Platform
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Where prompt engineering meets software engineering discipline. 
              Manage system prompts, model variations, and enterprise AI workflows with Git-level control.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card key={index} className="text-center border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-8">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                    <p className="text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-blue-600">
        <div className="px-6 max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <div key={index} className="text-center text-white">
                <div className="text-4xl font-bold mb-2">{stat.value}</div>
                <div className="text-lg font-medium mb-1">{stat.label}</div>
                <div className="text-blue-100">{stat.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="py-16 bg-gray-50">
        <div className="px-6 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Where Professional Prompt Engineers Thrive
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              For teams who understand that writing prompts is different from writing code — and need enterprise-grade tools to match.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {useCases.map((useCase, index) => (
              <Card key={index} className="border-0 shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center mb-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    <span className="font-medium text-gray-900">{useCase}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="px-6 max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Professionalize Your AI Prompts?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join enterprise teams treating prompts as source code — with the discipline, governance, and scale your AI initiatives demand.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Go to Dashboard
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/register">
                  <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                    Start Free Trial
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-white text-white hover:bg-white hover:text-blue-600">
                  Schedule Demo
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      </div>
  )
}