"use client"

import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { User, Mail, Calendar, Shield, Star, MessageSquare } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function ProfilPage() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!session?.user) {
    redirect("/connexion")
  }

  const isAdmin = session.user.role === "ADMIN"

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Profile Header */}
      <Card className="mb-8">
        <CardContent className="p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || "Profil"}
                className="h-24 w-24 rounded-full"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-12 w-12 text-primary" />
              </div>
            )}

            <div className="text-center sm:text-left flex-1">
              <div className="flex items-center gap-3 justify-center sm:justify-start">
                <h1 className="text-2xl font-bold text-gray-900">
                  {session.user.name || "Utilisateur"}
                </h1>
                {isAdmin && (
                  <Badge className="bg-purple-500">
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                  </Badge>
                )}
              </div>
              <p className="text-gray-600 flex items-center gap-2 justify-center sm:justify-start mt-1">
                <Mail className="h-4 w-4" />
                {session.user.email}
              </p>
            </div>

            <Button variant="outline">Modifier le profil</Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="inline-flex p-3 bg-amber-100 rounded-full mb-3">
              <Star className="h-6 w-6 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-600">Avis donnes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="inline-flex p-3 bg-blue-100 rounded-full mb-3">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-600">Commentaires</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <div className="inline-flex p-3 bg-green-100 rounded-full mb-3">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {new Date().toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
            </p>
            <p className="text-sm text-gray-600">Membre depuis</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Activite recente</CardTitle>
          <CardDescription>Vos derniers avis et interactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Aucune activite pour le moment</p>
            <p className="text-sm mt-1">
              Commencez par donner votre avis sur un film ou une serie !
            </p>
            <Button className="mt-4" asChild>
              <a href="/films">Decouvrir des films</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Parametres du compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Notifications par email</p>
              <p className="text-sm text-gray-500">Recevoir les nouveautes et recommandations</p>
            </div>
            <Button variant="outline" size="sm">Configurer</Button>
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Gestion des cookies</p>
              <p className="text-sm text-gray-500">Modifier vos preferences de cookies</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/cookies">Gerer</a>
            </Button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-red-600">Supprimer mon compte</p>
              <p className="text-sm text-gray-500">Cette action est irreversible</p>
            </div>
            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
              Supprimer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
