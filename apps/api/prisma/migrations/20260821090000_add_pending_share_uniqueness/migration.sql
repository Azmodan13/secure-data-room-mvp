-- Prevent duplicate active pending grants for the same email and target.
CREATE UNIQUE INDEX "share_grants_active_room_email_key"
    ON "share_grants" ("data_room_id", "recipient_email")
    WHERE "revoked_at" IS NULL AND "data_room_id" IS NOT NULL;

CREATE UNIQUE INDEX "share_grants_active_folder_email_key"
    ON "share_grants" ("folder_id", "recipient_email")
    WHERE "revoked_at" IS NULL AND "folder_id" IS NOT NULL;

CREATE UNIQUE INDEX "share_grants_active_file_email_key"
    ON "share_grants" ("file_id", "recipient_email")
    WHERE "revoked_at" IS NULL AND "file_id" IS NOT NULL;
