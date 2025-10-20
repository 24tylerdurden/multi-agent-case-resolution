import { useEffect, useState } from 'react'
import Kpi from '../components/Kpi'

export default function Dashboard() {
  const [health, setHealth] = useState<string>('...')

  useEffect(() => {
    fetch('/status/health').then(r=>r.json()).then(j=>setHealth(j.status || 'ok')).catch((err)=>{
      setHealth('down')
  })
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border rounded p-3">
          <div className="text-sm text-gray-600">API Health</div>
          <div className="text-2xl font-semibold">{health}</div>
        </div>
        <div className="border rounded p-3">
          <div className="text-sm text-gray-600">Alerts in Queue</div>
          <Kpi endpoint="/api/alerts?limit=1" selector={(j:any)=> (j.nextCursor ? 100 : (j.items?.length||0))} />
        </div>
        <div className="border rounded p-3">
          <div className="text-sm text-gray-600">Avg Triage Latency (ms)</div>
          <div className="text-2xl font-semibold">—</div>
        </div>
      </div>
    </div>
  )
}
