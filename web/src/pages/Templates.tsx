import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  FileText,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TemplateCard, TemplateFilters } from '@/components/templates'
import { useTemplates, useTemplateVersions } from '@/hooks/api'
import { Template, TemplateVersion } from '@/types/api'

export function Templates() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const { data: templatesData, isLoading, error } = useTemplates()
  
  const templateIds = useMemo(() => {
    if (!templatesData) return []
    return templatesData.map(t => t.id)
  }, [templatesData])

  const templatesVersions = useTemplateVersions(templateIds.join(','))

  const filteredAndSortedTemplates = useMemo(() => {
    if (!templatesData) return []

    let filtered = templatesData.filter(template => {
      const metadata = template.metadata || {}
      const matchesSearch =
        template.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (metadata.description && metadata.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (metadata.tags && metadata.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
      
      const matchesOwner = ownerFilter === 'all' || template.owner === ownerFilter
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && metadata.tags?.includes('active')) ||
        (statusFilter === 'draft' && !metadata.tags?.includes('active'))

      return matchesSearch && matchesOwner && matchesStatus
    })

    return filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'created_at':
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        case 'name':
          aValue = a.id.toLowerCase()
          bValue = b.id.toLowerCase()
          break
        case 'owner':
          aValue = a.owner.toLowerCase()
          bValue = b.owner.toLowerCase()
          break
        default:
          aValue = a.created_at
          bValue = b.created_at
      }

      if (sortOrder === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      } else {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      }
    })
  }, [templatesData, searchTerm, ownerFilter, statusFilter, sortBy, sortOrder])

  const availableOwners = useMemo(() => {
    if (!templatesData) return []
    const owners = [...new Set(templatesData.map(t => t.owner))]
    return owners.sort()
  }, [templatesData])

  const availableStatuses = ['active', 'draft', 'deprecated']

  const handleCreateNew = () => {
    navigate('/templates/new')
  }

  const handleEdit = (templateId: string, version?: string) => {
    if (version) {
      navigate(`/templates/${templateId}/versions/${version}`)
    } else {
      navigate(`/templates/${templateId}/edit`)
    }
  }

  const handleDelete = async (templateId: string) => {
    if (confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      // TODO: Implement delete functionality
      console.log('Delete template:', templateId)
    }
  }

  const handleDuplicate = (templateId: string) => {
    // TODO: Implement duplicate functionality
    console.log('Duplicate template:', templateId)
  }

  const handleTest = (templateId: string, version: string) => {
    // TODO: Implement test functionality
    console.log('Test template:', templateId, version)
  }

  const handleViewAnalytics = (templateId: string) => {
    navigate(`/templates/${templateId}/analytics`)
  }

  const getTemplateVersions = (templateId: string): TemplateVersion[] => {
    return templatesVersions.data?.filter(v => v.template_id === templateId) || []
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading templates...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load templates. Please try again later.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">
            Manage your prompt templates and versions ({templatesData?.length || 0} total)
          </p>
        </div>
      </div>

      {/* Filters */}
      <TemplateFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        ownerFilter={ownerFilter}
        onOwnerFilterChange={setOwnerFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        onCreateNew={handleCreateNew}
        availableOwners={availableOwners}
        availableStatuses={availableStatuses}
      />

      {/* Templates Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredAndSortedTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            versions={getTemplateVersions(template.id)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onTest={handleTest}
            onViewAnalytics={handleViewAnalytics}
          />
        ))}
      </div>

      {filteredAndSortedTemplates.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No templates found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || ownerFilter !== 'all' || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first template'
              }
            </p>
            {(!searchTerm && ownerFilter === 'all' && statusFilter === 'all') && (
              <Button onClick={handleCreateNew}>
                Create Template
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}