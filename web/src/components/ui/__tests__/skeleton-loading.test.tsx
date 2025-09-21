import React from 'react'
import { render, screen } from '@testing-library/react'
import {
  RoleCardSkeleton,
  PermissionListSkeleton,
  TableSkeleton,
  RoleManagementSkeleton
} from '../skeleton-loading'

describe('Skeleton Loading Components', () => {
  describe('RoleCardSkeleton', () => {
    it('renders with default props', () => {
      render(<RoleCardSkeleton />)
      expect(screen.getByRole('generic')).toBeInTheDocument()
    })

    it('renders without actions when showActions is false', () => {
      const { container } = render(<RoleCardSkeleton showActions={false} />)
      const skeletonElements = container.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })
  })

  describe('PermissionListSkeleton', () => {
    it('renders with default props', () => {
      render(<PermissionListSkeleton />)
      expect(screen.getByRole('generic')).toBeInTheDocument()
    })

    it('renders with custom item count', () => {
      const { container } = render(<PermissionListSkeleton itemCount={3} />)
      const skeletonElements = container.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('renders without search when showSearch is false', () => {
      render(<PermissionListSkeleton showSearch={false} />)
      const searchInput = screen.queryByRole('searchbox')
      expect(searchInput).not.toBeInTheDocument()
    })
  })

  describe('TableSkeleton', () => {
    it('renders with default props', () => {
      render(<TableSkeleton />)
      expect(screen.getByRole('generic')).toBeInTheDocument()
    })

    it('renders with custom row and column count', () => {
      const { container } = render(<TableSkeleton rowCount={3} columnCount={2} />)
      const skeletonElements = container.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })
  })

  describe('RoleManagementSkeleton', () => {
    it('renders with default props', () => {
      render(<RoleManagementSkeleton />)
      expect(screen.getByRole('generic')).toBeInTheDocument()
    })

    it('renders without create button when showCreateButton is false', () => {
      render(<RoleManagementSkeleton showCreateButton={false} />)
      const createButton = screen.queryByRole('button')
      expect(createButton).not.toBeInTheDocument()
    })
  })
})