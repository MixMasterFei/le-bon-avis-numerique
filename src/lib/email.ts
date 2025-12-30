import { Resend } from "resend"

// Lazy initialization of Resend to avoid build-time errors when API key is not set
let resend: Resend | null = null

function getResend(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set")
    }
    resend = new Resend(apiKey)
  }
  return resend
}

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@lebonsens.fr"
const APP_NAME = "Le Bon Sens Numérique"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export async function sendVerificationEmail(
  email: string,
  token: string,
  name?: string
) {
  const verifyUrl = `${APP_URL}/verifier-email?token=${token}`

  const { data, error } = await getResend().emails.send({
    from: `${APP_NAME} <${FROM_EMAIL}>`,
    to: email,
    subject: "Vérifiez votre adresse email",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Vérification de votre email</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎬 ${APP_NAME}</h1>
          </div>

          <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1e293b; margin-top: 0;">Bienvenue${name ? ` ${name}` : ""} !</h2>

            <p>Merci de vous être inscrit sur ${APP_NAME}. Pour activer votre compte et accéder à toutes les fonctionnalités, veuillez vérifier votre adresse email.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Vérifier mon email
              </a>
            </div>

            <p style="color: #64748b; font-size: 14px;">Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
            <p style="color: #2563eb; font-size: 14px; word-break: break-all;">${verifyUrl}</p>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

            <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
              Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte sur ${APP_NAME}, vous pouvez ignorer cet email.
            </p>
          </div>

          <div style="background: #1e293b; padding: 20px; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} ${APP_NAME} - Guide parental des médias numériques
            </p>
          </div>
        </body>
      </html>
    `,
    text: `
Bienvenue sur ${APP_NAME}${name ? `, ${name}` : ""} !

Merci de vous être inscrit. Pour activer votre compte, veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous :

${verifyUrl}

Ce lien expire dans 24 heures.

Si vous n'avez pas créé de compte sur ${APP_NAME}, vous pouvez ignorer cet email.

---
${APP_NAME} - Guide parental des médias numériques
    `.trim(),
  })

  if (error) {
    console.error("Error sending verification email:", error)
    throw new Error("Failed to send verification email")
  }

  return data
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  name?: string
) {
  const resetUrl = `${APP_URL}/reinitialiser-mot-de-passe?token=${token}`

  const { data, error } = await getResend().emails.send({
    from: `${APP_NAME} <${FROM_EMAIL}>`,
    to: email,
    subject: "Réinitialisez votre mot de passe",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Réinitialisation du mot de passe</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎬 ${APP_NAME}</h1>
          </div>

          <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1e293b; margin-top: 0;">Réinitialisation du mot de passe</h2>

            <p>Bonjour${name ? ` ${name}` : ""},</p>

            <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Réinitialiser mon mot de passe
              </a>
            </div>

            <p style="color: #64748b; font-size: 14px;">Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
            <p style="color: #2563eb; font-size: 14px; word-break: break-all;">${resetUrl}</p>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

            <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
              Ce lien expire dans 1 heure. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.
            </p>
          </div>

          <div style="background: #1e293b; padding: 20px; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} ${APP_NAME} - Guide parental des médias numériques
            </p>
          </div>
        </body>
      </html>
    `,
    text: `
Réinitialisation du mot de passe

Bonjour${name ? ` ${name}` : ""},

Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :

${resetUrl}

Ce lien expire dans 1 heure.

Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.

---
${APP_NAME} - Guide parental des médias numériques
    `.trim(),
  })

  if (error) {
    console.error("Error sending password reset email:", error)
    throw new Error("Failed to send password reset email")
  }

  return data
}
