import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AsistentePage } from '@/features/asistente/asistente-page'

const searchSchema = z.object({
  conv_id: z
    .union([z.number(), z.literal('new'), z.string()])
    .optional(),
})

export const Route = createFileRoute('/_authenticated/asistente/')({
  component: AsistentePage,
  validateSearch: searchSchema,
})
