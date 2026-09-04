"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, ChevronRight } from "lucide-react"
import {
  MINDMAP,
  MINDMAP_ROOT,
  STATUS_COLOR,
  STATUS_LABEL,
  type MindBranch,
  type MindNode,
  type NodeStatus,
} from "@/lib/steph/knowledge"
import { stephPalette, stephSerif } from "./StephShell"

const p = stephPalette
const serif = stephSerif.className

// ── Géométrie du schéma ───────────────────────────────────────────────
// Un seul viewBox fixe, mis à l'échelle par le navigateur : le diagramme
// reste lisible de 640 px à 1400 px sans recalcul JS. En dessous de 768 px il
// est remplacé par la liste des branches (voir plus bas) — une carte radiale
// sur un écran de téléphone n'est lisible par personne.

const VIEW_W = 1000
const VIEW_H = 620
const CX = VIEW_W / 2
const CY = VIEW_H / 2
const RX = 330
const RY = 190
const PILL_W = 208
const PILL_H = 58
const ROOT_W = 268
const ROOT_H = 70

function branchPoint(index: number, total: number): { x: number; y: number } {
  // On démarre à midi et on tourne dans le sens des aiguilles d'une montre :
  // l'ordre visuel suit alors l'ordre de lecture de la légende.
  const angle = (-90 + (index * 360) / total) * (Math.PI / 180)
  return { x: CX + RX * Math.cos(angle), y: CY + RY * Math.sin(angle) }
}

/** Compte tous les nœuds sous une branche (elle-même exclue). */
function countNodes(node: MindNode): number {
  if (!node.children?.length) return 0
  return node.children.reduce((sum, c) => sum + 1 + countNodes(c), 0)
}

// ── Schéma radial ─────────────────────────────────────────────────────

