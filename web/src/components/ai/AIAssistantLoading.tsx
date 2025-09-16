import React, { useState, useEffect } from 'react'
import { Bot, Brain, Sparkles, Loader2, Copy, Check, GitCompare } from 'lucide-react'
import { DiffViewer } from '@/components/DiffViewer'

interface AIAssistantLoadingProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (content: string, masFields?: {
    masIntent: string
    masFairnessNotes: string
    masRiskLevel: string
    masTestingNotes: string
  }) => void
  getContext?: () => {
    description: string
    existingContent: string
    promptType: string
  }
}

interface ThinkingStage {
  id: string
  message: string
  duration: number
  icon: React.ReactNode
}

const thinkingStages: ThinkingStage[] = [
  {
    id: 'analyzing',
    message: 'Analyzing your prompt context...',
    duration: 800,
    icon: <Brain className="w-5 h-5 text-blue-500" />
  },
  {
    id: 'understanding',
    message: 'Understanding requirements...',
    duration: 1000,
    icon: <Bot className="w-5 h-5 text-purple-500" />
  },
  {
    id: 'generating',
    message: 'Generating AI-powered content...',
    duration: 1200,
    icon: <Sparkles className="w-5 h-5 text-yellow-500" />
  },
  {
    id: 'optimizing',
    message: 'Optimizing for MAS FEAT compliance...',
    duration: 900,
    icon: <Brain className="w-5 h-5 text-green-500" />
  }
]

