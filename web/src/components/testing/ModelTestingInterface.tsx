import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Play, Square, Loader2 } from 'lucide-react'
import { ModelTestResults } from './ModelTestResults'
import { useUserProviders, useTestPromptAcrossProviders } from '@/hooks/api'

interface ModelTestingInterfaceProps {
  systemPrompt: string
  promptName?: string
}

export function ModelTestingInterface({ systemPrompt, promptName }: ModelTestingInterfaceProps) {
  const [userMessage, setUserMessage] = useState('')
  const [selectedProviders, setSelectedProviders] = useState<string[]>([])
  const [testResults, setTestResults] = useState<any[]>([])
  const [isTesting, setIsTesting] = useState(false)

  const { data: providersData, isLoading: isLoadingProviders } = useUserProviders()
  const testMutation = useTestPromptAcrossProviders()

  const providers = providersData?.providers || []

  const handleProviderToggle = (providerId: string) => {
    setSelectedProviders(prev =>
      prev.includes(providerId)
        ? prev.filter(id => id !== providerId)
        : [...prev, providerId]
    )
  }

  const handleSelectAllProviders = () => {
    if (selectedProviders.length === providers.length) {
      setSelectedProviders([])
    } else {
      setSelectedProviders(providers.map(p => p.id))
    }
  }

  const handleTestPrompt = async () => {
    if (!userMessage.trim()) {
      alert('Please enter a message to test')
      return
    }

    if (selectedProviders.length === 0 && providers.length > 0) {
      alert('Please select at least one provider to test')
      return
    }

    setIsTesting(true)
    setTestResults([])

    try {
      const requestData: any = {
        system_prompt: systemPrompt,
        user_message: userMessage,
      }

      // Only include providers if specific ones are selected
      if (selectedProviders.length > 0) {
        requestData.providers = selectedProviders
      }

      const result = await testMutation.mutateAsync(requestData)
      setTestResults(result.results || [])
    } catch (error) {
      console.error('Test failed:', error)
    } finally {
      setIsTesting(false)
    }
  }

  const handleStopTest = () => {
    setIsTesting(false)
  }

  return (
    <div className="space-y-6">
      {/* System Prompt Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>System Prompt</span>
            {promptName && (
              <Badge variant="outline">{promptName}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-md">
            <pre className="whitespace-pre-wrap text-sm font-mono">
              {systemPrompt}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* User Message Input */}
      <Card>
        <CardHeader>
          <CardTitle>Test Message</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="user-message">Enter your test message:</Label>
              <Textarea
                id="user-message"
                placeholder="Enter a message to test with this system prompt..."
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>

            {/* AI Provider Selection */}
            {providers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium">AI Providers to Test:</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllProviders}
                    className="text-xs"
                  >
                    {selectedProviders.length === providers.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {providers.map((provider) => (
                    <div key={provider.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`provider-${provider.id}`}
                        checked={selectedProviders.includes(provider.id)}
                        onCheckedChange={() => handleProviderToggle(provider.id)}
                        disabled={isTesting}
                      />
                      <Label
                        htmlFor={`provider-${provider.id}`}
                        className="text-sm cursor-pointer flex-1 min-w-0"
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{provider.name}</span>
                          <Badge variant="outline" className="text-xs ml-2">
                            {provider.type}
                          </Badge>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Test Button */}
            <div className="flex items-center space-x-2">
              {isTesting ? (
                <Button onClick={handleStopTest} variant="destructive">
                  <Square className="w-4 h-4 mr-2" />
                  Stop Test
                </Button>
              ) : (
                <Button
                  onClick={handleTestPrompt}
                  disabled={!userMessage.trim() || (providers.length > 0 && selectedProviders.length === 0)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Test Across {selectedProviders.length > 0 ? selectedProviders.length : 'All'} Providers
                </Button>
              )}
              {isTesting && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing in progress...
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <ModelTestResults
            results={testResults}
            isTesting={isTesting}
          />
        </CardContent>
      </Card>
    </div>
  )
}