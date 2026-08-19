import { NextRequest, NextResponse } from "next/server";
import { logCronRun } from "@/lib/cron-log";
import { isCronOrAdminAuthorized } from "@/lib/cron-auth";
import { sendDebtDigest } from "@/lib/email";
import { GAME_GUIDES } from "@/lib/game-guides";
import {
  auditGuideFreshness,
  REVIEW_INTERVAL_DAYS,
} from "@/lib/game-guide-freshness";

// Monthly review reminder for the Parents' Guide "état du jeu" blocks.
//
// This job does NOT re-verify facts and must never be described as if it
// does — see the header of game-guide-freshness.ts. It reports two things a
// machine can actually establish: how old each human verification is, and
// whether the official documentation links still resolve. Both feed one
// email whose only job is to put a short, concrete re-read list in front of
// a human on the 1st of each month.
//
// A dead official link is the strongest mechanical signal available that a
// publisher reorganised its safety documentation — which is exactly when the
// facts in the block are most likely to have drifted.

export const maxDuration = 60;

interface LinkCheck {
  guide: string;
  label: string;
  url: string;
  status: number | null;
  ok: boolean;
  error?: string;
}

/**
 * Liveness probe for one official link. Publishers often reject HEAD, so a
 * failed HEAD is retried as a ranged GET before being called broken.
 *
 * Network failure is reported as `ok: false` WITH the reason rather than
 * swallowed — a probe that silently passes on timeout is the exact
 * green-light-over-a-dead-feature pattern this codebase keeps getting bitten
 * by. Better a false alarm a human dismisses than a real break nobody sees.
 */
async function checkLink(
  guide: string,
  label: string,
  url: string,
): Promise<LinkCheck> {
  const attempt = async (method: "HEAD" | "GET") => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      return await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: {
          // Some publisher edges 403 an unknown agent; identify as a browser.
          "User-Agent":
            "Mozilla/5.0 (compatible; TotemAvise/1.0; +https://totemavise.com)",
          ...(method === "GET" ? { Range: "bytes=0-2048" } : {}),
        },
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let res = await attempt("HEAD");
    if (!res.ok) res = await attempt("GET");
    return { guide, label, url, status: res.status, ok: res.ok };
  } catch (e) {
    return {
      guide,
      label,
      url,
      status: null,
      ok: false,
      error: e instanceof Error ? e.message : "échec réseau",
    };
  }
}

