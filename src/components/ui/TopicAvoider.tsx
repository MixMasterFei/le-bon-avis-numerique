"use client"

import { useState } from "react"
import { X, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface TopicAvoiderProps {
  label?: string
  topics: string[]
  onChange: (topics: string[]) => void
  suggestedTopics?: string[]
  placeholder?: string
  className?: string
}

const DEFAULT_SUGGESTED_TOPICS = [
  "Guerre",
  "Mort",
  "Divorce",
  "Maladie",
  "Abandon",
  "Cruauté animale",
  "Clowns",
  "Zombies",
  "Fantômes",
  "Araignées",
  "Violence familiale",
  "Deuil",
  "Harcèlement",
  "Catastrophes",
]

export function TopicAvoider({
  label = "Thèmes à éviter",
  topics,
  onChange,
  suggestedTopics = DEFAULT_SUGGESTED_TOPICS,
  placeholder = "Ajouter un thème...",
  className,
}: TopicAvoiderProps) {
  const [inputValue, setInputValue] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)

  const handleAddTopic = (topic: string) => {
    const trimmed = topic.trim()
    if (trimmed && !topics.includes(trimmed)) {
      onChange([...topics, trimmed])
    }
    setInputValue("")
    setShowSuggestions(false)
  }

  const handleRemoveTopic = (topic: string) => {
    onChange(topics.filter(t => t !== topic))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (inputValue.trim()) {
        handleAddTopic(inputValue)
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
    }
  }

  // Filter suggestions based on input and already selected topics
  const filteredSuggestions = suggestedTopics.filter(
    t => !topics.includes(t) && t.toLowerCase().includes(inputValue.toLowerCase())
  )

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="block text-sm font-medium">{label}</label>}

      {/* Selected topics */}
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {topics.map(topic => (
          <span
            key={topic}
            className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-sm rounded-full"
          >
            {topic}
            <button
              onClick={() => handleRemoveTopic(topic)}
              className="hover:bg-red-200 rounded-full p-0.5"
              aria-label={`Retirer ${topic}`}
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
            placeholder={placeholder}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <button
            onClick={() => inputValue.trim() && handleAddTopic(inputValue)}
            disabled={!inputValue.trim()}
            className="px-3 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredSuggestions.slice(0, 8).map(topic => (
              <button
                key={topic}
                onClick={() => handleAddTopic(topic)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
              >
                {topic}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick add buttons for common topics */}
      {topics.length === 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Suggestions rapides :</p>
          <div className="flex flex-wrap gap-1">
            {suggestedTopics.slice(0, 6).map(topic => (
              <button
                key={topic}
                onClick={() => handleAddTopic(topic)}
                className="px-2 py-0.5 text-xs border border-gray-300 rounded-full hover:bg-gray-100"
              >
                + {topic}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
