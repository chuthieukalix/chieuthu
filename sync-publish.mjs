#!/usr/bin/env node
/**
 * sync-publish.mjs — Copy chi nhung note co `publish: true` tu vault Obsidian sang content/.
 *
 * Nguyen tac: OPT-IN TUYET DOI.
 * Note khong gan co -> khong bao gio roi vao repo -> khong bao gio len GitHub.
 *
 * Chay: npm run sync
 */

import { readdir, readFile, writeFile, mkdir, rm, copyFile, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, extname, basename, relative, dirname } from "node:path"

const VAULT =
  process.env.VAULT_PATH ??
  "/Users/admin/Library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian-chuthieu"

const OUT = join(import.meta.dirname, "content")

/** Thu muc KHONG BAO GIO duoc publish, ke ca khi note ben trong gan publish: true. */
const DENY_DIRS = [
  "1.CAPTURE",
  "99.KALIX SYSTEM",
  "_agent",
  "Clippings",
  ".obsidian",
  ".git",
  "node_modules",
  ".trash",
]

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".pdf"])

/** Duyet de quy vault, tra ve moi duong dan file. */
async function walk(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (DENY_DIRS.includes(e.name)) continue
      await walk(full, acc)
    } else {
      acc.push(full)
    }
  }
  return acc
}

/** Tach frontmatter tho (khong dung thu vien). Tra ve { raw, body } hoac null. */
function splitFrontmatter(text) {
  if (!text.startsWith("---")) return null
  const end = text.indexOf("\n---", 3)
  if (end === -1) return null
  const raw = text.slice(3, end)
  const body = text.slice(text.indexOf("\n", end + 1) + 1)
  return { raw, body }
}

const isPublished = (fm) => /^publish:\s*true\s*$/im.test(fm)

/** Lay ten file dich (flatten) — vault dung wikilink bare [[basename]]. */
const slugOf = (path) => basename(path)

/** Tim moi asset duoc nhung trong note: ![[x.png]] va ![](x.png) */
function findAssets(body) {
  const out = new Set()
  for (const m of body.matchAll(/!\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) out.add(m[1].trim())
  for (const m of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const p = decodeURIComponent(m[1].trim())
    if (!p.startsWith("http")) out.add(p)
  }
  return [...out].filter((p) => IMAGE_EXT.has(extname(p).toLowerCase()))
}

/** Liet ke wikilink tro sang note khac (de canh bao link gay). */
function findWikilinks(body) {
  const out = new Set()
  for (const m of body.matchAll(/(?<!!)\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) out.add(m[1].trim())
  return [...out]
}

async function main() {
  if (!existsSync(VAULT)) {
    console.error(`✗ Khong tim thay vault: ${VAULT}`)
    process.exit(1)
  }

  const files = await walk(VAULT)
  const mdFiles = files.filter((f) => extname(f) === ".md")

  // 1. Loc note co publish: true
  const published = []
  for (const f of mdFiles) {
    const text = await readFile(f, "utf8")
    const fm = splitFrontmatter(text)
    if (!fm || !isPublished(fm.raw)) continue
    published.push({ path: f, text, body: fm.body })
  }

  if (published.length === 0) {
    console.log("⚠ Chua co note nao gan `publish: true`. Khong co gi de dua len web.")
  }

  // 2. Don sach content/ roi ghi lai tu dau (tranh sot note da go co)
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })

  // 3. Copy note, phat hien trung ten
  const taken = new Map()
  const publishedSlugs = new Set()
  const collisions = []

  for (const note of published) {
    const slug = slugOf(note.path)
    if (taken.has(slug)) {
      collisions.push({ slug, a: taken.get(slug), b: note.path })
      continue
    }
    taken.set(slug, note.path)
    publishedSlugs.add(basename(slug, ".md"))
    await copyFile(note.path, join(OUT, slug))
  }

  // 4. Copy asset duoc nhung trong cac note da publish
  const assetIndex = new Map()
  for (const f of files) {
    if (IMAGE_EXT.has(extname(f).toLowerCase())) assetIndex.set(basename(f), f)
  }

  let assetCount = 0
  const missingAssets = []
  for (const note of published) {
    for (const ref of findAssets(note.body)) {
      const name = basename(ref)
      const src = assetIndex.get(name)
      if (!src) {
        missingAssets.push({ note: basename(note.path), ref })
        continue
      }
      const dest = join(OUT, name)
      if (!existsSync(dest)) {
        await copyFile(src, dest)
        assetCount++
      }
    }
  }

  // 5. Canh bao link tro sang note CHUA publish (se thanh link gay tren web)
  const brokenLinks = []
  for (const note of published) {
    for (const link of findWikilinks(note.body)) {
      const target = basename(link, ".md")
      if (!publishedSlugs.has(target)) {
        brokenLinks.push({ note: basename(note.path), target })
      }
    }
  }

  // 6. Bao cao
  console.log(`\n✓ Da dua ${published.length} note + ${assetCount} asset vao content/`)
  for (const slug of taken.keys()) console.log(`  · ${slug}`)

  if (collisions.length) {
    console.log(`\n✗ TRUNG TEN FILE (${collisions.length}) — chi note dau tien duoc dung:`)
    for (const c of collisions) {
      console.log(`  · ${c.slug}\n      giu:  ${relative(VAULT, c.a)}\n      bo:   ${relative(VAULT, c.b)}`)
    }
  }

  if (missingAssets.length) {
    console.log(`\n⚠ Khong tim thay ${missingAssets.length} asset:`)
    for (const m of missingAssets) console.log(`  · ${m.note} → ${m.ref}`)
  }

  if (brokenLinks.length) {
    console.log(`\n⚠ ${brokenLinks.length} wikilink tro sang note CHUA publish (se hien link gay):`)
    const byNote = new Map()
    for (const b of brokenLinks) {
      if (!byNote.has(b.note)) byNote.set(b.note, [])
      byNote.get(b.note).push(b.target)
    }
    for (const [note, targets] of byNote) {
      console.log(`  · ${note} → ${[...new Set(targets)].join(", ")}`)
    }
    console.log(`  (Cach xu ly: gan publish: true cho note dich, hoac bo link trong bai.)`)
  }

  console.log("")
}

await main()
