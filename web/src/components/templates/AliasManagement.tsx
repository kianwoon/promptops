import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, 
  Edit, 
  Trash2, 
  GitBranch, 
  Activity,
  Settings,
  Save,
  X
} from 'lucide-react'
import { Alias } from '@/types/api'
import { cn } from '@/lib/utils'

interface AliasManagementProps {
  templateId: string
  aliases: Alias[]
  onCreateAlias: (alias: Omit<Alias, 'updated_at'>) => void
  onUpdateAlias: (alias: string, updates: Partial<Alias>) => void
  onDeleteAlias: (alias: string) => void
  onTestAlias: (alias: string) => void
}

export function AliasManagement({
  templateId,
  aliases,
  onCreateAlias,
  onUpdateAlias,
  onDeleteAlias,
  onTestAlias
}: AliasManagementProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingAlias, setEditingAlias] = useState<string | null>(null)
  const [newAlias, setNewAlias] = useState({
    alias: '',
    target_version: '',
    weights: {},
    description: ''
  })

  const handleCreateAlias = () => {
    if (newAlias.alias && newAlias.target_version) {
      onCreateAlias({
        alias: newAlias.alias,
        template_id: templateId,
        target_version: newAlias.target_version,
        weights: newAlias.weights,
        etag: '',
        updated_by: 'current-user'
      })
      setNewAlias({ alias: '', target_version: '', weights: {}, description: '' })
      setShowCreateForm(false)
    }
  }

  const handleUpdateWeights = (aliasName: string, version: string, weight: number) => {
    const alias = aliases.find(a => a.alias === aliasName)
    if (alias) {
      onUpdateAlias(aliasName, {
        weights: {
          ...alias.weights,
          [version]: Math.max(0, Math.min(100, weight))
        }
      })
    }
  }

  const getTotalWeight = (alias: Alias) => {
    return Object.values(alias.weights).reduce((sum, weight) => sum + weight, 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Alias Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage deployment aliases for A/B testing and canary releases
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Alias
        </Button>
      </div>

      {/* Create Alias Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Alias</CardTitle>
            <CardDescription>
              Create a new deployment alias for this template
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="alias-name">Alias Name</Label>
                <Input
                  id="alias-name"
                  placeholder="production"
                  value={newAlias.alias}
                  onChange={(e) => setNewAlias(prev => ({ ...prev, alias: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="target-version">Target Version</Label>
                <Input
                  id="target-version"
                  placeholder="1.0.0"
                  value={newAlias.target_version}
                  onChange={(e) => setNewAlias(prev => ({ ...prev, target_version: e.target.value }))}
                />
              </div>
              
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Production deployment"
                  value={newAlias.description}
                  onChange={(e) => setNewAlias(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button onClick={handleCreateAlias}>
                <Save className="h-4 w-4 mr-2" />
                Create Alias
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Aliases */}
      <div className="grid gap-4">
        {aliases.map((alias) => (
          <Card key={alias.alias}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    {alias.alias}
                  </CardTitle>
                  <CardDescription>
                    {alias.description || 'No description provided'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    Total: {getTotalWeight(alias)}%
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => onTestAlias(alias.alias)}>
                    <Activity className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setEditingAlias(alias.alias === editingAlias ? null : alias.alias)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onDeleteAlias(alias.alias)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <Tabs defaultValue="weights">
                <TabsList>
                  <TabsTrigger value="weights">Traffic Weights</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
                
                <TabsContent value="weights" className="space-y-4">
                  {Object.entries(alias.weights).map(([version, weight]) => (
                    <div key={version} className="flex items-center gap-4">
                      <Label className="w-24">{version}</Label>
                      <div className="flex-1">
                        <Input
                          type="range"
                          min="0"
                          max="100"
                          value={weight}
                          onChange={(e) => handleUpdateWeights(alias.alias, version, parseInt(e.target.value))}
                          className="w-full"
                        />
                      </div>
                      <div className="w-16 text-right">
                        <Badge variant="outline">{weight}%</Badge>
                      </div>
                    </div>
                  ))}
                </TabsContent>
                
                <TabsContent value="settings" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Target Version</Label>
                      <div className="mt-1">
                        <Badge variant="outline">{alias.target_version}</Badge>
                      </div>
                    </div>
                    <div>
                      <Label>Updated By</Label>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {alias.updated_by}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ))}
      </div>

      {aliases.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No aliases found</h3>
            <p className="text-muted-foreground mb-4">
              Create your first deployment alias to manage different versions
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Alias
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}