"use client"

import { useState } from "react"
import { X, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface InterestsEditorProps {
  interests: string[]
  onChange: (interests: string[]) => void
  memberName: string
  className?: string
}

const SUGGESTED_INTERESTS = [
  "Dinosaures", "Espace", "Princesses", "Pirates", "Animaux",
  "Voitures", "Football", "Danse", "Musique", "Dessin",
  "Super-héros", "Robots", "Nature", "Cuisine", "Magie",
  "Chevaux", "Trains", "Océan", "Construction", "Lecture",
]

export function InterestsEditor({ interests, onChange, memberName, className }: InterestsEditorProps) {
  const [inputValue, setInputValue] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)

  const handleAdd = (interest: string) => {
    const trimmed = interest.trim()
    if (trimmed && !interests.includes(trimmed) && interests.length < 20) {
      onChange([...interests, trimmed])
    }
    setInputValue("")
    setShowSuggestions(false)
  }

  const handleRemove = (interest: string) => {
    onChange(interests.filter((i) => i !== interest))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (inputValue.trim()) handleAdd(inputValue)
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
    }
  }

  const filteredSuggestions = SUGGESTED_INTERESTS.filter(
    (s) => !interests.includes(s) && s.toLowerCase().includes(inputValue.toLowerCase())
  )

  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected interests */}
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {interests.map((interest) => (
          <span
            key={interest}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-100 text-violet-800 text-sm rounded-full"
          >
            {interest}
            <button
              onClick={() => handleRemove(interest)}
              className="hover:bg-violet-200 rounded-full p-0.5"
              aria-label={`Retirer ${interest}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Input with suggestions */}
      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={`Qu'est-ce que ${memberName} aime ?`}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            disabled={interests.length >= 20}
          />
          <button
            onClick={() => inputValue.trim() && handleAdd(inputValue)}
            disabled={!inputValue.trim() || interests.length >= 20}
            className="px-3 py-2 bg-violet-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredSuggestions.slice(0, 8).map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleAdd(suggestion)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick add buttons when empty */}
      {interests.length === 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Suggestions :</p>
          <div className="flex flex-wrap gap-1">
            {SUGGESTED_INTERESTS.slice(0, 8).map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleAdd(suggestion)}
                className="px-2 py-0.5 text-xs border border-violet-200 text-violet-600 rounded-full hover:bg-violet-50"
              >
                + {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {interests.length >= 20 && (
        <p className="text-xs text-gray-400">Maximum de 20 centres d&apos;intérêt atteint.</p>
      )}
    </div>
  )
}
