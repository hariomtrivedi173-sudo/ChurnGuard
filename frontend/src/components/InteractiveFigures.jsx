import { useEffect, useRef } from 'react'

/**
 * InteractiveFigures
 *
 * 3-Column FIG section matching Linear-level motion restraint and precision:
 * - FIG 0.1: Layered Platform / Slab Stack (translateZ, perspective, preserve-3d)
 * - FIG 0.2: Agent Cluster (modular isometric cubes shifting independently)
 * - FIG 0.3: Stepped Fin / Velocity Rack (cascading vertical fins with ripple parallax)
 *
 * STRICT STACK COMPLIANCE:
 * - Zero static inline CSS.
 * - Dynamic runtime interpolation sets CSS custom properties via `el.style.setProperty` inside a rAF loop.
 * - Tailwind arbitrary classes read them: e.g. `[transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]`.
 * - rAF loop with lerp (0.08), IntersectionObserver (only runs in viewport / when hovered), cancels on unmount.
 * - Respects `prefers-reduced-motion: reduce` (loop disabled, well-composed static pose).
 * - Touch friendly with gentle idle oscillation.
 * - Strict dusty Mauve palette only.
 */

export default function InteractiveFigures() {
  return (
    <section id="figures" className="w-full py-20 sm:py-28 lg:py-32 border-t border-b border-mauve-200 dark:border-mauve-800 bg-mauve-50 dark:bg-mauve-950 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="mb-12 sm:mb-16 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider text-mauve-700 dark:text-mauve-200 bg-mauve-100 dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            System Architecture
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-mauve-950 dark:text-mauve-50">
            Engineered for deterministic retention.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-mauve-700/80 dark:text-mauve-200/80 leading-relaxed">
            Three decoupled layers running continuous telemetry pipelines, causal attribution models, and agentic playbooks.
          </p>
        </div>

        {/* 3-Column Figures Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-mauve-200 dark:divide-mauve-800 border border-mauve-200 dark:border-mauve-800 rounded-lg bg-white/50 dark:bg-mauve-900/30 overflow-hidden shadow-sm">
          <FigureOne />
          <FigureTwo />
          <FigureThree />
        </div>

      </div>
    </section>
  )
}

/* ==========================================================================
   FIG 0.1 — LAYERED PLATFORM / SLAB STACK
   ========================================================================== */
function FigureOne() {
  const containerRef = useRef(null)
  const rigRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    const rig = rigRef.current
    if (!el || !rig) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motionQuery.matches) {
      rig.style.setProperty('--rx', '18deg')
      rig.style.setProperty('--ry', '-14deg')
      rig.style.setProperty('--lift-top', '-28px')
      rig.style.setProperty('--lift-mid1', '-16px')
      rig.style.setProperty('--lift-mid2', '-8px')
      return
    }

    let isVisible = false
    let isHovered = false
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let rafId = null
    let idleTick = 0

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting
    }, { threshold: 0.1 })
    observer.observe(el)

    const onMouseMove = (e) => {
      const rect = el.getBoundingClientRect()
      targetX = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1))
      targetY = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1))
      isHovered = true
    }

    const onMouseLeave = () => {
      isHovered = false
      targetX = 0
      targetY = 0
    }

    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseleave', onMouseLeave)

    const render = () => {
      if (isVisible) {
        if (!isHovered) {
          idleTick += 0.02
          targetX = Math.sin(idleTick) * 0.25
          targetY = Math.cos(idleTick * 0.7) * 0.2
        }

        currentX += (targetX - currentX) * 0.08
        currentY += (targetY - currentY) * 0.08

        const rotX = 18 - currentY * 12
        const rotY = -14 + currentX * 14
        const liftTop = -28 - currentY * 24
        const liftMid1 = -16 - currentY * 14
        const liftMid2 = -8 - currentY * 8

        rig.style.setProperty('--rx', `${rotX.toFixed(2)}deg`)
        rig.style.setProperty('--ry', `${rotY.toFixed(2)}deg`)
        rig.style.setProperty('--lift-top', `${liftTop.toFixed(2)}px`)
        rig.style.setProperty('--lift-mid1', `${liftMid1.toFixed(2)}px`)
        rig.style.setProperty('--lift-mid2', `${liftMid2.toFixed(2)}px`)
      }
      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      observer.disconnect()
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="p-6 sm:p-8 flex flex-col justify-between group cursor-default transition-colors hover:bg-mauve-100/40 dark:hover:bg-mauve-900/50"
    >
      <div>
        <div className="flex items-center justify-between mb-6">
          <span className="font-mono text-[11px] uppercase tracking-wider text-mauve-700 dark:text-mauve-200">
            FIG 0.1
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mauve-100 dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 text-mauve-700 dark:text-mauve-200">
            SLAB STACK
          </span>
        </div>

        {/* 3D Wireframe Canvas */}
        <div className="relative w-full h-64 sm:h-72 flex items-center justify-center my-2 [perspective:1000px]">
          <div
            ref={rigRef}
            className="relative w-56 h-56 transition-transform duration-75 ease-out [transform-style:preserve-3d] [transform:rotateX(var(--rx,18deg))_rotateY(var(--ry,-14deg))] will-change-transform"
          >
            {/* Ground Plate */}
            <div className="absolute inset-0 [transform:translate3d(0,32px,-30px)] pointer-events-none">
              <svg viewBox="0 0 200 200" className="w-full h-full stroke-mauve-200 dark:stroke-mauve-800 fill-mauve-100/40 dark:fill-mauve-900/60" strokeWidth="1.2">
                <path d="M100 80 L165 115 L100 150 L35 115 Z" />
                <path d="M35 115 L100 150 L100 162 L35 127 Z" className="fill-mauve-200/50 dark:fill-mauve-950/80" />
                <path d="M100 150 L165 115 L165 127 L100 162 Z" className="fill-mauve-200/30 dark:fill-mauve-900/80" />
              </svg>
            </div>

            {/* Layer 3 - Telemetry Ingestion */}
            <div className="absolute inset-0 [transform:translate3d(0,var(--lift-mid2,-8px),-10px)] pointer-events-none">
              <svg viewBox="0 0 200 200" className="w-full h-full stroke-mauve-200 dark:stroke-mauve-800 fill-mauve-100/50 dark:fill-mauve-900/50" strokeWidth="1.2">
                <path d="M100 70 L160 105 L100 140 L40 105 Z" />
                <path d="M40 105 L100 140 L100 148 L40 113 Z" className="fill-mauve-200/60 dark:fill-mauve-950/70" />
                <path d="M100 140 L160 105 L160 113 L100 148 Z" className="fill-mauve-200/40 dark:fill-mauve-900/70" />
                <path d="M70 122 L100 105 L130 122" strokeDasharray="3 3" fill="none" className="stroke-mauve-700/40 dark:stroke-mauve-200/40" strokeWidth="0.9" />
              </svg>
            </div>

            {/* Layer 2 - Causal SHAP Attribution */}
            <div className="absolute inset-0 [transform:translate3d(0,var(--lift-mid1,-16px),15px)] pointer-events-none">
              <svg viewBox="0 0 200 200" className="w-full h-full stroke-mauve-700/60 dark:stroke-mauve-200/60 fill-mauve-100/60 dark:fill-mauve-900/60" strokeWidth="1.2">
                <path d="M100 60 L155 95 L100 130 L45 95 Z" />
                <path d="M45 95 L100 130 L100 137 L45 102 Z" className="fill-mauve-200/70 dark:fill-mauve-950/80" />
                <path d="M100 130 L155 95 L155 102 L100 137 Z" className="fill-mauve-200/50 dark:fill-mauve-900/80" />
              </svg>
            </div>

            {/* Top Slab - Agentic Action Dispatch */}
            <div className="absolute inset-0 [transform:translate3d(0,var(--lift-top,-28px),42px)] pointer-events-none">
              <svg viewBox="0 0 200 200" className="w-full h-full stroke-mauve-950 dark:stroke-mauve-50 fill-white dark:fill-mauve-900/90" strokeWidth="1.4">
                <path d="M100 50 L150 85 L100 120 L50 85 Z" />
                <path d="M50 85 L100 120 L100 128 L50 93 Z" className="fill-mauve-200 dark:fill-mauve-950" />
                <path d="M100 120 L150 85 L150 93 L100 128 Z" className="fill-mauve-100 dark:fill-mauve-800" />

                {/* Aperture Sensor */}
                <ellipse cx="100" cy="85" rx="24" ry="14" fill="none" className="stroke-mauve-700 dark:stroke-mauve-200" strokeWidth="1.2" />
                <line x1="80" y1="83" x2="120" y2="83" className="stroke-mauve-700/60 dark:stroke-mauve-200/60" strokeWidth="1" />
                <line x1="84" y1="87" x2="116" y2="87" className="stroke-mauve-700/60 dark:stroke-mauve-200/60" strokeWidth="1" />
                <circle cx="100" cy="85" r="2.5" className="fill-mauve-950 dark:fill-mauve-50" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-mauve-200/60 dark:border-mauve-800/60">
        <h3 className="text-sm font-semibold text-mauve-950 dark:text-mauve-50 tracking-tight">
          Layered Platform Architecture
        </h3>
        <p className="mt-1.5 text-xs text-mauve-700/80 dark:text-mauve-200/80 leading-relaxed">
          Slabs isolate continuous raw event streaming, Bayesian risk modeling, and playbook execution for 99.99% uptime.
        </p>
      </div>
    </div>
  )
}

