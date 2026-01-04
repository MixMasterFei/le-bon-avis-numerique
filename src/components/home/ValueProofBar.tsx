"use client"

import { Shield, Award, Users2, Heart } from "lucide-react"

const values = [
  {
    icon: Shield,
    title: "Independant",
    description: "Aucun lien avec les studios",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  {
    icon: Award,
    title: "Experts",
    description: "Analyses par des professionnels",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    icon: Users2,
    title: "Par age",
    description: "Recommandations adaptees",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    icon: Heart,
    title: "Communaute",
    description: "Avis de milliers de parents",
    color: "text-pink-600",
    bgColor: "bg-pink-50",
  },
]

export function ValueProofBar() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {values.map((value) => (
        <div
          key={value.title}
          className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
        >
          <div className={`p-2.5 rounded-lg ${value.bgColor}`}>
            <value.icon className={`h-5 w-5 ${value.color}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{value.title}</h3>
            <p className="text-xs text-gray-500">{value.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
