"use client"

import { useState, useRef, useCallback } from "react"
import { Bold, Italic, Smile } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// Common emojis for reviews
const emojiCategories = {
  "Réactions": ["👍", "👎", "❤️", "😊", "😢", "😱", "🤔", "👏"],
  "Famille": ["👨‍👩‍👧‍👦", "👪", "👧", "👦", "🧒", "👶", "🎬", "📺"],
  "Évaluations": ["⭐", "✅", "❌", "⚠️", "🔞", "👀", "💯", "🎯"],
}

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  maxLength?: number
  className?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Votre commentaire...",
  rows = 4,
  maxLength = 2000,
  className,
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)

  // Get selection range
  const getSelection = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return { start: 0, end: 0 }
    return {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    }
  }, [])

  // Insert text at cursor or wrap selection
  const insertText = useCallback((before: string, after: string = "") => {
    const textarea = textareaRef.current
    if (!textarea) return

    const { start, end } = getSelection()
    const selectedText = value.substring(start, end)
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end)

    onChange(newText)

    // Restore cursor position after state update
    setTimeout(() => {
      textarea.focus()
      const newPosition = start + before.length + selectedText.length + after.length
      textarea.setSelectionRange(
        selectedText ? newPosition : start + before.length,
        selectedText ? newPosition : start + before.length
      )
    }, 0)
  }, [value, onChange, getSelection])

  // Format helpers
  const applyBold = () => {
    const { start, end } = getSelection()
    const selectedText = value.substring(start, end)

    if (selectedText) {
      insertText("**", "**")
    } else {
      insertText("**texte en gras**")
    }
  }

  const applyItalic = () => {
    const { start, end } = getSelection()
    const selectedText = value.substring(start, end)

    if (selectedText) {
      insertText("*", "*")
    } else {
      insertText("*texte en italique*")
    }
  }

  const insertEmoji = (emoji: string) => {
    insertText(emoji)
    setEmojiOpen(false)
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-1 bg-gray-50 rounded-lg border">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={applyBold}
          className="h-8 w-8 p-0"
          title="Gras (sélectionnez du texte)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={applyItalic}
          className="h-8 w-8 p-0"
          title="Italique (sélectionnez du texte)"
        >
          <Italic className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Insérer un emoji"
            >
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="space-y-3">
              {Object.entries(emojiCategories).map(([category, emojis]) => (
                <div key={category}>
                  <p className="text-xs font-medium text-gray-500 mb-1">{category}</p>
                  <div className="flex flex-wrap gap-1">
                    {emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className="w-8 h-8 text-lg hover:bg-gray-100 rounded transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {maxLength && (
          <span className={cn(
            "text-xs pr-2",
            value.length > maxLength * 0.9 ? "text-orange-500" : "text-gray-400",
            value.length > maxLength ? "text-red-500" : ""
          )}>
            {value.length}/{maxLength}
          </span>
        )}
      </div>

      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        rows={rows}
        className="resize-none"
      />

      {/* Help text */}
      <p className="text-xs text-gray-400">
        Utilisez **texte** pour le gras et *texte* pour l&apos;italique
      </p>
    </div>
  )
}

// Helper to render formatted text (for display)
export function renderFormattedText(text: string): string {
  if (!text) return ""

  // Convert **text** to <strong>text</strong>
  let formatted = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Convert *text* to <em>text</em> (but not inside **)
  formatted = formatted.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')

  return formatted
}
