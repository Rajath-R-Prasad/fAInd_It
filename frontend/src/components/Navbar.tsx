import { Link, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'

export default function Navbar() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  const logout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <nav className="bg-neo-primary border-b-4 border-black p-4 mb-8">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 text-white font-bold text-2xl">
          <Search size={28} />
          <span>fAInd It</span>
        </Link>
        <div className="flex gap-4 items-center">
          {token ? (
            <>
              <Link to="/dashboard" className="text-white font-bold hover:underline">Dashboard</Link>
              <Link to="/report/new" className="text-white font-bold hover:underline">Report Item</Link>
              <Link to="/matches" className="text-white font-bold hover:underline">Matches</Link>
              <Link to="/claims" className="text-white font-bold hover:underline">Claims</Link>
              <button onClick={logout} className="bg-white text-neo-primary px-4 py-2 border-2 border-black font-bold hover:bg-neo-secondary">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-white font-bold hover:underline">Login</Link>
              <Link to="/register" className="bg-white text-neo-primary px-4 py-2 border-2 border-black font-bold hover:bg-neo-secondary">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
