import { useEffect, useState } from 'react'

export default function Kpi({ endpoint, selector }: { endpoint: string; selector: (j: any) => number | string }) {
  const [value, setValue] = useState<string>('...')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await fetch(endpoint)
        const j = await r.json()
        const v = selector(j)
        if (!cancelled) setValue(String(v))
      } catch {
        if (!cancelled) setValue('—')
      }
    }
    load()
    const id = setInterval(load, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [endpoint])

  return (
    <div className="text-2xl font-semibold">{value}</div>
  )
}
