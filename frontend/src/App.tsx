import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import ReportForm from './pages/ReportForm'
import Matches from './pages/Matches'
import Claims from './pages/Claims'
import AdminDashboard from './pages/AdminDashboard'
import Evaluation from './pages/Evaluation'
import ReportDetail from './pages/ReportDetail'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="relative flex-1 overflow-x-clip">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/report/new" element={<ReportForm />} />
              <Route path="/reports/:id" element={<ReportDetail />} />
              <Route path="/reports/:id/edit" element={<ReportForm />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/claims" element={<Claims />} />
              <Route path="/evaluation" element={<Evaluation />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App
