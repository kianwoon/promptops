import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { GoogleCallback } from './pages/GoogleCallback'
import { AuthSuccess } from './pages/AuthSuccess'
import { AuthError } from './pages/AuthError'
import { Dashboard } from './pages/Dashboard'
import { Templates } from './pages/Templates'
import { TemplateEditor } from './pages/TemplateEditor'
import { Deployments } from './pages/Deployments'
import { Evaluations } from './pages/Evaluations'
import { CompatibilityMatrixPage } from './pages/CompatibilityMatrix'
import { Governance } from './pages/Governance'
import { SettingsPage as Settings } from './pages/Settings'
import { Profile } from './pages/Profile'
import { UserManagement } from './pages/UserManagement'
import { Projects } from './pages/Projects'
import { ProjectDetail } from './pages/ProjectDetail'
import { ApiKeysPage } from './pages/ApiKeys'
import { DeveloperPage as Developer } from './pages/Developer'
import { AssistantPage } from './pages/Assistant'
import { Layout } from './components/Layout'
import { PublicLayoutWrapper } from './components/PublicLayoutWrapper'
import { DevProtectedRoute as ProtectedRoute } from './components/auth/DevProtectedRoute'
import { DevAppWrapper } from './components/DevAppWrapper'
import { ModulePromptsPage } from './pages/ModulePrompts'
import { ModelTesting } from './pages/ModelTesting'
import { RoleManagementPage } from './pages/RoleManagementPage'

function App() {
  return (
    <DevAppWrapper>
      <Routes>
        {/* Public Routes with Layout */}
        <Route element={<PublicLayoutWrapper />}>
          <Route path="/" element={<Landing />} />
          <Route path="/developer" element={<Developer />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/success" element={<AuthSuccess />} />
          <Route path="/auth/error" element={<AuthError />} />
        </Route>

        {/* Auth callback routes (minimal layout) */}
        <Route path="/auth/google/callback" element={<GoogleCallback />} />

        {/* Protected Routes */}
        <Route element={<Layout />}>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <Projects />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <ProtectedRoute>
                <ProjectDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectId/modules/:moduleId/prompts"
            element={
              <ProtectedRoute>
                <ModulePromptsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectId/modules/:moduleId/prompts/:promptId/testing"
            element={
              <ProtectedRoute>
                <ModelTesting />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:projectId/modules/:moduleId/prompts/:promptId/:version/testing"
            element={
              <ProtectedRoute>
                <ModelTesting />
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates"
            element={
              <ProtectedRoute>
                <Templates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates/new"
            element={
              <ProtectedRoute>
                <TemplateEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates/:id/edit"
            element={
              <ProtectedRoute>
                <TemplateEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/templates/:id/versions/:version"
            element={
              <ProtectedRoute>
                <TemplateEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/deployments"
            element={
              <ProtectedRoute>
                <Deployments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/evaluations"
            element={
              <ProtectedRoute>
                <Evaluations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/compatibility"
            element={
              <ProtectedRoute>
                <CompatibilityMatrixPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/governance"
            element={
              <ProtectedRoute>
                <Governance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/roles"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <RoleManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/keys"
            element={
              <ProtectedRoute>
                <ApiKeysPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assistant"
            element={
              <ProtectedRoute>
                <AssistantPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </DevAppWrapper>
  )
}

export default App