-- Searches move from a random public ID to one address under /results, such as
-- "edina-mn/a-fence-permit" (searchSlug() in search-key.ts). Existing rows are
-- filled in, then the column is required and public_id is dropped. Drafts,
-- saved permits and reports point at searches by id, so they're unaffected.
ALTER TABLE "searches" ADD COLUMN "slug" varchar(500);--> statement-breakpoint
CREATE FUNCTION pg_temp.slug_part(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' FROM regexp_replace(
    translate(lower(value), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'),
    '[^a-z0-9]+', '-', 'g'
  ))
$$;--> statement-breakpoint
UPDATE "searches" AS search
SET "slug" =
  pg_temp.slug_part(city."name") || '-' ||
  CASE city."region" WHEN 'Alabama' THEN 'al' WHEN 'Alaska' THEN 'ak' WHEN 'Arizona' THEN 'az' WHEN 'Arkansas' THEN 'ar' WHEN 'California' THEN 'ca' WHEN 'Colorado' THEN 'co' WHEN 'Connecticut' THEN 'ct' WHEN 'Delaware' THEN 'de' WHEN 'District of Columbia' THEN 'dc' WHEN 'Florida' THEN 'fl' WHEN 'Georgia' THEN 'ga' WHEN 'Hawaii' THEN 'hi' WHEN 'Idaho' THEN 'id' WHEN 'Illinois' THEN 'il' WHEN 'Indiana' THEN 'in' WHEN 'Iowa' THEN 'ia' WHEN 'Kansas' THEN 'ks' WHEN 'Kentucky' THEN 'ky' WHEN 'Louisiana' THEN 'la' WHEN 'Maine' THEN 'me' WHEN 'Maryland' THEN 'md' WHEN 'Massachusetts' THEN 'ma' WHEN 'Michigan' THEN 'mi' WHEN 'Minnesota' THEN 'mn' WHEN 'Mississippi' THEN 'ms' WHEN 'Missouri' THEN 'mo' WHEN 'Montana' THEN 'mt' WHEN 'Nebraska' THEN 'ne' WHEN 'Nevada' THEN 'nv' WHEN 'New Hampshire' THEN 'nh' WHEN 'New Jersey' THEN 'nj' WHEN 'New Mexico' THEN 'nm' WHEN 'New York' THEN 'ny' WHEN 'North Carolina' THEN 'nc' WHEN 'North Dakota' THEN 'nd' WHEN 'Ohio' THEN 'oh' WHEN 'Oklahoma' THEN 'ok' WHEN 'Oregon' THEN 'or' WHEN 'Pennsylvania' THEN 'pa' WHEN 'Rhode Island' THEN 'ri' WHEN 'South Carolina' THEN 'sc' WHEN 'South Dakota' THEN 'sd' WHEN 'Tennessee' THEN 'tn' WHEN 'Texas' THEN 'tx' WHEN 'Utah' THEN 'ut' WHEN 'Vermont' THEN 'vt' WHEN 'Virginia' THEN 'va' WHEN 'Washington' THEN 'wa' WHEN 'West Virginia' THEN 'wv' WHEN 'Wisconsin' THEN 'wi' WHEN 'Wyoming' THEN 'wy' ELSE pg_temp.slug_part(city."region") END
  || '/' ||
  -- Wording with letters a slug can't hold gets a code to keep it apart. It
  -- isn't the code the app computes, so those few rows just aren't reused.
  CASE
    WHEN translate(lower(search."permit_query"), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy') ~ '[^[:ascii:]]'
      THEN trim(both '-' FROM pg_temp.slug_part(search."permit_query") || '-' || left(md5(search."permit_query"), 7))
    ELSE pg_temp.slug_part(search."permit_query")
  END
FROM "cities" AS city
WHERE city."id" = search."city_id";--> statement-breakpoint
ALTER TABLE "searches" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
DROP INDEX "searches_public_id";--> statement-breakpoint
ALTER TABLE "searches" DROP COLUMN "public_id";--> statement-breakpoint
CREATE INDEX "searches_slug_created_at" ON "searches" USING btree ("slug","created_at");
