import Link from "next/link"
import { fetchComments } from "@/lib/news-comments"
import { APERCU_PALETTE } from "./apercuTheme"
import { NewsCommentComposer } from "./NewsCommentComposer"
import { NewsCommentItem } from "./NewsCommentItem"

interface NewsCommentsProps {
  storyId: string
  slug: string
  serifClass: string
  viewerId: string | null
}

export async function NewsComments({
  storyId,
  slug,
  serifClass,
  viewerId,
}: NewsCommentsProps) {
  const p = APERCU_PALETTE
  const comments = await fetchComments(storyId, viewerId)

  return (
    <section id="commentaires" className="mt-12 scroll-mt-24">
      <div className="flex items-baseline justify-between mb-4">
        <h2
          className={`${serifClass} text-2xl font-medium`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Commentaires
          {comments.length > 0 && (
            <span
              className="ml-2 text-sm font-normal"
              style={{ color: p.ink2 }}
            >
              {comments.length}
            </span>
          )}
        </h2>
      </div>

      {viewerId ? (
        <div className="mb-6">
          <NewsCommentComposer slug={slug} />
        </div>
      ) : (
        <div
          className="rounded-2xl p-4 mb-6 text-sm flex items-center justify-between gap-3 flex-wrap"
          style={{ background: p.bg2, border: `1px solid ${p.line}`, color: p.ink2 }}
        >
          <span>Connectez-vous pour partager votre avis.</span>
          <Link
            href={`/connexion?callbackUrl=/apercudecouverte/${slug}`}
            className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: p.ink, color: p.bg }}
          >
            Se connecter
          </Link>
        </div>
      )}

      {comments.length === 0 ? (
        <div
          className="rounded-2xl p-6 text-center text-sm"
          style={{ background: p.card, border: `1px solid ${p.line}`, color: p.ink2 }}
        >
          Soyez le premier à commenter cette actualité.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <NewsCommentItem key={c.id} comment={c} isLoggedIn={viewerId !== null} />
          ))}
        </div>
      )}
    </section>
  )
}
