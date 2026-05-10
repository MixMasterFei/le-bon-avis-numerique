import { describe, expect, it } from "vitest"
import { resolveHomepageTimeContext } from "@/lib/homepage-time-context"
import type { CalendarHoliday } from "@/lib/school-holidays"

// All inputs are constructed via Date strings with explicit offsets
// so the assertions describe Paris-local intent regardless of the
// host machine's TZ. We're testing the helper itself, which uses
// Intl + "Europe/Paris" internally.

describe("resolveHomepageTimeContext", () => {
  it("returns 'tonight' for a Mon-Thu evening in Paris", () => {
    // 2026-05-12 19:00 Paris (CEST, +02:00 → 17:00 UTC)
    const ctx = resolveHomepageTimeContext(new Date("2026-05-12T17:00:00Z"))
    expect(ctx.state).toBe("tonight")
  })

  it("returns 'default' for a Tuesday morning in Paris", () => {
    // 2026-05-12 09:00 Paris → 07:00 UTC
    const ctx = resolveHomepageTimeContext(new Date("2026-05-12T07:00:00Z"))
    expect(ctx.state).toBe("default")
  })

  it("returns 'weekend' for a Friday afternoon at 12h Paris", () => {
    // 2026-05-15 12:30 Paris → 10:30 UTC (CEST)
    const ctx = resolveHomepageTimeContext(new Date("2026-05-15T10:30:00Z"))
    expect(ctx.state).toBe("weekend")
  })

  it("returns 'tonight' (NOT weekend) for Friday 11h Paris", () => {
    // 2026-05-15 11:00 Paris → 09:00 UTC. Friday before 12h.
    // Weekday-evening rule requires hour >= 16, so this is "default".
    const ctx = resolveHomepageTimeContext(new Date("2026-05-15T09:00:00Z"))
    expect(ctx.state).toBe("default")
  })

  it("returns 'weekend' for any time on Saturday Paris", () => {
    // 2026-05-16 10:00 Paris → 08:00 UTC
    const ctx = resolveHomepageTimeContext(new Date("2026-05-16T08:00:00Z"))
    expect(ctx.state).toBe("weekend")
  })

  it("returns 'weekend' on Sunday late evening Paris", () => {
    // 2026-05-17 22:30 Paris → 20:30 UTC
    const ctx = resolveHomepageTimeContext(new Date("2026-05-17T20:30:00Z"))
    expect(ctx.state).toBe("weekend")
  })

  it("returns 'holidays' when current Paris date is in an active zone B holiday", () => {
    // Pretend Tue afternoon during a Zone B holiday window. The
    // resolver should pick "holidays" over "default" / "tonight".
    const holidays: CalendarHoliday[] = [
      {
        description: "Vacances de printemps",
        startISO: "2026-04-04",
        endISO: "2026-04-19",
        zone: "B",
      },
    ]
    // 2026-04-08 14:00 Paris → 12:00 UTC (CEST). Wed afternoon.
    const ctx = resolveHomepageTimeContext(
      new Date("2026-04-08T12:00:00Z"),
      holidays,
      "B",
    )
    expect(ctx.state).toBe("holidays")
    expect(ctx.holidayLabel).toBe("Vacances de printemps")
  })

  it("ignores holidays for a different zone", () => {
    const holidays: CalendarHoliday[] = [
      {
        description: "Vacances de printemps",
        startISO: "2026-04-04",
        endISO: "2026-04-19",
        zone: "A",
      },
    ]
    // Same date as previous test but only Zone A is on holiday.
    // Default resolver zone is "B" so we should NOT enter holidays.
    const ctx = resolveHomepageTimeContext(
      new Date("2026-04-08T12:00:00Z"),
      holidays,
      "B",
    )
    expect(ctx.state).not.toBe("holidays")
  })

  it("respects 'ALL' zone holidays for any zone", () => {
    const holidays: CalendarHoliday[] = [
      {
        description: "Jour férié national",
        startISO: "2026-05-01",
        endISO: "2026-05-01",
        zone: "ALL",
      },
    ]
    // 2026-05-01 14:00 Paris → 12:00 UTC
    const ctx = resolveHomepageTimeContext(
      new Date("2026-05-01T12:00:00Z"),
      holidays,
      "B",
    )
    expect(ctx.state).toBe("holidays")
  })

  it("populates a French subtitle (weekday + day + month)", () => {
    // 2026-05-12 14:00 Paris → 12:00 UTC. Tuesday "mardi 12 mai".
    const ctx = resolveHomepageTimeContext(new Date("2026-05-12T12:00:00Z"))
    expect(ctx.subtitle).toBe("mardi 12 mai")
  })
})
