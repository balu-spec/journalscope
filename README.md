# JournalScope

A fast, free journal search and selection tool: ABDC 2025, JCR 2025 (JIF 2024), Scopus/SCImago 2025 quartiles, publisher speed metrics (first decision, review, acceptance, publication), APCs, similar-journal suggestions and a paper-to-journal finder.

Everything runs in the browser. No server, no tracking, no login.

## Features

- **Search** by title, abbreviation or ISSN (instant suggestions) or by **keywords/topic**.
- **Filters**: ABDC, JCR quartile, Scopus quartile, subject area/category, ABDC field (FoR), publisher (grouped, e.g. all Elsevier imprints), country, JIF/SJR/h-index minimums, max first-decision days, max APC, open access, diamond OA, ABDC upgrades.
- **Journal profile**: all rankings, ABDC history 2016-2025, citation metrics, publishing timeline, subject categories, links (SCImago, Scopus, Web of Science MJL, Google Scholar, DOAJ, publisher insights) and live **OpenAlex** data (articles per year, topics, APC, five latest articles).
- **Similar journals** on the scale you choose (ABDC / Scopus / JCR / your own list): same tier, higher tier (stretch) or lower tier (safer).
- **Journal Finder**: paste title, abstract and keywords; get Reach / Target / Safer suggestions, using offline subject matching plus a live OpenAlex check of which journals publish papers like yours.
- **Shortlist & compare** side by side, export CSV, share link.
- **Import your own list** (AJG/CABS, FT50, UTD24, institutional lists) from CSV/Excel; stays on the user's device.

## Publish on GitHub Pages (free, about 5 minutes, no coding)

1. Create a free account at https://github.com and sign in.
2. Click **+** (top right) → **New repository**. Name it e.g. `journalscope`, choose **Public**, tick **Add a README file**, click **Create repository**.
3. In the new repository click **Add file → Upload files**. Drag in **everything inside this folder** (`index.html`, `app.js`, `style.css`, `data.js`, `.nojekyll`, `vendor` folder, `tools` folder). Click **Commit changes**.
   - If GitHub replaces the README, that is fine.
4. Go to **Settings → Pages**. Under *Build and deployment* choose **Source: Deploy from a branch**, **Branch: main**, folder **/(root)**, then **Save**.
5. Wait 1 to 2 minutes and refresh the page. Your link appears at the top, e.g. `https://<your-username>.github.io/journalscope/`. Share that link.

To update later, upload the new files the same way (they overwrite the old ones).

Alternatives: drag the folder onto https://app.netlify.com/drop (instant URL) or use Cloudflare Pages.

## Updating the data next year

See `tools/UPDATE.md`.

## Data sources and licences

- ABDC Journal Quality List 2025 © Australian Business Deans Council.
- Journal Citation Reports 2025 (JIF 2024) © Clarivate. Redistribution may be restricted by Clarivate's terms; the site owner is responsible for its use.
- SCImago Journal Rank 2025 © SCImago Lab, data from Scopus® (Elsevier).
- Publishing timelines and APCs: publicly displayed on Elsevier and Springer Nature journal pages, collected 27 Oct 2026.
- Live data: OpenAlex (CC0).

This is an independent, non-commercial tool and is not affiliated with any of the above. Always confirm current rankings and indexing on the official sources.
