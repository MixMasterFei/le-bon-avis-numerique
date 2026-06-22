#!/usr/bin/env python3
"""
Generate one editable Word (.docx) per blog/NN-*.md.

Each .docx starts with a small metadata table (Titre, Slug, Catégorie, Auteur,
Résumé, Titre SEO, Description SEO) followed by the formatted article (headings,
bold, links, bullets preserved). Edit in Word, then bring changes back with
scripts/docx-to-blog.py.

Usage:
    python scripts/blog-to-docx.py            # all posts -> blog/docx/NN-*.docx
"""
import os
import re
import glob
import pypandoc

HERE = os.path.dirname(os.path.abspath(__file__))
BLOG = os.path.join(HERE, "..", "blog")
OUT = os.path.join(BLOG, "docx")
os.makedirs(OUT, exist_ok=True)

# (frontmatter key, French label shown in Word). Order = table order.
FIELDS = [
    ("title", "Titre"),
    ("slug", "Slug"),
    ("category", "Catégorie"),
    ("author", "Auteur"),
    ("excerpt", "Résumé"),
    ("seoTitle", "Titre SEO"),
    ("seoDescription", "Description SEO"),
]


def parse_frontmatter(md: str):
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", md, re.S)
    if not m:
        raise ValueError("missing frontmatter")
    raw, body = m.group(1), m.group(2).lstrip("\n")
    fm = {}
    for line in raw.split("\n"):
        mm = re.match(r'^(\w+):\s*"(.*)"\s*$', line)
        if mm:
            fm[mm.group(1)] = mm.group(2)
    return fm, body


def main():
    files = sorted(glob.glob(os.path.join(BLOG, "[0-9][0-9]-*.md")))
    for path in files:
        with open(path, encoding="utf-8") as f:
            fm, body = parse_frontmatter(f.read())

        # Body already starts with "# Title" (the article H1) — keep it as the big
        # heading in Word. The table above carries the editable metadata fields.
        rows = ["| Champ | Valeur |", "|---|---|"]
        for key, label in FIELDS:
            val = (fm.get(key, "") or "").replace("|", "/")
            rows.append(f"| {label} | {val} |")
        doc_md = "\n".join(rows) + "\n\n" + body

        name = os.path.splitext(os.path.basename(path))[0] + ".docx"
        out = os.path.join(OUT, name)
        pypandoc.convert_text(
            doc_md, "docx", format="markdown-smart", outputfile=out, extra_args=["--wrap=none"]
        )
        print("wrote", os.path.relpath(out, os.path.join(HERE, "..")))
    print(f"\n{len(files)} Word files written to blog/docx/")


if __name__ == "__main__":
    main()
