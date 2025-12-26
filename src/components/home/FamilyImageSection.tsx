"use client"

import Image from "next/image"
import { User } from "lucide-react"

export function FamilyImageSection() {
  return (
    <section className="py-16 bg-white overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Guider les familles dans leurs choix médias
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Depuis notre création, nous aidons les parents à trouver des contenus adaptés
              à l&apos;âge et aux valeurs de leur famille. Notre mission : vous donner les clés
              pour des choix médias éclairés.
            </p>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-emerald-600 text-sm font-bold">✓</span>
                </div>
                <span className="text-gray-700">Évaluations détaillées par des experts et des parents</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-emerald-600 text-sm font-bold">✓</span>
                </div>
                <span className="text-gray-700">Recommandations d&apos;âge basées sur le développement de l&apos;enfant</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-emerald-600 text-sm font-bold">✓</span>
                </div>
                <span className="text-gray-700">Communauté de parents engagés partageant leurs expériences</span>
              </li>
            </ul>
          </div>

          {/* Image Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden row-span-2 shadow-lg">
              <Image
                src="/family-movie.jpg"
                alt="Famille regardant un film ensemble"
                fill
                className="object-cover"
              />
            </div>
            <div className="relative aspect-square rounded-2xl overflow-hidden shadow-lg">
              <Image
                src="/parent-tablet.jpg"
                alt="Parent et enfant avec tablette"
                fill
                className="object-cover"
              />
            </div>
            <div className="relative aspect-square rounded-2xl overflow-hidden shadow-lg">
              <Image
                src="/children-reading.jpg"
                alt="Enfants lisant ensemble"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function TestimonialsSection() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Ce que disent les parents
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Des milliers de familles nous font confiance pour guider leurs choix médias.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Testimonial 1 */}
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <User className="h-7 w-7 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Marie D.</p>
                <p className="text-sm text-gray-500">Maman de 2 enfants</p>
              </div>
            </div>
            <p className="text-gray-600 italic">
              &quot;Enfin un site qui m&apos;aide à choisir des films adaptés ! Les recommandations par âge sont très précises.&quot;
            </p>
          </div>

          {/* Testimonial 2 */}
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                <User className="h-7 w-7 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Thomas L.</p>
                <p className="text-sm text-gray-500">Papa de 3 enfants</p>
              </div>
            </div>
            <p className="text-gray-600 italic">
              &quot;J&apos;apprécie les détails sur le contenu : violence, langage... Ça m&apos;aide à anticiper les discussions avec mes enfants.&quot;
            </p>
          </div>

          {/* Testimonial 3 */}
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                <User className="h-7 w-7 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Sophie M.</p>
                <p className="text-sm text-gray-500">Enseignante et maman</p>
              </div>
            </div>
            <p className="text-gray-600 italic">
              &quot;Je recommande ce site à tous les parents de mes élèves. C&apos;est une ressource précieuse pour l&apos;éducation aux médias.&quot;
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
