import React from 'react'
import { Link } from 'react-router-dom'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  MoreVertical, 
  Edit, 
  Copy, 
  Trash2, 
  Play, 
  BarChart3,
  GitBranch,
  Clock,
  User
} from 'lucide-react'
import { Template, TemplateVersion } from '@/types/api'
import { formatDate, formatRelativeTime } from '@/lib/utils'

interface TemplateCardProps {
  template: Template
  versions: TemplateVersion[]
  onEdit: (templateId: string, version?: string) => void
  onDelete: (templateId: string) => void
  onDuplicate: (templateId: string) => void
  onTest: (templateId: string, version: string) => void
  onViewAnalytics: (templateId: string) => void
}

export function TemplateCard({
  template,
  versions,
  onEdit,
  onDelete,
  onDuplicate,
  onTest,
  onViewAnalytics
}: TemplateCardProps) {
  const latestVersion = versions.reduce((latest, version) => {
    return new Date(version.created_at) > new Date(latest.created_at) ? version : latest
  }, versions[0])

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'draft': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'deprecated': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg">
              <Link 
                to={`/templates/${template.id}/edit`}
                className="hover:text-primary transition-colors"
              >
                {template.id}
              </Link>
            </CardTitle>
            <CardDescription className="mt-1">
              {template.metadata?.description || 'No description available'}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(template.id, latestVersion?.version)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(template.id)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewAnalytics(template.id)}>
                <BarChart3 className="h-4 w-4 mr-2" />
                View Analytics
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onTest(template.id, latestVersion?.version)}>
                <Play className="h-4 w-4 mr-2" />
                Test Template
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(template.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="flex flex-wrap gap-1 mt-2">
          <Badge className={getStatusColor(template.metadata?.tags?.includes('active') ? 'active' : 'draft')}>
            {template.metadata?.tags?.includes('active') ? 'Active' : 'Draft'}
          </Badge>
          <Badge variant="outline">
            v{latestVersion?.version || '1.0.0'}
          </Badge>
          {template.metadata?.tags?.slice(0, 2).map((tag) => (
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
            {formatRelativeTime(template.created_at)}
          </div>
          
          <div className="flex items-center text-sm text-muted-foreground">
            <GitBranch className="h-4 w-4 mr-1" />
            {versions.length} version{versions.length !== 1 ? 's' : ''}
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={() => onEdit(template.id, latestVersion?.version)}>
              Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => onViewAnalytics(template.id)}>
              <BarChart3 className="h-4 w-4 mr-1" />
              Analytics
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}