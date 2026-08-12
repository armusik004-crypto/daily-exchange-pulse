import { createServerFn } from '@tanstack/react-start'

export type EngagementRow = { rateId: number; views: number; likes: number; liked: boolean }

async function admin() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  return supabaseAdmin
}

async function stats(rateIds: number[], deviceId: string): Promise<EngagementRow[]> {
  const db = await admin()
  const [{ data: views }, { data: likes }] = await Promise.all([
    db.from('rate_views').select('rate_id,device_id').in('rate_id', rateIds),
    db.from('rate_likes').select('rate_id,device_id').in('rate_id', rateIds),
  ])
  return rateIds.map((rateId) => ({
    rateId,
    views: (views ?? []).filter((v) => Number(v.rate_id) === rateId).length,
    likes: (likes ?? []).filter((l) => Number(l.rate_id) === rateId).length,
    liked: (likes ?? []).some((l) => Number(l.rate_id) === rateId && l.device_id === deviceId),
  }))
}

export const getEngagement = createServerFn({ method: 'POST' })
  .inputValidator((d: { rateIds: number[]; deviceId: string }) => d)
  .handler(async ({ data }) => {
    if (!data.rateIds.length) return { items: [] as EngagementRow[] }
    return { items: await stats(data.rateIds, data.deviceId) }
  })

export const registerViews = createServerFn({ method: 'POST' })
  .inputValidator((d: { rateIds: number[]; deviceId: string }) => d)
  .handler(async ({ data }) => {
    if (!data.rateIds.length || !data.deviceId) return { items: [] as EngagementRow[] }
    const db = await admin()
    await db
      .from('rate_views')
      .upsert(
        data.rateIds.map((rate_id) => ({ rate_id, device_id: data.deviceId })),
        { onConflict: 'rate_id,device_id', ignoreDuplicates: true },
      )
    return { items: await stats(data.rateIds, data.deviceId) }
  })

export const toggleLike = createServerFn({ method: 'POST' })
  .inputValidator((d: { rateId: number; deviceId: string; rateIds: number[] }) => d)
  .handler(async ({ data }) => {
    if (!data.deviceId) return { items: [] as EngagementRow[] }
    const db = await admin()
    const { data: existing } = await db
      .from('rate_likes')
      .select('id')
      .eq('rate_id', data.rateId)
      .eq('device_id', data.deviceId)
      .maybeSingle()
    if (existing) {
      await db.from('rate_likes').delete().eq('id', existing.id)
    } else {
      await db
        .from('rate_likes')
        .upsert(
          { rate_id: data.rateId, device_id: data.deviceId },
          { onConflict: 'rate_id,device_id', ignoreDuplicates: true },
        )
    }
    return { items: await stats(data.rateIds, data.deviceId) }
  })
