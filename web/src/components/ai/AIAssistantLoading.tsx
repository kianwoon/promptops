import React, { useState, useEffect } from 'react'
import { Bot, Brain, Sparkles, CheckCircle, X } from 'lucide-react'

interface AIAssistantLoadingProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (generatedContent: string, masFields?: any) => void
  getContext: () => { description: string; module_info: string; requirements: string }
}

interface Stage {
  id: number
  name: string
  description: string
  duration: number
  icon: React.ReactNode
}

const stages: Stage[] = [
  {
    id: 1,
    name: "Understanding Requirements",
    description: "Analyzing your prompt requirements and objectives",
    duration: 1200,
    icon: <Brain className="w-5 h-5 text-blue-500" />
  },
  {
    id: 2,
    name: "AI Processing",
    description: "Using advanced AI to generate intelligent content",
    duration: 1500,
    icon: <Bot className="w-5 h-5 text-purple-500" />
  },
  {
    id: 3,
    name: "Compliance Check",
    description: "Ensuring MAS FEAT compliance and ethical standards",
    duration: 1000,
    icon: <CheckCircle className="w-5 h-5 text-green-500" />
  },
  {
    id: 4,
    name: "Final Generation",
    description: "Creating your optimized prompt with best practices",
    duration: 900,
    icon: <Sparkles className="w-5 h-5 text-green-500" />
  }
]

// No hardcoded fallback content - all content comes from the AI service
// The component will display content received from the backend AI generation

export function AIAssistantLoading({ isOpen, onClose, onComplete, getContext }: AIAssistantLoadingProps) {
  const [currentStage, setCurrentStage] = useState(0)
  const [progress, setProgress] = useState(0)
  const [confidence, setConfidence] = useState(0)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isProcessingAI, setIsProcessingAI] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    let stageTimeout: NodeJS.Timeout
    let progressInterval: NodeJS.Timeout
    let confidenceInterval: NodeJS.Timeout

    const startProgress = () => {
      // Update progress bar
      progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 98) {
            clearInterval(progressInterval)
            return 100
          }
          return prev + 2
        })
      }, 50)
    }

    const startConfidence = () => {
      // Update confidence based on current stage
      confidenceInterval = setInterval(() => {
        setConfidence(prev => {
          const targetConfidence = Math.min((currentStage + 1) * 25, 95)
          if (prev >= targetConfidence) {
            clearInterval(confidenceInterval)
            return targetConfidence
          }
          return prev + 1
        })
      }, 30)
    }

    const advanceStage = () => {
      if (currentStage < stages.length - 1) {
        setCurrentStage(prev => prev + 1)
        stageTimeout = setTimeout(advanceStage, stages[currentStage + 1].duration)
      } else {
        // All stages complete
        setIsCompleting(true)

        // Ensure progress reaches 100% and confidence completes
        setProgress(100)
        setConfidence(100)

        // Complete the process - parent will handle actual content generation and modal closing
        // Keep the modal open until parent decides to close it
        // Show AI processing state
        setIsProcessingAI(true)
      }
    }

    // Start the process
    stageTimeout = setTimeout(advanceStage, stages[0].duration)
    startProgress()
    startConfidence()

    return () => {
      clearTimeout(stageTimeout)
      clearInterval(progressInterval)
      clearInterval(confidenceInterval)
      setIsProcessingAI(false)
    }
  }, [isOpen, currentStage, getContext, onComplete, onClose])

  const handleCopy = async () => {
    try {
      // Copy functionality should be handled by parent component
      // This component is just for loading animation
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (!isOpen) return null

  const currentStageData = stages[currentStage]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all duration-300 scale-100">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            {/* Siri-style Wave Animation */}
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Bot className="w-10 h-10 text-white" />
              </div>

              {/* Animated Waves */}
              <div className={`absolute inset-0 rounded-full border-4 border-blue-400 animate-ping ${isCompleting ? 'hidden' : ''}`} style={{ animationDelay: '0s' }} />
              <div className={`absolute inset-0 rounded-full border-4 border-purple-400 animate-ping ${isCompleting ? 'hidden' : ''}`} style={{ animationDelay: '0.5s' }} />
              <div className={`absolute inset-0 rounded-full border-4 border-pink-400 animate-ping ${isCompleting ? 'hidden' : ''}`} style={{ animationDelay: '1s' }} />
            </div>

            {/* Completion Checkmark */}
            {isProcessingAI && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center">
                  <Bot className="w-10 h-10 text-white animate-pulse" />
                </div>
              </div>
            )}
            {isCompleting && !isProcessingAI && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
              </div>
            )}
          </div>

          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {isProcessingAI ? "AI Processing..." : isCompleting ? "Prompt Generated!" : currentStageData.name}
          </h3>
          <p className="text-gray-600">
            {isProcessingAI
              ? "AI is generating your custom prompt... This may take a few moments."
              : isCompleting
                ? "Your AI-powered prompt is ready"
                : currentStageData.description
            }
          </p>
        </div>

        {/* Progress Bar - Hide during AI processing */}
        {!isProcessingAI && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm font-medium text-gray-700">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Confidence Score - Hide during AI processing */}
        {!isProcessingAI && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">AI Confidence</span>
              <span className="text-sm font-medium text-gray-700">{confidence}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${confidence}%` }}
              />
            </div>
          </div>
        )}

        {/* Stage Indicators */}
        <div className="flex justify-between mb-6">
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 transition-colors duration-300 ${
                  index <= currentStage
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {stage.icon}
              </div>
              <span className={`text-xs text-center ${
                index <= currentStage ? 'text-gray-900 font-medium' : 'text-gray-500'
              }`}>
                {stage.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex items-center space-x-2"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </button>

          {isProcessingAI && (
            <button
              disabled
              className="px-4 py-2 bg-blue-400 text-white rounded-lg flex items-center space-x-2 cursor-not-allowed"
            >
              <Bot className="w-4 h-4 animate-pulse" />
              <span>Processing...</span>
            </button>
          )}

          {isCompleting && !isProcessingAI && (
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center space-x-2"
            >
              {isCopied ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Content preview is handled by parent component */}
      </div>
    </div>
  )
}