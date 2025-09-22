import React, { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  User,
  Building,
  Shield,
  Bell,
  Database,
  Key,
  Users,
  CreditCard,
  Save,
  Mail,
  Phone,
  Calendar,
  LogOut
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth, usePermission } from '@/contexts/AuthContext'
import { useUpdateUser } from '@/hooks/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDate } from '@/lib/utils'

export function SettingsPage() {
  const { user, updateUser, hasPermission, logout } = useAuth()
  const updateUserMutation = useUpdateUser()
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Debug: Log user and permissions
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🔍 Settings Page Debug:', {
        user,
        hasSettingsPermission: hasPermission('settings:manage'),
        hasUsersPermission: hasPermission('users:read'),
        userRole: user?.role
      })
    }
  }, [user, hasPermission])

  // Form state
  const [formData, setFormData] = useState({
    // Personal Information
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',

    // Organization
    organization: user?.organization || '',
    companySize: user?.companySize || '',

    // Role & Permissions
    role: user?.role || 'user',

    // Preferences
    emailNotifications: true,
    pushNotifications: true,
    timezone: 'UTC',
    language: 'en'
  })

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!user?.id) {
      setSaveMessage({
        type: 'error',
        message: 'User ID not found. Please log in again.'
      })
      return
    }

    setIsSaving(true)
    setSaveMessage(null)

    try {
      // Prepare user data for API - match backend field names
      const userData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        organization: formData.organization,
        company_size: formData.companySize,  // Backend expects snake_case
        role: formData.role
      }

      // Debug: Log what we're sending
      if (import.meta.env.DEV) {
        console.log('🔍 Settings Save Debug:', {
          userId: user.id,
          userData
        })
      }

      // Call API to update user
      const result = await updateUserMutation.mutateAsync({
        userId: user.id,
        userData
      })

      // Debug: Log what we received back
      if (import.meta.env.DEV) {
        console.log('🔍 Settings Save Response:', result.data)
      }

      // Update user in auth context with the response data
      updateUser(result.data)

      setSaveMessage({
        type: 'success',
        message: 'Settings updated successfully!'
      })

      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000)

    } catch (error: any) {
      console.error('Settings save error:', error)
      setSaveMessage({
        type: 'error',
        message: error.message || 'Failed to update settings. Please try again.'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const settingsSections = [
    {
      title: "Account Settings",
      description: "Manage your profile, security, and preferences",
      icon: User,
      items: [
        { title: "Profile", href: "/profile", description: "Update your personal information" },
        { title: "Security", href: "/settings/security", description: "Password and authentication" },
        { title: "Notifications", href: "/settings/notifications", description: "Email and push notifications" },
      ]
    },
    {
      title: "Organization Settings",
      description: "Configure your organization and team",
      icon: Building,
      permission: "organizations:manage",
      items: [
        { title: "General", href: "/settings/organization", description: "Organization details and settings" },
        { title: "Team Members", href: "/users", description: "Manage users and permissions" },
        { title: "Billing", href: "/settings/billing", description: "Subscription and usage" },
      ]
    },
    {
      title: "Platform Configuration",
      description: "Customize your PromptOps experience",
      icon: SettingsIcon,
      permission: "settings:manage",
      items: [
        { title: "General", href: "/settings/general", description: "Platform preferences" },
        { title: "Integrations", href: "/settings/integrations", description: "Third-party services" },
        { title: "API Keys", href: "/settings/api-keys", description: "Manage API credentials" },
      ]
    },
    {
      title: "Developer Tools",
      description: "Advanced configuration and development",
      icon: Database,
      permission: "settings:manage",
      items: [
        { title: "Database", href: "/settings/database", description: "Database configuration" },
        { title: "Monitoring", href: "/settings/monitoring", description: "Performance and metrics" },
        { title: "Audit Logs", href: "/settings/audits", description: "Activity and security logs" },
      ]
    }
  ]

  const filteredSections = settingsSections.filter(section => {
    if (!section.permission) return true
    try {
      return usePermission(section.permission)
    } catch (error) {
      console.warn('Permission check failed:', error)
      return false
    }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your profile, role, and organization settings
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {saveMessage && (
            <div className={`px-4 py-2 rounded-md text-sm font-medium ${
              saveMessage.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}>
              {saveMessage.message}
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </Button>
        </div>
      </div>

      {/* Settings Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="p-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white mr-3">
                  <User className="h-5 w-5" />
                </div>
                Personal Information
              </CardTitle>
              <CardDescription>
                Update your personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter your email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </CardContent>
          </Card>

          {/* Organization Settings */}
          <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="p-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white mr-3">
                  <Building className="h-5 w-5" />
                </div>
                Organization Settings
              </CardTitle>
              <CardDescription>
                Configure your organization and company information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="organization">Company/Organization Name</Label>
                <Input
                  id="organization"
                  value={formData.organization}
                  onChange={(e) => handleInputChange('organization', e.target.value)}
                  placeholder="Enter your company name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companySize">Company Size</Label>
                <Select
                  value={formData.companySize}
                  onValueChange={(value) => handleInputChange('companySize', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-10">1-10 employees</SelectItem>
                    <SelectItem value="11-50">11-50 employees</SelectItem>
                    <SelectItem value="51-200">51-200 employees</SelectItem>
                    <SelectItem value="201-1000">201-1000 employees</SelectItem>
                    <SelectItem value="1000+">1000+ employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Role & Permissions */}
          <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="p-2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-white mr-3">
                  <Shield className="h-5 w-5" />
                </div>
                Role & Permissions
              </CardTitle>
              <CardDescription>
                Manage your role and access permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">User Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleInputChange('role', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {formData.role === 'admin' && 'Full access to all features and user management'}
                  {formData.role === 'user' && 'Access to templates, deployments, and evaluations'}
                  {formData.role === 'viewer' && 'Read-only access to view templates and deployments'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60"></div>
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="p-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white mr-3">
                  <Bell className="h-5 w-5" />
                </div>
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Configure how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="emailNotifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="emailNotifications"
                    checked={formData.emailNotifications}
                    onChange={(e) => handleInputChange('emailNotifications', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="pushNotifications">Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive push notifications in browser
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="pushNotifications"
                    checked={formData.pushNotifications}
                    onChange={(e) => handleInputChange('pushNotifications', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Current User Info */}
          <Card>
            <CardHeader>
              <CardTitle>Current Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback>
                    {user?.name?.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Role: </span>
                  <Badge variant={user?.role === 'admin' ? 'destructive' : user?.role === 'user' ? 'default' : 'secondary'}>
                    {user?.role}
                  </Badge>
                </div>
                {user?.organization && (
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{user?.organization}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {user?.createdAt ? `Joined ${formatDate(user.createdAt)}` : 'Member since today'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Users className="w-4 h-4 mr-2" />
                Manage Users
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <CreditCard className="w-4 h-4 mr-2" />
                Billing & Usage
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Key className="w-4 h-4 mr-2" />
                API Keys
              </Button>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Mail className="w-4 h-4 mr-2" />
                Change Email
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Key className="w-4 h-4 mr-2" />
                Change Password
              </Button>
              <Button variant="destructive" className="w-full justify-start" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}