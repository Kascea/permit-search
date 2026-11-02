import { Modal, ModalCloseButton, modalPanelClass } from '#/components/Modal'
import { PermitSearchForm } from '#/components/PermitSearchForm'
import type { City } from '#/lib/location/types'

interface SearchModalProps {
  isOpen: boolean
  initialCity?: City
  initialPermit?: string
  onClose: () => void
  onSearch: (city: City, permit: string) => void
}

// The home page's search form in a modal, for searching again from results.
export function SearchModal({
  isOpen,
  initialCity,
  initialPermit,
  onClose,
  onSearch,
}: SearchModalProps) {
  return (
    <Modal isOpen={isOpen} label="New search" onClose={onClose}>
      <PermitSearchForm
        title="New search"
        className={modalPanelClass}
        initialCity={initialCity}
        initialPermit={initialPermit}
        onSearch={onSearch}
        headerAction={<ModalCloseButton onClick={onClose} />}
      />
    </Modal>
  )
}
