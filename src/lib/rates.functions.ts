import { createServerFn } from '@tanstack/react-start'
import { getRatesForApp } from '@/lib/rates.server'

export type RateRow = {
  id: number
  pair: string
  buy: number
  sell: number
  recorded_at: string
  recorded_date: string
}

export const getRates = createServerFn({ method: 'GET' }).handler(async () => {
  return getRatesForApp()
})
