import * as React from "react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export interface RoleCardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  showActions?: boolean
}

export function RoleCardSkeleton({ className, showActions = true, ...props }: RoleCardSkeletonProps) {
  return (
    <div className={cn("bg-card border rounded-lg p-6 space-y-4", className)} {...props}>
      {/* Header with title and actions */}
      <div className="flex justify-between items-start">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-4 w-48" />
        </div>
        {showActions && (
          <Skeleton className="h-8 w-8" />
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Permissions section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex flex-wrap gap-1">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>

      {/* Inheritance section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Meta info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Skeleton className="h-3 w-3" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
}

export interface PermissionListSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  itemCount?: number
  showSearch?: boolean
  showHeader?: boolean
}

export function PermissionListSkeleton({
  className,
  itemCount = 5,
  showSearch = true,
  showHeader = true,
  ...props
}: PermissionListSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      {showHeader && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-32" />
            {showSearch && (
              <Skeleton className="h-10 w-48" />
            )}
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
      )}

      {/* Permission items */}
      <div className="border rounded-lg p-3 space-y-2">
        {Array.from({ length: itemCount }).map((_, index) => (
          <div key={index} className="flex items-start space-x-3 p-3">
            <Skeleton className="h-4 w-4 mt-1" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface TableSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rowCount?: number
  columnCount?: number
  showHeader?: boolean
}

export function TableSkeleton({
  className,
  rowCount = 5,
  columnCount = 4,
  showHeader = true,
  ...props
}: TableSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      {showHeader && (
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="border-b bg-muted/50">
          <div className="grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}>
            {Array.from({ length: columnCount }).map((_, index) => (
              <Skeleton key={index} className="h-5" />
            ))}
          </div>
        </div>

        {/* Table rows */}
        <div className="divide-y">
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <div key={rowIndex} className="hover:bg-muted/50">
              <div className="grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}>
                {Array.from({ length: columnCount }).map((_, colIndex) => (
                  <Skeleton key={colIndex} className="h-4" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export interface RoleManagementSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  showSearch?: boolean
  showCreateButton?: boolean
  roleCardCount?: number
}

export function RoleManagementSkeleton({
  className,
  showSearch = true,
  showCreateButton = true,
  roleCardCount = 6,
  ...props
}: RoleManagementSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)} {...props}>
      {/* Header section */}
      <div className="flex justify-end">
        {showCreateButton && (
          <Skeleton className="h-10 w-32" />
        )}
      </div>

      {/* Search section */}
      {showSearch && (
        <div className="bg-card border rounded-lg p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        </div>
      )}

      {/* Role cards grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: roleCardCount }).map((_, index) => (
          <RoleCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}

// Export all components
export { Skeleton }