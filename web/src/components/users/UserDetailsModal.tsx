import React from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Mail, Building, Shield, Calendar, User, Phone, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface UserDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  user: {
    id: string
    name: string
    email: string
    role: 'admin' | 'user' | 'viewer'
    organization: string
    status: 'active' | 'inactive' | 'pending'
    lastLogin: string | null
    createdAt: string
    avatar?: string
    phone?: string
    companySize?: string
  }
}

export function UserDetailsModal({ isOpen, onClose, user }: UserDetailsModalProps) {
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive'
      case 'user': return 'default'
      case 'viewer': return 'secondary'
      default: return 'outline'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'inactive': return 'secondary'
      case 'pending': return 'outline'
      default: return 'outline'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>
            View detailed information about this user account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Header */}
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="text-lg">
                {user.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
              <p className="text-sm text-gray-600">{user.email}</p>
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant={getRoleBadgeColor(user.role)}>
                  {user.role}
                </Badge>
                <Badge variant={getStatusBadgeColor(user.status)}>
                  {user.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* User Information */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Basic Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-900 uppercase tracking-wider">Basic Information</h4>

                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 mr-3 text-gray-400" />
                  <span className="font-medium text-gray-900">Full Name:</span>
                  <span className="ml-2 text-gray-600">{user.name}</span>
                </div>

                <div className="flex items-center text-sm">
                  <Mail className="w-4 h-4 mr-3 text-gray-400" />
                  <span className="font-medium text-gray-900">Email:</span>
                  <span className="ml-2 text-gray-600">{user.email}</span>
                </div>

                {user.phone && (
                  <div className="flex items-center text-sm">
                    <Phone className="w-4 h-4 mr-3 text-gray-400" />
                    <span className="font-medium text-gray-900">Phone:</span>
                    <span className="ml-2 text-gray-600">{user.phone}</span>
                  </div>
                )}
              </div>

              {/* Organization Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-900 uppercase tracking-wider">Organization</h4>

                <div className="flex items-center text-sm">
                  <Building className="w-4 h-4 mr-3 text-gray-400" />
                  <span className="font-medium text-gray-900">Organization:</span>
                  <span className="ml-2 text-gray-600">{user.organization}</span>
                </div>

                {user.companySize && (
                  <div className="flex items-center text-sm">
                    <Users className="w-4 h-4 mr-3 text-gray-400" />
                    <span className="font-medium text-gray-900">Company Size:</span>
                    <span className="ml-2 text-gray-600">{user.companySize}</span>
                  </div>
                )}

                <div className="flex items-center text-sm">
                  <Shield className="w-4 h-4 mr-3 text-gray-400" />
                  <span className="font-medium text-gray-900">Role:</span>
                  <Badge variant={getRoleBadgeColor(user.role)} className="ml-2">
                    {user.role}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Account Status */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900 uppercase tracking-wider">Account Status</h4>

              <div className="flex items-center text-sm">
                <Shield className="w-4 h-4 mr-3 text-gray-400" />
                <span className="font-medium text-gray-900">Status:</span>
                <Badge variant={getStatusBadgeColor(user.status)} className="ml-2">
                  {user.status}
                </Badge>
              </div>

              <div className="flex items-center text-sm">
                <Calendar className="w-4 h-4 mr-3 text-gray-400" />
                <span className="font-medium text-gray-900">Created:</span>
                <span className="ml-2 text-gray-600">{formatDate(user.createdAt)}</span>
              </div>

              <div className="flex items-center text-sm">
                <Calendar className="w-4 h-4 mr-3 text-gray-400" />
                <span className="font-medium text-gray-900">Last Login:</span>
                <span className="ml-2 text-gray-600">
                  {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}