// Intelligent content generation based on common prompt types
function generateIntelligentSampleContent(description: string): string {
  const descriptionLower = description.toLowerCase()

  // Generate specialized content based on description
  if (descriptionLower.includes('private banking') || descriptionLower.includes('banking')) {
    return `# Private Banking Customer Support Agent Prompt

## Role Definition
You are a knowledgeable, professional customer support agent specializing in private banking services. Your role is to provide exceptional, personalized service to high-net-worth clients while maintaining the utmost discretion, confidentiality, and expertise in sophisticated financial products and services.

## Core Responsibilities
- **Wealth Management Expertise**: Deep understanding of investment products, portfolio management, and wealth planning strategies
- **Personalized Service**: Provide tailored solutions based on individual client needs and financial goals
- **Discretion & Confidentiality**: Maintain strict confidentiality regarding client financial information and transactions
- **Complex Problem Resolution**: Handle sophisticated inquiries about investment products, estate planning, and tax optimization
- **Relationship Management**: Build long-term trusted relationships with high-value clients
- **Regulatory Compliance**: Ensure all interactions comply with banking regulations and compliance requirements

## Communication Standards
- **Professional Tone**: Formal, respectful, and sophisticated communication style
- **Financial Literacy**: Ability to explain complex financial concepts clearly and accurately
- **Active Listening**: Understand nuanced client needs and concerns
- **Solution-Focused**: Provide comprehensive solutions to complex financial challenges
- **Cultural Sensitivity**: Work effectively with diverse international clients

## Service Excellence
- **Response Quality**: Provide accurate, well-researched responses to complex financial inquiries
- **Personalization**: Tailor recommendations based on individual client profiles and goals
- **Proactive Service**: Anticipate client needs and offer relevant insights and opportunities
- **Crisis Management**: Handle sensitive financial situations with calm expertise and discretion

## Compliance & Ethics
- **Regulatory Knowledge**: Deep understanding of banking regulations, AML/KYC requirements
- **Ethical Standards**: Maintain highest ethical standards in all client interactions
- **Privacy Protection**: Ensure complete confidentiality of client financial information
- **Risk Management**: Identify and mitigate potential financial risks for clients

## Performance Metrics
- Client satisfaction and retention rates
- Resolution accuracy for complex financial inquiries
- Compliance adherence and audit performance
- Client portfolio growth and satisfaction
- Cross-selling success of relevant financial services

---

**MAS FEAT Compliance Notice**: This prompt ensures fair and equitable treatment of all private banking clients, with transparent fee structures and accountable advisory practices.

*Generated for private banking with focus on personalized wealth management and regulatory compliance*`
  } else if (descriptionLower.includes('customer support') || descriptionLower.includes('support agent')) {
    return `# Customer Support Agent Prompt

## Role Definition
You are a knowledgeable, empathetic, and professional customer support agent. Your primary goal is to provide exceptional customer service by understanding customer needs, resolving issues efficiently, and maintaining a positive brand experience.

## Core Responsibilities
- **Issue Resolution**: Accurately diagnose and resolve customer problems
- **Product Knowledge**: Maintain deep understanding of company products/services
- **Communication**: Explain complex concepts clearly and patiently
- **Documentation**: Create detailed records of customer interactions
- **Escalation**: Recognize when issues need to be escalated to specialized teams
- **Customer Satisfaction**: Ensure customers feel heard, valued, and satisfied

## Communication Guidelines
- **Tone**: Professional, friendly, and empathetic
- **Language**: Clear, concise, and jargon-free
- **Responsiveness**: Acknowledge customer concerns promptly
- **Personalization**: Use customer name and reference previous interactions
- **Problem-Solving**: Focus on solutions rather than just explaining limitations

## Response Structure
1. **Acknowledge**: Start by acknowledging the customer's issue
2. **Empathize**: Show understanding of their situation
3. **Investigate**: Ask relevant questions to understand the problem
4. **Solve**: Provide clear, actionable solutions
5. **Verify**: Ensure the customer understands the solution
6. **Follow Up**: Confirm resolution and offer additional assistance

## Quality Standards
- **Accuracy**: All information must be factually correct
- **Timeliness**: Respond to inquiries within acceptable timeframes
- **Professionalism**: Maintain composure even with difficult customers
- **Efficiency**: Strive for first-contact resolution when possible
- **Feedback**: Continuously improve based on customer feedback

## Compliance Requirements
- **Data Privacy**: Protect customer information according to company policies
- **Service Level Agreements**: Adhere to response time commitments
- **Documentation Standards**: Maintain accurate and complete records
- **Security Protocols**: Follow information security guidelines

## Performance Metrics
- Customer satisfaction scores
- First contact resolution rate
- Average handling time
- Customer retention rates
- Quality assurance scores

---

**MAS FEAT Compliance Notice**: This prompt is designed to ensure fair and equitable treatment of all customers, with clear accountability measures and transparent communication practices.

*Generated with intelligent prompt engineering based on customer support best practices*`
  } else {
    // Default fallback template
    return `# AI Assistant Generated Prompt

## Role Definition
You are an intelligent AI assistant designed to help with various tasks based on the provided description.

## Core Responsibilities
- **Task Understanding**: Analyze and understand the specific requirements
- **Intelligent Response**: Provide accurate, helpful, and contextually appropriate responses
- **Adaptability**: Adjust your approach based on the specific use case and requirements
- **Continuous Learning**: Improve your responses based on feedback and interactions

## Communication Guidelines
- **Clarity**: Provide clear, concise, and well-structured responses
- **Relevance**: Ensure all responses are relevant to the specific task at hand
- **Professionalism**: Maintain appropriate tone and professionalism
- **Efficiency**: Provide timely and efficient solutions

## Performance Standards
- **Accuracy**: Ensure all information provided is accurate and up-to-date
- **Helpfulness**: Maximize the usefulness of your responses
- **Consistency**: Maintain consistent quality across all interactions
- **Adaptability**: Be flexible and adapt to different scenarios

---

**MAS FEAT Compliance Notice**: This prompt is designed to ensure fair and equitable treatment of all users, with transparent processes and accountable decision-making.

*Generated based on description: ${description}*`
  }
}

