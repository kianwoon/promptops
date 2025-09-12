// YAML syntax highlighting and validation utilities for Monaco Editor

interface YamlValidationError {
  line: number
  column: number
  message: string
  severity: 'error' | 'warning' | 'info'
}

interface YamlSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array'
  properties?: Record<string, YamlSchema>
  items?: YamlSchema
  required?: string[]
  description?: string
  enum?: any[]
}

// PromptOps template schema
const templateSchema: YamlSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Template name' },
    version: { type: 'string', description: 'Template version' },
    description: { type: 'string', description: 'Template description' },
    template: { type: 'string', description: 'The prompt template' },
    variables: {
      type: 'object',
      description: 'Template variables',
      properties: {
        type: { type: 'string', enum: ['string', 'number', 'boolean', 'array'] },
        description: { type: 'string' },
        required: { type: 'boolean' },
        default: { type: 'string' },
        enum: { type: 'array' }
      }
    },
    modules: {
      type: 'array',
      description: 'Module dependencies',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          config: { type: 'object' }
        },
        required: ['name', 'version']
      }
    },
    validation: {
      type: 'object',
      description: 'Validation rules',
      properties: {
        max_tokens: { type: 'number' },
        min_tokens: { type: 'number' },
        required_variables: { type: 'array', items: { type: 'string' } },
        forbidden_words: { type: 'array', items: { type: 'string' } }
      }
    },
    deployment: {
      type: 'object',
      description: 'Deployment configuration',
      properties: {
        auto_deploy: { type: 'boolean' },
        review_required: { type: 'boolean' },
        test_suite: { type: 'string' },
        canary_percentage: { type: 'number' }
      }
    }
  },
  required: ['name', 'version', 'template']
}

export function validateYaml(yaml: string): YamlValidationError[] {
  const errors: YamlValidationError[] = []
  const lines = yaml.split('\n')

  // Basic YAML syntax validation
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1
    
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) {
      continue
    }

    // Check for invalid characters
    if (line.includes('\t')) {
      errors.push({
        line: lineNumber,
        column: line.indexOf('\t') + 1,
        message: 'Tabs are not allowed in YAML, use spaces instead',
        severity: 'error'
      })
    }

    // Check for invalid key-value pairs
    if (line.includes(':')) {
      const parts = line.split(':')
      const key = parts[0].trim()
      
      if (key && !/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(key)) {
        errors.push({
          line: lineNumber,
          column: 1,
          message: `Invalid key name: "${key}". Keys must start with a letter or underscore and contain only letters, numbers, underscores, and hyphens`,
          severity: 'error'
        })
      }
      
      // Check for proper spacing around colon
      if (parts.length > 1 && !line.includes(': ') && !line.includes(':\n') && line.trim() !== line.trim().replace(':', '')) {
        errors.push({
          line: lineNumber,
          column: line.indexOf(':') + 1,
          message: 'Add a space after colon',
          severity: 'warning'
        })
      }
    }

    // Check indentation consistency
    if (line.length > 0 && line[0] === ' ') {
      const leadingSpaces = line.length - line.trimStart().length
      if (leadingSpaces % 2 !== 0) {
        errors.push({
          line: lineNumber,
          column: 1,
          message: 'Indentation should be in multiples of 2 spaces',
          severity: 'warning'
        })
      }
    }
  }

  // Validate against schema
  try {
    const parsed = parseYamlToObject(yaml)
    validateAgainstSchema(parsed, templateSchema, errors)
  } catch (error) {
    // YAML parsing errors
    errors.push({
      line: 1,
      column: 1,
      message: `YAML parsing error: ${error}`,
      severity: 'error'
    })
  }

  return errors
}

