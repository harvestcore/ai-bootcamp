import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type RefObject,
} from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Button } from './ui'
import {
  compartmentCount,
  compartmentPosition,
  getCompartmentInfo,
  type InventorySnapshot,
} from '../lib/inventory'
import type { DrawerUnit, PieceColor } from '../types'

/**
 * One drawer unit as the physical cabinet it is, instead of a flat grid: the
 * same compartment states `CompartmentGrid` draws, rendered as an open-fronted
 * box you can turn around.
 *
 * This is the only module in the app that imports `three`, and it is loaded
 * lazily by `DrawerUnit3DPane` so the grid view never downloads it.
 *
 * Everything it knows about the inventory comes from `getCompartmentInfo`, the
 * very same call the grid makes, so the two views cannot disagree.
 */

/** One compartment, in world units. Everything else is expressed in these. */
const CELL = 1
/** Shell, divider and outline thickness. */
const WALL = 0.07
/** How deep a compartment is, front to back. */
const DEPTH = 0.85
const FOV = 45
/** A press that travelled further than this was a camera drag, not a click. */
const DRAG_THRESHOLD_PX = 6

/**
 * The scene's colors are the app's design tokens read off `:root`, not new
 * hexes — that is what keeps an empty compartment the same shade of beige (or,
 * in dark mode, the same near-black) it has in the grid.
 */
interface ScenePalette {
  cellEmpty: string
  cellFilled: string
  cellLine: string
  brand: string
  surface: string
  ink: string
  /** Stand-in for a custom "Other…" color, which has no rgb to draw. */
  neutral: string
}

function readPalette(): ScenePalette {
  const style = getComputedStyle(document.documentElement)
  const token = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback
  return {
    cellEmpty: token('--cell-empty', '#efece6'),
    cellFilled: token('--cell-filled', '#fdf1d6'),
    cellLine: token('--cell-line', '#dfd8cc'),
    brand: token('--brand', '#f3b229'),
    surface: token('--surface', '#ffffff'),
    ink: token('--ink', '#1d2330'),
    neutral: token('--ink-muted', '#6b7384'),
  }
}

/** The color a piece's body is drawn in — never a guess for a custom color. */
function bodyColor(color: PieceColor, palette: ScenePalette): string {
  return color.source === 'palette' ? color.rgb : palette.neutral
}

/**
 * The "marked full" hatching, as a texture instead of the CSS
 * `repeating-linear-gradient` the grid uses — same 45° stripes, generated in a
 * 2D canvas so no texture file (and no new dependency) is needed.
 */
