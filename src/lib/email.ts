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

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@totemavise.com"
const APP_NAME = "Totem Avisé"
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

export async function sendContactEmail(
  name: string,
  email: string,
  subject: string,
  message: string
) {
  const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "contact@totemavise.com"

  const subjectLabels: Record<string, string> = {
    question: "Question générale",
    feedback: "Suggestion / Feedback",
    bug: "Signalement de problème",
    other: "Autre",
  }

  const subjectLine = `[Contact] ${subjectLabels[subject] || subject} - de ${name}`

  const { data, error } = await getResend().emails.send({
    from: `${APP_NAME} <${FROM_EMAIL}>`,
    to: CONTACT_EMAIL,
    replyTo: email,
    subject: subjectLine,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nouveau message de contact</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📬 Nouveau message de contact</h1>
          </div>

          <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 12px; font-weight: 600; color: #475569; width: 100px;">Nom</td>
                <td style="padding: 8px 12px; color: #1e293b;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; font-weight: 600; color: #475569;">Email</td>
                <td style="padding: 8px 12px; color: #1e293b;"><a href="mailto:${email}" style="color: #2563eb;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; font-weight: 600; color: #475569;">Sujet</td>
                <td style="padding: 8px 12px; color: #1e293b;">${subjectLabels[subject] || subject}</td>
              </tr>
            </table>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">

            <h3 style="color: #1e293b; margin-top: 0;">Message :</h3>
            <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap;">${message}</div>
          </div>

          <div style="background: #1e293b; padding: 20px; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              Message envoyé depuis le formulaire de contact de ${APP_NAME}
            </p>
          </div>
        </body>
      </html>
    `,
    text: `
Nouveau message de contact

Nom: ${name}
Email: ${email}
Sujet: ${subjectLabels[subject] || subject}

Message:
${message}

---
Envoyé depuis le formulaire de contact de ${APP_NAME}
    `.trim(),
  })

  if (error) {
    console.error("Error sending contact email:", error)
    throw new Error("Failed to send contact email")
  }

  return data
}

export async function sendCronFailureAlert(params: {
  task: string
  summary: string
  details?: Record<string, unknown>
}) {
  if (process.env.CRON_ALERT_MODE === "digest") {
    console.warn(`[cron-alert] suppressed immediate alert for ${params.task}: ${params.summary}`)
    return
  }

  const alertEmail = process.env.CRON_ALERT_EMAIL || "masterfei@gmail.com"

  // Swallow send errors — alerting must never itself break the cron.
  try {
    const detailsJson = params.details
      ? JSON.stringify(params.details, null, 2).slice(0, 2000)
      : null

    await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: alertEmail,
      subject: `[Cron failed] ${params.task}`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.5; color: #1e293b; max-width: 640px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #b91c1c; margin-top: 0;">⚠️ Cron failure — ${params.task}</h2>
            <p style="color: #475569;">${params.summary}</p>
            ${
              detailsJson
                ? `<pre style="background: #f1f5f9; padding: 16px; border-radius: 8px; font-size: 12px; overflow-x: auto; color: #334155;">${detailsJson}</pre>`
                : ""
            }
            <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
              Vérifier la table <code>cron_logs</code> ou le tableau de bord admin pour plus de contexte.
            </p>
          </body>
        </html>
      `,
      text: `Cron failure — ${params.task}\n\n${params.summary}${
        detailsJson ? `\n\n${detailsJson}` : ""
      }`,
    })
  } catch (err) {
    console.error("Failed to send cron alert email:", err)
  }
}

