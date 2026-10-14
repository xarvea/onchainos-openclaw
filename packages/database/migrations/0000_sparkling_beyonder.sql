CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"asset" text NOT NULL,
	"collection" text,
	"from" text,
	"to" text,
	"price" bigint,
	"tx_signature" text NOT NULL,
	"block_time" timestamp with time zone NOT NULL,
	"slot" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"mint" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"uri" text NOT NULL,
	"image" text,
	"standard" text NOT NULL,
	"collection" text,
	"owner" text NOT NULL,
	"creator" text,
	"attributes" jsonb DEFAULT '[]'::jsonb,
	"compressed" boolean DEFAULT false NOT NULL,
	"frozen" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"address" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"description" text,
	"verified" boolean DEFAULT false NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"standard" text NOT NULL,
	"creator" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset" text NOT NULL,
	"seller" text NOT NULL,
	"price" bigint NOT NULL,
	"platform_fee" bigint NOT NULL,
	"creator_royalty" bigint NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"tx_signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"cursor" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "activities_asset_idx" ON "activities" USING btree ("asset");--> statement-breakpoint
CREATE INDEX "activities_collection_idx" ON "activities" USING btree ("collection");--> statement-breakpoint
CREATE INDEX "activities_blocktime_idx" ON "activities" USING btree ("block_time");--> statement-breakpoint
CREATE INDEX "assets_owner_idx" ON "assets" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "assets_collection_idx" ON "assets" USING btree ("collection");--> statement-breakpoint
CREATE INDEX "assets_creator_idx" ON "assets" USING btree ("creator");--> statement-breakpoint
CREATE INDEX "collections_creator_idx" ON "collections" USING btree ("creator");--> statement-breakpoint
CREATE INDEX "listings_asset_status_idx" ON "listings" USING btree ("asset","status");--> statement-breakpoint
CREATE INDEX "listings_seller_idx" ON "listings" USING btree ("seller");