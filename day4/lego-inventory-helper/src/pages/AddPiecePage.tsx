import { useNavigate, useSearchParams } from 'react-router-dom'
import { AddPieceWizard } from '../components/AddPieceWizard'
import { Button, EmptyState } from '../components/ui'
import { useInventory } from '../hooks/useInventory'

/**
 * The `/add` route: a thin wrapper around `AddPieceWizard`, which is the whole
 * flow and is shared with the modal `DrawerUnitPage` opens over a compartment.
 * This file owns only what belongs to *being a page*: the `unit`/`compartment`
 * query params, the "no drawer unit yet" empty state, and turning the wizard's
 * two exits into navigation.
 */
export function AddPiecePage() {
  const snapshot = useInventory()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // Opened from a compartment's own "Add a piece here" link: the location is
  // already decided, so the location step is skipped entirely.
  const presetUnit = params.get('unit')
  const presetCompartment = params.get('compartment')
  const openedFrom =
    presetUnit && presetCompartment != null
      ? { unitId: presetUnit, compartmentIndex: Number(presetCompartment) }
      : null

  if (snapshot.units.length === 0) {
    return (
      <EmptyState icon="🗄️" title="Set up a drawer unit first">
        <p className="max-w-sm text-sm text-ink-muted">
          There's nowhere to put a piece yet. Create at least one drawer unit and come back.
        </p>
        <Button variant="primary" onClick={() => navigate('/setup')}>
          Go to drawer setup
        </Button>
      </EmptyState>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <AddPieceWizard
        openedFrom={openedFrom}
        onRequestClose={(addedCount) => (addedCount > 0 ? navigate('/') : navigate(-1))}
        onGoToCompartment={(unitId, compartmentIndex) =>
          navigate(`/unit/${unitId}/compartment/${compartmentIndex}`)
        }
      />
    </div>
  )
}
