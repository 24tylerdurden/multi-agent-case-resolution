import { useEffect, useMemo, useState } from 'react'
import { fetchCustomerTxns, fetchInsights, type Txn } from '../api'
import { useParams } from 'react-router-dom'

export default function Customer() {
  const { id = '' } = useParams()
  const [txns, setTxns] = useState<Txn[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<any | null>(null)

  async function load(next?: boolean) {
    setLoading(true)
    const page = await fetchCustomerTxns(id, { cursor: next ? cursor ?? undefined : undefined, limit: 50 })
    setTxns(next ? [...txns, ...page.items] : page.items)
    setCursor(page.nextCursor)
    setLoading(false)
  }

  useEffect(() => { if (id) { setTxns([]); setCursor(null); load(false); fetchInsights(id).then(setInsights) } }, [id])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Customer {id}</h2>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="border rounded p-3">
          <div className="text-sm text-gray-600">Top Merchants</div>
          <ul className="text-sm mt-1">
            {insights?.topMerchants?.slice(0,5).map((m:any)=> <li key={m.merchant}>{m.merchant} <span className="text-gray-500">({m.count})</span></li>) || <li>—</li>}
          </ul>
        </div>
        <div className="border rounded p-3">
          <div className="text-sm text-gray-600">Categories</div>
          <ul className="text-sm mt-1">
            {insights?.categories?.slice(0,5).map((c:any)=> <li key={c.name}>{c.name}: {(c.pct*100).toFixed(1)}%</li>) || <li>—</li>}
          </ul>
        </div>
        <div className="border rounded p-3">
          <div className="text-sm text-gray-600">Anomalies</div>
          <ul className="text-sm mt-1">
            {insights?.anomalies?.map((a:any)=> <li key={a.ts}>{a.ts} <b>{a.note}</b> z={a.z}</li>) || <li>—</li>}
          </ul>
        </div>
      </section>

      <section className="space-y-2">
        <div className="text-sm text-gray-600">Transactions</div>
        <div className="border rounded divide-y">
          {txns.map(t => (
            <div key={t.id} className="p-3 flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <div className="font-mono text-xs">{t.id}</div>
                <div>{t.merchant} · {t.mcc}</div>
                <div className="text-gray-500">{new Date(t.ts).toLocaleString()}</div>
              </div>
              <div className="font-mono">{(t.amountCents/100).toLocaleString(undefined,{style:'currency',currency:t.currency})}</div>
            </div>
          ))}
          {txns.length === 0 && <div className="p-3 text-sm text-gray-500">No transactions</div>}
        </div>
        <div className="flex justify-center">
          <button disabled={!cursor || loading} onClick={() => load(true)} className="px-3 py-1 border rounded disabled:opacity-50">{loading ? 'Loading...' : (cursor ? 'Load more' : 'No more')}</button>
        </div>
      </section>
    </div>
  )
}
