# ClientIQ — Case Study Portfolio

A static portfolio site for the **ClientIQ** product case study, plus the home and work index pages.

🔗 **Live site:** _add your Vercel URL here once deployed_

## Pages
- `index.html` — home
- `work.html` — work index
- `clientiq.html` — ClientIQ case study (assets in `uploads/clientiq/`)

## Stack
Plain HTML, CSS, and vanilla JS — no build step. A shared design system lives in
`design-system.css` / `design-system.js`; page-specific styles are inline in each page's
`<style>` block.

## Local preview
```bash
python3 serve.py    # or: ./sync.sh   (serves on http://localhost:8095)
```

## Deployment
Hosted on Vercel — every push to `main` auto-deploys. No build command; output is the repo root.
