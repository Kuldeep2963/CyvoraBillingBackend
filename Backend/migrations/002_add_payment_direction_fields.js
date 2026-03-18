module.exports = {
  async up(queryInterface, Sequelize) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return '';
    });

    if (!normalizedTables.includes('payments')) {
      console.log('Skipping 002 migration: payments table does not exist yet');
      return;
    }

    const tableDescription = await queryInterface.describeTable('payments');

    if (!tableDescription.partyType) {
      await queryInterface.addColumn('payments', 'partyType', {
        type: Sequelize.ENUM('customer', 'vendor', 'internal'),
        allowNull: false,
        defaultValue: 'customer'
      });
    }

    if (!tableDescription.paymentDirection) {
      await queryInterface.addColumn('payments', 'paymentDirection', {
        type: Sequelize.ENUM('inbound', 'outbound'),
        allowNull: false,
        defaultValue: 'inbound'
      });
    }

    if (!tableDescription.vendorInvoiceId) {
      await queryInterface.addColumn('payments', 'vendorInvoiceId', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }

    await queryInterface.addIndex('payments', ['partyType', 'paymentDirection'], {
      name: 'payments_party_type_direction_idx'
    }).catch(() => {});

    await queryInterface.addIndex('payments', ['vendorInvoiceId'], {
      name: 'payments_vendor_invoice_id_idx'
    }).catch(() => {});

    if (!normalizedTables.includes('vendor_invoices')) {
      console.log('Skipping vendor payment backfill in 002: vendor_invoices table does not exist');
      return;
    }

    const [paidVendorInvoices] = await queryInterface.sequelize.query(`
      SELECT
        vi.id,
        vi."vendorId",
        vi."vendorCode",
        vi."invoiceNumber",
        vi."grandTotal",
        vi.currency,
        vi."updatedAt",
        a."gatewayId",
        a."accountName"
      FROM vendor_invoices vi
      LEFT JOIN accounts a ON a.id = vi."vendorId"
      WHERE vi.status = 'paid'
        AND NOT EXISTS (
          SELECT 1
          FROM payments p
          WHERE p."vendorInvoiceId" = vi.id
            AND p."partyType" = 'vendor'
            AND p."paymentDirection" = 'outbound'
        )
      ORDER BY vi."updatedAt" ASC, vi.id ASC
    `);

    if (paidVendorInvoices.length > 0) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');

      const [existingPayments] = await queryInterface.sequelize.query(`
        SELECT COUNT(*)::int AS count
        FROM payments
        WHERE "paymentNumber" LIKE 'PAY-${year}-${month}-%'
      `);

      let sequence = Number(existingPayments[0]?.count || 0);
      const paymentRows = paidVendorInvoices.map((invoice) => {
        sequence += 1;
        const paymentNumber = `PAY-${year}-${month}-${String(sequence).padStart(4, '0')}`;
        const paymentTimestamp = invoice.updatedAt ? new Date(invoice.updatedAt).getTime() : Date.now();

        return {
          paymentNumber,
          receiptNumber: `VND-${paymentNumber.split('-').slice(1).join('-')}`,
          customerGatewayId: invoice.gatewayId || invoice.vendorCode || String(invoice.vendorId || invoice.id),
          customerName: invoice.accountName || invoice.vendorCode,
          customerCode: invoice.vendorCode,
          partyType: 'vendor',
          paymentDirection: 'outbound',
          amount: invoice.grandTotal,
          currency: invoice.currency || 'USD',
          paymentDate: paymentTimestamp,
          paymentMethod: 'bank_transfer',
          paymentGateway: null,
          transactionId: `VENDOR-PAY-${invoice.invoiceNumber}`,
          referenceNumber: invoice.invoiceNumber,
          status: 'completed',
          allocatedAmount: invoice.grandTotal,
          unappliedAmount: 0,
          notes: `Backfilled vendor payment for invoice ${invoice.invoiceNumber}`,
          customerNotes: null,
          receiptPath: null,
          recordedBy: null,
          recordedDate: paymentTimestamp,
          refundedAmount: 0,
          refundDate: null,
          refundReason: null,
          vendorInvoiceId: invoice.id,
          createdAt: now,
          updatedAt: now
        };
      });

      await queryInterface.bulkInsert('payments', paymentRows);
    }
  },

  async down(queryInterface) {
    const allTables = await queryInterface.showAllTables();
    const normalizedTables = allTables.map((t) => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t.tableName === 'string') return t.tableName.toLowerCase();
      return '';
    });

    if (!normalizedTables.includes('payments')) {
      return;
    }

    await queryInterface.removeIndex('payments', 'payments_party_type_direction_idx').catch(() => {});
    await queryInterface.removeIndex('payments', 'payments_vendor_invoice_id_idx').catch(() => {});

    const tableDescription = await queryInterface.describeTable('payments');

    if (tableDescription.vendorInvoiceId) {
      await queryInterface.removeColumn('payments', 'vendorInvoiceId');
    }

    if (tableDescription.paymentDirection) {
      await queryInterface.removeColumn('payments', 'paymentDirection');
    }

    if (tableDescription.partyType) {
      await queryInterface.removeColumn('payments', 'partyType');
    }
  }
};