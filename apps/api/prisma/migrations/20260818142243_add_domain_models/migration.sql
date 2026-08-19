-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ShareRole" AS ENUM ('VIEWER');

-- CreateTable
CREATE TABLE "data_rooms" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" UUID NOT NULL,
    "data_room_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "data_room_id" UUID NOT NULL,
    "folder_id" UUID,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum" TEXT,
    "upload_status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_grants" (
    "id" UUID NOT NULL,
    "data_room_id" UUID,
    "folder_id" UUID,
    "file_id" UUID,
    "recipient_user_id" UUID,
    "recipient_email" TEXT NOT NULL,
    "role" "ShareRole" NOT NULL DEFAULT 'VIEWER',
    "notified_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_links" (
    "id" UUID NOT NULL,
    "data_room_id" UUID,
    "folder_id" UUID,
    "file_id" UUID,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_links_pkey" PRIMARY KEY ("id")
);

-- Ensure every share targets exactly one resource.
ALTER TABLE "share_grants"
    ADD CONSTRAINT "share_grants_exactly_one_target_check"
        CHECK (num_nonnulls("data_room_id", "folder_id", "file_id") = 1);

ALTER TABLE "public_links"
    ADD CONSTRAINT "public_links_exactly_one_target_check"
        CHECK (num_nonnulls("data_room_id", "folder_id", "file_id") = 1);

-- PostgreSQL treats NULL values as distinct, so Prisma's compound
-- unique indexes do not protect root-level folder and file names.
CREATE UNIQUE INDEX "folders_root_normalized_name_key"
    ON "folders" ("data_room_id", "normalized_name")
    WHERE "parent_id" IS NULL;

CREATE UNIQUE INDEX "files_root_normalized_name_key"
    ON "files" ("data_room_id", "normalized_name")
    WHERE "folder_id" IS NULL;

-- A recipient may have only one active grant for a specific target.
-- Revoked grants remain stored for auditability.
CREATE UNIQUE INDEX "share_grants_active_room_recipient_key"
    ON "share_grants" ("data_room_id", "recipient_user_id")
    WHERE
  "revoked_at" IS NULL
  AND "data_room_id" IS NOT NULL
  AND "recipient_user_id" IS NOT NULL;

CREATE UNIQUE INDEX "share_grants_active_folder_recipient_key"
    ON "share_grants" ("folder_id", "recipient_user_id")
    WHERE
  "revoked_at" IS NULL
  AND "folder_id" IS NOT NULL
  AND "recipient_user_id" IS NOT NULL;

CREATE UNIQUE INDEX "share_grants_active_file_recipient_key"
    ON "share_grants" ("file_id", "recipient_user_id")
    WHERE
  "revoked_at" IS NULL
  AND "file_id" IS NOT NULL
  AND "recipient_user_id" IS NOT NULL;

-- A target may expose only one active public link.
CREATE UNIQUE INDEX "public_links_active_room_key"
    ON "public_links" ("data_room_id")
    WHERE "revoked_at" IS NULL AND "data_room_id" IS NOT NULL;

CREATE UNIQUE INDEX "public_links_active_folder_key"
    ON "public_links" ("folder_id")
    WHERE "revoked_at" IS NULL AND "folder_id" IS NOT NULL;

CREATE UNIQUE INDEX "public_links_active_file_key"
    ON "public_links" ("file_id")
    WHERE "revoked_at" IS NULL AND "file_id" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "data_rooms_owner_id_normalized_name_key" ON "data_rooms"("owner_id", "normalized_name");

-- CreateIndex
CREATE INDEX "folders_data_room_id_parent_id_idx" ON "folders"("data_room_id", "parent_id");

-- CreateIndex
CREATE INDEX "folders_parent_id_idx" ON "folders"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "folders_data_room_id_parent_id_normalized_name_key" ON "folders"("data_room_id", "parent_id", "normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE INDEX "files_folder_id_created_at_id_idx" ON "files"("folder_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "files_data_room_id_folder_id_idx" ON "files"("data_room_id", "folder_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_data_room_id_folder_id_normalized_name_key" ON "files"("data_room_id", "folder_id", "normalized_name");

-- CreateIndex
CREATE INDEX "share_grants_recipient_user_id_revoked_at_idx" ON "share_grants"("recipient_user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "share_grants_recipient_email_revoked_at_idx" ON "share_grants"("recipient_email", "revoked_at");

-- CreateIndex
CREATE INDEX "share_grants_data_room_id_idx" ON "share_grants"("data_room_id");

-- CreateIndex
CREATE INDEX "share_grants_folder_id_idx" ON "share_grants"("folder_id");

-- CreateIndex
CREATE INDEX "share_grants_file_id_idx" ON "share_grants"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "public_links_token_hash_key" ON "public_links"("token_hash");

-- CreateIndex
CREATE INDEX "public_links_data_room_id_idx" ON "public_links"("data_room_id");

-- CreateIndex
CREATE INDEX "public_links_folder_id_idx" ON "public_links"("folder_id");

-- CreateIndex
CREATE INDEX "public_links_file_id_idx" ON "public_links"("file_id");

-- AddForeignKey
ALTER TABLE "data_rooms" ADD CONSTRAINT "data_rooms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_data_room_id_fkey" FOREIGN KEY ("data_room_id") REFERENCES "data_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_data_room_id_fkey" FOREIGN KEY ("data_room_id") REFERENCES "data_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_grants" ADD CONSTRAINT "share_grants_data_room_id_fkey" FOREIGN KEY ("data_room_id") REFERENCES "data_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_grants" ADD CONSTRAINT "share_grants_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_grants" ADD CONSTRAINT "share_grants_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_grants" ADD CONSTRAINT "share_grants_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_links" ADD CONSTRAINT "public_links_data_room_id_fkey" FOREIGN KEY ("data_room_id") REFERENCES "data_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_links" ADD CONSTRAINT "public_links_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_links" ADD CONSTRAINT "public_links_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
