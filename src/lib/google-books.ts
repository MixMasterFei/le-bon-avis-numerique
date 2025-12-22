/**
 * Google Books API Integration
 * Free API with generous limits
 * 
 * Setup:
 * 1. Go to Google Cloud Console: https://console.cloud.google.com/
 * 2. Create a project
 * 3. Enable "Books API"
 * 4. Create an API key (APIs & Services → Credentials)
 * 5. Add to environment variables:
 *    - GOOGLE_BOOKS_API_KEY
 * 
 * Documentation: https://developers.google.com/books/docs/v1/using
 */

const GOOGLE_BOOKS_BASE_URL = "https://www.googleapis.com/books/v1"

// ============================================
// TYPES
// ============================================

export interface GoogleBooksVolume {
  id: string
  volumeInfo: {
    title: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    industryIdentifiers?: {
      type: string // ISBN_10, ISBN_13
      identifier: string
    }[]
    pageCount?: number
    categories?: string[]
    averageRating?: number
    ratingsCount?: number
    maturityRating?: "NOT_MATURE" | "MATURE"
    imageLinks?: {
      smallThumbnail?: string
      thumbnail?: string
      small?: string
      medium?: string
      large?: string
    }
    language?: string
    previewLink?: string
    infoLink?: string
  }
  saleInfo?: {
    country: string
    isEbook: boolean
    listPrice?: {
      amount: number
      currencyCode: string
    }
  }
}

export interface GoogleBooksSearchResult {
  totalItems: number
  items?: GoogleBooksVolume[]
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Make request to Google Books API
 */
async function googleBooksFetch<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY

  if (!apiKey) {
    throw new Error(
      "GOOGLE_BOOKS_API_KEY not configured. Get one at https://console.cloud.google.com/"
    )
  }

  const url = new URL(`${GOOGLE_BOOKS_BASE_URL}${endpoint}`)
  url.searchParams.set("key", apiKey)

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  const response = await fetch(url.toString(), {
    next: { revalidate: 3600 }, // Cache for 1 hour
  })

  if (!response.ok) {
    throw new Error(`Google Books API error: ${response.status}`)
  }

  return response.json()
}

/**
 * Search for books in French
 */
export async function searchBooks(
  query: string,
  options: {
    startIndex?: number
    maxResults?: number
    orderBy?: "relevance" | "newest"
    langRestrict?: string
  } = {}
): Promise<GoogleBooksSearchResult> {
  const params: Record<string, string> = {
    q: query,
    langRestrict: options.langRestrict || "fr", // French by default
    maxResults: (options.maxResults || 20).toString(),
    orderBy: options.orderBy || "relevance",
    printType: "books",
  }

  if (options.startIndex) {
    params.startIndex = options.startIndex.toString()
  }

  return googleBooksFetch<GoogleBooksSearchResult>("/volumes", params)
}

/**
 * Search for children's books in French
 */
export async function searchChildrensBooks(
  query: string,
  maxResults = 20
): Promise<GoogleBooksSearchResult> {
  // Add "jeunesse" (youth) to search for children's books
  return searchBooks(`${query} subject:jeunesse`, { maxResults })
}

/**
 * Get book details by ID
 */
export async function getBookDetails(volumeId: string): Promise<GoogleBooksVolume> {
  return googleBooksFetch<GoogleBooksVolume>(`/volumes/${volumeId}`)
}

/**
 * Search by ISBN
 */
export async function searchByISBN(isbn: string): Promise<GoogleBooksVolume | null> {
  const result = await searchBooks(`isbn:${isbn}`, { maxResults: 1 })
  return result.items?.[0] || null
}

/**
 * Get popular French children's books
 */
export async function getPopularChildrensBooks(
  maxResults = 20
): Promise<GoogleBooksSearchResult> {
  return searchBooks("subject:jeunesse", {
    maxResults,
    orderBy: "relevance",
    langRestrict: "fr",
  })
}

/**
 * Search French books by category
 */
