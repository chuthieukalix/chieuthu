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

const SiteLogo = ({ fileData, displayClass }) => {
  const baseDir = pathToRoot(fileData?.slug)
  const cls = ["site-logo", displayClass].filter(Boolean).join(" ")
  return h(
    "h2",
    { class: cls },
    h(
      "a",
      { href: baseDir, class: "site-logo-link", "aria-label": "Chu Thiều" },
      h("img", { src: `${baseDir}/static/logo.png`, alt: "Chu Thiều", class: "site-logo-img" }),
    ),
  )
}

SiteLogo.css = `
.site-logo {
  margin: 0;
  line-height: 0;
}
.site-logo-link {
  display: inline-flex;
  align-items: center;
}
.site-logo-img {
  height: 2.3rem;
  width: auto;
  display: block;
}
`

export default () => SiteLogo
