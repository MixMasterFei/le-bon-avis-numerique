"use client"

import { useState } from "react"
import { Search, Film, Tv, Gamepad2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuickImportModal } from "./QuickImportModal"

interface QuickActionsBarProps {
  onImportComplete?: () => void
  /** Hide section title when nested inside AdminSectionCard */
  embedded?: boolean
  /** Parent can request the search modal to open (e.g. from shortcut bar) */
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
          <Button
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Search className="h-4 w-4 mr-2" />
            Rechercher & Ajouter
          </Button>

          <div className="flex gap-2 ml-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenModal("MOVIE")}
            >
              <Film className="h-4 w-4 mr-1" />
              Film
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenModal("TV")}
            >
              <Tv className="h-4 w-4 mr-1" />
              Série
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenModal("GAME")}
            >
              <Gamepad2 className="h-4 w-4 mr-1" />
              Jeu
            </Button>
          </div>
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
