import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Mail, FileText, ExternalLink } from "lucide-react"

export const metadata = {
  title: "Politique de confidentialité — Totem Avisé",
  description:
    "Politique de confidentialité de Totem Avisé : données collectées, finalités, conservation, droits RGPD et contact.",
  alternates: { canonical: "/confidentialite" },
}

export default function ConfidentialitePage() {
  const lastUpdate = "29 decembre 2024"

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-green-100 rounded-xl">
            <Shield className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Politique de Confidentialite
          </h1>
        </div>
        <p className="text-gray-600">
          Derniere mise a jour : {lastUpdate}
        </p>
      </div>

      <div className="space-y-6">
        {/* Introduction */}
        <Card>
          <CardHeader>
            <CardTitle>1. Introduction</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>
              Totem Avisé (ci-après &quot;nous&quot;, &quot;notre&quot; ou &quot;le Site&quot;) s&apos;engage
              a proteger la vie privee des utilisateurs de son site internet. Cette politique
              de confidentialite explique comment nous collectons, utilisons, stockons et
              protegeons vos donnees personnelles conformement au Reglement General sur la
              Protection des Donnees (RGPD - Reglement UE 2016/679) et a la loi francaise
              Informatique et Libertes du 6 janvier 1978 modifiee.
            </p>
            <p>
              Cette politique s&apos;applique a tous les utilisateurs du site, qu&apos;ils soient
              visiteurs, membres inscrits ou parents/tuteurs d&apos;enfants mineurs utilisant
              nos services.
            </p>
          </CardContent>
        </Card>

        {/* Data Controller */}
        <Card>
          <CardHeader>
            <CardTitle>2. Responsable du traitement</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>Le responsable du traitement des donnees personnelles est :</p>
            <div className="bg-gray-50 p-4 rounded-lg not-prose">
              <p className="font-semibold">Totem Avisé</p>
              <p className="text-sm text-gray-600">Association loi 1901</p>
              <p className="text-sm text-gray-600">Siege social : Paris, France</p>
              <p className="text-sm text-gray-600 mt-2">
                <strong>Email :</strong> contact@totemavise.com
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Data Collected */}
        <Card>
          <CardHeader>
            <CardTitle>3. Donnees collectees</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>Nous collectons les categories de donnees suivantes :</p>

            <h4 className="font-semibold mt-4">3.1 Donnees d&apos;identification</h4>
            <ul>
              <li>Nom et prenom (lors de la creation de compte)</li>
              <li>Adresse email</li>
              <li>Mot de passe (stocke de maniere chiffree)</li>
              <li>Photo de profil (optionnelle)</li>
            </ul>

            <h4 className="font-semibold mt-4">3.2 Donnees relatives aux membres de la famille</h4>
            <ul>
              <li>Prenoms des enfants (optionnel)</li>
              <li>Annee de naissance des enfants (pour les recommandations par age)</li>
              <li>Reactions des enfants aux contenus (aime, pas aime, trop effrayant, etc.)</li>
            </ul>

            <h4 className="font-semibold mt-4">3.3 Donnees de contribution</h4>
            <ul>
              <li>Avis et commentaires publies</li>
              <li>Notes attribuees aux contenus</li>
              <li>Listes de favoris et contenus a voir</li>
            </ul>

            <h4 className="font-semibold mt-4">3.4 Donnees techniques</h4>
            <ul>
              <li>Adresse IP</li>
              <li>Type et version du navigateur</li>
              <li>Systeme d&apos;exploitation</li>
              <li>Pages visitees et duree de visite</li>
              <li>Date et heure de connexion</li>
            </ul>

            <h4 className="font-semibold mt-4">3.5 Donnees de connexion tierce</h4>
            <p>
              Si vous utilisez la connexion via Google, nous recevons : votre nom,
              adresse email et photo de profil associes a votre compte Google.
            </p>
          </CardContent>
        </Card>

        {/* Legal Basis */}
        <Card>
          <CardHeader>
            <CardTitle>4. Bases legales du traitement</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>
              Conformement a l&apos;article 6 du RGPD, nous traitons vos donnees sur les
              bases legales suivantes :
            </p>

            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Traitement</th>
                    <th className="text-left py-2">Base legale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Gestion de votre compte</td>
                    <td className="py-2">Execution du contrat</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Publication de vos avis</td>
                    <td className="py-2">Execution du contrat</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Envoi de newsletters</td>
                    <td className="py-2">Consentement</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Cookies analytiques</td>
                    <td className="py-2">Consentement</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Securite du site</td>
                    <td className="py-2">Interet legitime</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Amelioration des services</td>
                    <td className="py-2">Interet legitime</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Reponse aux obligations legales</td>
                    <td className="py-2">Obligation legale</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-4">
              <strong>Interet legitime :</strong> Notre interet legitime consiste a
              assurer le bon fonctionnement et la securite de notre site, ainsi qu&apos;a
              ameliorer nos services pour mieux repondre aux attentes de nos utilisateurs.
            </p>
          </CardContent>
        </Card>

        {/* Data Usage */}
        <Card>
          <CardHeader>
            <CardTitle>5. Utilisation des donnees</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>Vos donnees personnelles sont utilisees pour :</p>
            <ul>
              <li>Creer et gerer votre compte utilisateur</li>
              <li>Personnaliser les recommandations en fonction de l&apos;age de vos enfants</li>
              <li>Publier vos avis et contributions sur le site</li>
              <li>Sauvegarder vos favoris et listes personnelles</li>
              <li>Vous envoyer des communications (newsletters, mises a jour) si vous y avez consenti</li>
              <li>Repondre a vos demandes de support</li>
              <li>Ameliorer nos services et notre site</li>
              <li>Assurer la securite et prevenir les fraudes</li>
              <li>Respecter nos obligations legales</li>
            </ul>
            <p>
              <strong>Nous ne vendons jamais vos donnees personnelles a des tiers.</strong>
            </p>
          </CardContent>
        </Card>

        {/* Data Sharing */}
        <Card>
          <CardHeader>
            <CardTitle>6. Partage des donnees</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <h4 className="font-semibold">6.1 Donnees rendues publiques</h4>
            <p>
              Les avis, notes et commentaires que vous publiez sont visibles par tous
              les utilisateurs du site. Votre nom d&apos;affichage (pseudonyme ou prenom)
              sera associe a vos contributions.
            </p>

            <h4 className="font-semibold mt-4">6.2 Sous-traitants</h4>
            <p>Nous partageons vos donnees avec les prestataires suivants :</p>
            <ul>
              <li><strong>Vercel</strong> (Etats-Unis) : Hebergement du site</li>
              <li><strong>Neon/PostgreSQL</strong> : Base de donnees</li>
              <li><strong>Google</strong> (si connexion Google) : Authentification</li>
            </ul>
            <p>
              Ces prestataires sont contractuellement tenus de proteger vos donnees
              conformement au RGPD.
            </p>

            <h4 className="font-semibold mt-4">6.3 Transferts hors UE</h4>
            <p>
              Certains de nos prestataires sont situes aux Etats-Unis. Ces transferts
              sont encadres par des Clauses Contractuelles Types (CCT) approuvees par
              la Commission europeenne, garantissant un niveau de protection adequat.
            </p>

            <h4 className="font-semibold mt-4">6.4 Autorites</h4>
            <p>
              Nous pouvons divulguer vos donnees aux autorites competentes si la loi
              l&apos;exige ou en cas de decision judiciaire.
            </p>
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card>
          <CardHeader>
            <CardTitle>7. Duree de conservation</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>Nous conservons vos donnees selon les durees suivantes :</p>

            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Type de donnees</th>
                    <th className="text-left py-2">Duree de conservation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Donnees de compte</td>
                    <td className="py-2">Duree de l&apos;inscription + 3 ans apres suppression</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Avis et contributions</td>
                    <td className="py-2">Duree de publication + 1 an apres suppression</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Donnees de navigation (cookies)</td>
                    <td className="py-2">13 mois maximum</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Logs de securite</td>
                    <td className="py-2">1 an</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Donnees de facturation (si applicable)</td>
                    <td className="py-2">10 ans (obligation legale)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Cookies */}
        <Card>
          <CardHeader>
            <CardTitle>8. Cookies</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>Notre site utilise des cookies. Pour plus de details, consultez notre :</p>
            <Link
              href="/cookies"
              className="inline-flex items-center gap-2 text-green-600 hover:underline font-medium not-prose"
            >
              <FileText className="h-4 w-4" />
              Politique de gestion des cookies
            </Link>

            <h4 className="font-semibold mt-4">Resume des cookies utilises :</h4>
            <ul>
              <li>
                <strong>Cookies essentiels :</strong> Necessaires au fonctionnement
                (session, securite). Pas de consentement requis.
              </li>
              <li>
                <strong>Mesure d’audience et de performance :</strong> Plausible,
                Vercel Analytics et Vercel Speed Insights mesurent l’utilisation
                et les performances du site, uniquement avec votre accord.
                Ces outils fonctionnent sans cookies publicitaires.
              </li>
            </ul>
            <p>
              Vous pouvez modifier vos preferences de cookies a tout moment via notre
              page de gestion des cookies ou via le lien &quot;Gerer les cookies&quot; en bas de page.
            </p>
          </CardContent>
        </Card>

        {/* Minors */}
        <Card>
          <CardHeader>
            <CardTitle>9. Protection des mineurs</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>
              <strong>Notre site est destine aux parents et adultes.</strong> La creation
              d&apos;un compte est reservee aux personnes de 18 ans et plus.
            </p>
            <p>
              Conformement a l&apos;article 8 du RGPD et a l&apos;article 45 de la loi Informatique
              et Libertes, le traitement des donnees personnelles d&apos;un enfant de moins
              de 15 ans n&apos;est licite que si le consentement est donne par le titulaire
              de l&apos;autorite parentale.
            </p>
            <p>
              Les donnees relatives aux enfants (prenom, age, reactions) sont saisies
              par les parents dans le cadre de la fonctionnalite &quot;Ma famille&quot; et restent
              sous leur controle total. Ces donnees ne sont jamais partagees publiquement.
            </p>
            <p>
              Si vous etes parent et souhaitez supprimer les donnees de vos enfants,
              vous pouvez le faire directement depuis votre espace &quot;Profil&quot; ou nous
              contacter.
            </p>
          </CardContent>
        </Card>

        {/* User Rights */}
        <Card>
          <CardHeader>
            <CardTitle>10. Vos droits</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>
              Conformement au RGPD, vous disposez des droits suivants sur vos donnees
              personnelles :
            </p>
            <ul>
              <li>
                <strong>Droit d&apos;acces (art. 15) :</strong> Obtenir la confirmation que
                vos donnees sont traitees et en recevoir une copie.
              </li>
              <li>
                <strong>Droit de rectification (art. 16) :</strong> Corriger vos donnees
                inexactes ou incompletes.
              </li>
              <li>
                <strong>Droit a l&apos;effacement (art. 17) :</strong> Demander la suppression
                de vos donnees (&quot;droit a l&apos;oubli&quot;).
              </li>
              <li>
                <strong>Droit a la limitation (art. 18) :</strong> Limiter le traitement
                de vos donnees dans certains cas.
              </li>
              <li>
                <strong>Droit a la portabilite (art. 20) :</strong> Recevoir vos donnees
                dans un format structure et lisible par machine.
              </li>
              <li>
                <strong>Droit d&apos;opposition (art. 21) :</strong> Vous opposer au traitement
                de vos donnees, notamment pour le marketing.
              </li>
              <li>
                <strong>Droit de retirer votre consentement :</strong> A tout moment,
                sans affecter la liceite du traitement anterieur.
              </li>
            </ul>

            <h4 className="font-semibold mt-4">Comment exercer vos droits ?</h4>
            <ul>
              <li>
                <strong>En ligne :</strong> Via votre espace &quot;Profil&quot; pour modifier
                ou supprimer vos donnees
              </li>
              <li>
                <strong>Par email :</strong> contact@totemavise.com
              </li>
            </ul>
            <p>
              Nous repondrons a votre demande dans un delai d&apos;un mois. Ce delai peut
              etre prolonge de deux mois en cas de demande complexe.
            </p>
          </CardContent>
        </Card>

        {/* CNIL */}
        <Card>
          <CardHeader>
            <CardTitle>11. Reclamation aupres de la CNIL</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>
              Si vous estimez que le traitement de vos donnees personnelles constitue
              une violation du RGPD, vous avez le droit d&apos;introduire une reclamation
              aupres de la CNIL :
            </p>
            <div className="bg-gray-50 p-4 rounded-lg not-prose">
              <p className="font-semibold">Commission Nationale de l&apos;Informatique et des Libertes (CNIL)</p>
              <p className="text-sm text-gray-600">3 Place de Fontenoy</p>
              <p className="text-sm text-gray-600">TSA 80715</p>
              <p className="text-sm text-gray-600">75334 PARIS CEDEX 07</p>
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-green-600 hover:underline mt-2"
              >
                www.cnil.fr
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle>12. Securite des donnees</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>
              Nous mettons en oeuvre des mesures techniques et organisationnelles
              appropriees pour proteger vos donnees :
            </p>
            <ul>
              <li>Chiffrement des donnees en transit (HTTPS/TLS)</li>
              <li>Chiffrement des mots de passe (bcrypt)</li>
              <li>Acces restreint aux donnees (principe du moindre privilege)</li>
              <li>Sauvegardes regulieres</li>
              <li>Surveillance et detection des intrusions</li>
            </ul>
            <p>
              En cas de violation de donnees susceptible d&apos;engendrer un risque eleve
              pour vos droits et libertes, nous vous en informerons dans les meilleurs
              delais, conformement a l&apos;article 34 du RGPD.
            </p>
          </CardContent>
        </Card>

        {/* Updates */}
        <Card>
          <CardHeader>
            <CardTitle>13. Modifications de cette politique</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>
              Nous pouvons modifier cette politique de confidentialite a tout moment.
              Les modifications importantes seront notifiees par email ou via une
              notification sur le site.
            </p>
            <p>
              Nous vous encourageons a consulter regulierement cette page. La date de
              derniere mise a jour est indiquee en haut de ce document.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle>14. Contact</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none">
            <p>
              Pour toute question concernant cette politique de confidentialite ou
              vos donnees personnelles, contactez-nous :
            </p>
            <div className="not-prose mt-4">
              <a
                href="mailto:contact@totemavise.com"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
              >
                <Mail className="h-4 w-4" />
                contact@totemavise.com
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
