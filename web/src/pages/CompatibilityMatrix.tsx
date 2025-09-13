import React from 'react'
import { useParams } from 'react-router-dom'
import { CompatibilityMatrixDashboard } from '@/components/compatibility'

export function CompatibilityMatrixPage() {
  const { projectId } = useParams<{ projectId?: string }>()

  return <CompatibilityMatrixDashboard projectId={projectId} />
}