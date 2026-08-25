import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/rates')({
  server: {
    handlers: {
      GET: async () => {
        const { getRatesForApp } = await import('@/lib/rates.server')
        const result = await getRatesForApp()
        return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
      },
    },
  },
})