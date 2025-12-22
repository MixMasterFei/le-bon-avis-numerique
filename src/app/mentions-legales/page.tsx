import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function MentionsLegalesPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Mentions Légales</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Éditeur du site</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray">
            <p>
              Le site Le Bon Avis Numérique est édité par [Nom de la société],
              société [forme juridique] au capital de [montant] euros,
              immatriculée au Registre du Commerce et des Sociétés de [ville]
              sous le numéro [numéro RCS].
            </p>
            <p>
              <strong>Siège social :</strong> [Adresse complète]
            </p>
            <p>
              <strong>Numéro de TVA intracommunautaire :</strong> [Numéro TVA]
            </p>
            <p>
              <strong>Directeur de la publication :</strong> [Nom du directeur]
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hébergement</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray">
            <p>
              Le site est hébergé par [Nom de l&apos;hébergeur],
              [Adresse de l&apos;hébergeur].
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Propriété intellectuelle</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray">
            <p>
              L&apos;ensemble du contenu de ce site (textes, images, vidéos, etc.)
              est protégé par le droit d&apos;auteur. Toute reproduction, même
              partielle, est soumise à autorisation préalable.
            </p>
            <p>
              Les marques et logos présents sur le site sont la propriété de
              leurs détenteurs respectifs.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Responsabilité</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray">
            <p>
              Les informations et recommandations présentes sur ce site sont
              fournies à titre indicatif. Le Bon Avis Numérique s&apos;efforce de
              fournir des informations exactes et à jour, mais ne peut garantir
              l&apos;exactitude, la complétude ou l&apos;actualité des informations
              diffusées.
            </p>
            <p>
              Les décisions prises sur la base des informations de ce site
              relèvent de la responsabilité exclusive de l&apos;utilisateur.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray">
            <p>
              Pour toute question concernant le site, vous pouvez nous contacter :
            </p>
            <ul>
              <li>Par email : contact@lebonavis-numerique.fr</li>
              <li>Par courrier : [Adresse postale]</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

