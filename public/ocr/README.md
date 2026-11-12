# Text-reading data

Language models: `eng`, `fra`, `spa`, `por`, `deu`, `ita`, `ara`, `hin`, `chi_sim` (all from tessdata_fast, Apache License 2.0). Spell-check lists for French and Spanish come from `an-array-of-french-words` and `an-array-of-spanish-words` (MIT) at build time.

`eng.traineddata.gz`: English model from [tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) (Apache License 2.0), gzip-compressed. Used by the on-device text reader (Tesseract.js); downloaded by the app only when someone first uses "Read Text", then cached for offline use.

The OCR engine files (`worker.min.js`, `tesseract-core-*-lstm.wasm.js`) the word list (`words.txt`, from `an-array-of-english-words`, MIT) and the common-word ranking (`common.txt`, from SCOWL via `wordlist-english`; notice in `LICENSE-SCOWL.txt`) are copied from the installed npm packages at build time (see `vite.config.ts`), so they always match the installed versions.
