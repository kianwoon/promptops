import React from 'react'
import { RoleManagement } from '@/components/governance/RoleManagement'

export function RoleManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
        <p className="text-muted-foreground">
          Create and manage custom roles with granular permissions
        </p>
      </div>
      <RoleManagement />
    </div>
  )
}