/* ==========================================================================
   FIG 0.2 — MODULAR AGENT CLUSTER
   ========================================================================== */
function FigureTwo() {
  const containerRef = useRef(null)
  const rigRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    const rig = rigRef.current
    if (!el || !rig) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motionQuery.matches) {
      rig.style.setProperty('--rx', '16deg')
      rig.style.setProperty('--ry', '-14deg')
      rig.style.setProperty('--c1-y', '0px')
      rig.style.setProperty('--c2-y', '0px')
      rig.style.setProperty('--c3-y', '0px')
      rig.style.setProperty('--c4-y', '0px')
      return
    }

    let isVisible = false
    let isHovered = false
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let rafId = null
    let idleTick = 1.2

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting
    }, { threshold: 0.1 })
    observer.observe(el)

    const onMouseMove = (e) => {
      const rect = el.getBoundingClientRect()
      targetX = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1))
      targetY = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1))
      isHovered = true
    }

    const onMouseLeave = () => {
      isHovered = false
      targetX = 0
      targetY = 0
    }

    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseleave', onMouseLeave)

    const render = () => {
      if (isVisible) {
        if (!isHovered) {
          idleTick += 0.02
          targetX = Math.cos(idleTick * 0.9) * 0.22
          targetY = Math.sin(idleTick * 0.8) * 0.2
        }

        currentX += (targetX - currentX) * 0.08
        currentY += (targetY - currentY) * 0.08

        const rotX = 16 - currentY * 10
        const rotY = -14 + currentX * 12
        const c1y = currentY * -16
        const c2y = currentY * 14
        const c3y = currentY * -8
        const c4y = currentY * 18

        rig.style.setProperty('--rx', `${rotX.toFixed(2)}deg`)
        rig.style.setProperty('--ry', `${rotY.toFixed(2)}deg`)
        rig.style.setProperty('--c1-y', `${c1y.toFixed(2)}px`)
        rig.style.setProperty('--c2-y', `${c2y.toFixed(2)}px`)
        rig.style.setProperty('--c3-y', `${c3y.toFixed(2)}px`)
        rig.style.setProperty('--c4-y', `${c4y.toFixed(2)}px`)
      }
      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      observer.disconnect()
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="p-6 sm:p-8 flex flex-col justify-between group cursor-default transition-colors hover:bg-mauve-100/40 dark:hover:bg-mauve-900/50"
    >
      <div>
        <div className="flex items-center justify-between mb-6">
          <span className="font-mono text-[11px] uppercase tracking-wider text-mauve-700 dark:text-mauve-200">
            FIG 0.2
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mauve-100 dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 text-mauve-700 dark:text-mauve-200">
            AGENT CLUSTER
          </span>
        </div>

        {/* 3D Wireframe Canvas */}
        <div className="relative w-full h-64 sm:h-72 flex items-center justify-center my-2 [perspective:1000px]">
          <div
            ref={rigRef}
            className="relative w-56 h-56 transition-transform duration-75 ease-out [transform-style:preserve-3d] [transform:rotateX(var(--rx,16deg))_rotateY(var(--ry,-14deg))] will-change-transform"
          >
            {/* Cube 1: Top Rear (ML Model) */}
            <div className="absolute top-4 left-[74px] [transform:translate3d(0,var(--c1-y,0px),20px)] transition-transform duration-100 ease-out">
              <IsometricCube label="ML" active />
            </div>

            {/* Cube 2: Left Mid (API Gate) */}
            <div className="absolute top-[60px] left-[26px] [transform:translate3d(0,var(--c2-y,0px),-10px)] transition-transform duration-100 ease-out">
              <IsometricCube label="API" />
            </div>

            {/* Cube 3: Right Mid (XAI Engine) */}
            <div className="absolute top-[64px] left-[118px] [transform:translate3d(0,var(--c3-y,0px),0px)] transition-transform duration-100 ease-out">
              <IsometricCube label="XAI" />
            </div>

            {/* Cube 4: Bottom Front (Action Dispatcher) */}
            <div className="absolute top-[112px] left-[68px] [transform:translate3d(0,var(--c4-y,0px),35px)] transition-transform duration-100 ease-out">
              <IsometricCube label="ACT" active />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-mauve-200/60 dark:border-mauve-800/60">
        <h3 className="text-sm font-semibold text-mauve-950 dark:text-mauve-50 tracking-tight">
          Autonomous Agent Cluster
        </h3>
        <p className="mt-1.5 text-xs text-mauve-700/80 dark:text-mauve-200/80 leading-relaxed">
          Coordinated micro-agents continuously monitor seat decay, score churn probability, and stage multi-channel playbooks.
        </p>
      </div>
    </div>
  )
}

