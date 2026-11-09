-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'agency_admin', 'internal_employee', 'partner_admin', 'partner_employee');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "WeighingStatus" AS ENUM ('active', 'corrected', 'cancelled');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "region" TEXT,
    "technical_responsible" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_types" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partner_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trade_name" TEXT,
    "cnpj" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_type_links" (
    "organization_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "partner_type_id" UUID NOT NULL,

    CONSTRAINT "partner_type_links_pkey" PRIMARY KEY ("partner_id","partner_type_id")
);

-- CreateTable
CREATE TABLE "agency_partner_links" (
    "organization_id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "agency_partner_links_pkey" PRIMARY KEY ("agency_id","partner_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "agency_id" UUID,
    "partner_id" UUID,
    "name" TEXT NOT NULL,
    "cpf" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "residue_types" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "default_destination" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "residue_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waste_bag_weighings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "residue_type_id" UUID NOT NULL,
    "registered_by" UUID NOT NULL,
    "destination_partner_id" UUID,
    "weight_kg" DECIMAL(10,3) NOT NULL,
    "weighed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "evidence_url" TEXT,
    "status" "WeighingStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "waste_bag_weighings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "csrf_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_document_key" ON "organizations"("document");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_organization_id_id_key" ON "agencies"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_organization_id_code_key" ON "agencies"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_organization_id_cnpj_key" ON "agencies"("organization_id", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "partner_types_organization_id_id_key" ON "partner_types"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_types_organization_id_name_key" ON "partner_types"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "partners_organization_id_id_key" ON "partners"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "partners_organization_id_cnpj_key" ON "partners"("organization_id", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_agency_id_idx" ON "users"("organization_id", "agency_id");

-- CreateIndex
CREATE INDEX "users_organization_id_partner_id_idx" ON "users"("organization_id", "partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_id_key" ON "users"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_cpf_key" ON "users"("organization_id", "cpf");

-- CreateIndex
CREATE UNIQUE INDEX "residue_types_organization_id_id_key" ON "residue_types"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "residue_types_organization_id_name_key" ON "residue_types"("organization_id", "name");

-- CreateIndex
CREATE INDEX "waste_bag_weighings_organization_id_agency_id_weighed_at_idx" ON "waste_bag_weighings"("organization_id", "agency_id", "weighed_at");

-- CreateIndex
CREATE INDEX "waste_bag_weighings_organization_id_destination_partner_id__idx" ON "waste_bag_weighings"("organization_id", "destination_partner_id", "weighed_at");

-- CreateIndex
CREATE INDEX "waste_bag_weighings_organization_id_residue_type_id_status_idx" ON "waste_bag_weighings"("organization_id", "residue_type_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "waste_bag_weighings_organization_id_id_key" ON "waste_bag_weighings"("organization_id", "id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_entity_type_entity_id_created_at_idx" ON "audit_logs"("organization_id", "entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");


-- Explicit SQL constraints are maintained here because tenant integrity spans composite keys.
ALTER TABLE agencies ADD CONSTRAINT agencies_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE partners ADD CONSTRAINT partners_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE partner_types ADD CONSTRAINT partner_types_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE residue_types ADD CONSTRAINT residue_types_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE users ADD CONSTRAINT users_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE users ADD CONSTRAINT users_agency_fk FOREIGN KEY (organization_id, agency_id) REFERENCES agencies(organization_id, id) ON DELETE RESTRICT;
ALTER TABLE users ADD CONSTRAINT users_partner_fk FOREIGN KEY (organization_id, partner_id) REFERENCES partners(organization_id, id) ON DELETE RESTRICT;
ALTER TABLE users ADD CONSTRAINT users_role_scope CHECK (
  (role = 'super_admin' AND agency_id IS NULL AND partner_id IS NULL) OR
  (role IN ('agency_admin', 'internal_employee') AND agency_id IS NOT NULL AND partner_id IS NULL) OR
  (role IN ('partner_admin', 'partner_employee') AND agency_id IS NULL AND partner_id IS NOT NULL)
);
ALTER TABLE agency_partner_links ADD CONSTRAINT agency_link_agency_fk FOREIGN KEY (organization_id, agency_id) REFERENCES agencies(organization_id, id) ON DELETE RESTRICT;
ALTER TABLE agency_partner_links ADD CONSTRAINT agency_link_partner_fk FOREIGN KEY (organization_id, partner_id) REFERENCES partners(organization_id, id) ON DELETE RESTRICT;
ALTER TABLE partner_type_links ADD CONSTRAINT type_link_partner_fk FOREIGN KEY (organization_id, partner_id) REFERENCES partners(organization_id, id) ON DELETE RESTRICT;
ALTER TABLE partner_type_links ADD CONSTRAINT type_link_type_fk FOREIGN KEY (organization_id, partner_type_id) REFERENCES partner_types(organization_id, id) ON DELETE RESTRICT;
ALTER TABLE waste_bag_weighings ADD CONSTRAINT weighing_agency_fk FOREIGN KEY (organization_id, agency_id) REFERENCES agencies(organization_id, id) ON DELETE RESTRICT;
ALTER TABLE waste_bag_weighings ADD CONSTRAINT weighing_residue_fk FOREIGN KEY (organization_id, residue_type_id) REFERENCES residue_types(organization_id, id) ON DELETE RESTRICT;
ALTER TABLE waste_bag_weighings ADD CONSTRAINT weighing_user_fk FOREIGN KEY (organization_id, registered_by) REFERENCES users(organization_id, id) ON DELETE RESTRICT;
ALTER TABLE waste_bag_weighings ADD CONSTRAINT weighing_partner_fk FOREIGN KEY (organization_id, destination_partner_id) REFERENCES partners(organization_id, id) ON DELETE RESTRICT;
ALTER TABLE waste_bag_weighings ADD CONSTRAINT weighing_positive_weight CHECK (weight_kg > 0);
ALTER TABLE waste_bag_weighings ADD CONSTRAINT weighing_positive_version CHECK (version > 0);
ALTER TABLE audit_logs ADD CONSTRAINT audit_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE audit_logs ADD CONSTRAINT audit_user_fk FOREIGN KEY (organization_id, user_id) REFERENCES users(organization_id, id) ON DELETE RESTRICT;
ALTER TABLE sessions ADD CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Audit trail is append-only for the application; privileged DB maintenance remains external.
CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
