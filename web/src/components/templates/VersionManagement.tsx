import React from 'react'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  GitBranch, 
  Calendar, 
  User, 
  Hash,
  ArrowRight,
  Download,
  Eye,
  Trash2
} from 'lucide-react'
import { TemplateVersion } from '@/types/api'
import { formatDate } from '@/lib/utils'

interface VersionManagementProps {
  templateId: string
  versions: TemplateVersion[]
  currentVersion?: string
  onViewVersion: (version: string) => void
  onCompareVersions: (version1: string, version2: string) => void
  onPromoteVersion: (version: string) => void
  onDeleteVersion: (version: string) => void
  onDownloadVersion: (version: string) => void
}

export function VersionManagement({
  templateId,
  versions,
  currentVersion,
  onViewVersion,
  onCompareVersions,
  onPromoteVersion,
  onDeleteVersion,
  onDownloadVersion
}: VersionManagementProps) {
  const sortedVersions = [...versions].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Version History</h3>
        <Button variant="outline" size="sm">
          <GitBranch className="h-4 w-4 mr-2" />
          Compare Versions
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Hash</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedVersions.map((version, index) => (
              <TableRow key={version.version}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {version.version}
                    {version.version === currentVersion && (
                      <Badge variant="default" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(version.created_at)}
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <User className="h-3 w-3" />
                    {version.created_by}
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground font-mono">
                    <Hash className="h-3 w-3" />
                    {version.hash.substring(0, 8)}
                  </div>
                </TableCell>
                
                <TableCell>
                  <Badge 
                    variant={version.version === currentVersion ? "default" : "secondary"}
                  >
                    {version.version === currentVersion ? "Active" : "Historical"}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewVersion(version.version)}
                      title="View version"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCompareVersions(version.version, sortedVersions[index + 1]?.version)}
                      title="Compare with previous"
                      disabled={index === sortedVersions.length - 1}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onPromoteVersion(version.version)}
                      title="Promote to current"
                      disabled={version.version === currentVersion}
                    >
                      <GitBranch className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDownloadVersion(version.version)}
                      title="Download version"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteVersion(version.version)}
                      title="Delete version"
                      disabled={version.version === currentVersion}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {versions.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No versions found for this template</p>
        </div>
      )}
    </div>
  )
}