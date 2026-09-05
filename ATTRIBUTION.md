# Exercise data attribution

## Metadata (JSON)

Exercise names, muscle groups, equipment tags, and step-by-step instructions are sourced from [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), distributed under the [Unlicense](https://unlicense.org/).

## Images and GIFs

Still images and derived thumb GIFs come from the same repository's `exercises/` directory. That dataset was originally assembled from [wrkout/exercises.json](https://github.com/wrkout/exercises.json). Wrkout also sells a commercial image/video pack at [wrkout.xyz](https://wrkout.xyz/); the chain of title for the community-hosted JPGs is not fully documented.

**Gymfolio uses those images only for personal, self-hosted in-app reference.** They are copied into your own object store (Cloudflare R2 or Backblaze B2) at seed time — nothing is fetched from a third-party CDN at runtime. Do not republish the image pack as a standalone dataset or API.

## Reference videos (YouTube)

Full-motion demos are loaded lazily from YouTube when available. Video metadata (title, channel, view count, video ID) is stored in D1; video bytes are never copied into R2. YouTube content remains subject to each uploader's terms.

## Your Move

If you redistribute this application, keep this notice accessible (for example in Settings → About or the project README).
