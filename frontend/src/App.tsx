import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ChatPage from './pages/ChatPage'
import { Spinner } from './components/ui'

// Chat loads first; the other pages are split out so the first paint stays small.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const EligibilityPage = lazy(() => import('./pages/EligibilityPage'))
const LibraryPage = lazy(() => import('./pages/LibraryPage'))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'))
const InsightsPage = lazy(() => import('./pages/InsightsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

const Loading = () => (
  <div className="flex h-full items-center justify-center">
    <Spinner className="size-6 text-leaf-400" />
  </div>
)

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<ChatPage />} />
            <Route path="c/:id" element={<ChatPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="eligibility" element={<EligibilityPage />} />
            <Route path="schemes" element={<LibraryPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="insights" element={<InsightsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
