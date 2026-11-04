import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LogIn } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      const formData = new FormData()
      formData.append('username', email)
      formData.append('password', password)
      
      const response = await fetch('http://localhost:8000/auth/token', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error('Invalid credentials')
      }
      
      const data = await response.json()
      localStorage.setItem('token', data.access_token)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <LogIn className="text-neo-primary" size={32} />
          <h1 className="text-3xl font-bold">Login</h1>
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
          
          <button type="submit" className="btn w-full">Login</button>
        </form>
        
        <p className="mt-4 text-center">
          Don't have an account? <Link to="/register" className="text-neo-primary font-bold">Register</Link>
        </p>
      </div>
    </div>
  )
}