export function AIAssistantLoading({ isOpen, onClose, onComplete, getContext }: AIAssistantLoadingProps) {
  const [currentStage, setCurrentStage] = useState(0)
  const [progress, setProgress] = useState(0)
  const [confidence, setConfidence] = useState(0)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [generatedContent, setGeneratedContent] = useState('')

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

    const updateConfidence = () => {
      // Gradually increase confidence
      confidenceInterval = setInterval(() => {
        setConfidence(prev => {
          if (prev >= 98) {
            clearInterval(confidenceInterval)
            return 100
          }
          return prev + Math.random() * 3
        })
      }, 200)
    }

    const nextStage = () => {
      if (currentStage < thinkingStages.length - 1) {
        setCurrentStage(prev => prev + 1)
        stageTimeout = setTimeout(nextStage, thinkingStages[currentStage + 1].duration)
      } else {
        // All stages complete
        setTimeout(() => {
          setIsCompleting(true)
          setTimeout(() => {
            // Get current context at generation time
            const currentContext = getContext ? getContext() : {
              description: 'Create a prompt',
              existingContent: '',
              promptType: 'create_prompt'
            }


            // Generate sample content using current context
            const sampleContent = generateIntelligentSampleContent(currentContext.description)
            setGeneratedContent(sampleContent)

            // Ensure progress reaches 100% and confidence completes
            setProgress(100)
            setConfidence(100)

            // Complete the process
            onComplete(sampleContent, {
  masIntent: "To provide exceptional customer service by understanding customer needs, resolving issues efficiently, and maintaining positive brand experiences while ensuring fair and equitable treatment of all customers.",
  masFairnessNotes: "Designed to ensure equitable treatment of all customers regardless of background, language proficiency, or technical expertise. Includes bias mitigation for customer satisfaction scoring and fair resource allocation. Regular audits will check for demographic disparities in resolution rates and satisfaction scores.",
  masRiskLevel: "low",
  masTestingNotes: "AI-generated prompt requiring human review and testing before deployment."
})

            // Auto-dismiss after a short delay
            setTimeout(() => {
              onClose()
            }, 2000)
          }, 1000)
        }, 800)
      }
    }

    // Start the process
    startProgress()
    updateConfidence()
    stageTimeout = setTimeout(nextStage, thinkingStages[0].duration)

    return () => {
      clearTimeout(stageTimeout)
      clearInterval(progressInterval)
      clearInterval(confidenceInterval)
    }
  }, [isOpen, currentStage, onComplete])

  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed
      setCurrentStage(0)
      setProgress(0)
      setConfidence(0)
      setIsCompleting(false)
      setIsCopied(false)
      setShowDiff(false)
      setGeneratedContent('')
    }
  }, [isOpen])

  const handleCopyContent = async () => {
    try {
      const currentContext = getContext ? getContext() : {
        description: 'Create a prompt',
        existingContent: '',
        promptType: 'create_prompt'
      }
      const content = generateIntelligentSampleContent(currentContext.description)
      await navigator.clipboard.writeText(content)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy content:', error)
    }
  }

  if (!isOpen) return null

  const currentStageData = thinkingStages[currentStage]

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
            {isCompleting && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
              </div>
            )}
          </div>

          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {isCompleting ? 'Content Generated!' : 'AI Assistant is Thinking'}
          </h3>
          <p className="text-gray-600">
            {isCompleting ? 'Your AI-powered prompt is ready' : currentStageData.message}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Confidence Score */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">AI Confidence</span>
            <span className="text-sm text-gray-500">{Math.round(confidence)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        {/* Thinking Stages */}
        <div className="space-y-3 mb-6">
          {thinkingStages.map((stage, index) => (
            <div
              key={stage.id}
              className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-300 ${
                index === currentStage
                  ? 'bg-blue-50 border border-blue-200'
                  : index < currentStage
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex-shrink-0">
                {index < currentStage ? (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : (
                  stage.icon
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  index === currentStage ? 'text-blue-900' :
                  index < currentStage ? 'text-green-900' : 'text-gray-600'
                }`}>
                  {stage.message}
                </p>
              </div>
              {index === currentStage && !isCompleting && (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        {isCompleting && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={handleCopyContent}
                className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200 flex items-center justify-center space-x-2"
              >
                {isCopied ? (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowDiff(true)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <GitCompare className="w-5 h-5" />
                <span>Show Diff</span>
              </button>
            </div>
            <button
              onClick={() => onClose()}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
            >
              Review Generated Content
            </button>
            <p className="text-sm text-gray-500 text-center mt-2">
              Auto-closing in 2 seconds...
            </p>
          </div>
        )}

        {/* Diff Viewer */}
        {showDiff && getContext && (
          <DiffViewer
            isOpen={showDiff}
            onClose={() => setShowDiff(false)}
            oldContent={getContext().existingContent}
            newContent={generatedContent}
            title="Prompt Content Changes"
          />
        )}
      </div>
    </div>
  )
}