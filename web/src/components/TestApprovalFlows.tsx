import React from 'react'
import { useAvailableRoles } from '@/hooks/useApprovalFlows'

const TestApprovalFlows: React.FC = () => {
  const { data: roles, isLoading, error } = useAvailableRoles()

  if (isLoading) return <div>Loading roles...</div>
  if (error) return <div>Error loading roles: {error.message}</div>

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Test Approval Flows Integration</h2>
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold">Available Roles ({roles?.length || 0})</h3>
          <div className="mt-2 space-y-2">
            {roles?.map((role) => (
              <div key={role.name} className="p-2 border rounded">
                <div className="font-medium">{role.name}</div>
                <div className="text-sm text-gray-600">{role.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TestApprovalFlows