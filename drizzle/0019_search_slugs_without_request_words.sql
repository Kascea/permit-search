-- Search addresses leave out how the search was asked and a trailing "permit":
-- "I need a new fence" is now "new-fence" (querySlug() in search-key.ts). Rows
-- with letters a slug can't hold keep their slug, since their code doesn't
-- depend on these words. Runs of the current search version get the matching
-- query_key, so they're reused under the new address.
CREATE OR REPLACE FUNCTION pg_temp.slug_part(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' FROM regexp_replace(
    translate(lower(value), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'),
    '[^a-z0-9]+', '-', 'g'
  ))
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION pg_temp.query_slug(permit text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(
    nullif(
      regexp_replace(
        pg_temp.slug_part(coalesce(
          nullif(trim(regexp_replace(
            permit,
            '^(?:(?:do )?(?:i|we) )?(?:need |want )?(?:to )?(?:get )?(?:an? )?(?:permits? )?(?:to |for )?(?:an? |the |my )?',
            '',
            'i'
          )), ''),
          permit
        )),
        '-permits?$',
        ''
      ),
      ''
    ),
    pg_temp.slug_part(permit)
  )
$$;--> statement-breakpoint
UPDATE "searches"
SET
  "slug" = split_part("slug", '/', 1) || '/' || pg_temp.query_slug("permit_query"),
  "normalized_query" = pg_temp.query_slug("permit_query")
WHERE translate(lower("permit_query"), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy') !~ '[^[:ascii:]]';--> statement-breakpoint
UPDATE "searches"
SET "query_key" = "slug" || '|v' || "pipeline_version"
WHERE "pipeline_version" = 6;
