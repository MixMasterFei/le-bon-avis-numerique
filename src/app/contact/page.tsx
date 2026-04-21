"use client"

import { useState } from "react"
import { Mail, Send, Loader2, MessageSquare, HelpCircle, Bug, Check } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

const SAGE = "#5C8A5C"

const subjects = [
  { value: "question", label: "Question générale", icon: HelpCircle },
  { value: "feedback", label: "Suggestion / Feedback", icon: MessageSquare },
  { value: "bug", label: "Signaler un problème", icon: Bug },
  { value: "other", label: "Autre", icon: Mail },
]

export default function ContactPage() {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      const data = await response.json()
      if (!response.ok) {
        setErrorMessage(data.error || "Une erreur est survenue lors de l'envoi.")
        return
      }
      setIsSubmitted(true)
    } catch {
      setErrorMessage("Erreur de connexion. Veuillez réessayer.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <section
        className="flex-1 flex items-center justify-center py-16 px-4"
        style={{ background: p.bg, color: p.ink }}
      >
        <div
          className="w-full max-w-md rounded-3xl p-8 text-center"
          style={{ background: p.card, border: `1px solid ${p.line}` }}
        >
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
            style={{ background: SAGE, color: "#fff" }}
          >
            <Check className="h-6 w-6" />
          </div>
          <h1
            className={`${serifClass} text-2xl md:text-3xl font-medium mb-3`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Message envoyé
          </h1>
          <p className="text-sm mb-6" style={{ color: p.ink2 }}>
            Merci de nous avoir contactés. Nous vous répondrons dans les plus
            brefs délais.
          </p>
          <button
            onClick={() => {
              setFormData({ name: "", email: "", subject: "", message: "" })
              setIsSubmitted(false)
            }}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: p.ink, color: p.bg }}
          >
            Envoyer un autre message
          </button>
        </div>
      </section>
    )
  }

  return (
    <div
      className="flex flex-col flex-1"
      style={{ background: p.bg, color: p.ink }}
    >
      <section
        className="py-12 md:py-16"
        style={{ background: p.bg, borderBottom: `1px solid ${p.line}` }}
      >
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <div
            className="text-[11px] font-semibold mb-3 uppercase tracking-wide"
            style={{ color: p.accent }}
          >
            Contact
          </div>
          <h1
            className={`${serifClass} text-3xl md:text-5xl font-medium mb-5 leading-[1.05]`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Une question, une{" "}
            <em className="italic" style={{ color: p.accent }}>
              suggestion
            </em>{" "}
            ?
          </h1>
          <p className="text-base md:text-lg" style={{ color: p.ink2 }}>
            N&apos;hésitez pas à nous écrire. Notre équipe vous répondra dans
            les meilleurs délais.
          </p>
        </div>
      </section>

      <section className="py-10 md:py-14" style={{ background: p.bg2 }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-3 gap-5">
            <div className="space-y-4">
              <div
                className="rounded-2xl p-5"
                style={{ background: p.card, border: `1px solid ${p.line}` }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="p-2 rounded-lg"
                    style={{ background: p.bg2, color: p.accent }}
                  >
                    <Mail className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold text-sm" style={{ color: p.ink }}>
                    Email
                  </h3>
                </div>
                <a
                  href="mailto:contact@totemavise.com"
                  className="text-sm hover:opacity-70"
                  style={{ color: p.accent }}
                >
                  contact@totemavise.com
                </a>
              </div>
              <div
                className="rounded-2xl p-5"
                style={{ background: p.card, border: `1px solid ${p.line}` }}
              >
                <h3 className="font-semibold text-sm mb-2" style={{ color: p.ink }}>
                  Réponse rapide
                </h3>
                <p className="text-sm" style={{ color: p.ink2 }}>
                  Nous nous efforçons de répondre à toutes les demandes sous 48
                  heures ouvrables.
                </p>
              </div>
            </div>

            <div
              className="md:col-span-2 rounded-3xl p-6 md:p-8"
              style={{ background: p.card, border: `1px solid ${p.line}` }}
            >
              <h2
                className={`${serifClass} text-xl md:text-2xl font-medium mb-1`}
                style={{ color: p.ink, letterSpacing: "-0.02em" }}
              >
                Envoyez-nous un message
              </h2>
              <p className="text-sm mb-5" style={{ color: p.ink2 }}>
                Remplissez le formulaire ci-dessous.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="name"
                      className="text-xs font-semibold mb-1.5 block"
                      style={{ color: p.ink2 }}
                    >
                      Nom
                    </label>
                    <input
                      id="name"
                      placeholder="Votre nom"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                      className="w-full text-sm rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-offset-1"
                      style={{
                        background: p.bg2,
                        border: `1px solid ${p.line2}`,
                        color: p.ink,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="email"
                      className="text-xs font-semibold mb-1.5 block"
                      style={{ color: p.ink2 }}
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="vous@exemple.fr"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                      className="w-full text-sm rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-offset-1"
                      style={{
                        background: p.bg2,
                        border: `1px solid ${p.line2}`,
                        color: p.ink,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="text-xs font-semibold mb-1.5 block"
                    style={{ color: p.ink2 }}
                  >
                    Sujet
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {subjects.map((subject) => {
                      const active = formData.subject === subject.value
                      return (
                        <button
                          key={subject.value}
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              subject: subject.value,
                            })
                          }
                          className="flex items-center gap-2 p-3 rounded-xl text-sm transition-colors"
                          style={{
                            background: active ? p.bg2 : "transparent",
                            color: p.ink,
                            border: `1px solid ${active ? p.accent : p.line2}`,
                          }}
                        >
                          <subject.icon
                            className="h-4 w-4"
                            style={{ color: active ? p.accent : p.ink2 }}
                          />
                          {subject.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="text-xs font-semibold mb-1.5 block"
                    style={{ color: p.ink2 }}
                  >
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows={5}
                    placeholder="Votre message..."
                    value={formData.message}
                    onChange={(e) =>
                      setFormData({ ...formData, message: e.target.value })
                    }
                    required
                    className="w-full text-sm rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-offset-1 resize-none"
                    style={{
                      background: p.bg2,
                      border: `1px solid ${p.line2}`,
                      color: p.ink,
                    }}
                  />
                </div>

                {errorMessage && (
                  <div
                    className="rounded-xl px-3.5 py-2.5 text-sm"
                    style={{
                      background: "rgba(209, 106, 74, 0.12)",
                      border: `1px solid ${p.accent}`,
                      color: p.ink,
                    }}
                    role="alert"
                  >
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: p.ink, color: p.bg }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Envoyer le message
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
