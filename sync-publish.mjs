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

/**
 * Ban ghi de noi dung cong khai — song trong repo web, KHONG dung vault.
 *
 * Note trong vault van la nguon quyet dinh CO duoc publish hay khong (phai
 * co `publish: true`). Neu overrides/<ten-file-vault>.md ton tai, noi dung
 * web se lay tu day thay vi copy nguyen vault — dung khi ban muon viet lai
 * van phong cong khai (bo wikilink, callout...) ma khong sua note goc.
 */
const OVERRIDES = join(import.meta.dirname, "overrides")

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

/** Xap xi cach Quartz bien ten thanh URL slug: thuong hoa, khoang trang -> gach ngang. */
const toSlug = (s) => s.trim().toLowerCase().replaceAll(" ", "-")

/**
 * Bo alias trung voi chinh slug cua note.
 *
 * Plugin alias-redirects sinh mot trang chuyen huong cho moi alias. Neu alias
 * trung ten note, trang chuyen huong de len trang that va tro ve chinh no
 * -> trinh duyet lap vo han, man hinh trang tron.
 */
function stripSelfAlias(text, selfSlug) {
  const fm = splitFrontmatter(text)
  if (!fm) return text

  const lines = fm.raw.split("\n")
  const i = lines.findIndex((l) => /^aliases:/.test(l))
  if (i === -1) return text

  const inline = lines[i].match(/^aliases:\s*\[(.*)\]\s*$/)
  if (inline) {
    const kept = inline[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((a) => toSlug(a.replace(/^["']|["']$/g, "")) !== selfSlug)
    lines[i] = `aliases: [${kept.join(", ")}]`
  } else {
    // Dang khoi:  aliases:\n  - A\n  - B
    let end = i + 1
    while (end < lines.length && /^\s*-\s+/.test(lines[end])) end++
    const kept = lines
      .slice(i + 1, end)
      .filter((l) => toSlug(l.replace(/^\s*-\s+/, "").replace(/^["']|["']$/g, "")) !== selfSlug)
    lines.splice(i + 1, end - i - 1, ...kept)
  }

  return `---${lines.join("\n")}\n---\n${fm.body}`
}

/**
 * Tim moi asset duoc tham chieu trong note: ![[x.png]], ![](x.png), va
 * frontmatter `banner: x.jpg` (anh banner khong nhung trong body, chi khai
 * bao qua frontmatter).
 */
function findAssets(text) {
  const out = new Set()
  for (const m of text.matchAll(/!\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) out.add(m[1].trim())
  for (const m of text.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const p = decodeURIComponent(m[1].trim())
    if (!p.startsWith("http")) out.add(p)
  }
  const banner = text.match(/^banner:\s*(.+)$/m)
  if (banner) out.add(banner[1].trim().replace(/^["']|["']$/g, ""))
  return [...out].filter((p) => IMAGE_EXT.has(extname(p).toLowerCase()))
}

/** Tim anh dau tien xuat hien trong body (theo dung thu tu trong text), bo qua URL ngoai. */
function findFirstImage(body) {
  const re = /!\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]|!\[[^\]]*\]\(([^)\s]+)\)/g
  for (const m of body.matchAll(re)) {
    const ref = m[1] ? m[1].trim() : decodeURIComponent(m[2].trim())
    if (ref.startsWith("http")) continue
    if (IMAGE_EXT.has(extname(ref).toLowerCase())) return ref
  }
  return null
}

/**
 * Tu dong gan `banner:` = anh dau tien trong body, neu note chua tu khai bao
 * banner rieng. Frontmatter co san `banner:` luon duoc uu tien, khong bi ghi de.
 */
function withAutoBanner(text, fm) {
  if (/^banner:\s*.+$/m.test(fm.raw)) return text
  const firstImg = findFirstImage(fm.body)
  if (!firstImg) return text
  return text.replace(/^---\n/, `---\nbanner: ${firstImg}\n`)
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

  // 1. Loc note co publish: true — day la CUA QUYET DINH duy nhat, khong the bi override qua mat
  const published = []
  for (const f of mdFiles) {
    const vaultText = await readFile(f, "utf8")
    const vaultFm = splitFrontmatter(vaultText)
    if (!vaultFm || !isPublished(vaultFm.raw)) continue

    const overridePath = join(OVERRIDES, basename(f))
    const text = existsSync(overridePath) ? await readFile(overridePath, "utf8") : vaultText
    const fm = splitFrontmatter(text)
    if (!fm) {
      console.log(`⚠ Bo qua "${basename(f)}": override thieu frontmatter hop le.`)
      continue
    }
    const finalText = withAutoBanner(text, fm)
    published.push({ path: f, text: finalText, body: fm.body, overridden: text !== vaultText })
  }

  if (published.length === 0) {
    console.log("⚠ Chua co note nao gan `publish: true`. Khong co gi de dua len web.")
  }

  // 2. Don sach content/ roi ghi lai tu dau (tranh sot note da go co)
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })
  // Giu thu muc ton tai trong git ngay ca khi chua co bai nao — CI can no de build
  await writeFile(join(OUT, ".gitkeep"), "")

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
    await writeFile(join(OUT, slug), stripSelfAlias(note.text, toSlug(basename(slug, ".md"))))
  }

  // 4. Copy asset duoc nhung trong cac note da publish
  const assetIndex = new Map()
  for (const f of files) {
    if (IMAGE_EXT.has(extname(f).toLowerCase())) assetIndex.set(basename(f), f)
  }

  let assetCount = 0
  const missingAssets = []
  for (const note of published) {
    for (const ref of findAssets(note.text)) {
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

  // 6. Sinh trang chu: phan gioi thieu tu trang-chu.md + danh sach bai tu dong
  const introPath = join(import.meta.dirname, "trang-chu.md")
  const intro = existsSync(introPath)
    ? await readFile(introPath, "utf8")
    : "---\ntitle: Chu Thiều\n---\n"

  const entries = published
    .filter((n) => taken.get(slugOf(n.path)) === n.path) // bo qua ban trung ten
    .map((n) => {
      const fm = splitFrontmatter(n.text).raw
      const title = fm.match(/^title:\s*(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, "")
      const date = fm.match(/^(?:created|updated):\s*(\d{4}-\d{2}-\d{2})/m)?.[1] ?? ""
      return { name: basename(n.path, ".md"), title: title || basename(n.path, ".md"), date }
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  const list = entries.length
    ? entries.map((e) => `- [[${e.name}|${e.title}]]${e.date ? ` — *${e.date}*` : ""}`).join("\n")
    : "*Chưa có bài nào.*"

  await writeFile(join(OUT, "index.md"), `${intro.trimEnd()}\n\n## Bài viết\n\n${list}\n`)

  // 7. Bao cao
  console.log(`\n✓ Da dua ${published.length} note + ${assetCount} asset vao content/`)
  for (const slug of taken.keys()) {
    const overridden = published.find((n) => slugOf(n.path) === slug)?.overridden
    console.log(`  · ${slug}${overridden ? "  (dang dung ban override)" : ""}`)
  }

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