function buildReport(
  audit: ReturnType<typeof auditGuideFreshness>,
  broken: LinkCheck[],
  checkedLinks: number,
): string {
  const lines: string[] = [];

  lines.push("GUIDES PARENTS — REVUE MENSUELLE");
  lines.push("");
  lines.push(
    "Ce rapport dit QUAND chaque bloc « L'état du jeu » a été vérifié pour la",
  );
  lines.push(
    "dernière fois par un humain, pas s'il est encore exact. Seule une",
  );
  lines.push("relecture humaine peut le confirmer.");
  lines.push("");

  if (audit.invalid.length > 0) {
    lines.push("── DATES INEXPLOITABLES (à corriger tout de suite) ──");
    for (const g of audit.invalid) {
      lines.push(`  • ${g.name} — ${g.verifiedOn} : ${g.problem}`);
    }
    lines.push("");
  }

  if (audit.stale.length > 0) {
    lines.push("── EN RETARD ──");
    for (const g of audit.stale) {
      lines.push(
        `  • ${g.name} — vérifié il y a ${g.ageDays} jours (${g.verifiedOn})`,
      );
    }
    lines.push("");
  }

  if (audit.due.length > 0) {
    lines.push("── À RELIRE CE MOIS-CI ──");
    for (const g of audit.due) {
      lines.push(
        `  • ${g.name} — vérifié il y a ${g.ageDays} jours (${g.verifiedOn})`,
      );
    }
    lines.push("");
  }

  if (audit.fresh.length > 0) {
    lines.push("── À JOUR ──");
    for (const g of audit.fresh) {
      lines.push(`  • ${g.name} — ${g.ageDays} j`);
    }
    lines.push("");
  }

  lines.push(`── LIENS OFFICIELS (${checkedLinks} vérifiés) ──`);
  if (broken.length === 0) {
    lines.push("  Tous les liens répondent.");
  } else {
    lines.push("  Un lien mort signale souvent que l'éditeur a réorganisé sa");
    lines.push("  documentation — donc que les faits du bloc ont pu bouger.");
    lines.push("");
    for (const l of broken) {
      const why = l.error ? l.error : `HTTP ${l.status}`;
      lines.push(`  • [${l.guide}] ${l.label}`);
      lines.push(`    ${l.url} → ${why}`);
    }
  }
  lines.push("");
  lines.push("── QUOI FAIRE ──");
  lines.push(
    `  Relire chaque bloc listé ci-dessus, corriger ce qui a changé, puis`,
  );
  lines.push(
    `  mettre à jour verifiedOn dans src/lib/game-guides.ts. Cadence visée :`,
  );
  lines.push(`  ${REVIEW_INTERVAL_DAYS} jours.`);

  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  // Shared by the monthly cron (CRON_SECRET) and the "Vérifier les guides"
  // button on /admin/operations (ADMIN session) — one implementation, so the
  // button can never drift from what actually runs on the 1st.
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  try {
    const audit = auditGuideFreshness(new Date());

    const links = GAME_GUIDES.flatMap((g) =>
      g.stateOfPlay.officialLinks.map((l) => ({
        guide: g.name,
        label: l.label,
        url: l.url,
      })),
    );
    const checks = await Promise.all(
      links.map((l) => checkLink(l.guide, l.label, l.url)),
    );
    const broken = checks.filter((c) => !c.ok);

    const report = buildReport(audit, broken, checks.length);
    const needsEmail = audit.needsAttention || broken.length > 0;

    let emailed = false;
    if (needsEmail && !dryRun) {
      const subject =
        audit.invalid.length > 0 || broken.length > 0
          ? "Guides parents — action requise"
          : "Guides parents — revue mensuelle";
      await sendDebtDigest({ subject, report });
      emailed = true;
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const stats = {
      guides: audit.checked,
      fresh: audit.fresh.length,
      due: audit.due.length,
      stale: audit.stale.length,
      invalid: audit.invalid.length,
      linksChecked: checks.length,
      linksBroken: broken.length,
      emailed,
    };

    // An unusable date or a dead official link is a real defect, not noise:
    // surface it as "partial" so the supervisor and /admin/operations show it
    // rather than a reassuring green.
    const status =
      audit.invalid.length > 0 || broken.length > 0 ? "partial" : "success";

    // Only real runs are logged. An admin pressing the button is inspecting,
    // not performing the monthly review — logging it would refresh "last run"
    // in the supervisor and debt digest and hide a genuinely skipped month.
    if (!dryRun) {
      await logCronRun({
        task: "game-guides-check",
        status,
        summary:
          `${audit.checked} guides — ${audit.fresh.length} à jour, ${audit.due.length} à relire, ` +
          `${audit.stale.length} en retard, ${audit.invalid.length} dates invalides ; ` +
          `${broken.length}/${checks.length} liens cassés en ${duration}s`,
        details: { stats, broken, report },
        startTime,
      });
    }

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      dryRun,
      stats,
      // Per-guide verdicts so the admin panel can render a real list rather
      // than re-parsing the email text.
      guides: [...audit.invalid, ...audit.stale, ...audit.due, ...audit.fresh],
      broken,
      report,
    });
  } catch (error) {
    await logCronRun({
      task: "game-guides-check",
      status: "error",
      summary:
        error instanceof Error ? error.message : "game-guides-check failed",
      startTime,
    });
    return NextResponse.json(
      {
        error: "game-guides-check failed",
        message: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 },
    );
  }
}
