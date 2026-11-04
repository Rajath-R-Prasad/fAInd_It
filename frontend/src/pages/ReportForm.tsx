import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'

export default function ReportForm() {
  const [formData, setFormData] = useState({
    type: 'LOST',
    title: '',
    description: '',
    category: '',
    color: '',
    location: '',
    event_date: ''
  })
  const [image, setImage] = useState<File | null>(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) {
      navigate('/login')
      return
    }

    const data = new FormData()
    data.append('report_type', formData.type)
    data.append('title', formData.title)
    data.append('description', formData.description)
    data.append('category', formData.category)
    data.append('color', formData.color)
    data.append('location', formData.location)
    if (formData.event_date) data.append('event_date', formData.event_date)
    if (image) data.append('image', image)

    try {
      const response = await fetch('http://localhost:8000/reports/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: data
      })

      if (!response.ok) {
        throw new Error('Failed to create report')
      }

      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="text-neo-primary" size={32} />
          <h1 className="text-3xl font-bold">Create Report</h1>
        </div>

        {error && <div className="bg-red-100 border-2 border-red-500 p-3 mb-4 text-red-700">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Report Type</label>
            <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
              <option value="LOST">Lost Item</option>
              <option value="FOUND">Found Item</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Title</label>
            <input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={4}></textarea>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Category</label>
              <input value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} placeholder="e.g., Phone, Wallet" />
            </div>
            <div className="form-group">
              <label className="form-label">Color</label>
              <input value={formData.color} onChange={(e) => setFormData({...formData, color: e.target.value})} placeholder="e.g., Black, Blue" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Location</label>
            <input value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} placeholder="Where it was lost/found" />
          </div>

          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="datetime-local" value={formData.event_date} onChange={(e) => setFormData({...formData, event_date: e.target.value})} />
          </div>

          <div className="form-group">
            <label className="form-label">Image</label>
            <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} required />
          </div>

          <button type="submit" className="btn w-full">Create Report</button>
        </form>
      </div>
    </div>
  )
}
