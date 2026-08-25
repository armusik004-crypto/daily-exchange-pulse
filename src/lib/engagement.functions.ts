import { createServerFn } from '@tanstack/react-start'
import { registerRateViews, stats, toggleRateLike } from '@/lib/engagement.server'

export type EngagementRow = { rateId: number; views: number; likes: number; liked: boolean }

export const getEngagement = createServerFn({ method: 'POST' })
  .inputValidator((d: { rateIds: number[]; deviceId: string }) => d)
  .handler(async ({ data }) => {
    if (!data.rateIds.length) return { items: [] as EngagementRow[] }
    return { items: await stats(data.rateIds, data.deviceId) }
  })

export const registerViews = createServerFn({ method: 'POST' })
  .inputValidator((d: { rateIds: number[]; deviceId: string }) => d)
  .handler(async ({ data }) => {
    return { items: await registerRateViews(data.rateIds, data.deviceId) }
  })

export const toggleLike = createServerFn({ method: 'POST' })
  .inputValidator((d: { rateId: number; deviceId: string; rateIds: number[] }) => d)
  .handler(async ({ data }) => {
    return { items: await toggleRateLike(data.rateId, data.deviceId, data.rateIds) }
  })
