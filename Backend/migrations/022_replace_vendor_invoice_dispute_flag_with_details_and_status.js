'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const table = await queryInterface.describeTable('vendor_invoices', { transaction });

      if (!table.disputeDetails) {
        await queryInterface.addColumn(
          'vendor_invoices',
          'disputeDetails',
          {
            type: Sequelize.JSONB,
            allowNull: true,
            defaultValue: null,
          },
          { transaction }
        );
      }

      if (table.status) {
        await queryInterface.sequelize.query(
          `
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1
                FROM pg_type
                WHERE typname = 'enum_vendor_invoices_status_new'
              ) THEN
                CREATE TYPE "enum_vendor_invoices_status_new" AS ENUM ('pending', 'paid', 'disputed');
              END IF;
            END $$;
          `,
          { transaction }
        );

        await queryInterface.sequelize.query(
          `ALTER TABLE "vendor_invoices" ALTER COLUMN "status" DROP DEFAULT;`,
          { transaction }
        );

        await queryInterface.sequelize.query(
          `
            ALTER TABLE "vendor_invoices"
            ALTER COLUMN "status"
            TYPE "enum_vendor_invoices_status_new"
            USING (
              CASE
                WHEN ${table.isDisputed ? 'COALESCE("isDisputed", false) = true' : 'LOWER(COALESCE("status"::text, \'\')) = \'disputed\''} THEN 'disputed'
                WHEN LOWER(COALESCE("status"::text, '')) = 'paid' THEN 'paid'
                ELSE 'pending'
              END
            )::"enum_vendor_invoices_status_new";
          `,
          { transaction }
        );

        await queryInterface.sequelize.query(
          `DROP TYPE IF EXISTS "enum_vendor_invoices_status";`,
          { transaction }
        );

        await queryInterface.sequelize.query(
          `ALTER TYPE "enum_vendor_invoices_status_new" RENAME TO "enum_vendor_invoices_status";`,
          { transaction }
        );

        await queryInterface.sequelize.query(
          `ALTER TABLE "vendor_invoices" ALTER COLUMN "status" SET DEFAULT 'pending';`,
          { transaction }
        );
      }

      if (table.isDisputed) {
        await queryInterface.removeColumn('vendor_invoices', 'isDisputed', { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const table = await queryInterface.describeTable('vendor_invoices', { transaction });

      if (!table.isDisputed) {
        await queryInterface.addColumn(
          'vendor_invoices',
          'isDisputed',
          {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          },
          { transaction }
        );
      }

      if (table.status) {
        await queryInterface.sequelize.query(
          `
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1
                FROM pg_type
                WHERE typname = 'enum_vendor_invoices_status_old'
              ) THEN
                CREATE TYPE "enum_vendor_invoices_status_old" AS ENUM (
                  'pending', 'approved', 'rejected', 'processing', 'paid', 'processed', 'error'
                );
              END IF;
            END $$;
          `,
          { transaction }
        );

        await queryInterface.sequelize.query(
          `ALTER TABLE "vendor_invoices" ALTER COLUMN "status" DROP DEFAULT;`,
          { transaction }
        );

        await queryInterface.sequelize.query(
          `
            ALTER TABLE "vendor_invoices"
            ALTER COLUMN "status"
            TYPE "enum_vendor_invoices_status_old"
            USING (
              CASE
                WHEN LOWER(COALESCE("status"::text, '')) = 'paid' THEN 'paid'
                WHEN LOWER(COALESCE("status"::text, '')) = 'disputed' THEN 'processing'
                ELSE 'pending'
              END
            )::"enum_vendor_invoices_status_old";
          `,
          { transaction }
        );

        await queryInterface.sequelize.query(
          `DROP TYPE IF EXISTS "enum_vendor_invoices_status";`,
          { transaction }
        );

        await queryInterface.sequelize.query(
          `ALTER TYPE "enum_vendor_invoices_status_old" RENAME TO "enum_vendor_invoices_status";`,
          { transaction }
        );

        await queryInterface.sequelize.query(
          `ALTER TABLE "vendor_invoices" ALTER COLUMN "status" SET DEFAULT 'pending';`,
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        `
          UPDATE "vendor_invoices"
          SET "isDisputed" = CASE
            WHEN LOWER(COALESCE("status"::text, '')) = 'processing' THEN true
            ELSE false
          END
        `,
        { transaction }
      );

      if (table.disputeDetails) {
        await queryInterface.removeColumn('vendor_invoices', 'disputeDetails', { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
