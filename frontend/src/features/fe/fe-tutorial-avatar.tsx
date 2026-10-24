import { cn } from '@/lib/utils'

interface Props {
  speaking: boolean
  className?: string
}

export function FeTutorialAvatar({ speaking, className }: Props) {
  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <svg viewBox='0 0 64 64' className='h-full w-full' aria-hidden>
        <defs>
          <radialGradient id='fe-tutorial-face' cx='50%' cy='40%' r='60%'>
            <stop offset='0%' stopColor='#A5B4FC' />
            <stop offset='100%' stopColor='#6366F1' />
          </radialGradient>
        </defs>
        <circle cx='32' cy='32' r='28' fill='url(#fe-tutorial-face)' />
        <circle cx='22' cy='26' r='3.2' fill='white' />
        <circle cx='42' cy='26' r='3.2' fill='white' />
        <circle cx='22' cy='26.5' r='1.5' fill='#1E1B4B'>
          {speaking && (
            <animate
              attributeName='cy'
              values='26.5;25.8;26.5'
              dur='0.6s'
              repeatCount='indefinite'
            />
          )}
        </circle>
        <circle cx='42' cy='26.5' r='1.5' fill='#1E1B4B'>
          {speaking && (
            <animate
              attributeName='cy'
              values='26.5;25.8;26.5'
              dur='0.6s'
              repeatCount='indefinite'
            />
          )}
        </circle>
        {speaking ? (
          <ellipse cx='32' cy='42' rx='6' ry='4' fill='#1E1B4B'>
            <animate
              attributeName='ry'
              values='1.5;4;2.5;4;1.5'
              dur='0.5s'
              repeatCount='indefinite'
            />
            <animate
              attributeName='rx'
              values='5;6;5.5;6;5'
              dur='0.5s'
              repeatCount='indefinite'
            />
          </ellipse>
        ) : (
          <path
            d='M24 40 Q32 46 40 40'
            stroke='#1E1B4B'
            strokeWidth='2.5'
            strokeLinecap='round'
            fill='none'
          />
        )}
        <path
          d='M10 28 Q10 10 32 10 Q54 10 54 28'
          stroke='#4338CA'
          strokeWidth='3'
          fill='none'
          strokeLinecap='round'
        />
        <rect x='6' y='24' width='7' height='12' rx='2.5' fill='#4338CA' />
        <rect x='51' y='24' width='7' height='12' rx='2.5' fill='#4338CA' />
        {speaking && (
          <>
            <circle cx='58' cy='30' r='2' fill='#A5B4FC' opacity='0.6'>
              <animate
                attributeName='r'
                values='2;6;2'
                dur='1.2s'
                repeatCount='indefinite'
              />
              <animate
                attributeName='opacity'
                values='0.6;0;0.6'
                dur='1.2s'
                repeatCount='indefinite'
              />
            </circle>
            <circle cx='6' cy='30' r='2' fill='#A5B4FC' opacity='0.6'>
              <animate
                attributeName='r'
                values='2;6;2'
                dur='1.2s'
                begin='0.3s'
                repeatCount='indefinite'
              />
              <animate
                attributeName='opacity'
                values='0.6;0;0.6'
                dur='1.2s'
                begin='0.3s'
                repeatCount='indefinite'
              />
            </circle>
          </>
        )}
      </svg>
    </div>
  )
}
