import React from 'react'
import { RoleManagement } from '@/components/governance/RoleManagement'
import { ErrorBoundary } from '@/components/error-handling/ErrorBoundary'
import { APIErrorBoundary } from '@/components/error-handling/APIErrorBoundary'
import { ErrorLogger } from '@/lib/errorLogger'

export function RoleManagementPage() {
  // Log page access
  React.useEffect(() => {
    ErrorLogger.logUserAction('access_role_management_page', {
      timestamp: new Date().toISOString(),
      url: window.location.href
    })
  }, [])

  return (
    <ErrorBoundary
      context={{ page: 'RoleManagementPage' }}
      showToast={true}
      fallbackComponent={({ error, resetError }) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
            <p className="text-muted-foreground">
              Create and manage custom roles with granular permissions
            </p>
          </div>
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-4">Unable to load Role Management</h2>
            <p className="text-muted-foreground mb-4">
              We encountered an error while loading this page. Please try again.
            </p>
            <button
              onClick={resetError}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
          <p className="text-muted-foreground">
            Create and manage custom roles with granular permissions
          </p>
        </div>
        <APIErrorBoundary
          maxRetries={2}
          retryDelay={3000}
          showToast={true}
          fallbackComponent={({ error, retry }) => (
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold mb-4">Connection Error</h2>
              <p className="text-muted-foreground mb-4">
                Unable to connect to the server. Please check your internet connection and try again.
              </p>
              <button
                onClick={retry}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
              >
                Retry
              </button>
            </div>
          )}
        >
          <RoleManagement />
        </APIErrorBoundary>
      </div>
    </ErrorBoundary>
  )
}