function IsometricCube({ label, active = false }) {
  return (
    <svg width="60" height="57" viewBox="0 0 100 95" className="overflow-visible">
      {/* Top Face */}
      <path
        d="M50 8 L92 32 L50 56 L8 32 Z"
        className={
          active
            ? 'fill-mauve-100 dark:fill-mauve-900 stroke-mauve-950 dark:stroke-mauve-50'
            : 'fill-white/80 dark:fill-mauve-950 stroke-mauve-200 dark:stroke-mauve-800'
        }
        strokeWidth="1.2"
      />
      {/* Left Face */}
      <path
        d="M8 32 L50 56 L50 88 L8 64 Z"
        className="fill-mauve-200/50 dark:fill-mauve-950/80 stroke-mauve-200 dark:stroke-mauve-800"
        strokeWidth="1.2"
      />
      {/* Right Face */}
      <path
        d="M50 56 L92 32 L92 64 L50 88 Z"
        className="fill-mauve-200/30 dark:fill-mauve-900/60 stroke-mauve-200 dark:stroke-mauve-800"
        strokeWidth="1.2"
      />
      {/* Label */}
      <text
        x="50"
        y="36"
        textAnchor="middle"
        fontSize="11"
        fontFamily="monospace"
        fontWeight="600"
        className={active ? 'fill-mauve-950 dark:fill-mauve-50' : 'fill-mauve-700 dark:text-mauve-200'}
      >
        {label}
      </text>
    </svg>
  )
}

