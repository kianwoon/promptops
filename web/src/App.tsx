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
import { Governance } from './pages/Governance'
import { SettingsPage as Settings } from './pages/Settings'
import { UserManagement } from './pages/UserManagement'
import { Layout } from './components/Layout'
import { PublicLayoutWrapper } from './components/PublicLayoutWrapper'
import { ProtectedRoute } from './components/auth/ProtectedRoute'

function App() {
  return (
    <Routes>
      {/* Public Routes with Layout */}
      <Route element={<PublicLayoutWrapper />}>
        <Route path="/" element={<Landing />} />
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
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  )
}

export default App