CREATE TABLE "user_organization_creation_grants" (
  "user_id" UUID NOT NULL,
  "organization_type" "OrganizationType" NOT NULL,
  "granted_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_organization_creation_grants_pkey" PRIMARY KEY ("user_id", "organization_type"),
  CONSTRAINT "user_organization_creation_grants_no_personal_check" CHECK ("organization_type" <> 'PERSONAL'::"OrganizationType"),
  CONSTRAINT "user_organization_creation_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_organization_creation_grants_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "user_organization_creation_grants_granted_by_idx"
  ON "user_organization_creation_grants"("granted_by");
