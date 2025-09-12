import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './layout/Sidebar'
import { Header } from './layout/Header'
import { Toaster } from 'react-hot-toast'

interface LayoutProps {
  children?: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">
            <div className="container mx-auto px-6 py-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <Toaster />
    </div>
  )
}