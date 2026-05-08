import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Scale, Building2, Server, FileText, Shield, AlertTriangle, Mail } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Mentions légales — Totem Avisé",
  description:
    "Mentions légales de Totem Avisé : éditeur, hébergement, responsabilité et informations de contact.",
  alternates: { canonical: "/mentions-legales" },
}

export default function MentionsLegalesPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-12">
        <div className="inline-flex p-4 bg-primary/10 rounded-full mb-4">
          <Scale className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Mentions Légales</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Conformément aux dispositions des articles 6-III et 19 de la Loi n°2004-575
          du 21 juin 2004 pour la Confiance dans l&apos;économie numérique (LCEN).
        </p>
      </div>

      <div className="space-y-6">
        {/* Éditeur du site */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>1. Éditeur du site</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>
              Le site <strong>Totem Avisé</strong> accessible à l&apos;adresse
              www.totemavise.com est édité par :
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mt-4">
              <p className="mb-2">
                <strong>Éditeur :</strong> Xavier Manzanares (personne physique)
              </p>
              <p className="mb-2">
                <strong>Email :</strong>{" "}
                <a
                  href="mailto:contact@totemavise.com"
                  className="text-primary hover:underline"
                >
                  contact@totemavise.com
                </a>
              </p>
            </div>
            <div className="mt-4">
              <p className="mb-2">
                <strong>Directeur de la publication :</strong> Xavier Manzanares
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Hébergement */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-primary" />
              <CardTitle>2. Hébergement</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>Le site est hébergé par :</p>
            <div className="bg-gray-50 p-4 rounded-lg mt-4">
              <p className="mb-2">
                <strong>Vercel Inc.</strong>
              </p>
              <p className="mb-2">
                340 S Lemon Ave #4133<br />
                Walnut, CA 91789<br />
                États-Unis
              </p>
              <p className="mb-2">
                <strong>Site web :</strong>{" "}
                <a
                  href="https://vercel.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  vercel.com
                </a>
              </p>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Les données sont hébergées dans des centres de données sécurisés.
              Des mesures de protection appropriées sont mises en place conformément
              au RGPD pour les transferts de données vers les États-Unis.
            </p>
          </CardContent>
        </Card>

        {/* Propriété intellectuelle */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>3. Propriété intellectuelle</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>
              L&apos;ensemble du contenu de ce site (structure, textes, logos, images,
              vidéos, sons, logiciels, bases de données, etc.) est protégé par le
              droit d&apos;auteur et le droit des marques, conformément aux dispositions
              du Code de la Propriété Intellectuelle.
            </p>
            <h4 className="font-semibold mt-4 mb-2">Droits d&apos;auteur</h4>
            <p>
              Toute reproduction, représentation, modification, publication, adaptation
              de tout ou partie des éléments du site, quel que soit le moyen ou le
              procédé utilisé, est interdite sans autorisation écrite préalable de
              Totem Avisé.
            </p>
            <h4 className="font-semibold mt-4 mb-2">Marques et logos</h4>
            <p>
              Les marques, logos et signes distinctifs présents sur le site sont
              la propriété de Totem Avisé ou font l&apos;objet d&apos;une
              autorisation d&apos;utilisation. Toute utilisation non autorisée constitue
              une contrefaçon sanctionnée par les articles L.335-2 et suivants du
              Code de la Propriété Intellectuelle.
            </p>
            <h4 className="font-semibold mt-4 mb-2">Contenus tiers</h4>
            <p>
              Les affiches de films, images et autres contenus relatifs aux œuvres
              cinématographiques et audiovisuelles présentées sur ce site appartiennent
              à leurs ayants droit respectifs (studios, distributeurs, producteurs).
              Ils sont utilisés à des fins d&apos;information et de critique dans le
              cadre du droit de citation.
            </p>
          </CardContent>
        </Card>

        {/* Responsabilité */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <CardTitle>4. Limitation de responsabilité</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <h4 className="font-semibold mb-2">Informations et recommandations</h4>
            <p>
              Les informations, recommandations d&apos;âge et avis présents sur ce site
              sont fournis à titre indicatif et informatif. Totem Avisé
              s&apos;efforce de fournir des informations exactes et à jour, mais ne peut
              garantir l&apos;exactitude, la complétude ou l&apos;actualité des informations
              diffusées.
            </p>
            <p>
              Les décisions prises sur la base des informations de ce site, notamment
              concernant le visionnage de contenus par des enfants, relèvent de la
              responsabilité exclusive des parents ou tuteurs légaux.
            </p>

            <h4 className="font-semibold mt-4 mb-2">Disponibilité du site</h4>
            <p>
              Totem Avisé ne peut garantir que le site sera disponible de
              manière ininterrompue et sans erreur. L&apos;éditeur se réserve le droit
              de suspendre, modifier ou interrompre l&apos;accès au site à tout moment,
              notamment pour des raisons de maintenance.
            </p>

            <h4 className="font-semibold mt-4 mb-2">Liens hypertextes</h4>
            <p>
              Le site peut contenir des liens vers d&apos;autres sites web. Totem
              Avisé n&apos;exerce aucun contrôle sur ces sites et décline toute
              responsabilité quant à leur contenu.
            </p>

            <h4 className="font-semibold mt-4 mb-2">Contributions des utilisateurs</h4>
            <p>
              Les avis et commentaires publiés par les utilisateurs n&apos;engagent que
              leurs auteurs. Totem Avisé se réserve le droit de modérer
              ou supprimer tout contenu contraire aux bonnes mœurs, à la loi ou
              aux conditions d&apos;utilisation du site.
            </p>
          </CardContent>
        </Card>

        {/* Protection des données */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>5. Protection des données personnelles</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>
              Totem Avisé s&apos;engage à protéger la vie privée des
              utilisateurs de son site, conformément au Règlement Général sur la
              Protection des Données (RGPD) et à la loi Informatique et Libertés.
            </p>
            <p className="mt-4">
              Pour connaître en détail nos pratiques en matière de collecte et de
              traitement des données personnelles, veuillez consulter notre{" "}
              <Link href="/confidentialite" className="text-primary hover:underline">
                Politique de Confidentialité
              </Link>
              .
            </p>
            <p className="mt-4">
              Pour gérer vos préférences concernant les cookies, rendez-vous sur
              notre page{" "}
              <Link href="/cookies" className="text-primary hover:underline">
                Gestion des cookies
              </Link>
              .
            </p>
            <div className="bg-blue-50 p-4 rounded-lg mt-4">
              <p className="text-sm">
                <strong>Délégué à la Protection des Données (DPO) :</strong><br />
                Email : contact@totemavise.com
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Droit applicable */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Scale className="h-5 w-5 text-primary" />
              <CardTitle>6. Droit applicable et juridiction</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>
              Les présentes mentions légales sont régies par le droit français.
            </p>
            <p className="mt-4">
              En cas de litige relatif à l&apos;interprétation ou l&apos;exécution des
              présentes, et à défaut de résolution amiable, les tribunaux français
              seront seuls compétents.
            </p>
            <p className="mt-4">
              Conformément aux dispositions du Code de la consommation concernant
              le règlement amiable des litiges, l&apos;utilisateur peut recourir au
              service de médiation suivant :
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mt-4">
              <p className="text-sm">
                <strong>Plateforme de règlement en ligne des litiges :</strong><br />
                <a
                  href="https://ec.europa.eu/consumers/odr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://ec.europa.eu/consumers/odr
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle>7. Contact</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>
              Pour toute question concernant le site ou les présentes mentions
              légales, vous pouvez nous contacter :
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mt-4">
              <p className="mb-2">
                <strong>Par email :</strong>{" "}
                <a
                  href="mailto:contact@totemavise.com"
                  className="text-primary hover:underline"
                >
                  contact@totemavise.com
                </a>
              </p>
              <p className="mb-2">
                <strong>Par courrier :</strong><br />
                Totem Avisé — Xavier Manzanares<br />
                France
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Mise à jour */}
        <Card className="bg-gray-50">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 text-center">
              <strong>Dernière mise à jour :</strong> {new Date().toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric"
              })}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
