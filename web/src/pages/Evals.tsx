import { useEffect, useState } from 'react'

type EvalCase = { id: string; description: string }
type RunResult = { id: string; description: string; expected: any; actual: any; pass: boolean }

export default function Evals() {
  const [cases, setCases] = useState<EvalCase[]>([])
  const [results, setResults] = useState<RunResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/evals').then(r=>r.json()).then(j=>{
      setCases((j.evalCases||[]).map((c:any)=>({ id: c.id, description: c.description })))
    }).catch(()=>setCases([]))
  }, [])

  async function run() {
    try {
      setError(null)
      setLoading(true)
      const r = await fetch('/api/evals/run', { method: 'POST' })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'failed')
      setResults(j.results || [])
    } catch (e:any) {
      setError(e?.message || 'failed_to_run')
    } finally {
      setLoading(false)
    }
  }

  const totals = results ? {
    total: results.length,
    passed: results.filter(r=>r.pass).length,
    failed: results.filter(r=>!r.pass).length,
  } : null

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Evals</h2>
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">Cases: <b>{cases.length}</b></div>
        <button onClick={run} disabled={loading} className="px-3 py-1 border rounded disabled:opacity-50">{loading ? 'Running...' : 'Run Evals'}</button>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {totals && (
        <div className="text-sm">Total: <b>{totals.total}</b> · Passed: <b className="text-green-700">{totals.passed}</b> · Failed: <b className="text-red-700">{totals.failed}</b></div>
      )}
      <div className="space-y-2">
        {(results || cases).map((c:any, idx:number) => {
          const r = (results || []) as RunResult[]
          const rr = r[idx]
          const pass = rr ? rr.pass : null
          return (
            <div key={c.id} className={`border rounded p-3 text-sm ${pass===true ? 'border-green-300' : pass===false ? 'border-red-300' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="font-semibold">{c.id}</div>
                <div className="text-xs text-gray-500">{c.description}</div>
              </div>
              {rr && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <div className="text-gray-600">Expected</div>
                    <pre className="text-xs overflow-auto border rounded p-2">{JSON.stringify(rr.expected, null, 2)}</pre>
                  </div>
                  <div>
                    <div className="text-gray-600">Actual</div>
                    <pre className="text-xs overflow-auto border rounded p-2">{JSON.stringify(rr.actual, null, 2)}</pre>
                  </div>
                </div>
              )}
              {pass!==null && (
                <div className="mt-2">Result: {pass ? <b className="text-green-700">PASS</b> : <b className="text-red-700">FAIL</b>}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
