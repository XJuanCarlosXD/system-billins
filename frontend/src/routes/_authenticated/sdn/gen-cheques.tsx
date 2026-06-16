import { createFileRoute } from '@tanstack/react-router'
import { SdnGenCheques } from '@/features/sdn/sdn-gen-cheques'
export const Route = createFileRoute('/_authenticated/sdn/gen-cheques')({ component: SdnGenCheques })
