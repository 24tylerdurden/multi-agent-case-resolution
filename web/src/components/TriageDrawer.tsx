import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { actionFreezeCard, actionOpenDispute, startTriageWithOptions } from '../api'

export default function TriageDrawer({ alertId, onClose, onRateLimit }: { alertId: string, onClose: () => void, onRateLimit?: (retryAfterMs: number) => void }) {
  const [open, setOpen] = useState(true)
  const [runId, setRunId] = useState<string | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [recommended, setRecommended] = useState<string | null>(null)
  const [freezeStatus, setFreezeStatus] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [cardId, setCardId] = useState('')
  const [simulateFail, setSimulateFail] = useState(false)

  const liveRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    async function init() {
      if (startedRef.current) return
      startedRef.current = true
      if (esRef.current) { esRef.current.close(); esRef.current = null }
      try {
        const { runId } = await startTriageWithOptions(alertId, { simulateRiskFail: simulateFail })
        setRunId(runId)
        const es = new EventSource(`/api/triage/${runId}/stream`)
        esRef.current = es
        es.addEventListener('plan_built', (e: any) => addEvent('plan_built', e))
        es.addEventListener('tool_update', (e: any) => addEvent('tool_update', e))
        es.addEventListener('fallback_triggered', (e: any) => addEvent('fallback_triggered', e))
        es.addEventListener('decision_finalized', (e: any) => addEvent('decision_finalized', e))
      } catch (e: any) {
        if (e?.code === 429) {
          if (onRateLimit) onRateLimit(e.retryAfterMs ?? 3000)
          // Close immediately and prevent stream setup
          setOpen(false)
          onClose()
          return
        }
        throw e
      }
    }
    function addEvent(type: string, e: MessageEvent) {
      try {
        const payload = JSON.parse(e.data)
        setEvents(prev => [...prev, { type, ...payload }])
        if (type === 'decision_finalized') setRecommended(payload.data?.recommended || null)
        if (liveRef.current) liveRef.current.textContent = `${type}: ${payload?.ts}`
      } catch {}
    }
    init()
    return () => { if (esRef.current) { esRef.current.close(); esRef.current = null } }
  }, [alertId, simulateFail])

  useEffect(() => { 
    // Reset state when alert changes and allow re-initialization
    startedRef.current = false
    setOpen(true)
    setRunId(null)
    setEvents([])
    setRecommended(null)
    setFreezeStatus(null)
    setOtp('')
    setCardId('')
  }, [alertId])

  const close = () => { setOpen(false); onClose() }

  async function onFreeze() {
    if (!runId) return
    if (!cardId) { alert('Enter cardId'); return }
    const resp = await actionFreezeCard(cardId, otp || undefined)
    setFreezeStatus(resp.status)
  }

  async function onOpenDispute() {
    // In a real UI we'd choose a txnId; here prompt for demo
    const txnId = prompt('Enter txnId to dispute')
    if (!txnId) return
    await actionOpenDispute(txnId, '10.4')
    alert('Dispute opened')
  }

  return (
    <div role="dialog" aria-modal="true" className={`fixed inset-0 ${open ? '' : 'hidden'}`}>
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl flex flex-col" aria-labelledby="triage-title">
        <header className="p-4 border-b flex items-center justify-between">
          <h2 id="triage-title" className="text-lg font-semibold">Triage Run {runId ?? '...'}</h2>
          <button onClick={close} className="px-2 py-1 border rounded">ESC</button>
        </header>
        <div className="p-4 space-y-4 overflow-auto flex-1">
          <section>
            <div className="text-sm text-gray-600">Recommended Action</div>
            <div className="text-xl font-semibold">{recommended ?? '...'}</div>
          </section>
          <section>
            <div className="text-sm text-gray-600 mb-2">Events</div>
            <div className="space-y-2">
              {events.map((ev, i) => (
                <div key={i} className="border rounded p-2 text-sm">
                  <div className="font-mono text-xs text-gray-500">{ev.type} · {ev.ts}</div>
                  <pre className="text-xs overflow-auto">{JSON.stringify(ev.data, null, 2)}</pre>
                </div>
              ))}
            </div>
          </section>
          <section className="space-y-2">
            <div className="text-sm text-gray-600">Actions</div>
            <div className="flex gap-2">
              <input aria-label="Card ID" value={cardId} onChange={(e: ChangeEvent<HTMLInputElement>)=>setCardId(e.target.value)} placeholder="Card ID" className="border bg-white px-2 py-1 rounded" />
              <input aria-label="OTP" value={otp} onChange={(e: ChangeEvent<HTMLInputElement>)=>setOtp(e.target.value)} placeholder="OTP" className="border bg-white px-2 py-1 rounded" />
              <button onClick={onFreeze} className="px-3 py-1 bg-black text-white rounded">Freeze Card</button>
              <button onClick={onOpenDispute} className="px-3 py-1 border rounded">Open Dispute</button>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={simulateFail} onChange={(e)=>setSimulateFail(e.target.checked)} />
              Simulate riskSignals failure
            </label>
          </section>
          {freezeStatus && <div className="text-sm">Freeze status: <b>{freezeStatus}</b></div>}
        </div>
        <div className="sr-only" aria-live="polite" ref={liveRef} />
      </div>
    </div>
  )
}