function parseYamlToObject(yaml: string): any {
  // Simple YAML parser for basic validation
  const result: any = {}
  const lines = yaml.split('\n')
  let currentPath: string[] = []
  let currentIndent = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const indent = line.length - line.trimStart().length
    const keyMatch = trimmed.match(/^([^:]+):\s*(.*)$/)
    
    if (keyMatch) {
      const [, key, value] = keyMatch
      
      // Adjust current path based on indentation
      while (currentPath.length > 0 && indent <= currentIndent - 2) {
        currentPath.pop()
        currentIndent -= 2
      }
      
      if (indent > currentIndent) {
        currentPath.push(key)
        currentIndent = indent
      } else {
        if (currentPath.length > 0) {
          currentPath[currentPath.length - 1] = key
        } else {
          currentPath = [key]
        }
        currentIndent = indent
      }
      
      // Set value in result object
      let current = result
      for (let i = 0; i < currentPath.length - 1; i++) {
        if (!current[currentPath[i]]) {
          current[currentPath[i]] = {}
        }
        current = current[currentPath[i]]
      }
      
      if (value && value !== '') {
        // Try to parse as number, boolean, or string
        if (/^\d+$/.test(value)) {
          current[key] = parseInt(value, 10)
        } else if (/^\d+\.\d+$/.test(value)) {
          current[key] = parseFloat(value)
        } else if (value.toLowerCase() === 'true') {
          current[key] = true
        } else if (value.toLowerCase() === 'false') {
          current[key] = false
        } else if (value.startsWith('"') && value.endsWith('"')) {
          current[key] = value.slice(1, -1)
        } else {
          current[key] = value
        }
      } else {
        current[key] = null
      }
    }
  }

  return result
}

function validateAgainstSchema(obj: any, schema: YamlSchema, errors: YamlValidationError[], path: string = ''): void {
  if (schema.type === 'object') {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      errors.push({
        line: 1,
        column: 1,
        message: `Expected object at path "${path}"`,
        severity: 'error'
      })
      return
    }

    // Check required properties
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in obj)) {
          errors.push({
            line: 1,
            column: 1,
            message: `Missing required property "${requiredProp}"`,
            severity: 'error'
          })
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (prop in obj) {
          validateAgainstSchema(obj[prop], propSchema, errors, path ? `${path}.${prop}` : prop)
        }
      }
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(obj)) {
      errors.push({
        line: 1,
        column: 1,
        message: `Expected array at path "${path}"`,
        severity: 'error'
      })
      return
    }

    if (schema.items) {
      for (let i = 0; i < obj.length; i++) {
        validateAgainstSchema(obj[i], schema.items, errors, `${path}[${i}]`)
      }
    }
  } else {
    // Validate primitive types
    const actualType = typeof obj
    if (actualType !== schema.type) {
      errors.push({
        line: 1,
        column: 1,
        message: `Expected ${schema.type} at path "${path}", got ${actualType}`,
        severity: 'error'
      })
    }

    // Check enum values
    if (schema.enum && !schema.enum.includes(obj)) {
      errors.push({
        line: 1,
        column: 1,
        message: `Value "${obj}" is not one of the allowed values: ${schema.enum.join(', ')}`,
        severity: 'error'
      })
    }
  }
}

export function getMonacoYamlLanguageConfiguration() {
  return {
    comments: {
      lineComment: '#'
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')']
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    folding: {
      markers: {
        start: new RegExp('^\\s*#\\s*region\\b'),
        end: new RegExp('^\\s*#\\s*endregion\\b')
      }
    }
  }
}

export function getYamlCompletionItems(model: any, position: any): any[] {
  const textUntilPosition = model.getValueInRange({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column
  })

  const items: any[] = []
  
  // Add template schema properties
  const schemaProps = Object.keys(templateSchema.properties || {})
  for (const prop of schemaProps) {
    items.push({
      label: prop,
      kind: 12, // Property
      detail: (templateSchema.properties as any)[prop].description,
      insertText: `${prop}: `,
      documentation: (templateSchema.properties as any)[prop].description
    })
  }

  // Add common YAML keywords
  const yamlKeywords = ['name', 'version', 'description', 'type', 'required', 'default', 'enum']
  for (const keyword of yamlKeywords) {
    if (!schemaProps.includes(keyword)) {
      items.push({
        label: keyword,
        kind: 14, // Keyword
        insertText: `${keyword}: `
      })
    }
  }

  return items
}