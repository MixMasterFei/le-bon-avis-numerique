"use client"

import { useState } from "react"
import { Mail, Send, Loader2, MessageSquare, HelpCircle, Bug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const subjects = [
  { value: "question", label: "Question generale", icon: HelpCircle },
  { value: "feedback", label: "Suggestion / Feedback", icon: MessageSquare },
  { value: "bug", label: "Signaler un probleme", icon: Bug },
  { value: "other", label: "Autre", icon: Mail },
]

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1500))

    setIsSubmitting(false)
    setIsSubmitted(true)
  }

  if (isSubmitted) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
        <div className="inline-flex p-4 bg-green-100 rounded-full mb-6">
          <Send className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Message envoye !</h1>
        <p className="text-gray-600 mb-8">
          Merci de nous avoir contactes. Nous vous repondrons dans les plus brefs delais.
        </p>
        <Button onClick={() => setIsSubmitted(false)}>Envoyer un autre message</Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Contactez-nous</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Une question, une suggestion ou un probleme ? N&apos;hesitez pas a nous ecrire.
          Notre equipe vous repondra dans les meilleurs delais.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Contact Info */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">Email</h3>
              </div>
              <p className="text-gray-600 text-sm">
                contact@lebonavis-numerique.fr
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-3">Reponse rapide</h3>
              <p className="text-gray-600 text-sm">
                Nous nous efforcons de repondre a toutes les demandes sous 48 heures ouvrables.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-3">FAQ</h3>
              <p className="text-gray-600 text-sm mb-3">
                Consultez notre FAQ pour trouver des reponses aux questions frequentes.
              </p>
              <Button variant="outline" size="sm" className="w-full">
                Voir la FAQ
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Contact Form */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Envoyez-nous un message</CardTitle>
            <CardDescription>
              Remplissez le formulaire ci-dessous et nous vous repondrons rapidement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-gray-700">
                    Nom
                  </label>
                  <Input
                    id="name"
                    placeholder="Votre nom"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="vous@exemple.fr"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Sujet</label>
                <div className="grid grid-cols-2 gap-2">
                  {subjects.map((subject) => (
                    <button
                      key={subject.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, subject: subject.value })}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-colors ${
                        formData.subject === subject.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <subject.icon className="h-4 w-4" />
                      {subject.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-medium text-gray-700">
                  Message
                </label>
                <textarea
                  id="message"
                  rows={5}
                  placeholder="Votre message..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Envoyer le message
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
