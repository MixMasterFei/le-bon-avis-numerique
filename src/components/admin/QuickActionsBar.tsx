"use client"

import { useState } from "react"
import { Search, Film, Tv, Gamepad2 } from "lucide-react"
import { QuickImportModal } from "./QuickImportModal"
import { AdminBtn } from "./shared/admin-ui"

interface QuickActionsBarProps {
  onImportComplete?: () => void
  embedded?: boolean
  requestOpen?: boolean
  onOpenHandled?: () => void
}

export function QuickActionsBar({
  onImportComplete,
  embedded,
  requestOpen,
  onOpenHandled,
}: QuickActionsBarProps) {
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedType, setSelectedType] = useState<"MOVIE" | "TV" | "GAME" | null>(null)

  const handleOpenModal = (type: "MOVIE" | "TV" | "GAME" | null = null) => {
    setSelectedType(type)
    setShowImportModal(true)
  }

  const handleClose = () => {
    setShowImportModal(false)
    setSelectedType(null)
    if (requestOpen) onOpenHandled?.()
  }

  const modalOpen = showImportModal || !!requestOpen

  return (
    <>
      <div className={embedded ? "mb-4" : "mb-6"}>
        {!embedded && (
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Actions rapides</h2>
        )}
        <div className="flex flex-wrap gap-2">
          <AdminBtn variant="primary" onClick={() => handleOpenModal()}>
            <Search className="h-4 w-4" />
            Rechercher &amp; ajouter
          </AdminBtn>
          <AdminBtn size="sm" onClick={() => handleOpenModal("MOVIE")}>
            <Film className="h-4 w-4" /> Film
          </AdminBtn>
          <AdminBtn size="sm" onClick={() => handleOpenModal("TV")}>
            <Tv className="h-4 w-4" /> Série
          </AdminBtn>
          <AdminBtn size="sm" onClick={() => handleOpenModal("GAME")}>
            <Gamepad2 className="h-4 w-4" /> Jeu
          </AdminBtn>
        </div>
      </div>

      <QuickImportModal
        open={modalOpen}
        onClose={handleClose}
        defaultType={selectedType}
        onImportComplete={onImportComplete}
      />
    </>
  )
}