function MindmapDiagram({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (id: string) => void
}) {
  const total = MINDMAP.length

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Carte des sept grands thèmes de Totem Avisé"
    >
      {/* Les traits d'abord, pour qu'ils passent sous les pastilles. */}
      {MINDMAP.map((branch, i) => {
        const { x, y } = branchPoint(i, total)
        const isActive = branch.id === selected
        // Courbe tirée vers le centre : donne l'aspect « ramification »
        // plutôt qu'une étoile rigide.
        const mx = CX + (x - CX) * 0.45
        const my = CY + (y - CY) * 0.75
        return (
          <path
            key={branch.id}
            d={`M ${CX} ${CY} Q ${mx} ${my} ${x} ${y}`}
            fill="none"
            stroke={branch.color}
            strokeWidth={isActive ? 4 : 2}
            strokeOpacity={isActive ? 1 : 0.45}
            strokeLinecap="round"
          />
        )
      })}

      {/* Le tronc */}
      <g>
        <rect
          x={CX - ROOT_W / 2}
          y={CY - ROOT_H / 2}
          width={ROOT_W}
          height={ROOT_H}
          rx={ROOT_H / 2}
          fill={p.ink}
        />
        <text
          x={CX}
          y={CY + 6}
          textAnchor="middle"
          className={serif}
          fontSize={24}
          fontWeight={500}
          fill={p.bg}
        >
          {MINDMAP_ROOT.label}
        </text>
      </g>

      {/* Les branches */}
      {MINDMAP.map((branch, i) => {
        const { x, y } = branchPoint(i, total)
        const isActive = branch.id === selected
        const count = countNodes(branch)
        return (
          <g
            key={branch.id}
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            aria-label={`${branch.label} — ${count} sous-thèmes`}
            onClick={() => onSelect(branch.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onSelect(branch.id)
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={x - PILL_W / 2}
              y={y - PILL_H / 2}
              width={PILL_W}
              height={PILL_H}
              rx={16}
              fill={isActive ? branch.color : p.card}
              stroke={branch.color}
              strokeWidth={isActive ? 3 : 2}
            />
            <text
              x={x}
              y={y - 3}
              textAnchor="middle"
              fontSize={16}
              fontWeight={700}
              fill={isActive ? "#1E1A15" : p.ink}
            >
              {branch.label}
            </text>
            <text
              x={x}
              y={y + 17}
              textAnchor="middle"
              fontSize={11}
              fill={isActive ? "rgba(30,26,21,0.7)" : p.ink2}
            >
              {count} sous-thèmes
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Arbre détaillé ────────────────────────────────────────────────────

function StatusPill({ status }: { status: NodeStatus }) {
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
      style={{ background: `${STATUS_COLOR[status]}22`, color: STATUS_COLOR[status] }}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function TreeNode({
  node,
  color,
  depth,
}: {
  node: MindNode
  color: string
  depth: number
}) {
  const hasChildren = Boolean(node.children?.length)

  return (
    <li className="relative pl-5">
      {/* Le petit trait horizontal qui rattache le nœud à la tige verticale
          portée par le <ul> parent. */}
      <span
        aria-hidden
        className="absolute left-0 top-[13px] h-px w-3.5"
        style={{ background: p.line2 as string }}
      />
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-1">
        <span
          aria-hidden
          className="h-2 w-2 rounded-full shrink-0 translate-y-[-1px]"
          style={{ background: depth === 0 ? color : (p.line2 as string) }}
        />
        {node.href ? (
          <Link
            href={node.href}
            className="text-sm font-semibold inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:opacity-75"
            style={{ color: p.ink }}
          >
            {node.label}
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </Link>
        ) : (
          <span className="text-sm font-semibold" style={{ color: p.ink }}>
            {node.label}
          </span>
        )}
        {node.status && <StatusPill status={node.status} />}
      </div>
      {node.note && (
        <p className="text-[13px] leading-relaxed pb-1 max-w-2xl" style={{ color: p.ink2 }}>
          {node.note}
        </p>
      )}
      {hasChildren && (
        <ul
          className="ml-1 pb-1"
          style={{ borderLeft: `1px solid ${p.line2}` }}
        >
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} color={color} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

function BranchPanel({ branch }: { branch: MindBranch }) {
  return (
    <div
      className="rounded-2xl p-5 md:p-7 flex flex-col gap-4"
      style={{ background: p.card, border: `1px solid ${p.line}`, borderTop: `5px solid ${branch.color}` }}
    >
      <div className="flex flex-col gap-1.5">
        <h2
          className={`${serif} text-2xl md:text-3xl font-medium`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          {branch.label}
        </h2>
        <p className="text-sm font-semibold" style={{ color: branch.color }}>
          {branch.question}
        </p>
        {branch.note && (
          <p className="text-[15px] leading-relaxed max-w-3xl" style={{ color: p.ink2 }}>
            {branch.note}
          </p>
        )}
      </div>

      <ul style={{ borderLeft: `1px solid ${p.line2}` }}>
        {branch.children?.map((child) => (
          <TreeNode key={child.id} node={child} color={branch.color} depth={0} />
        ))}
      </ul>
    </div>
  )
}

// ── Vue ───────────────────────────────────────────────────────────────

export function StephMindmapView() {
  const [selected, setSelected] = useState<string>(MINDMAP[0].id)
  const [showAll, setShowAll] = useState(false)

  const branch = MINDMAP.find((b) => b.id === selected) ?? MINDMAP[0]

  return (
    <div className="flex flex-col gap-8">
      {/* Légende + bascule */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: p.ink2 }}>
            Les pastilles
          </span>
          {(Object.keys(STATUS_LABEL) as NodeStatus[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-xs" style={{ color: p.ink }}>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: STATUS_COLOR[s] }}
                aria-hidden
              />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-sm font-semibold px-3.5 py-2 rounded-full transition-opacity hover:opacity-80"
          style={{ background: p.card, border: `1px solid ${p.line2}`, color: p.ink }}
        >
          {showAll ? "Revenir à la carte" : "Tout déplier (vue imprimable)"}
        </button>
      </div>

      {!showAll && (
        <>
          {/* Schéma — écrans larges uniquement */}
          <div
            className="hidden md:block rounded-2xl p-4"
            style={{ background: p.card, border: `1px solid ${p.line}` }}
          >
            <MindmapDiagram selected={selected} onSelect={setSelected} />
            <p className="text-xs text-center pb-1" style={{ color: p.ink2 }}>
              Cliquez sur une branche pour l&apos;ouvrir en détail juste en dessous.
            </p>
          </div>

          {/* Sélecteur — écrans étroits */}
          <div className="md:hidden flex flex-col gap-2">
            <p className="text-sm" style={{ color: p.ink2 }}>
              Choisissez une branche :
            </p>
            {MINDMAP.map((b) => {
              const isActive = b.id === selected
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelected(b.id)}
                  className="rounded-xl px-4 py-3 flex items-center gap-3 text-left transition-opacity hover:opacity-80"
                  style={{
                    background: isActive ? `${b.color}22` : p.card,
                    border: `1px solid ${isActive ? b.color : p.line}`,
                  }}
                  aria-pressed={isActive}
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ background: b.color }}
                    aria-hidden
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold" style={{ color: p.ink }}>
                      {b.label}
                    </span>
                    <span className="block text-xs" style={{ color: p.ink2 }}>
                      {b.question}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: p.ink2 }} aria-hidden />
                </button>
              )
            })}
          </div>

          <BranchPanel branch={branch} />

          {/* Passage rapide d'une branche à l'autre sans remonter au schéma */}
          <div className="hidden md:flex flex-wrap gap-2">
            {MINDMAP.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelected(b.id)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-80"
                style={{
                  background: b.id === selected ? b.color : p.card,
                  border: `1px solid ${b.color}`,
                  color: p.ink,
                }}
                aria-pressed={b.id === selected}
              >
                {b.label}
              </button>
            ))}
          </div>
        </>
      )}

      {showAll && (
        <div className="flex flex-col gap-6">
          {MINDMAP.map((b) => (
            <BranchPanel key={b.id} branch={b} />
          ))}
        </div>
      )}

      <div
        className="rounded-2xl p-5 md:p-6 text-sm leading-relaxed"
        style={{ background: p.bg2, color: p.ink }}
      >
        <strong>Comment lire cette carte.</strong> Les sept branches répondent chacune à une
        question. « Ce que c&apos;est » et « Ce qu&apos;on couvre » décrivent le présent :
        c&apos;est la matière d&apos;un discours de marque. « Pour qui » et « Le compte famille »
        décrivent le parcours d&apos;un visiteur, de la première recherche Google jusqu&apos;au
        foyer inscrit. « Les tuyaux » explique pourquoi une seule personne peut tenir tout ça.
        « Se faire connaître » et « La suite » sont les deux branches où il reste le plus à faire —
        et où la couleur rouge « À faire » domine.
      </div>
    </div>
  )
}
