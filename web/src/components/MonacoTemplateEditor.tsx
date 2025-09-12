import React, { useRef, useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Save, Play, Eye, EyeOff } from 'lucide-react'

interface MonacoTemplateEditorProps {
  initialContent?: string
  language?: string
  theme?: string
  onSave?: (content: string) => void
  onTest?: (content: string) => void
  readOnly?: boolean
  height?: string
}

export function MonacoTemplateEditor({
  initialContent = '',
  language = 'yaml',
  theme = 'vs-dark',
  onSave,
  onTest,
  readOnly = false,
  height = '600px'
}: MonacoTemplateEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [isPreviewVisible, setIsPreviewVisible] = useState(false)
  const [isValidYaml, setIsValidYaml] = useState(true)
  const editorRef = useRef<any>(null)

  useEffect(() => {
    setContent(initialContent)
  }, [initialContent])

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor
    
    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      tabSize: 2,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderLineHighlight: 'all',
      selectOnLineNumbers: true,
      matchBrackets: 'always',
      autoIndent: 'advanced',
      formatOnPaste: true,
      formatOnType: true
    })

    // Add YAML validation
    editor.onDidChangeModelContent(() => {
      validateYaml(editor.getValue())
    })
  }

  const validateYaml = (yamlContent: string) => {
    try {
      // Basic YAML validation - check for proper structure
      const lines = yamlContent.split('\n')
      let hasErrors = false
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()
        
        if (trimmed && !trimmed.startsWith('#')) {
          // Check for proper key-value pairs
          if (trimmed.includes(':')) {
            const parts = trimmed.split(':')
            if (parts.length > 1 && parts[0].trim() === '') {
              hasErrors = true
              break
            }
          }
        }
      }
      
      setIsValidYaml(!hasErrors)
    } catch (error) {
      setIsValidYaml(false)
    }
  }

  const handleSave = () => {
    if (isValidYaml && onSave) {
      onSave(content)
    }
  }

  const handleTest = () => {
    if (isValidYaml && onTest) {
      onTest(content)
    }
  }

  const handleEditorChange = (value: string | undefined) => {
    const newContent = value || ''
    setContent(newContent)
    validateYaml(newContent)
  }

  const formatYaml = () => {
    try {
      const formatted = formatYamlContent(content)
      setContent(formatted)
      if (editorRef.current) {
        editorRef.current.setValue(formatted)
      }
    } catch (error) {
      console.error('Failed to format YAML:', error)
    }
  }

  const formatYamlContent = (yaml: string): string => {
    const lines = yaml.split('\n')
    let indentLevel = 0
    const formattedLines: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      
      if (trimmed.startsWith('#') || trimmed === '') {
        formattedLines.push(line)
        continue
      }

      if (trimmed.includes(':') && !trimmed.endsWith(':')) {
        // Key-value pair
        if (indentLevel > 0) {
          formattedLines.push('  '.repeat(indentLevel) + trimmed)
        } else {
          formattedLines.push(trimmed)
        }
      } else if (trimmed.endsWith(':')) {
        // Key with nested content
        if (indentLevel > 0) {
          formattedLines.push('  '.repeat(indentLevel) + trimmed)
        } else {
          formattedLines.push(trimmed)
        }
        indentLevel++
      } else {
        // Value or nested content
        if (indentLevel > 0) {
          formattedLines.push('  '.repeat(indentLevel) + trimmed)
        } else {
          formattedLines.push(trimmed)
        }
      }
    }

    return formattedLines.join('\n')
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            Template Editor
            <Badge variant={isValidYaml ? "default" : "destructive"}>
              {isValidYaml ? "Valid YAML" : "Invalid YAML"}
            </Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={formatYaml}
              disabled={readOnly}
            >
              Format
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewVisible(!isPreviewVisible)}
            >
              {isPreviewVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {isPreviewVisible ? "Hide Preview" : "Show Preview"}
            </Button>
            
            {onTest && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={!isValidYaml || readOnly}
              >
                <Play className="w-4 h-4 mr-2" />
                Test
              </Button>
            )}
            
            {onSave && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isValidYaml || readOnly}
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Editor
              height={height}
              language={language}
              theme={theme}
              value={content}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              options={{
                readOnly,
                domReadOnly: readOnly,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                occurrencesHighlight: false,
                cursorBlinking: 'blink',
                wordWrap: 'on',
                folding: true,
                foldingStrategy: 'indentation',
                showFoldingControls: 'always',
                disableLayerHinting: true,
                renderLineHighlight: 'all',
                selectOnLineNumbers: true,
                matchBrackets: 'always',
                autoIndent: 'advanced',
                formatOnPaste: true,
                formatOnType: true,
                tabSize: 2,
              }}
            />
          </div>
          
          {isPreviewVisible && (
            <div className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96">
                    {content}
                  </pre>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}