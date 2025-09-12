import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Settings as SettingsIcon, 
  User, 
  Building, 
  Shield, 
  Bell, 
  Database,
  Key,
  Globe,
  Palette,
  Users,
  CreditCard,
  BarChart3,
  Zap
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth, usePermission } from '@/contexts/AuthContext'

export function SettingsPage() {
  const { user } = useAuth()

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
    return usePermission(section.permission)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your account, organization, and platform settings
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Team Members</p>
                <p className="text-2xl font-bold text-gray-900">12</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Key className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">API Keys</p>
                <p className="text-2xl font-bold text-gray-900">3</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Zap className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Integrations</p>
                <p className="text-2xl font-bold text-gray-900">5</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Monthly Usage</p>
                <p className="text-2xl font-bold text-gray-900">87%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredSections.map((section, index) => {
          const Icon = section.icon
          return (
            <Card key={index} className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Icon className="h-5 w-5 mr-2" />
                  {section.title}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {section.items.map((item, itemIndex) => (
                  <Link key={itemIndex} to={item.href}>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                      <div>
                        <h4 className="font-medium text-gray-900">{item.title}</h4>
                        <p className="text-sm text-gray-600">{item.description}</p>
                      </div>
                      <Button variant="ghost" size="sm">
                        →
                      </Button>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/templates">
              <Button variant="outline" className="w-full justify-start">
                <Database className="w-4 h-4 mr-2" />
                Browse Templates
              </Button>
            </Link>
            
            <Link to="/users">
              <Button variant="outline" className="w-full justify-start">
                <Users className="w-4 h-4 mr-2" />
                Manage Users
              </Button>
            </Link>
            
            <Link to="/settings/integrations">
              <Button variant="outline" className="w-full justify-start">
                <Zap className="w-4 h-4 mr-2" />
                Setup Integrations
              </Button>
            </Link>
            
            <Link to="/settings/billing">
              <Button variant="outline" className="w-full justify-start">
                <CreditCard className="w-4 h-4 mr-2" />
                View Billing
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest changes and updates in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { action: "User created", user: "Alice Johnson", time: "2 minutes ago" },
              { action: "Template updated", user: "Bob Smith", time: "1 hour ago" },
              { action: "Deployment triggered", user: "Carol White", time: "3 hours ago" },
              { action: "Settings modified", user: "David Brown", time: "1 day ago" },
            ].map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{activity.action}</p>
                  <p className="text-sm text-gray-600">by {activity.user}</p>
                </div>
                <span className="text-sm text-gray-500">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}