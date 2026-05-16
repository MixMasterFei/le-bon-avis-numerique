// Pure helpers used by /api/recommendations/family — extracted so they can be
// unit-tested without spinning up Prisma or the auth stack.

export interface FamilyRecsWhereInput {
  youngestAge: number | null
  dislikedGenres: string[]
  avoidTopics: string[]
}

export interface FamilyRecsWhereParts {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ageFilter: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exclusionFilter: Record<string, any>
}

// Build the age + disliked/avoid exclusion fragments for the family
// recommendations Prisma query. Keeps them separate so the route can splice
// them next to its other constraints (genres, posters, languages, popularity).
export function buildFamilyRecsFilters(input: FamilyRecsWhereInput): FamilyRecsWhereParts {
  // Always cap at youngestAge when known. Unrated content (expertAgeRec: null)
  // is intentionally excluded — we don't recommend unreviewed media to
  // mixed-age families, even when all members are adults.
  const ageFilter = input.youngestAge !== null
    ? { expertAgeRec: { lte: input.youngestAge } }
    : {}

  const dislikedArr = Array.from(new Set(input.dislikedGenres))
  const avoidArr = Array.from(new Set(input.avoidTopics))

  if (dislikedArr.length === 0 && avoidArr.length === 0) {
    return { ageFilter, exclusionFilter: {} }
  }

  return {
    ageFilter,
    exclusionFilter: {
      NOT: [
        ...(dislikedArr.length > 0 ? [{ genres: { hasSome: dislikedArr } }] : []),
        ...(avoidArr.length > 0
          ? [
              { genres: { hasSome: avoidArr } },
              { topics: { hasSome: avoidArr } },
            ]
          : []),
      ],
    },
  }
}
