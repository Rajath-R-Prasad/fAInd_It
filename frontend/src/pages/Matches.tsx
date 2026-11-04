import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target } from 'lucide-react'

export default function Matches() {
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    loadMatches()
  }, [token, navigate])

  const loadMatches = async () => {
    try {
      const response = await fetch('http://localhost:8000/matches/', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setMatches(data.matches || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="text-center">Loading matches...</div>

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Target className="text-neo-primary" size={32} />
        <h1 className="text-3xl font-bold text-neo-primary">Potential Matches</h1>
      </div>

      {matches.length === 0 ? (
        <div className="card text-center">
          <p className="text-lg">No matches found. Create reports to find matches!</p>
        </div>
      ) : (
        matches.map((matchGroup, idx) => (
          <div key={idx} className="mb-8">
            <div className="card mb-4">
              <h2 className="text-xl font-bold">
                Matches for: <span className="text-neo-primary">{matchGroup.source_report?.title}</span> ({matchGroup.source_report?.type})
              </h2>
            </div>
            {matchGroup.matches?.map((match: any, mIdx: number) => (
              <div key={mIdx} className="card mb-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className={`inline-block px-2 py-1 mb-2 font-bold border-2 border-black ${
                      match.report.type === 'LOST' ? 'bg-red-300' : 'bg-green-300'
                    }`}>
                      {match.report.type}
                    </span>
                    <h3 className="text-xl font-bold">{match.report.title}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-neo-primary">{(match.scores.final_score * 100).toFixed(1)}%</div>
                    <div className="text-sm">Match Score</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="border-2 border-black p-2">
                    <div className="font-bold">Image</div>
                    <div>{(match.scores.image_similarity * 100).toFixed(1)}%</div>
                  </div>
                  <div className="border-2 border-black p-2">
                    <div className="font-bold">Text</div>
                    <div>{(match.scores.text_similarity * 100).toFixed(1)}%</div>
                  </div>
                  <div className="border-2 border-black p-2">
                    <div className="font-bold">Metadata</div>
                    <div>{(match.scores.metadata_similarity * 100).toFixed(1)}%</div>
                  </div>
                </div>
                <p className="mt-3 text-sm">{match.report.description}</p>
                <p className="text-xs text-gray-600">Location: {match.report.location}</p>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
