import type { CSSProperties } from "react"
import {
  Clapperboard,
  Users,
  Castle,
  Rocket,
  Sprout,
  Compass,
  Laugh,
  Zap,
  GraduationCap,
  Sparkles,
  Star,
  TreePine,
  Ghost,
  Sun,
  Gamepad2,
  Sofa,
  Joystick,
  type LucideIcon,
} from "lucide-react"

// Editorial line-icons for the collections — replaces the OS emoji, which
// clashed with the warm/serif art direction. Keyed by the stable collection
// id (every render site already has it), so the data module stays untouched.
// Unknown ids fall back to Sparkles rather than crashing.
const ICON_BY_ID: Record<string, LucideIcon> = {
  "top-films-animation-enfants": Clapperboard,
  "top-films-famille": Users,
  "top-disney": Castle,
  "top-pixar": Rocket,
  "top-ghibli": Sprout,
  "top-films-aventure": Compass,
  "top-comedies-ados": Laugh,
  "top-super-heros": Zap,
  "top-films-educatifs": GraduationCap,
  "meilleurs-films-2026": Sparkles,
  "meilleurs-films-2025": Star,
  "films-noel-famille": TreePine,
  "films-halloween-enfants": Ghost,
  "films-vacances-ete": Sun,
  "top-jeux-famille": Gamepad2,
  "top-jeux-multijoueur-local": Sofa,
  "top-jeux-ados": Joystick,
}

// Renders the collection's line-icon. Colour follows `currentColor`; size is
// set via `className` (Tailwind h-/w- utilities) so each surface sets its scale.
export function CollectionIcon({
  id,
  className,
  strokeWidth = 1.75,
  style,
}: {
  id: string
  className?: string
  strokeWidth?: number
  style?: CSSProperties
}) {
  const Icon = ICON_BY_ID[id] ?? Sparkles
  return <Icon className={className} strokeWidth={strokeWidth} style={style} aria-hidden />
}
