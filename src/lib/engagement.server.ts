import type { EngagementRow } from '@/lib/engagement.functions'

async function admin() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  return supabaseAdmin
}

async function countRows(table: 'rate_views' | 'rate_likes', rateId: number): Promise<number> {
  const db = await admin()
  const { count } = await db.from(table).select('id', { count: 'exact', head: true }).eq('rate_id', rateId)
  return count ?? 0
}

async function isLiked(rateId: number, deviceId: string): Promise<boolean> {
  const db = await admin()
  const { data } = await db
    .from('rate_likes')
    .select('id')
    .eq('rate_id', rateId)
    .eq('device_id', deviceId)
    .maybeSingle()
  return !!data
}

export async function stats(rateIds: number[], deviceId: string): Promise<EngagementRow[]> {
  const ids = rateIds.filter((id) => Number.isInteger(id) && id > 0)
  return Promise.all(
    ids.map(async (rateId) => ({
      rateId,
      views: await countRows('rate_views', rateId),
      likes: await countRows('rate_likes', rateId),
      liked: await isLiked(rateId, deviceId),
    })),
  )
}

export async function registerRateViews(rateIds: number[], deviceId: string): Promise<EngagementRow[]> {
  const ids = rateIds.filter((id) => Number.isInteger(id) && id > 0)
  if (!ids.length || !deviceId) return []
  const db = await admin()
  await db.from('rate_views').upsert(
    ids.map((rate_id) => ({ rate_id, device_id: deviceId })),
    { onConflict: 'rate_id,device_id', ignoreDuplicates: true },
  )
  return stats(ids, deviceId)
}

export async function toggleRateLike(rateId: number, deviceId: string, rateIds: number[]): Promise<EngagementRow[]> {
  if (!deviceId || rateId <= 0) return []
  const db = await admin()
  const { data: existing } = await db
    .from('rate_likes')
    .select('id')
    .eq('rate_id', rateId)
    .eq('device_id', deviceId)
    .maybeSingle()
  if (existing) {
    await db.from('rate_likes').delete().eq('id', existing.id)
  } else {
    await db
      .from('rate_likes')
      .upsert({ rate_id: rateId, device_id: deviceId }, { onConflict: 'rate_id,device_id', ignoreDuplicates: true })
  }
  return stats(rateIds, deviceId)
}
