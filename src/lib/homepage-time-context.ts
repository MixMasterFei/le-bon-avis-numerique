import type { CalendarHoliday, Zone } from "@/lib/school-holidays"

export type HomepageState = "tonight" | "weekend" | "holidays" | "default"

export interface HomepageTimeContext {
  state: HomepageState
  title: string
  subtitle: string
  isHoliday: boolean
  holidayLabel: string | null
  /** ISO-day Y-M-D in Paris time, useful as a stable cache key. */
  parisIsoDay: string
}

/**
 * Returns Paris-local weekday (1=Mon..7=Sun), hour 0-23, and the
 * ISO date YYYY-MM-DD in Paris time. Uses Intl exclusively so we
 * never rely on the runtime's TZ — works the same on Vercel (UTC)
 * and on a developer's local machine.
 */
function parisParts(d: Date): { weekday: number; hour: number; isoDay: string } {
  // en-GB gives 24h hour; en-CA gives ISO-shaped date.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d)

  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  }
  const weekdayPart = parts.find((p) => p.type === "weekday")?.value ?? "Mon"
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0"

  const weekday = weekdayMap[weekdayPart] ?? 1
  // 24-hour clock; "00".."23". Strip leading zero defensively.
  const hour = Number.parseInt(hourPart, 10) || 0

  const isoDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)

  return { weekday, hour, isoDay }
}

function frenchWeekdayLong(weekday: number): string {
  return (
    ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"][weekday - 1] ??
    "lundi"
  )
}

function frenchMonthShort(monthIndex0: number): string {
  return [
    "janv.",
    "févr.",
    "mars",
    "avril",
    "mai",
    "juin",
    "juil.",
    "août",
    "sept.",
    "oct.",
    "nov.",
    "déc.",
  ][monthIndex0]
}

function findActiveHoliday(
  isoDay: string,
  holidays: CalendarHoliday[],
  zone: Zone,
): CalendarHoliday | null {
  for (const h of holidays) {
    if (h.zone !== zone && h.zone !== "ALL") continue
    if (isoDay >= h.startISO && isoDay <= h.endISO) return h
  }
  return null
}

/**
 * Decide which homepage state to render based on Paris-local time
 * and active school holidays.
 *
 * Priority: holidays > weekend > weekday-evening > default.
 *
 * - tonight:  Mon-Thu, 16h-23h (Paris)
 * - weekend:  Fri 12h → Sun 23h (Paris)
 * - holidays: any day inside an active holiday window for the zone
 * - default:  everything else (mornings, late nights, in-between)
 */
export function resolveHomepageTimeContext(
  now: Date,
  holidays: CalendarHoliday[] = [],
  zone: Zone = "B",
): HomepageTimeContext {
  const { weekday, hour, isoDay } = parisParts(now)

  const activeHoliday = findActiveHoliday(isoDay, holidays, zone)

  // Build the friendly subtitle ("jeudi 21 mai") from Paris parts.
  const monthDay = isoDay.split("-")
  const monthIdx = Number(monthDay[1] ?? "1") - 1
  const dayNum = Number(monthDay[2] ?? "1")
  const subtitle = `${frenchWeekdayLong(weekday)} ${dayNum} ${frenchMonthShort(monthIdx)}`

  if (activeHoliday) {
    return {
      state: "holidays",
      title: "Pendant les vacances",
      subtitle: activeHoliday.description,
      isHoliday: true,
      holidayLabel: activeHoliday.description,
      parisIsoDay: isoDay,
    }
  }

  // Weekend: Fri 12h → Sun 23h59
  const isFridayAfternoon = weekday === 5 && hour >= 12
  const isSatOrSun = weekday === 6 || weekday === 7
  if (isFridayAfternoon || isSatOrSun) {
    return {
      state: "weekend",
      title: "Pour ce week-end en famille",
      subtitle,
      isHoliday: false,
      holidayLabel: null,
      parisIsoDay: isoDay,
    }
  }

  // Tonight: Mon-Thu evenings 16h-23h
  const isWeekdayEvening = weekday >= 1 && weekday <= 4 && hour >= 16 && hour < 23
  if (isWeekdayEvening) {
    return {
      state: "tonight",
      title: "Pour ce soir, on regarde quoi ?",
      subtitle,
      isHoliday: false,
      holidayLabel: null,
      parisIsoDay: isoDay,
    }
  }

  return {
    state: "default",
    title: "Sélection du jour",
    subtitle,
    isHoliday: false,
    holidayLabel: null,
    parisIsoDay: isoDay,
  }
}

export interface HomepageRailLabel {
  eyebrow: string
  prefix: string
  emphasis: string
  suffix: string
  lead: string
}

/**
 * Time-aware label for the homepage's first content rail, so it never reads
 * "ce week-end" on a Monday. Mirrors the states of resolveHomepageTimeContext.
 */
export function homepageRailLabel(state: HomepageState): HomepageRailLabel {
  switch (state) {
    case "holidays":
      return {
        eyebrow: "Pendant les vacances",
        prefix: "Pour ",
        emphasis: "les vacances",
        suffix: " en famille",
        lead: "De quoi occuper petits et grands pendant les vacances, prêt à lancer.",
      }
    case "weekend":
      return {
        eyebrow: "Ce week-end",
        prefix: "Pour ",
        emphasis: "ce week-end",
        suffix: " en famille",
        lead: "Un mélange de nouveautés et de valeurs sûres, prêtes à lancer.",
      }
    case "tonight":
      return {
        eyebrow: "Ce soir",
        prefix: "Pour ",
        emphasis: "ce soir",
        suffix: " en famille",
        lead: "Des idées prêtes à lancer pour la soirée, sans hésiter pendant le dîner.",
      }
    default:
      return {
        eyebrow: "Aujourd'hui",
        prefix: "À regarder ",
        emphasis: "aujourd'hui",
        suffix: " en famille",
        lead: "Notre sélection du moment, à regarder ensemble.",
      }
  }
}