/* ==========================================================================
   FIG 0.3 — STEPPED FIN / VELOCITY RACK
   ========================================================================== */
function FigureThree() {
  const containerRef = useRef(null)
  const rigRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    const rig = rigRef.current
    if (!el || !rig) return

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motionQuery.matches) {
      rig.style.setProperty('--rx', '18deg')
      rig.style.setProperty('--ry', '-12deg')
      rig.style.setProperty('--wave-y', '0px')
      return
    }

    let isVisible = false
    let isHovered = false
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let rafId = null
    let idleTick = 2.4

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting
    }, { threshold: 0.1 })
    observer.observe(el)

    const onMouseMove = (e) => {
      const rect = el.getBoundingClientRect()
      targetX = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1))
      targetY = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1))
      isHovered = true
    }

    const onMouseLeave = () => {
      isHovered = false
      targetX = 0
      targetY = 0
    }

    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseleave', onMouseLeave)

    const render = () => {
      if (isVisible) {
        if (!isHovered) {
          idleTick += 0.02
          targetX = Math.sin(idleTick * 0.7) * 0.2
          targetY = Math.cos(idleTick * 0.8) * 0.22
        }

        currentX += (targetX - currentX) * 0.08
        currentY += (targetY - currentY) * 0.08

        const rotX = 18 - currentY * 9
        const rotY = -12 + currentX * 11
        const wave = currentY * 14

        rig.style.setProperty('--rx', `${rotX.toFixed(2)}deg`)
        rig.style.setProperty('--ry', `${rotY.toFixed(2)}deg`)
        rig.style.setProperty('--wave-y', `${wave.toFixed(2)}px`)
      }
      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      observer.disconnect()
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="p-6 sm:p-8 flex flex-col justify-between group cursor-default transition-colors hover:bg-mauve-100/40 dark:hover:bg-mauve-900/50"
    >
      <div>
        <div className="flex items-center justify-between mb-6">
          <span className="font-mono text-[11px] uppercase tracking-wider text-mauve-700 dark:text-mauve-200">
            FIG 0.3
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mauve-100 dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 text-mauve-700 dark:text-mauve-200">
            VELOCITY RACK
          </span>
        </div>

        {/* 3D Wireframe Canvas */}
        <div className="relative w-full h-64 sm:h-72 flex items-center justify-center my-2 [perspective:1000px]">
          <div
            ref={rigRef}
            className="relative w-56 h-56 transition-transform duration-75 ease-out flex items-center justify-center [transform-style:preserve-3d] [transform:rotateX(var(--rx,18deg))_rotateY(var(--ry,-12deg))] will-change-transform"
          >
            <svg viewBox="0 0 200 200" className="w-56 h-56 overflow-visible">
              {/* Rack Base Track */}
              <path
                d="M30 145 L110 95 L170 130 L90 180 Z"
                className="fill-mauve-100/40 dark:fill-mauve-900/40 stroke-mauve-200 dark:stroke-mauve-800"
                strokeWidth="1"
              />

              {/* Stepped Fins with Ripple Parallax */}
              <FinGroup index={0} height={30} posX={42} posY={138} />
              <FinGroup index={1} height={37} posX={53} posY={131.5} />
              <FinGroup index={2} height={44} posX={64} posY={125} />
              <FinGroup index={3} height={51} posX={75} posY={118.5} />
              <FinGroup index={4} height={58} posX={86} posY={112} />
              <FinGroup index={5} height={65} posX={97} posY={105.5} />
              <FinGroup index={6} height={72} posX={108} posY={99} />
              <FinGroup index={7} height={79} posX={119} posY={92.5} />
              <FinGroup index={8} height={86} posX={130} posY={86} />
              <FinGroup index={9} height={93} posX={141} posY={79.5} isTallest />
            </svg>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-mauve-200/60 dark:border-mauve-800/60">
        <h3 className="text-sm font-semibold text-mauve-950 dark:text-mauve-50 tracking-tight">
          Sub-50ms Inference Velocity
        </h3>
        <p className="mt-1.5 text-xs text-mauve-700/80 dark:text-mauve-200/80 leading-relaxed">
          Parallel pipeline stages process incoming telemetry in real-time, delivering risk signals to CSMs in under 50ms.
        </p>
      </div>
    </div>
  )
}

