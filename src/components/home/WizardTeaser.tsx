"use client"

import { useState } from "react"
import Link from "next/link"
import { Sparkles, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const ageOptions = [
  { value: "2-5", label: "2-5 ans", emoji: "👶" },
  { value: "6-9", label: "6-9 ans", emoji: "🧒" },
  { value: "10-12", label: "10-12 ans", emoji: "🧑" },
  { value: "13+", label: "13+ ans", emoji: "👦" },
]

export function WizardTeaser() {
  const [selectedAge, setSelectedAge] = useState<string | null>(null)

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-8 text-white">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="relative max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-white/20 rounded-full">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">Recommandations personnalisees</span>
        </div>

        <h2 className="text-2xl md:text-3xl font-bold mb-3">
          Quel age a votre enfant ?
        </h2>
        <p className="text-white/80 mb-6">
          Decouvrez les films et series adaptes a son age
        </p>

        {/* Age Selector */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {ageOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedAge(option.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium transition-all ${
                selectedAge === option.value
                  ? "bg-white text-indigo-700 shadow-lg scale-105"
                  : "bg-white/20 hover:bg-white/30"
              }`}
            >
              <span className="text-lg">{option.emoji}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>

        {/* CTA Button */}
        <Button
          asChild
          size="lg"
          className={`bg-white text-indigo-700 hover:bg-indigo-50 shadow-lg transition-all ${
            selectedAge ? "scale-105" : ""
          }`}
        >
          <Link href={selectedAge ? `/recommandations?age=${selectedAge}` : "/recommandations"}>
            {selectedAge ? "Voir les recommandations" : "Decouvrir"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>

        <p className="mt-4 text-xs text-white/60">
          Plus de 2000 films et series evalues par nos experts
        </p>
      </div>
    </div>
  )
}
