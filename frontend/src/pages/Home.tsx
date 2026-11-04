import { Link } from 'react-router-dom'
import { Search, FileText, CheckCircle } from 'lucide-react'

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="card text-center mb-8">
        <h1 className="text-4xl font-bold text-neo-primary mb-4">Welcome to fAInd It</h1>
        <p className="text-xl mb-6">AI-powered lost and found platform using CLIP and Sentence Transformers</p>
        <div className="flex gap-4 justify-center">
          <Link to="/register" className="btn">Get Started</Link>
          <Link to="/login" className="btn" style={{backgroundColor: '#333'}}>Login</Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="card">
          <Search className="text-neo-primary mb-3" size={40} />
          <h2 className="text-2xl font-bold mb-2">Report</h2>
          <p>Report lost or found items with images and details</p>
        </div>
        <div className="card">
          <FileText className="text-neo-primary mb-3" size={40} />
          <h2 className="text-2xl font-bold mb-2">Match</h2>
          <p>AI finds potential matches using image, text, and metadata similarity</p>
        </div>
        <div className="card">
          <CheckCircle className="text-neo-primary mb-3" size={40} />
          <h2 className="text-2xl font-bold mb-2">Reunite</h2>
          <p>Connect with others through secure claims workflow</p>
        </div>
      </div>
    </div>
  )
}
