import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

export default function Dashboard() {
  const [reports, setReports] = useState<any[]>([])
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    loadReports()
  }, [token, navigate])

  const loadReports = async () => {
    try {
      const response = await fetch('http://localhost:8000/reports/', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setReports(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-neo-primary">My Reports</h1>
        <Link to="/report/new" className="btn flex items-center gap-2">
          <Plus size={20} />
          New Report
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="card text-center">
          <p className="text-lg">No reports yet. Create your first report!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => (
            <div key={report.id} className="card">
              <span className={`inline-block px-3 py-1 mb-2 font-bold border-2 border-black ${
                report.type === 'LOST' ? 'bg-red-300' : 'bg-green-300'
              }`}>
                {report.type}
              </span>
              <h2 className="text-xl font-bold mb-2">{report.title}</h2>
              <p className="text-sm mb-2">{report.description}</p>
              <p className="text-xs text-gray-600">Category: {report.category}</p>
              <p className="text-xs text-gray-600">Location: {report.location}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
