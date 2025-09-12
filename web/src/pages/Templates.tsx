import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Play,
  BarChart3,
  Clock,
  User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTemplates } from '@/hooks/api'
import { formatDate, formatRelativeTime } from '@/lib/utils'

interface TemplateItem {
  id: string
  name: string
  description: string
  owner: string
  versions: string[]
  latestVersion: string
  lastUpdated: string
  status: 'active' | 'draft' | 'deprecated'
  tags: string[]
}

const mockTemplates: TemplateItem[] = [
  {
    id: 'support/summary',
    name: 'Customer Support Summary',
    description: 'Summarizes customer support tickets with sentiment analysis',
    owner: 'support-team',
    versions: ['1.0.0', '1.1.0', '1.2.0'],
    latestVersion: '1.2.0',
    lastUpdated: '2024-01-15T10:30:00Z',
    status: 'active',
    tags: ['support', 'summarization', 'sentiment']
  },
  {
    id: 'sales/assistant',
    name: 'Sales Assistant',
    description: 'AI assistant for sales inquiries and product recommendations',
    owner: 'sales-team',
    versions: ['1.0.0', '2.0.0'],
    latestVersion: '2.0.0',
    lastUpdated: '2024-01-14T15:45:00Z',
    status: 'active',
    tags: ['sales', 'recommendation', 'assistant']
  },
  {
    id: 'hr/interview',
    name: 'HR Interview Questions',
    description: 'Generates contextual interview questions for candidates',
    owner: 'hr-team',
    versions: ['1.0.0'],
    latestVersion: '1.0.0',
    lastUpdated: '2024-01-13T09:15:00Z',
    status: 'draft',
    tags: ['hr', 'interview', 'questions']
  }
]

export function Templates() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const filteredTemplates = mockTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === 'all' || template.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'draft': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'deprecated': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">
            Manage your prompt templates and versions
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Status: {statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                All Status
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('active')}>
                Active
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('draft')}>
                Draft
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('deprecated')}>
                Deprecated
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    <Link 
                      to={`/templates/${template.id}/edit`}
                      className="hover:text-primary transition-colors"
                    >
                      {template.name}
                    </Link>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {template.description}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/templates/${template.id}/edit`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      View Analytics
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Play className="h-4 w-4 mr-2" />
                      Test Template
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="flex flex-wrap gap-1 mt-2">
                <Badge className={getStatusColor(template.status)}>
                  {template.status}
                </Badge>
                <Badge variant="outline">
                  v{template.latestVersion}
                </Badge>
                {template.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center text-sm text-muted-foreground">
                  <User className="h-4 w-4 mr-1" />
                  {template.owner}
                </div>
                
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-1" />
                  {formatRelativeTime(template.lastUpdated)}
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {template.versions.length} version{template.versions.length !== 1 ? 's' : ''}
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button size="sm" asChild>
                    <Link to={`/templates/${template.id}/edit`}>
                      Edit
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline">
                    <BarChart3 className="h-4 w-4 mr-1" />
                    Analytics
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first template'
              }
            </p>
            {(!searchTerm && statusFilter === 'all') && (
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}