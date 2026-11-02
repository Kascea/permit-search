ALTER TABLE "search_requests" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "search_requests" ADD CONSTRAINT "search_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_requests_user_requested_at" ON "search_requests" USING btree ("user_id","requested_at");