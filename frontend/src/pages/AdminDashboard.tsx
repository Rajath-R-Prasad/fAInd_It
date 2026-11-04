import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'

export default function AdminDashboard() {
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
      const response = await fetch('http://localhost:8000/admin/reports', {
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
      <div className="flex items-center gap-2 mb-6">
        <Shield className="text-neo-primary" size={32} />
        <h1 className="text-3xl font-bold text-neo-primary">Admin Dashboard</h1>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold mb-4">All Reports</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-2 border-black">
            <thead className="bg-neo-primary text-white">
              <tr>
                <th className="border-2 border-black p-2 text-left">Type</th>
                <th className="border-2 border-black p-2 text-left">Title</th>
                <th className="border-2 border-black p-2 text-left">Category</th>
                <th className="border-2 border-black p-2 text-left">Location</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="border-2 border-black p-2">{report.type}</td>
                  <td className="border-2 border-black p-2">{report.title}</td>
                  <td className="border-2 border-black p-2">{report.category}</td>
                  <td className="border-2 border-black p-2">{report.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
