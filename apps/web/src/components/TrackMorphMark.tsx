const MIN_DURATION_MS = 5_000
const MAX_DURATION_MS = 10_000
const DEFAULT_DURATION_MS = 7_500
const POINT_COUNT = 24

const KEY_TIMES = '0;0.07;0.14;0.22;0.34;0.45;0.56;0.7;0.8;0.9;0.96;1'
const KEY_SPLINES = Array.from({ length: 11 }, () => '.4 0 .2 1').join(';')

type Point = { x: number; y: number }

function clampDuration(durationMs: number) {
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, durationMs))
}

function makeRadialPath(radiusAt: (angle: number) => number) {
  const center = 50
  const points = Array.from({ length: POINT_COUNT }, (_, index) => {
    const angle = -Math.PI / 2 + (index / POINT_COUNT) * Math.PI * 2
    const radius = radiusAt(angle)
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    }
  })

  return makeClosedCurve(points)
}

function makeClosedCurve(points: Array<Point>) {
  const tension = 1 / 6
  const commands = points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length]!
    const next = points[(index + 1) % points.length]!
    const nextNext = points[(index + 2) % points.length]!
    const controlOne = {
      x: point.x + (next.x - previous.x) * tension,
      y: point.y + (next.y - previous.y) * tension,
    }
    const controlTwo = {
      x: next.x - (nextNext.x - point.x) * tension,
      y: next.y - (nextNext.y - point.y) * tension,
    }
    return `C ${format(controlOne.x)} ${format(controlOne.y)} ${format(controlTwo.x)} ${format(controlTwo.y)} ${format(next.x)} ${format(next.y)}`
  })

  return `M ${format(points[0]!.x)} ${format(points[0]!.y)} ${commands.join(' ')} Z`
}

function format(value: number) {
  return value.toFixed(2)
}

const ring = makeRadialPath(() => 17)
const paired = makeRadialPath((angle) => 16 + 7.5 * Math.cos(angle * 2))
const compact = makeRadialPath(() => 14)
const fourLobe = makeRadialPath((angle) => 21 + 5.5 * Math.cos(angle * 4 + Math.PI))
const fourPoint = makeRadialPath((angle) => 19 + 9 * Math.cos(angle * 4))
const broadRing = makeRadialPath(() => 28)
const hourglass = makeRadialPath((angle) => 22 - 7 * Math.cos(angle * 2))
const clover = makeRadialPath((angle) => 16 + 7 * Math.cos(angle * 3 + Math.PI / 2))

const OUTLINE_VALUES = [
  ring,
  paired,
  ring,
  compact,
  fourLobe,
  fourPoint,
  fourPoint,
  compact,
  broadRing,
  hourglass,
  clover,
  ring,
].join(';')

const OUTLINE_OPACITY = '1;1;1;1;1;1;0;0;1;1;1;1'
const SATELLITE_OPACITY = '0;1;0;0;0.46;0.5;1;1;0;0;0.45;0'
const CAPSULE_OPACITY = '0;0;0;1;0;0;0;0;0;0;0;0'

const SATELLITE_PATHS = [
  '0 0;-10 0;0 0;0 0;-10 -10;0 -17;0 -19;13 -13;0 0;0 0;-9 -6;0 0',
  '0 0;10 0;0 0;0 0;10 -10;17 0;19 0;13 13;0 0;0 0;9 -6;0 0',
  '0 0;0 0;0 0;0 0;10 10;0 17;0 19;-13 13;0 0;0 0;0 10;0 0',
  '0 0;0 0;0 0;0 0;-10 10;-17 0;-19 0;-13 -13;0 0;0 0;0 0;0 0',
]

export type TrackMorphMarkProps = {
  className?: string
  durationMs?: number
}

export function TrackMorphMark({
  className,
  durationMs = DEFAULT_DURATION_MS,
}: TrackMorphMarkProps) {
  const duration = `${clampDuration(durationMs) / 1_000}s`
  const classes = ['track-morph-mark', className].filter(Boolean).join(' ')

  return (
    <svg
      aria-hidden="true"
      className={classes}
      focusable="false"
      viewBox="0 0 100 100"
    >
      <g className="track-morph-motion">
        <path className="track-morph-outline" d={ring}>
          <animate
            attributeName="d"
            calcMode="spline"
            dur={duration}
            keySplines={KEY_SPLINES}
            keyTimes={KEY_TIMES}
            repeatCount="indefinite"
            values={OUTLINE_VALUES}
          />
          <animate
            attributeName="opacity"
            dur={duration}
            keyTimes={KEY_TIMES}
            repeatCount="indefinite"
            values={OUTLINE_OPACITY}
          />
        </path>

        {SATELLITE_PATHS.map((positions) => (
          <g className="track-morph-satellite" key={positions}>
            <circle cx="0" cy="0" r="8" />
            <animateTransform
              attributeName="transform"
              dur={duration}
              keyTimes={KEY_TIMES}
              repeatCount="indefinite"
              type="translate"
              values={positions.split(';').map((position) => {
                const [x, y] = position.split(' ').map(Number)
                return `${50 + x!} ${50 + y!}`
              }).join(';')}
            />
            <animate
              attributeName="opacity"
              dur={duration}
              keyTimes={KEY_TIMES}
              repeatCount="indefinite"
              values={SATELLITE_OPACITY}
            />
          </g>
        ))}

        <g className="track-morph-capsules">
          <rect height="28" rx="7" width="10" x="19" y="36" />
          <rect height="28" rx="7" width="10" x="71" y="36" />
          <animate
            attributeName="opacity"
            dur={duration}
            keyTimes={KEY_TIMES}
            repeatCount="indefinite"
            values={CAPSULE_OPACITY}
          />
        </g>
      </g>

      <g className="track-morph-static">
        <circle cx="50" cy="50" r="17" />
      </g>
    </svg>
  )
}
