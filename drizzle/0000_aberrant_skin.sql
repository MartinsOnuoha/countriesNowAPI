CREATE TABLE "anomalies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"kind" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_ref" text NOT NULL,
	"field" text,
	"severity" text DEFAULT 'medium' NOT NULL,
	"summary" text NOT NULL,
	"observed" jsonb,
	"expected" jsonb,
	"sources" jsonb,
	"status" text DEFAULT 'open' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iso2" char(2) NOT NULL,
	"iso3" char(3),
	"iso_numeric" char(3),
	"geonames_id" integer,
	"wikidata_qid" text,
	"m49" char(3),
	"iso_official_name" text NOT NULL,
	"display_name" text NOT NULL,
	"common_name" text,
	"iso_status" text,
	"iso_assigned" boolean DEFAULT true NOT NULL,
	"independent" boolean,
	"un_member" boolean,
	"sovereignty_note" text,
	"administered_by" char(2),
	"capital" text,
	"capital_geonames_id" integer,
	"continent_code" char(2),
	"region" text,
	"subregion" text,
	"tld" text,
	"latitude" double precision,
	"longitude" double precision,
	"area_km2" double precision,
	"dial_code" text,
	"dial_root" text,
	"dial_suffixes" jsonb,
	"primary_currency" char(3),
	"flag_emoji" text,
	"flag_svg_url" text,
	"flag_png_url" text,
	"population" bigint,
	"population_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "country_currencies" (
	"country_id" uuid NOT NULL,
	"currency_code" char(3) NOT NULL,
	"is_fund" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "country_currencies_country_id_currency_code_pk" PRIMARY KEY("country_id","currency_code")
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"code" char(3) PRIMARY KEY NOT NULL,
	"numeric_code" char(3),
	"name" text NOT NULL,
	"minor_units" integer,
	"symbol" text,
	"is_historical" boolean DEFAULT false NOT NULL,
	"withdrawn_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"built_at" timestamp with time zone DEFAULT now() NOT NULL,
	"artifact_sha256" char(64),
	"artifact_bytes" bigint,
	"source_versions" jsonb,
	"gate_report" jsonb,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"field" text NOT NULL,
	"value_text" text,
	"source" text NOT NULL,
	"source_version" text,
	"source_url" text,
	"retrieved_at" timestamp with time zone NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "names" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"locale" text DEFAULT 'und' NOT NULL,
	"name" text NOT NULL,
	"folded" text NOT NULL,
	"kind" text NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"geonames_id" integer NOT NULL,
	"country_id" uuid NOT NULL,
	"subdivision_id" uuid,
	"parent_place_id" uuid,
	"name" text NOT NULL,
	"ascii_name" text,
	"feature_class" char(1) NOT NULL,
	"feature_code" text NOT NULL,
	"is_city" boolean DEFAULT false NOT NULL,
	"admin1_code" text,
	"admin2_code" text,
	"latitude" double precision,
	"longitude" double precision,
	"elevation" integer,
	"timezone" text,
	"population" bigint,
	"population_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anomaly_id" uuid NOT NULL,
	"patch" jsonb NOT NULL,
	"rationale" text NOT NULL,
	"claim" text NOT NULL,
	"evidence" jsonb,
	"verdict" text,
	"refutation" text,
	"confidence" real,
	"hypothesis_model" text,
	"verify_model" text,
	"gate_passed" boolean,
	"gate_report" jsonb,
	"pr_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"version" text NOT NULL,
	"url" text,
	"sha256" char(64) NOT NULL,
	"bytes" bigint NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subdivisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_id" uuid NOT NULL,
	"iso_3166_2" text,
	"code" text NOT NULL,
	"parent_id" uuid,
	"level" integer DEFAULT 1 NOT NULL,
	"type" text,
	"name" text NOT NULL,
	"display_name" text,
	"geonames_id" integer,
	"geonames_admin1" text,
	"wikidata_qid" text,
	"latitude" double precision,
	"longitude" double precision,
	"timezone" text,
	"population" bigint,
	"population_year" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "country_currencies" ADD CONSTRAINT "country_currencies_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "country_currencies" ADD CONSTRAINT "country_currencies_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_subdivision_id_subdivisions_id_fk" FOREIGN KEY ("subdivision_id") REFERENCES "public"."subdivisions"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_parent_place_id_places_id_fk" FOREIGN KEY ("parent_place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_anomaly_id_anomalies_id_fk" FOREIGN KEY ("anomaly_id") REFERENCES "public"."anomalies"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "subdivisions" ADD CONSTRAINT "subdivisions_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "subdivisions" ADD CONSTRAINT "subdivisions_parent_id_subdivisions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."subdivisions"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "anomalies_fingerprint_key" ON "anomalies" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "anomalies_status_idx" ON "anomalies" USING btree ("status","severity");--> statement-breakpoint
CREATE UNIQUE INDEX "countries_iso2_key" ON "countries" USING btree ("iso2");--> statement-breakpoint
CREATE UNIQUE INDEX "countries_iso3_key" ON "countries" USING btree ("iso3");--> statement-breakpoint
CREATE UNIQUE INDEX "countries_geonames_key" ON "countries" USING btree ("geonames_id");--> statement-breakpoint
CREATE INDEX "countries_display_name_idx" ON "countries" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX "country_currencies_currency_idx" ON "country_currencies" USING btree ("currency_code");--> statement-breakpoint
CREATE UNIQUE INDEX "datasets_version_key" ON "datasets" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "field_provenance_key" ON "field_provenance" USING btree ("entity_type","entity_id","field");--> statement-breakpoint
CREATE INDEX "field_provenance_source_idx" ON "field_provenance" USING btree ("source");--> statement-breakpoint
CREATE INDEX "names_lookup_idx" ON "names" USING btree ("entity_type","folded");--> statement-breakpoint
CREATE INDEX "names_entity_idx" ON "names" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "names_locale_idx" ON "names" USING btree ("entity_type","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "names_unique_key" ON "names" USING btree ("entity_type","entity_id","locale","kind","name");--> statement-breakpoint
CREATE UNIQUE INDEX "places_geonames_key" ON "places" USING btree ("geonames_id");--> statement-breakpoint
CREATE INDEX "places_country_idx" ON "places" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "places_subdivision_idx" ON "places" USING btree ("subdivision_id");--> statement-breakpoint
CREATE INDEX "places_parent_idx" ON "places" USING btree ("parent_place_id");--> statement-breakpoint
CREATE INDEX "places_city_idx" ON "places" USING btree ("country_id","is_city");--> statement-breakpoint
CREATE INDEX "places_feature_idx" ON "places" USING btree ("feature_code");--> statement-breakpoint
CREATE INDEX "proposals_anomaly_idx" ON "proposals" USING btree ("anomaly_id");--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "proposals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_source_sha_key" ON "snapshots" USING btree ("source","sha256");--> statement-breakpoint
CREATE INDEX "snapshots_source_idx" ON "snapshots" USING btree ("source","fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subdivisions_iso_key" ON "subdivisions" USING btree ("iso_3166_2");--> statement-breakpoint
CREATE UNIQUE INDEX "subdivisions_country_code_key" ON "subdivisions" USING btree ("country_id","code");--> statement-breakpoint
CREATE INDEX "subdivisions_country_idx" ON "subdivisions" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "subdivisions_parent_idx" ON "subdivisions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "subdivisions_admin1_idx" ON "subdivisions" USING btree ("country_id","geonames_admin1");