-- Remove placeholder YouTube metadata from the stub seed (0004).
-- Real references are filled by lazy-fetch after media seed.
UPDATE exercises
SET youtube_status = 'not_fetched',
    youtube_json = NULL
WHERE youtube_status IN ('ready', 'pending');
