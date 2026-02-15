import { NextResponse } from "next/server"
import { sendContactEmail } from "@/lib/email"
import { sanitizeInput, getClientIdentifier, checkRateLimit, RATE_LIMITS, rateLimitHeaders } from "@/lib/security"

export async function POST(request: Request) {
  try {
    // Rate limit
    const clientId = getClientIdentifier(request)
    const rl = checkRateLimit(`contact:${clientId}`, RATE_LIMITS.auth)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Trop de messages envoyés. Veuillez réessayer dans quelques minutes." },
        { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetIn) }
      )
    }

    const body = await request.json()
    const { name, email, subject, message } = body

    // Validate required fields
    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Tous les champs sont requis." },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Adresse email invalide." },
        { status: 400 }
      )
    }

    // Validate message length
    if (message.length > 5000) {
      return NextResponse.json(
        { error: "Le message est trop long (5000 caractères maximum)." },
        { status: 400 }
      )
    }

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name.trim())
    const sanitizedSubject = sanitizeInput(subject.trim())
    const sanitizedMessage = sanitizeInput(message.trim())

    // Send email
    await sendContactEmail(sanitizedName, email.trim(), sanitizedSubject, sanitizedMessage)

    return NextResponse.json(
      { success: true, message: "Message envoyé avec succès." },
      { headers: rateLimitHeaders(rl.remaining, rl.resetIn) }
    )
  } catch (error) {
    console.error("Contact form error:", error)
    return NextResponse.json(
      { error: "Une erreur est survenue lors de l'envoi du message. Veuillez réessayer." },
      { status: 500 }
    )
  }
}
