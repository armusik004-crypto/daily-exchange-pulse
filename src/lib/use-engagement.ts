import { useCallback, useEffect, useState } from 'react'
import type { EngagementRow } from '@/lib/engagement.functions'
import { getEngagement, registerViews, toggleLike } from '@/lib/engagement.functions'

const DEVICE_KEY = 'km_device_id_v1'

function deviceId() {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function useEngagement(rateIds: number[]) {
  const [items, setItems] = useState<Record<number, EngagementRow>>({})
  const key = rateIds.join(',')

  const apply = useCallback((rows: EngagementRow[]) => {
    setItems((prev) => {
      const next = { ...prev }
      for (const r of rows) next[r.rateId] = r
      return next
    })
  }, [])

  useEffect(() => {
    const ids = key ? key.split(',').map(Number) : []
    if (!ids.length) return
    const did = deviceId()
    let cancelled = false
    ;(async () => {
      try {
        const res = await registerViews({ data: { rateIds: ids, deviceId: did } })
        if (!cancelled) apply(res.items)
      } catch {
        try {
          const res = await getEngagement({ data: { rateIds: ids, deviceId: did } })
          if (!cancelled) apply(res.items)
        } catch {
          /* offline — ignore */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key, apply])

  const like = useCallback(
    async (rateId: number) => {
      const ids = key ? key.split(',').map(Number) : []
      const did = deviceId()
      // optimistic
      setItems((prev) => {
        const cur = prev[rateId]
        if (!cur) return prev
        return {
          ...prev,
          [rateId]: { ...cur, liked: !cur.liked, likes: cur.likes + (cur.liked ? -1 : 1) },
        }
      })
      try {
        const res = await toggleLike({ data: { rateId, deviceId: did, rateIds: ids } })
        apply(res.items)
      } catch {
        /* keep optimistic state */
      }
    },
    [key, apply],
  )

  return { items, like }
}
