import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ConfidentialitePage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Politique de Confidentialité
      </h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Introduction</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray">
            <p>
              Le Bon Avis Numérique s&apos;engage à protéger la vie privée des
              utilisateurs de son site. Cette politique de confidentialité
              explique comment nous collectons, utilisons et protégeons vos
              données personnelles conformément au Règlement Général sur la
              Protection des Données (RGPD).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Données collectées</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray">
            <p>Nous pouvons collecter les types de données suivants :</p>
            <ul>
              <li>
                <strong>Données d&apos;identification :</strong> nom, prénom, adresse
                email lors de la création d&apos;un compte
              </li>
              <li>
                <strong>Données de navigation :</strong> adresse IP, type de
                navigateur, pages visitées (via cookies)
              </li>
              <li>
                <strong>Données de contribution :</strong> avis, notes et
                commentaires que vous publiez
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Utilisation des données</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray">
            <p>Vos données sont utilisées pour :</p>
            <ul>
              <li>Gérer votre compte utilisateur</li>
              <li>Publier vos avis et contributions</li>
              <li>Améliorer nos services et notre site</li>
              <li>Vous envoyer des communications (avec votre consentement)</li>
              <li>Assurer la sécurité du site</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cookies</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray">
            <p>Notre site utilise des cookies pour :</p>
            <ul>
              <li>
                <strong>Cookies essentiels :</strong> nécessaires au
                fonctionnement du site (session, préférences)
              </li>
              <li>
                <strong>Cookies analytiques :</strong> pour comprendre comment
                vous utilisez le site (avec votre consentement)
              </li>
            </ul>
            <p>
              Vous pouvez gérer vos préférences de cookies à tout moment via
              notre bannière de consentement.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vos droits</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray">
            <p>
              Conformément au RGPD, vous disposez des droits suivants sur vos
              données :
            </p>
            <ul>
              <li>
                <strong>Droit d&apos;accès :</strong> obtenir une copie de vos données
              </li>
              <li>
                <strong>Droit de rectification :</strong> corriger vos données
              </li>
              <li>
                <strong>Droit à l&apos;effacement :</strong> demander la suppression
                de vos données
              </li>
              <li>
                <strong>Droit à la portabilité :</strong> recevoir vos données
                dans un format structuré
              </li>
              <li>
                <strong>Droit d&apos;opposition :</strong> vous opposer au traitement
                de vos données
              </li>
            </ul>
            <p>
              Pour exercer ces droits, contactez-nous à :
              privacy@lebonavis-numerique.fr
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conservation des données</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray">
            <p>
              Nous conservons vos données personnelles pendant la durée de votre
              utilisation de nos services, puis pendant les durées légales
              applicables.
            </p>
            <p>
              Les données de navigation sont conservées pendant 13 mois maximum.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray">
            <p>
              Pour toute question concernant cette politique de confidentialité
              ou vos données personnelles :
            </p>
            <ul>
              <li>Email : privacy@lebonavis-numerique.fr</li>
              <li>
                Délégué à la protection des données : dpo@lebonavis-numerique.fr
              </li>
            </ul>
            <p>
              Vous pouvez également introduire une réclamation auprès de la CNIL
              (Commission Nationale de l&apos;Informatique et des Libertés).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

