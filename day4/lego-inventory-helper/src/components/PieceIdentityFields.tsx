import { useEffect } from 'react'
import { ColorPicker } from './ColorPicker'
import { PartSearch } from './PartSearch'
import { Field, TextInput } from './ui'
import { useAvailableColors, useCatalogPart } from '../hooks/useCatalog'
import type { PieceColor } from '../types'

/**
 * The "what piece is this" half of both the Add and the Edit form: catalog
 * search, the part number itself, the name it resolves to, and the color.
 *
 * The part number is mandatory and there is no free-text description — the
 * display name always comes from the catalog (see CLAUDE.md, "Deviations from
 * the written spec"). Colors are narrowed to the ones that part exists in.
 */
export function PieceIdentityFields({
  partNumber,
  onPartNumberChange,
  color,
  onColorChange,
}: {
  partNumber: string
  onPartNumberChange: (value: string) => void
  color: PieceColor | null
  onColorChange: (color: PieceColor | null) => void
}) {
  const { part, loading } = useCatalogPart(partNumber)
  const colors = useAvailableColors(partNumber)

  // Changing the part number can invalidate the chosen color: keeping a color
  // this part never comes in would be a silent lie about what's in the drawer.
  useEffect(() => {
    if (!colors.length || color?.source !== 'palette') return
    if (!colors.some((c) => c.id === color.id)) onColorChange(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onColorChange is a render-time callback
  }, [colors, color])

  return (
    <>
      <Field label="Find the piece in the catalog" hint="Optional — fills the part number for you.">
        <PartSearch onSelect={(found) => onPartNumberChange(found.part_num)} />
      </Field>

      <Field label="LEGO part number" required>
        <TextInput
          value={partNumber}
          onChange={(e) => onPartNumberChange(e.target.value)}
          placeholder="e.g. 3001"
          inputMode="text"
          autoComplete="off"
        />
      </Field>

      <div className="rounded-xl border border-line bg-sunken px-3 py-2.5">
        <span className="block text-xs font-medium tracking-wide text-ink-muted uppercase">Piece</span>
        <PieceName partNumber={partNumber} name={part?.name ?? null} loading={loading} />
      </div>

      <Field
        label="Color"
        required
        hint={
          colors.length
            ? 'Only the colors this part is known to exist in are listed.'
            : undefined
        }
      >
        <ColorPicker colors={colors} value={color} onChange={onColorChange} />
      </Field>
    </>
  )
}

function PieceName({
  partNumber,
  name,
  loading,
}: {
  partNumber: string
  name: string | null
  loading: boolean
}) {
  if (!partNumber.trim()) {
    return <span className="text-sm text-ink-muted">Enter or search for a part number above.</span>
  }
  if (loading) return <span className="text-sm text-ink-muted">Looking it up…</span>
  if (name) return <span className="text-sm font-medium text-ink">{name}</span>
  return (
    <span className="text-sm text-warning">
      Not in the catalog — it will be labeled “Part #{partNumber.trim()}”.
    </span>
  )
}
