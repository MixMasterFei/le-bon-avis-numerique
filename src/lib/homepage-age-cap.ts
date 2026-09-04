import { AGE_BANDS } from "./age-bands"

/** Co-viewing must suit the youngest selected viewer, including an age band's start. */
export function homepageAgeCap(
  selectedBandKeys: readonly string[],
  memberAges: readonly (number | null | undefined)[] = [],
): number | undefined {
  const ages = [
    ...AGE_BANDS.filter((band) => selectedBandKeys.includes(band.key)).map((band) => band.min),
    ...memberAges.filter((age): age is number => typeof age === "number" && Number.isFinite(age) && age >= 0),
  ]
  return ages.length ? Math.min(...ages) : undefined
}

/** Also applied at render time so an old response/cache cannot bypass a new cap. */
export function fitsHomepageAge(
  media: { expertAgeRec?: number | null },
  maxAge: number | undefined,
): boolean {
  if (maxAge === undefined) return true
  return (
    typeof media.expertAgeRec === "number" &&
    Number.isFinite(media.expertAgeRec) &&
    media.expertAgeRec >= 0 &&
    media.expertAgeRec <= maxAge
  )
}
