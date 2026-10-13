# Independent everyday vocabulary deck

`public/everyday-data.js` is committed so deployment does not depend on an
external dictionary download. It was built from FreeDict/WikDict French–Chinese
2025.11.23 (Karl Bartel; CC BY-SA 3.0 Unported) and the manually curated
`regional-vocabulary.tsv`. User-facing credit and links are in
`public/everyday-attribution.html`.

To regenerate, download and extract the source archive from
`https://download.freedict.org/dictionaries/fra-zho/2025.11.23/` into
`.sites-runtime/fra-zho/fra-zho.tei`, install `wordfreq==3.1.1` and
`opencc-python-reimplemented==0.1.7`, then run
`python scripts/build-everyday-vocabulary.py` and `node test-everyday.mjs`.

The builder excludes headwords already in the exam deck, screens for common
single-word forms using a French Zipf frequency threshold, and keeps short
Chinese glosses. Some common homographs have manual gloss overrides. The
regional TSV is kept separate for traceability. This is a broad supplement,
not a claim to contain every colloquial expression or every sense of each word.