export async function searchBooksByCategory(
  category: string,
  maxResults = 20
): Promise<GoogleBooksSearchResult> {
  return searchBooks(`subject:${category}`, {
    maxResults,
    langRestrict: "fr",
  })
}

// ============================================
// IMAGE HELPERS
// ============================================

/**
 * Get the best available image URL
 */
export function getBookImageUrl(
  imageLinks?: GoogleBooksVolume["volumeInfo"]["imageLinks"],
  size: "small" | "medium" | "large" = "medium"
): string {
  if (!imageLinks) return "/placeholder-book.jpg"

  // Try to get the requested size, fallback to alternatives
  const sizeMap = {
    small: ["smallThumbnail", "thumbnail"],
    medium: ["thumbnail", "small", "medium"],
    large: ["large", "medium", "small", "thumbnail"],
  }

  for (const key of sizeMap[size]) {
    const url = imageLinks[key as keyof typeof imageLinks]
    if (url) {
      // Convert HTTP to HTTPS and remove zoom parameter for better quality
      return url.replace("http://", "https://").replace("&edge=curl", "")
    }
  }

  return "/placeholder-book.jpg"
}

// ============================================
// TRANSFORM HELPERS
// ============================================

/**
 * Estimate age recommendation based on categories and maturity rating
 */
function estimateAgeRecommendation(volume: GoogleBooksVolume): number {
  const { maturityRating, categories } = volume.volumeInfo

  // If marked as mature
  if (maturityRating === "MATURE") return 16

  // Check categories for age hints
  const categoriesStr = (categories || []).join(" ").toLowerCase()

  if (
    categoriesStr.includes("bébé") ||
    categoriesStr.includes("tout-petit") ||
    categoriesStr.includes("0-3")
  ) {
    return 2
  }

  if (
    categoriesStr.includes("maternelle") ||
    categoriesStr.includes("3-6") ||
    categoriesStr.includes("petite enfance")
  ) {
    return 3
  }

  if (
    categoriesStr.includes("primaire") ||
    categoriesStr.includes("6-9") ||
    categoriesStr.includes("enfant")
  ) {
    return 6
  }

  if (
    categoriesStr.includes("jeunesse") ||
    categoriesStr.includes("jeune") ||
    categoriesStr.includes("9-12")
  ) {
    return 9
  }

  if (
    categoriesStr.includes("adolescent") ||
    categoriesStr.includes("young adult") ||
    categoriesStr.includes("ado")
  ) {
    return 12
  }

  // Default for general fiction
  return 10
}

/**
 * Transform Google Books volume to our internal format
 */
export function transformBook(volume: GoogleBooksVolume) {
  const { volumeInfo } = volume

  return {
    id: volume.id,
    googleBooksId: volume.id,
    title: volumeInfo.title,
    originalTitle: volumeInfo.subtitle
      ? `${volumeInfo.title}: ${volumeInfo.subtitle}`
      : volumeInfo.title,
    type: "BOOK" as const,
    synopsisFr: volumeInfo.description || null,
    posterUrl: getBookImageUrl(volumeInfo.imageLinks, "medium"),
    releaseDate: volumeInfo.publishedDate || null,
    officialRating: "TOUS_PUBLICS", // Books don't have official ratings in France
    expertAgeRec: estimateAgeRecommendation(volume),
    author: volumeInfo.authors?.join(", ") || null,
    publisher: volumeInfo.publisher || null,
    pageCount: volumeInfo.pageCount || null,
    genres: volumeInfo.categories || [],
    isbn:
      volumeInfo.industryIdentifiers?.find((i) => i.type === "ISBN_13")
        ?.identifier ||
      volumeInfo.industryIdentifiers?.find((i) => i.type === "ISBN_10")
        ?.identifier ||
      null,
    language: volumeInfo.language || "fr",
    rating: volumeInfo.averageRating || null,
    ratingCount: volumeInfo.ratingsCount || 0,
    previewLink: volumeInfo.previewLink || null,
    infoLink: volumeInfo.infoLink || null,
  }
}

