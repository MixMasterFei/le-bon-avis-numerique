#!/usr/bin/env python3
"""
Bring Word edits back into the blog/NN-*.md files.

Reads each blog/docx/NN-*.docx, parses the metadata table + article body, and
rewrites the matching blog/NN-*.md: the scalar frontmatter fields (title, slug,
category, author, excerpt, seoTitle, seoDescription) are updated from the table,
the YAML lists (internalLinks / sourceLinks) are preserved untouched, and the
body is replaced with the edited article.

After running this, run `npx tsx scripts/publish-blog.ts` to re-sync the Sanity
drafts.

Usage:
    python scripts/docx-to-blog.py            # all docx in blog/docx/
    python scripts/docx-to-blog.py 03         # only the file(s) matching "03"
"""
import os
import re
import sys
import glob
import pypandoc

HERE = os.path.dirname(os.path.abspath(__file__))
BLOG = os.path.join(HERE, "..", "blog")
DOCX = os.path.join(BLOG, "docx")

LABEL_TO_KEY = {
    "Titre": "title",
    "Slug": "slug",
    "Catégorie": "category",
    "Auteur": "author",
    "Résumé": "excerpt",
    "Titre SEO": "seoTitle",
    "Description SEO": "seoDescription",
}


def parse_docx(path: str):
    md = pypandoc.convert_file(path, "gfm", extra_args=["--wrap=none"])
    lines = md.split("\n")
    fields, body_start = {}, 0
    for i, line in enumerate(lines):
        s = line.strip()
        if s.startswith("|"):
            cells = [c.strip() for c in s.strip("|").split("|")]
            if len(cells) >= 2:
                label = cells[0].strip("* ").strip()
                key = LABEL_TO_KEY.get(label)
                if key:
                    fields[key] = cells[1].replace("\\", "")  # drop pandoc escapes
            body_start = i + 1
            continue
        if s.startswith("# "):  # reached the article H1 -> body begins here
            body_start = i
            break
    body = "\n".join(lines[body_start:]).strip() + "\n"
    return fields, body


def rewrite_md(md_path: str, fields: dict, body: str):
    with open(md_path, encoding="utf-8") as f:
        src = f.read()
    m = re.match(r"^---\n(.*?)\n---\n?(.*)$", src, re.S)
    if not m:
        raise ValueError(f"{md_path}: missing frontmatter")
    fm_raw = m.group(1)
    # Replace only the scalar field lines; leave list fields (internalLinks…) intact.
    for key, val in fields.items():
        if not val:
            continue
        safe = val.replace('"', "'")
        fm_raw = re.sub(rf'^{key}:\s*".*"\s*$', f'{key}: "{safe}"', fm_raw, count=1, flags=re.M)
    return f"---\n{fm_raw}\n---\n\n{body.lstrip()}"


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    docx_files = sorted(glob.glob(os.path.join(DOCX, "*.docx")))
    if arg:
        docx_files = [p for p in docx_files if arg in os.path.basename(p)]
    if not docx_files:
        print("No .docx found in blog/docx/ (matching:", arg or "*", ")")
        return
    for dpath in docx_files:
        stem = os.path.splitext(os.path.basename(dpath))[0]
        md_path = os.path.join(BLOG, stem + ".md")
        if not os.path.exists(md_path):
            print("skip (no matching .md):", stem)
            continue
        fields, body = parse_docx(dpath)
        out = rewrite_md(md_path, fields, body)
        with open(md_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(out)
        print("updated", os.path.relpath(md_path, os.path.join(HERE, "..")))
    print("\nDone. Now run:  npx tsx scripts/publish-blog.ts   to re-sync the drafts.")


if __name__ == "__main__":
    main()