export async function sendCronSupervisorDigest(params: {
  to?: string
  subject: string
  report: string
}) {
  const to = params.to || process.env.CRON_ALERT_EMAIL || "masterfei@gmail.com"
  const safeReport = escapeHtml(params.report)

  const { data, error } = await getResend().emails.send({
    from: `${APP_NAME} <${FROM_EMAIL}>`,
    to,
    subject: params.subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${escapeHtml(params.subject)}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.5; color: #1e293b; max-width: 760px; margin: 0 auto; padding: 24px; background: #f8fafc;">
          <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px;">
            <h1 style="margin-top: 0; color: #1e293b; font-size: 22px;">Superviseur Totem Avisé</h1>
            <p style="color: #64748b; margin-bottom: 20px;">Synthèse des automatisations et remédiations tentées.</p>
            <pre style="white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; font-size: 13px; line-height: 1.55; background: #f1f5f9; border-radius: 12px; padding: 16px; overflow-x: auto;">${safeReport}</pre>
          </div>
        </body>
      </html>
    `,
    text: params.report,
  })

  if (error) {
    console.error("Error sending cron supervisor digest:", error)
    throw new Error("Failed to send cron supervisor digest")
  }

  return data
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export async function sendEditorialAgentReport(params: {
  to?: string
  subject: string
  report: string
}) {
  const to = params.to || process.env.EDITORIAL_AGENT_EMAIL || "masterfei@gmail.com"
  const safeReport = escapeHtml(params.report)

  const { data, error } = await getResend().emails.send({
    from: `${APP_NAME} <${FROM_EMAIL}>`,
    to,
    subject: params.subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${escapeHtml(params.subject)}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.5; color: #1e293b; max-width: 760px; margin: 0 auto; padding: 24px; background: #f8fafc;">
          <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px;">
            <h1 style="margin-top: 0; color: #1e293b; font-size: 22px;">Agent éditorial Totem Avisé</h1>
            <p style="color: #64748b; margin-bottom: 20px;">Propositions hebdomadaires à valider avant publication.</p>
            <pre style="white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; font-size: 13px; line-height: 1.55; background: #f1f5f9; border-radius: 12px; padding: 16px; overflow-x: auto;">${safeReport}</pre>
          </div>
        </body>
      </html>
    `,
    text: params.report,
  })

  if (error) {
    console.error("Error sending editorial agent report:", error)
    throw new Error("Failed to send editorial agent report")
  }

  return data
}

export async function sendDebtDigest(params: {
  to?: string
  subject: string
  report: string
}) {
  const to = params.to || process.env.CRON_ALERT_EMAIL || "masterfei@gmail.com"
  const safeReport = escapeHtml(params.report)

  const { data, error } = await getResend().emails.send({
    from: `${APP_NAME} <${FROM_EMAIL}>`,
    to,
    subject: params.subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${escapeHtml(params.subject)}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.5; color: #1e293b; max-width: 760px; margin: 0 auto; padding: 24px; background: #f8fafc;">
          <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px;">
            <h1 style="margin-top: 0; color: #1e293b; font-size: 22px;">Dette technique &amp; données — Totem Avisé</h1>
            <p style="color: #64748b; margin-bottom: 20px;">Synthèse hebdomadaire : santé des automatisations, lacunes du catalogue, file d'attente éditoriale.</p>
            <pre style="white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; font-size: 13px; line-height: 1.55; background: #f1f5f9; border-radius: 12px; padding: 16px; overflow-x: auto;">${safeReport}</pre>
          </div>
        </body>
      </html>
    `,
    text: params.report,
  })

  if (error) {
    console.error("Error sending debt digest:", error)
    throw new Error("Failed to send debt digest")
  }

  return data
}

export async function sendSeoReport(params: {
  to?: string
  subject: string
  report: string
}) {
  const to = params.to || process.env.CRON_ALERT_EMAIL || "masterfei@gmail.com"
  const safeReport = escapeHtml(params.report)

  const { data, error } = await getResend().emails.send({
    from: `${APP_NAME} <${FROM_EMAIL}>`,
    to,
    subject: params.subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${escapeHtml(params.subject)}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.5; color: #1e293b; max-width: 760px; margin: 0 auto; padding: 24px; background: #f8fafc;">
          <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px;">
            <h1 style="margin-top: 0; color: #1e293b; font-size: 22px;">SEO — Opportunités à portée de page 1</h1>
            <p style="color: #64748b; margin-bottom: 20px;">Requêtes déjà classées (pos. 8–20) à pousser, d'après Search Console.</p>
            <pre style="white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; font-size: 13px; line-height: 1.55; background: #f1f5f9; border-radius: 12px; padding: 16px; overflow-x: auto;">${safeReport}</pre>
          </div>
        </body>
      </html>
    `,
    text: params.report,
  })

  if (error) {
    console.error("Error sending SEO report:", error)
    throw new Error("Failed to send SEO report")
  }

  return data
}
