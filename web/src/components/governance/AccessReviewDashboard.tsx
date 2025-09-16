import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Progress,
} from '@/components/ui/progress'
import {
  Calendar,
  Clock,
  Search,
  Filter,
  Plus,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Shield,
  FileText,
  TrendingUp,
  Download,
  Settings,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Copy,
  CalendarDays,
  Target,
  CheckSquare,
  AlertCircle
} from 'lucide-react'
import {
  AccessReview,
  AccessReviewCreate,
  AccessReviewFinding,
  AccessReviewRecommendation,
  AccessReviewScope
} from '@/types/governance'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface AccessReviewDashboardProps {
  reviews?: AccessReview[]
  onCreateReview?: (review: AccessReviewCreate) => Promise<AccessReview>
  onUpdateReview?: (reviewId: string, updates: any) => Promise<AccessReview>
  onDeleteReview?: (reviewId: string) => Promise<void>
  onExecuteReview?: (reviewId: string) => Promise<void>
  onGetReviewFindings?: (reviewId: string) => Promise<AccessReviewFinding[]>
  onGetReviewRecommendations?: (reviewId: string) => Promise<AccessReviewRecommendation[]>
  onApproveRecommendations?: (reviewId: string, recommendations: string[]) => Promise<any>
}

export function AccessReviewDashboard({
  reviews = [],
  onCreateReview = async () => ({ id: '', title: '', description: '', review_type: 'periodic', status: 'pending', scope: { users: [], roles: [], resources: [] }, reviewers: [], findings: [], recommendations: [], created_at: '', updated_at: '' }),
  onUpdateReview = async () => ({ id: '', title: '', description: '', review_type: 'periodic', status: 'pending', scope: { users: [], roles: [], resources: [] }, reviewers: [], findings: [], recommendations: [], created_at: '', updated_at: '' }),
  onDeleteReview = async () => {},
  onExecuteReview = async () => {},
  onGetReviewFindings = async () => [],
  onGetReviewRecommendations = async () => [],
  onApproveRecommendations = async () => ({ success: true, message: 'Recommendations approved' })
}: AccessReviewDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedReview, setSelectedReview] = useState<AccessReview | null>(null)
  const [reviewFindings, setReviewFindings] = useState<AccessReviewFinding[]>([])
  const [reviewRecommendations, setReviewRecommendations] = useState<AccessReviewRecommendation[]>([])
  const [createFormData, setCreateFormData] = useState<AccessReviewCreate>({
    title: '',
    description: '',
    review_type: 'periodic',
    scope: {
      users: [],
      roles: [],
      resources: []
    },
    reviewers: [],
    due_date: ''
  })

  // Filter reviews based on search and filters
  const filteredReviews = reviews.filter(review => {
    const matchesSearch = review.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         review.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || !statusFilter || review.status === statusFilter
    const matchesType = typeFilter === "all" || !typeFilter || review.review_type === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  // Get status color and icon
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completed' }
      case 'in_progress':
        return { color: 'bg-blue-100 text-blue-800', icon: Play, label: 'In Progress' }
      case 'pending':
        return { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' }
      case 'expired':
        return { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Expired' }
      case 'cancelled':
        return { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Cancelled' }
      default:
        return { color: 'bg-gray-100 text-gray-800', icon: AlertCircle, label: status }
    }
  }

  // Get finding severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Get review statistics
  const getReviewStats = () => {
    const stats = {
      total: reviews.length,
      completed: reviews.filter(r => r.status === 'completed').length,
      inProgress: reviews.filter(r => r.status === 'in_progress').length,
      pending: reviews.filter(r => r.status === 'pending').length,
      overdue: reviews.filter(r => r.status === 'expired').length,
      totalFindings: reviews.reduce((sum, r) => sum + r.findings.length, 0),
      totalRecommendations: reviews.reduce((sum, r) => sum + r.recommendations.length, 0)
    }
    return stats
  }

  // Handle create review
  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onCreateReview(createFormData)
      setCreateFormData({
        title: '',
        description: '',
        review_type: 'periodic',
        scope: {
          users: [],
          roles: [],
          resources: []
        },
        reviewers: [],
        due_date: ''
      })
      setIsCreateDialogOpen(false)
    } catch (error) {
      console.error('Error creating review:', error)
    }
  }

  // Handle execute review
  const handleExecuteReview = async (reviewId: string) => {
    try {
      await onExecuteReview(reviewId)
    } catch (error) {
      console.error('Error executing review:', error)
    }
  }

  // Handle view review details
  const handleViewReview = async (review: AccessReview) => {
    setSelectedReview(review)
    try {
      const [findings, recommendations] = await Promise.all([
        onGetReviewFindings(review.id),
        onGetReviewRecommendations(review.id)
      ])
      setReviewFindings(findings)
      setReviewRecommendations(recommendations)
    } catch (error) {
      console.error('Error loading review details:', error)
    }
  }

  // Handle approve recommendations
  const handleApproveRecommendations = async (recommendations: string[]) => {
    if (!selectedReview) return

    try {
      await onApproveRecommendations(selectedReview.id, recommendations)
      // Refresh recommendations
      const updatedRecommendations = await onGetReviewRecommendations(selectedReview.id)
      setReviewRecommendations(updatedRecommendations)
    } catch (error) {
      console.error('Error approving recommendations:', error)
    }
  }

  const stats = getReviewStats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Access Reviews</h2>
          <p className="text-muted-foreground">
            Manage periodic access reviews and compliance checks
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Review
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Access Review</DialogTitle>
              <DialogDescription>
                Set up a new access review to audit user permissions and access rights
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateReview} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Review Title</Label>
                <Input
                  id="title"
                  value={createFormData.title}
                  onChange={(e) => setCreateFormData({...createFormData, title: e.target.value})}
                  placeholder="e.g., Q4 2024 Access Review"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={createFormData.description}
                  onChange={(e) => setCreateFormData({...createFormData, description: e.target.value})}
                  placeholder="Describe the purpose and scope of this review"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Review Type</Label>
                  <Select
                    value={createFormData.review_type}
                    onValueChange={(value) => setCreateFormData({...createFormData, review_type: value as any})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="periodic">Periodic</SelectItem>
                      <SelectItem value="event_based">Event Based</SelectItem>
                      <SelectItem value="user_driven">User Driven</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={createFormData.due_date}
                    onChange={(e) => setCreateFormData({...createFormData, due_date: e.target.value})}
                  />
                </div>
              </div>

              <Tabs defaultValue="users" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="users">Users</TabsTrigger>
                  <TabsTrigger value="roles">Roles</TabsTrigger>
                  <TabsTrigger value="resources">Resources</TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Review Users (comma-separated)</Label>
                    <Input
                      placeholder="user1@example.com, user2@example.com"
                      onChange={(e) => setCreateFormData({
                        ...createFormData,
                        scope: {
                          ...createFormData.scope,
                          users: e.target.value.split(',').map(u => u.trim()).filter(Boolean)
                        }
                      })}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="roles" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Review Roles (comma-separated)</Label>
                    <Input
                      placeholder="admin, manager, user"
                      onChange={(e) => setCreateFormData({
                        ...createFormData,
                        scope: {
                          ...createFormData.scope,
                          roles: e.target.value.split(',').map(r => r.trim()).filter(Boolean)
                        }
                      })}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="resources" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Resource Types (comma-separated)</Label>
                    <Input
                      placeholder="template, project, user"
                      onChange={(e) => setCreateFormData({
                        ...createFormData,
                        scope: {
                          ...createFormData.scope,
                          resources: e.target.value.split(',').map(r => r.trim()).filter(Boolean).map(type => ({ type, ids: [] }))
                        }
                      })}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <Label>Reviewers (comma-separated)</Label>
                <Input
                  placeholder="reviewer1@example.com, reviewer2@example.com"
                  onChange={(e) => setCreateFormData({
                    ...createFormData,
                    reviewers: e.target.value.split(',').map(r => r.trim()).filter(Boolean)
                  })}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Review</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reviews</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
              </div>
              <Play className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Findings</p>
                <p className="text-2xl font-bold text-red-600">{stats.totalFindings}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Search Reviews</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reviews..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="periodic">Periodic</SelectItem>
                  <SelectItem value="event_based">Event Based</SelectItem>
                  <SelectItem value="user_driven">User Driven</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews Table */}
      <Card>
        <CardHeader>
          <CardTitle>Access Reviews ({filteredReviews.length})</CardTitle>
          <CardDescription>
            View and manage all access reviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewers</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReviews.map((review) => {
                  const statusInfo = getStatusInfo(review.status)
                  const StatusIcon = statusInfo.icon

                  return (
                    <TableRow key={review.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{review.title}</div>
                          {review.description && (
                            <div className="text-sm text-muted-foreground">{review.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {review.review_type === 'periodic' && <Calendar className="h-3 w-3 mr-1" />}
                          {review.review_type === 'event_based' && <AlertCircle className="h-3 w-3 mr-1" />}
                          {review.review_type === 'user_driven' && <Users className="h-3 w-3 mr-1" />}
                          {review.review_type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusInfo.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span className="text-sm">{review.reviewers.length}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <CalendarDays className="h-3 w-3" />
                          {review.due_date ? formatDate(review.due_date) : 'No due date'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {review.findings.length} findings
                          </Badge>
                          {review.findings.some(f => f.severity === 'critical' || f.severity === 'high') && (
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewReview(review)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {review.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleExecuteReview(review.id)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewReview(review)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {review.status === 'pending' && (
                                <DropdownMenuItem onClick={() => handleExecuteReview(review.id)}>
                                  <Play className="h-4 w-4 mr-2" />
                                  Execute Review
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => onDeleteReview(review.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Review Details Dialog */}
      <Dialog open={!!selectedReview} onOpenChange={(open) => !open && setSelectedReview(null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedReview?.title}</DialogTitle>
            <DialogDescription>
              {selectedReview?.description}
            </DialogDescription>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              {/* Review Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Review Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-sm font-medium">Status</Label>
                      <div className="mt-1">
                        <Badge className={getStatusInfo(selectedReview.status).color}>
                          {getStatusInfo(selectedReview.status).label}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Type</Label>
                      <div className="mt-1">
                        <Badge variant="outline">
                          {selectedReview.review_type.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Due Date</Label>
                      <div className="mt-1 text-sm">
                        {selectedReview.due_date ? formatDate(selectedReview.due_date) : 'No due date'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Reviewers</Label>
                      <div className="mt-1 text-sm">
                        {selectedReview.reviewers.join(', ')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="findings" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="findings">
                    Findings ({reviewFindings.length})
                  </TabsTrigger>
                  <TabsTrigger value="recommendations">
                    Recommendations ({reviewRecommendations.length})
                  </TabsTrigger>
                  <TabsTrigger value="scope">Scope</TabsTrigger>
                </TabsList>

                <TabsContent value="findings" className="space-y-4">
                  <div className="space-y-3">
                    {reviewFindings.map((finding) => (
                      <Card key={finding.id} className="border-l-4 border-l-red-500">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" />
                              {finding.type.replace('_', ' ').title()}
                            </CardTitle>
                            <Badge className={getSeverityColor(finding.severity)}>
                              {finding.severity.toUpperCase()}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm mb-3">{finding.description}</p>

                          {finding.affected_users.length > 0 && (
                            <div className="mb-2">
                              <Label className="text-xs font-medium">Affected Users</Label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {finding.affected_users.slice(0, 5).map((user) => (
                                  <Badge key={user} variant="outline" className="text-xs">
                                    {user}
                                  </Badge>
                                ))}
                                {finding.affected_users.length > 5 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{finding.affected_users.length - 5} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}

                          {finding.affected_resources.length > 0 && (
                            <div>
                              <Label className="text-xs font-medium">Affected Resources</Label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {finding.affected_resources.slice(0, 3).map((resource) => (
                                  <Badge key={`${resource.type}-${resource.id}`} variant="outline" className="text-xs">
                                    {resource.type}:{resource.id}
                                  </Badge>
                                ))}
                                {finding.affected_resources.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{finding.affected_resources.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="mt-3 p-2 bg-muted rounded text-xs">
                            <strong>Recommendation:</strong> {finding.recommendation}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="recommendations" className="space-y-4">
                  <div className="space-y-3">
                    {reviewRecommendations.map((recommendation) => (
                      <Card key={recommendation.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Target className="h-4 w-4" />
                              {recommendation.type.replace('_', ' ').title()}
                            </CardTitle>
                            <Badge variant={recommendation.priority === 'high' ? 'destructive' : 'outline'}>
                              {recommendation.priority.toUpperCase()}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm mb-3">{recommendation.description}</p>

                          <div className="space-y-2 mb-3">
                            <Label className="text-xs font-medium">Implementation Steps</Label>
                            <ol className="text-xs space-y-1 ml-4">
                              {recommendation.implementation_steps.map((step, index) => (
                                <li key={index}>{step}</li>
                              ))}
                            </ol>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              Estimated effort: {recommendation.estimated_effort || 'Not specified'}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleApproveRecommendations([recommendation.id])}
                            >
                              <CheckSquare className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="scope" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Review Scope</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedReview.scope.users && selectedReview.scope.users.length > 0 && (
                          <div>
                            <Label className="text-sm font-medium">Users ({selectedReview.scope.users.length})</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedReview.scope.users.map((user) => (
                                <Badge key={user} variant="outline" className="text-xs">
                                  {user}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedReview.scope.roles && selectedReview.scope.roles.length > 0 && (
                          <div>
                            <Label className="text-sm font-medium">Roles ({selectedReview.scope.roles.length})</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedReview.scope.roles.map((role) => (
                                <Badge key={role} variant="outline" className="text-xs">
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedReview.scope.resources && selectedReview.scope.resources.length > 0 && (
                          <div>
                            <Label className="text-sm font-medium">Resources ({selectedReview.scope.resources.length})</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedReview.scope.resources.map((resource, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {resource.type}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedReview.scope.time_period && (
                          <div>
                            <Label className="text-sm font-medium">Time Period</Label>
                            <div className="text-sm mt-1">
                              {formatDate(selectedReview.scope.time_period.start)} - {formatDate(selectedReview.scope.time_period.end)}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}