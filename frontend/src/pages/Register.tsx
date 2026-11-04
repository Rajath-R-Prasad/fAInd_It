import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      const response = await fetch('http://localhost:8000/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ email, password }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Registration failed')
      }
      
      navigate('/login')
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <UserPlus className="text-neo-primary" size={32} />
          <h1 className="text-3xl font-bold">Register</h1>
        </div>
        
        {error && <div className="bg-red-100 border-2 border-red-500 p-3 mb-4 text-red-700">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="btn w-full">Register</button>
        </form>
        
        <p className="mt-4 text-center">
          Already have an account? <Link to="/login" className="text-neo-primary font-bold">Login</Link>
        </p>
      </div>
    </div>
  )
}
