import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'

export default function Claims() {
  const [claims, setClaims] = useState<any[]>([])
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    loadClaims()
  }, [token, navigate])

  const loadClaims = async () => {
    try {
      const response = await fetch('http://localhost:8000/claims/', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setClaims(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <CheckCircle className="text-neo-primary" size={32} />
        <h1 className="text-3xl font-bold text-neo-primary">Claims</h1>
      </div>

      {claims.length === 0 ? (
        <div className="card text-center">
          <p className="text-lg">No claims yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {claims.map((claim) => (
            <div key={claim.id} className="card flex justify-between items-center">
              <div>
                <p className="font-bold">Claim ID: {claim.id.slice(0, 8)}...</p>
                <p className="text-sm">Report: {claim.report_id.slice(0, 8)}...</p>
              </div>
              <span className={`px-3 py-1 font-bold border-2 border-black ${
                claim.status === 'accepted' ? 'bg-green-300' : 
                claim.status === 'rejected' ? 'bg-red-300' : 'bg-yellow-300'
              }`}>
                {claim.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