function FinGroup({ height, posX, posY, isTallest = false }) {
  const topY = posY - height

  return (
    <g className="[transform-origin:center]">
      {/* Left Fin Face */}
      <polygon
        points={`${posX},${posY} ${posX},${topY} ${posX + 7},${topY - 4} ${posX + 7},${posY - 4}`}
        className="fill-mauve-200/70 dark:fill-mauve-950/90 stroke-mauve-200 dark:stroke-mauve-800"
        strokeWidth="0.8"
      />
      {/* Right Fin Face */}
      <polygon
        points={`${posX + 7},${posY - 4} ${posX + 7},${topY - 4} ${posX + 35},${topY + 12} ${posX + 35},${posY + 12}`}
        className={
          isTallest
            ? 'fill-mauve-200 dark:fill-mauve-800 stroke-mauve-950 dark:stroke-mauve-50'
            : 'fill-mauve-100/60 dark:fill-mauve-900/60 stroke-mauve-200 dark:stroke-mauve-800'
        }
        strokeWidth={isTallest ? '1.2' : '0.8'}
      />
      {/* Top Cap */}
      <polygon
        points={`${posX},${topY} ${posX + 7},${topY - 4} ${posX + 35},${topY + 12} ${posX + 28},${topY + 16}`}
        className={
          isTallest
            ? 'fill-mauve-50 dark:fill-mauve-700 stroke-mauve-950 dark:stroke-mauve-50'
            : 'fill-white dark:fill-mauve-900 stroke-mauve-200 dark:stroke-mauve-800'
        }
        strokeWidth="0.8"
      />
    </g>
  )
}
