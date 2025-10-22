import { useEffect, useMemo, useState } from 'react'
import { Alert, fetchAlerts, updateAlertStatus } from '../api'
import { Link } from 'react-router-dom'
import TriageDrawer from '../components/TriageDrawer'

export default function Alerts() {
  const [items, setItems] = useState<Alert[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [triageAlertId, setTriageAlertId] = useState<string | null>(null)
  const [riskFilter, setRiskFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({}) // alertId -> epoch ms when enabled again

  async function load(next?: boolean) {
    setLoading(true)
    const page = await fetchAlerts(next ? cursor ?? undefined : undefined, 50)
    setCursor(page.nextCursor)
    setItems(next ? [...items, ...page.items] : page.items)
    setLoading(false)
  }

  useEffect(() => { load(false) }, [])

  const risks = useMemo(() => Array.from(new Set(items.map(i=>i.risk))).sort(), [items])
  const statuses = useMemo(() => Array.from(new Set(items.map(i=>i.status))).sort(), [items])
  const visible = useMemo(() => items.filter(i => (
    (!riskFilter || i.risk === riskFilter) && (!statusFilter || i.status === statusFilter)
  )), [items, riskFilter, statusFilter])

  async function setStatus(id: string, status: 'open'|'resolved') {
    try {
      setUpdatingId(id)
      await updateAlertStatus(id, status)
      setItems(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    } finally {
      setUpdatingId(null)
    }
  }

  function onRateLimit(alertId: string, retryAfterMs: number) {
    const until = Date.now() + retryAfterMs
    setCooldowns(prev => ({ ...prev, [alertId]: until }))
    // Clear after timeout to re-enable
    setTimeout(() => {
      setCooldowns(prev => {
        const copy = { ...prev }
        if (copy[alertId] && copy[alertId] <= Date.now()) delete copy[alertId]
        return copy
      })
    }, retryAfterMs + 50)
  }

  function cooldownLabel(alertId: string): string | null {
    const until = cooldowns[alertId]
    if (!until) return null
    const remaining = Math.max(0, until - Date.now())
    const secs = Math.ceil(remaining / 1000)
    return `Try in ${secs}s`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Alerts</h2>
        <div className="flex gap-2">
          <select aria-label="Risk" value={riskFilter} onChange={(e)=>setRiskFilter(e.target.value)} className="px-2 py-1 border bg-white rounded text-sm">
            <option value="">All Risks</option>
            {risks.map(r=> <option key={r} value={r}>{r}</option>)}
          </select>
          <select aria-label="Status" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="px-2 py-1 bg-white border rounded text-sm">
            <option value="">All Statuses</option>
            {statuses.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="px-3 py-1 border rounded" onClick={() => load(false)}>Refresh</button>
        </div>
      </div>
      <div className="border rounded divide-y">
        {visible.map(a => (
          <div key={a.id} className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <div className="font-mono text-xs">{a.id}</div>
              <div>Risk: <b>{a.risk}</b></div>
              <div>Status: {a.status}</div>
              <div className="text-gray-500">{new Date(a.createdAt).toLocaleString()}</div>
              <Link className="underline" to={`/customer/${a.customerId}`}>View Customer</Link>
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 bg-black text-white rounded disabled:opacity-50"
                disabled={!!triageAlertId || !!cooldowns[a.id]}
                title={cooldownLabel(a.id) || ''}
                onClick={() => setTriageAlertId(a.id)}
              >{cooldownLabel(a.id) || 'Open Triage'}</button>
              {a.status !== 'resolved' ? (
                <button disabled={updatingId===a.id} onClick={()=>setStatus(a.id, 'resolved')} className="px-3 py-1 border rounded disabled:opacity-50">{updatingId===a.id ? 'Resolving...' : 'Resolve'}</button>
              ) : (
                <button disabled={updatingId===a.id} onClick={()=>setStatus(a.id, 'open')} className="px-3 py-1 border rounded disabled:opacity-50">{updatingId===a.id ? 'Reopening...' : 'Reopen'}</button>
              )}
            </div>
          </div>
        ))}
        {items.length > 0 && visible.length === 0 && <div className="p-3 text-sm text-gray-500">No alerts match filters</div>}
        {items.length === 0 && <div className="p-3 text-sm text-gray-500">No alerts</div>}
      </div>
      <div className="flex justify-center">
        <button disabled={!cursor || loading} onClick={() => load(true)} className="px-3 py-1 border rounded disabled:opacity-50">{loading ? 'Loading...' : (cursor ? 'Load more' : 'No more')}</button>
      </div>
      {triageAlertId && (
        <TriageDrawer alertId={triageAlertId} onClose={() => setTriageAlertId(null)} onRateLimit={(ms)=>{ if (triageAlertId) onRateLimit(triageAlertId, ms) }} />
      )}
    </div>
  )
}
