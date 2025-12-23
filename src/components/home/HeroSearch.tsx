"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function HeroSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")

  const submit = () => {
    const q = query.trim()
    if (!q) return
    router.push(`/recherche?q=${encodeURIComponent(q)}`)
  }

  return (
    <form
      className="relative"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
      <Input
        type="search"
        placeholder="Rechercher un film, une série, un jeu..."
        className="pl-12 pr-32 h-14 text-lg bg-white text-gray-900 border-0 shadow-xl rounded-xl"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 h-10"
        disabled={query.trim().length < 2}
      >
        Rechercher
      </Button>
    </form>
  )
}


