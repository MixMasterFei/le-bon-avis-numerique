import { cn } from "@/lib/utils"
import { MessageCircle, Lightbulb, Heart, Shield, Clock, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ContentMetrics {
  violence?: number
  sexNudity?: number
  language?: number
  consumerism?: number
  substanceUse?: number
  positiveMessages?: number
  roleModels?: number
}

interface TalkToYourKidsProps {
  title: string
  type: "GAME" | "MOVIE" | "TV" | "BOOK" | "APP"
  metrics?: ContentMetrics
  genres?: string[]
  topics?: string[]
  className?: string
}

// Generate discussion points based on content
function generateDiscussionPoints(
  title: string,
  type: string,
  metrics?: ContentMetrics,
  genres?: string[],
  topics?: string[]
): { icon: React.ElementType; category: string; question: string }[] {
  const points: { icon: React.ElementType; category: string; question: string }[] = []

  // Violence-related discussions
  if (metrics?.violence && metrics.violence >= 3) {
    points.push({
      icon: Shield,
      category: "Violence",
      question: type === "GAME"
        ? "Parlez de la difference entre la violence dans les jeux et dans la vraie vie. Comment reagirais-tu si quelqu'un agissait comme ca en vrai ?"
        : "Discutez de comment les conflits pourraient etre resolus differemment dans la vraie vie."
    })
  }

  // Positive messages
  if (metrics?.positiveMessages && metrics.positiveMessages >= 3) {
    points.push({
      icon: Heart,
      category: "Messages positifs",
      question: "Quelles sont les bonnes lecons ou valeurs que tu retiens de cette histoire ?"
    })
  }

  // Role models
  if (metrics?.roleModels && metrics.roleModels >= 3) {
    points.push({
      icon: Users,
      category: "Modeles",
      question: "Quel personnage aimerais-tu ressembler ? Pourquoi ?"
    })
  }

  // Consumerism / In-game purchases
  if (metrics?.consumerism && metrics.consumerism >= 3) {
    points.push({
      icon: Clock,
      category: "Achats et argent",
      question: type === "GAME"
        ? "Parlons des achats dans les jeux. As-tu vraiment besoin de ces objets pour t'amuser ? Comment etablir un budget ?"
        : "Comment les publicites essaient-elles de nous faire acheter des choses ?"
    })
  }

  // Time management for games
  if (type === "GAME") {
    points.push({
      icon: Clock,
      category: "Temps d'ecran",
      question: "Combien de temps est raisonnable pour jouer ? Comment savoir quand il est temps d'arreter ?"
    })
  }

  // Language
  if (metrics?.language && metrics.language >= 3) {
    points.push({
      icon: MessageCircle,
      category: "Langage",
      question: "Tu as peut-etre entendu des gros mots. Pourquoi penses-tu qu'on ne devrait pas les utiliser dans la vie de tous les jours ?"
    })
  }

  // Online interactions for games
  if (type === "GAME") {
    points.push({
      icon: Users,
      category: "Jeu en ligne",
      question: "Si tu joues avec d'autres personnes en ligne, que ferais-tu si quelqu'un etait mechant ou te mettait mal a l'aise ?"
    })
  }

  // Default discussion point if none generated
  if (points.length === 0) {
    points.push({
      icon: Lightbulb,
      category: "Reflexion",
      question: `Qu'est-ce que tu as aime ou moins aime dans ${type === "GAME" ? "ce jeu" : type === "MOVIE" ? "ce film" : "cette histoire"} ?`
    })
  }

  return points.slice(0, 4) // Maximum 4 discussion points
}

export function TalkToYourKids({
  title,
  type,
  metrics,
  genres,
  topics,
  className
}: TalkToYourKidsProps) {
  const discussionPoints = generateDiscussionPoints(title, type, metrics, genres, topics)

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-indigo-500" />
          Parler avec vos enfants
        </CardTitle>
        <p className="text-sm text-gray-500">
          Points de discussion pour accompagner {type === "GAME" ? "cette experience de jeu" : "ce visionnage"}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {discussionPoints.map((point, index) => {
          const Icon = point.icon
          return (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg bg-indigo-50/50"
            >
              <div className="shrink-0 p-1.5 rounded-full bg-indigo-100">
                <Icon className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">
                  {point.category}
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {point.question}
                </p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
