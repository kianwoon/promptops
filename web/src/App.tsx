import { Routes, Route } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard'
import { Templates } from './pages/Templates'
import { TemplateEditor } from './pages/TemplateEditor'
import { Deployments } from './pages/Deployments'
import { Evaluations } from './pages/Evaluations'
import { Governance } from './pages/Governance'
import { Settings } from './pages/Settings'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/templates"
          element={
            <ProtectedRoute>
              <Templates />
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
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Layout>
  )
}

export default App