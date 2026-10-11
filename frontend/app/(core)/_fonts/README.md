# Geist for the application

`GeistLatin.woff2` is the unmodified variable Latin font distributed with the installed Next.js 15.5.18 developer tools (`next/dist/next-devtools/server/font/geist-latin.woff2`). The font is bundled locally so application typography does not require a third-party request.

Upstream: https://github.com/vercel/geist-font

License: SIL Open Font License 1.1, reproduced in `OFL.txt` from the upstream repository. The local filename is capitalized; the font contents and internal names are unchanged.

The shared `app/_components/AppRuntime.tsx` registers this original file as `--font-app` with `next/font/local`, weight 100–900 and `display: swap`. Preloading is disabled because Core and public watch layouts also contain routes outside the app. Only the `.app-experience` wrapper uses the font family.
