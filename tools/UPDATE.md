# Updating JournalScope data

You need Python 3 with `openpyxl` and `tqdm` (`pip install openpyxl tqdm`).

1. Put the new source files in one folder with these names:
   - `abdc.xlsx`: ABDC Journal Quality List (sheets named like `2025 JQL`, `2022 JQL`; edit the sheet names in `merge.py` if a new edition is added)
   - `jcr.xlsx`: JCR export with columns Journal Name, Abbreviated Journal, Publisher, ISSN, eISSN, Total Cites, Citable Items, JIF, 5-Year JIF, JCI, JIF Quartile, JIF Rank (same layout as the 2025 file)
   - `sjr.csv`: SCImago export from https://www.scimagojr.com/journalrank.php (the "Download data" button)
2. Run `python merge.py` (creates `merged.json`).
3. Optional speed data: save publisher timeline files as `jf_speed.json` (Elsevier Journal Finder), `els_speed.json` (ScienceDirect insights) and `spr_speed.json` (Springer journal pages) next to `merged.json`.
4. Run `python build_data.py`. It writes `data.js` in the same folder. Upload the new `data.js` to GitHub.
