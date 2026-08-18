-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