function createStripeTexture(ink: string, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.strokeStyle = ink
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 7
    for (let offset = -size; offset < size * 2; offset += 20) {
      ctx.beginPath()
      ctx.moveTo(offset, 0)
      ctx.lineTo(offset + size, size)
      ctx.stroke()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  return texture
}

export function DrawerUnit3D({
  unit,
  snapshot,
  selectedIndex,
  onSelect,
  onContextLost,
}: {
  unit: DrawerUnit
  snapshot: InventorySnapshot
  selectedIndex: number | null
  onSelect: (index: number) => void
  /** The GPU dropped the context: the pane swaps itself for the error message. */
  onContextLost: () => void
}) {
  // Read once, at mount: dark mode has already redefined the variables by then.
  const [palette] = useState(readPalette)
  // Hover is a pointer-device affordance; a tap must not leave a label stuck on.
  const [hoverCapable] = useState(() => window.matchMedia('(hover: hover)').matches)
  const [hovered, setHovered] = useState<number | null>(null)

  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const pressedAt = useRef<{ x: number; y: number } | null>(null)
  // Filled in by DefaultPose, inside the canvas, where the camera lives.
  const resetPose = useRef<(() => void) | null>(null)

  const indexes = Array.from({ length: compartmentCount(unit) }, (_, index) => index)

  // The camera pose comes from the unit's own size, so a 1x1 and a 10x10 are
  // both fully in frame on first render: far enough back for the taller of the
  // two dimensions to fit the vertical field of view, plus a small margin.
  const half = Math.max(unit.cols * CELL, unit.rows * CELL) / 2 + DEPTH / 2
  const radius = Math.hypot(unit.cols * CELL, unit.rows * CELL) / 2 + DEPTH
  const distance = (half / Math.tan((FOV / 2) * (Math.PI / 180))) * 1.08
  const pose = useMemo<[number, number, number]>(() => {
    const azimuth = 0.42
    const elevation = 0.36
    return [
      distance * Math.cos(elevation) * Math.sin(azimuth),
      distance * Math.sin(elevation),
      distance * Math.cos(elevation) * Math.cos(azimuth),
    ]
  }, [distance])

  // One texture per partition count so the stripes stay square-ish whatever the
  // height of the band they cover.
  const stripes = useMemo(() => {
    const inner = CELL - WALL
    return [1, 2, 3].map((count) =>
      createStripeTexture(palette.ink, inner / 0.3, inner / count / 0.3),
    )
  }, [palette.ink])
  useEffect(() => () => stripes.forEach((texture) => texture.dispose()), [stripes])

  const hoveredInfo =
    hovered != null ? getCompartmentInfo(snapshot, unit.id, hovered) : null

  return (
    <div
      className="relative h-full w-full"
      // Recorded here rather than on each mesh: the press may well start on one
      // compartment and end on another, and it is the distance that decides.
      onPointerDown={(event) => {
        pressedAt.current = { x: event.clientX, y: event.clientY }
      }}
      onPointerLeave={() => setHovered(null)}
    >
      <Canvas
        camera={{ position: pose, fov: FOV, near: 0.1, far: radius * 40 }}
        dpr={[1, 2]}
        // `flat` turns off the default ACES tone mapping: it would repaint every
        // token — brand amber included — as a different colour than the grid's.
        flat
      >
        <color attach="background" args={[palette.surface]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[radius, radius * 1.6, radius * 1.8]} intensity={0.55} />

        <Shell unit={unit} palette={palette} />
        {indexes.map((index) => (
          <Compartment3D
            key={index}
            unit={unit}
            index={index}
            snapshot={snapshot}
            palette={palette}
            stripes={stripes}
            selected={selectedIndex === index}
            hovered={hovered === index}
            onHover={hoverCapable ? setHovered : null}
            onSelect={onSelect}
            pressedAt={pressedAt}
          />
        ))}

        <OrbitControls
          ref={controls}
          enablePan={false}
          minDistance={radius * 1.1}
          maxDistance={distance * 2.5}
          // Stops the camera short of straight-down, and of dipping under the
          // unit's floor plane.
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2}
        />
        <DefaultPose position={pose} controls={controls} apply={resetPose} />
        <ContextLossWatcher onLost={onContextLost} />
      </Canvas>

      <div className="absolute top-2 right-2">
        <Button
          size="sm"
          className="min-h-11 border border-line bg-surface/90"
          onClick={() => resetPose.current?.()}
        >
          Reset view
        </Button>
      </div>

      {hoveredInfo ? (
        <div className="pointer-events-none absolute top-2 left-2 max-w-[60%] rounded-xl border border-line bg-surface/95 px-3 py-2 text-xs text-ink shadow-sm">
          <div className="font-semibold">Compartment {(hovered ?? 0) + 1}</div>
          {hoveredInfo.occupants.length === 0 ? (
            <div className="text-ink-muted">empty</div>
          ) : (
            hoveredInfo.occupants.map((occupant) => (
              <div key={occupant.id} className="text-ink-muted">
                {occupant.description} · {occupant.color.name} · {occupant.quantity}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

/**
 * The cabinet itself: back panel, outer walls and the internal dividers between
 * compartments. Built out of plates rather than a hollowed box, so every
 * compartment really is open-fronted.
 */
function Shell({ unit, palette }: { unit: DrawerUnit; palette: ScenePalette }) {
  const width = unit.cols * CELL
  const height = unit.rows * CELL
  const columnLines = Array.from({ length: unit.cols - 1 }, (_, i) => i + 1)
  const rowLines = Array.from({ length: unit.rows - 1 }, (_, i) => i + 1)

  return (
    <group>
      <mesh position={[0, 0, -DEPTH / 2]}>
        <boxGeometry args={[width, height, WALL]} />
        <meshStandardMaterial color={palette.cellLine} roughness={0.85} />
      </mesh>
      {[height / 2, -height / 2].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[width, WALL, DEPTH]} />
          <meshStandardMaterial color={palette.cellLine} roughness={0.85} />
        </mesh>
      ))}
      {[width / 2, -width / 2].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[WALL, height, DEPTH]} />
          <meshStandardMaterial color={palette.cellLine} roughness={0.85} />
        </mesh>
      ))}
      {columnLines.map((line) => (
        <mesh key={`c${line}`} position={[-width / 2 + line * CELL, 0, 0]}>
          <boxGeometry args={[WALL, height, DEPTH]} />
          <meshStandardMaterial color={palette.cellLine} roughness={0.85} />
        </mesh>
      ))}
      {rowLines.map((line) => (
        <mesh key={`r${line}`} position={[0, height / 2 - line * CELL, 0]}>
          <boxGeometry args={[width, WALL, DEPTH]} />
          <meshStandardMaterial color={palette.cellLine} roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * One compartment: its interior, one band per partition (top band is partition
 * 0, as in the grid), a body per occupant, the "full" stripes, and the click
 * target that covers the whole opening so an empty compartment is selectable too.
 */
function Compartment3D({
  unit,
  index,
  snapshot,
  palette,
  stripes,
  selected,
  hovered,
  onHover,
  onSelect,
  pressedAt,
}: {
  unit: DrawerUnit
  index: number
  snapshot: InventorySnapshot
  palette: ScenePalette
  stripes: THREE.CanvasTexture[]
  selected: boolean
  hovered: boolean
  onHover: ((index: number | null) => void) | null
  onSelect: (index: number) => void
  pressedAt: RefObject<{ x: number; y: number } | null>
}) {
  const { occupants, record } = getCompartmentInfo(snapshot, unit.id, index)
  const { row, col } = compartmentPosition(unit, index)

  const inner = CELL - WALL
  const cx = (col - (unit.cols - 1) / 2) * CELL
  const cy = ((unit.rows - 1) / 2 - row) * CELL
  const partitions = Array.from({ length: record.partitionCount }, (_, i) => i)
  const bandHeight = inner / record.partitionCount
  const bandCenter = (i: number) => cy + inner / 2 - bandHeight * (i + 0.5)
  const stripe = stripes[Math.min(record.partitionCount, stripes.length) - 1]

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    const start = pressedAt.current
    pressedAt.current = null
    if (!start) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG_THRESHOLD_PX) return
    onSelect(index)
  }

  return (
    <group>
      {partitions.map((partitionIndex) => {
        const occupant = occupants.find((o) => o.partitionIndex === partitionIndex)
        const y = bandCenter(partitionIndex)
        return (
          <group key={partitionIndex}>
            <mesh position={[cx, y, -DEPTH / 2 + WALL]}>
              <boxGeometry args={[inner, bandHeight, WALL * 0.6]} />
              <meshStandardMaterial
                color={occupant ? palette.cellFilled : palette.cellEmpty}
                roughness={0.9}
              />
            </mesh>
            {occupant ? (
              <mesh position={[cx, y, -WALL * 0.5]}>
                <boxGeometry
                  args={[inner * 0.7, bandHeight * 0.55, (DEPTH - WALL) * 0.6]}
                />
                <meshStandardMaterial
                  color={bodyColor(occupant.color, palette)}
                  roughness={occupant.color.source === 'palette' ? 0.45 : 0.95}
                  flatShading={occupant.color.source === 'other'}
                />
              </mesh>
            ) : null}
            {record.partitionsFull[partitionIndex] && stripe ? (
              <mesh position={[cx, y, DEPTH / 2 - WALL * 0.4]}>
                <planeGeometry args={[inner, bandHeight]} />
                <meshBasicMaterial map={stripe} transparent depthWrite={false} />
              </mesh>
            ) : null}
            {partitionIndex > 0 ? (
              <mesh position={[cx, cy + inner / 2 - bandHeight * partitionIndex, 0]}>
                <boxGeometry args={[inner, WALL * 0.7, DEPTH - WALL]} />
                <meshStandardMaterial color={palette.cellLine} roughness={0.85} />
              </mesh>
            ) : null}
          </group>
        )
      })}

      {/* The whole opening is one click/hover target, so an empty compartment
          picks up the pointer just as well as an occupied one. */}
      <mesh
        position={[cx, cy, 0]}
        onClick={handleClick}
        onPointerOver={onHover ? () => onHover(index) : undefined}
        onPointerOut={onHover ? () => onHover(null) : undefined}
      >
        <boxGeometry args={[inner, inner, DEPTH - WALL]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {selected || hovered ? (
        <Outline
          x={cx}
          y={cy}
          size={inner}
          color={palette.brand}
          opacity={selected ? 1 : 0.45}
        />
      ) : null}

      {/* Numbered like every grid cell — in HTML rather than 3D text, so no font
          has to be downloaded. */}
      <Html
        position={[cx + inner / 2 - 0.14, cy - inner / 2 + 0.12, DEPTH / 2]}
        center
        // Scales with the camera distance, so the number keeps the same
        // proportion to its compartment on a 1x1 and on a 10x10.
        distanceFactor={8}
        style={{
          pointerEvents: 'none',
          color: palette.ink,
          opacity: 0.55,
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        {index + 1}
      </Html>
    </group>
  )
}

/** A frame of four bars around a compartment's opening: the 3D `ring-2 ring-brand`. */
function Outline({
  x,
  y,
  size,
  color,
  opacity,
}: {
  x: number
  y: number
  size: number
  color: string
  opacity: number
}) {
  const bar = WALL * 0.7
  const material = (
    <meshStandardMaterial color={color} roughness={0.5} transparent opacity={opacity} />
  )
  return (
    <group position={[x, y, DEPTH / 2 + bar / 2]}>
      {[size / 2, -size / 2].map((offset) => (
        <mesh key={`h${offset}`} position={[0, offset, 0]}>
          <boxGeometry args={[size + bar, bar, bar]} />
          {material}
        </mesh>
      ))}
      {[size / 2, -size / 2].map((offset) => (
        <mesh key={`v${offset}`} position={[offset, 0, 0]}>
          <boxGeometry args={[bar, size + bar, bar]} />
          {material}
        </mesh>
      ))}
    </group>
  )
}

/**
 * Puts the camera in the default pose, on mount and whenever the unit is
 * resized (the `Canvas` camera prop is only read once), and hands the same
 * function back through `apply` so `Reset view` reproduces exactly that pose —
 * `OrbitControls.reset()` restores its own saved state, which is not quite the
 * same thing.
 */
function DefaultPose({
  position,
  controls,
  apply,
}: {
  position: [number, number, number]
  controls: RefObject<ComponentRef<typeof OrbitControls> | null>
  apply: RefObject<(() => void) | null>
}) {
  const camera = useThree((state) => state.camera)

  const applyPose = useCallback(() => {
    camera.position.set(position[0], position[1], position[2])
    camera.lookAt(0, 0, 0)
    const orbit = controls.current
    if (orbit) {
      orbit.target.set(0, 0, 0)
      orbit.update()
    }
  }, [camera, controls, position])

  useEffect(() => {
    apply.current = applyPose
    applyPose()
    return () => {
      apply.current = null
    }
  }, [apply, applyPose])

  return null
}

/** A lost context is reported up rather than left as a frozen black canvas. */
function ContextLossWatcher({ onLost }: { onLost: () => void }) {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [gl, onLost])

  return null
}
