import { h } from "preact"

function pathToRoot(slug) {
  const rootPath = (slug ?? "")
    .split("/")
    .filter((x) => x !== "")
    .slice(0, -1)
    .map(() => "..")
    .join("/")
  return rootPath.length === 0 ? "." : rootPath
}

/**
 * Banner toan man hinh o dau trang, dung anh chi dinh qua frontmatter `banner`.
 * Fade dan xuong mau nen trang (--light) — tu dong khop light/dark mode.
 * Khong co `banner` trong frontmatter -> khong render gi ca.
 */
const PostBanner = ({ fileData, displayClass }) => {
  const banner = fileData?.frontmatter?.banner
  if (!banner || typeof banner !== "string") return null

  const baseDir = pathToRoot(fileData?.slug)
  const src = `${baseDir}/${encodeURIComponent(banner)}`

  return h("div", {
    class: ["post-banner", displayClass].filter(Boolean).join(" "),
    style: `background-image: linear-gradient(to bottom, rgba(0,0,0,0) 0%, var(--light) 90%), url("${src}")`,
  })
}

PostBanner.css = `
.post-banner {
  width: 100vw;
  position: relative;
  left: 50%;
  right: 50%;
  margin-left: -50vw;
  margin-right: -50vw;
  margin-top: -1px;
  margin-bottom: -2.5rem;
  height: 52vh;
  min-height: 320px;
  max-height: 560px;
  background-size: cover;
  background-position: center 35%;
  background-repeat: no-repeat;
}

@media all and (max-width: 600px) {
  .post-banner {
    height: 38vh;
    min-height: 220px;
  }
}
`

export default () => PostBanner
