module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create Invoices table
    await queryInterface.createTable('invoices', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      invoiceNumber: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      customerGatewayId: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Foreign key to accounts.gatewayId'
      },
      customerName: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      customerCode: {
        type: Sequelize.STRING(100)
      },
      customerEmail: {
        type: Sequelize.STRING(255)
      },
      customerAddress: {
        type: Sequelize.TEXT
      },
      customerPhone: {
        type: Sequelize.STRING(50)
      },
      billingPeriodStart: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      billingPeriodEnd: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      invoiceDate: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      dueDate: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      subtotal: {
        type: Sequelize.DECIMAL(15, 4),
        allowNull: false,
        defaultValue: 0
      },
      taxRate: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      },
      taxAmount: {
        type: Sequelize.DECIMAL(15, 4),
        defaultValue: 0
      },
      discountAmount: {
        type: Sequelize.DECIMAL(15, 4),
        defaultValue: 0
      },
      adjustmentAmount: {
        type: Sequelize.DECIMAL(15, 4),
        defaultValue: 0
      },
      totalAmount: {
        type: Sequelize.DECIMAL(15, 4),
        allowNull: false,
        defaultValue: 0
      },
      paidAmount: {
        type: Sequelize.DECIMAL(15, 4),
        defaultValue: 0
      },
      balanceAmount: {
        type: Sequelize.DECIMAL(15, 4),
        defaultValue: 0
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'USD'
      },
      status: {
        type: Sequelize.ENUM('draft', 'pending', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'void'),
        defaultValue: 'draft'
      },
      paymentMethod: {
        type: Sequelize.STRING(50)
      },
      paymentDate: {
        type: Sequelize.BIGINT
      },
      paymentReference: {
        type: Sequelize.STRING(255)
      },
      notes: {
        type: Sequelize.TEXT
      },
      customerNotes: {
        type: Sequelize.TEXT
      },
      termsAndConditions: {
        type: Sequelize.TEXT
      },
      generatedBy: {
        type: Sequelize.INTEGER
      },
      sentDate: {
        type: Sequelize.BIGINT
      },
      viewedDate: {
        type: Sequelize.BIGINT
      },
      isRecurring: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      recurringPeriod: {
        type: Sequelize.ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly')
      },
      pdfPath: {
        type: Sequelize.STRING(500)
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Add indexes for invoices
    await queryInterface.addIndex('invoices', ['customerGatewayId'], {
      name: 'idx_invoices_customer_gateway_id'
    });
    await queryInterface.addIndex('invoices', ['invoiceNumber'], { 
      unique: true,
      name: 'idx_invoices_invoice_number' 
    });
    await queryInterface.addIndex('invoices', ['status'], {
      name: 'idx_invoices_status'
    });
    await queryInterface.addIndex('invoices', ['billingPeriodStart', 'billingPeriodEnd'], {
      name: 'idx_invoices_billing_period'
    });
    await queryInterface.addIndex('invoices', ['dueDate'], {
      name: 'idx_invoices_due_date'
    });

    // Create Invoice Items table
    await queryInterface.createTable('invoice_items', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      invoiceId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'invoices',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      itemType: {
        type: Sequelize.ENUM('call_charges', 'destination_charge', 'monthly_fee', 'setup_fee', 'additional_service', 'discount', 'adjustment'),
        allowNull: false
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      destination: {
        type: Sequelize.STRING(255)
      },
      destinationCode: {
        type: Sequelize.STRING(50)
      },
      quantity: {
        type: Sequelize.INTEGER,
        defaultValue: 1
      },
      duration: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      durationMinutes: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0
      },
      unitPrice: {
        type: Sequelize.DECIMAL(15, 6),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(15, 4),
        allowNull: false
      },
      totalCalls: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      completedCalls: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      failedCalls: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      asr: {
        type: Sequelize.DECIMAL(5, 2)
      },
      acd: {
        type: Sequelize.DECIMAL(10, 2)
      },
      taxable: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      taxAmount: {
        type: Sequelize.DECIMAL(15, 4),
        defaultValue: 0
      },
      periodStart: {
        type: Sequelize.BIGINT
      },
      periodEnd: {
        type: Sequelize.BIGINT
      },
      sortOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Add indexes for invoice_items
    await queryInterface.addIndex('invoice_items', ['invoiceId'], {
      name: 'idx_invoice_items_invoice_id'
    });
    await queryInterface.addIndex('invoice_items', ['itemType'], {
      name: 'idx_invoice_items_item_type'
    });
    await queryInterface.addIndex('invoice_items', ['destination'], {
      name: 'idx_invoice_items_destination'
    });

    // Create Payments table
    await queryInterface.createTable('payments', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      paymentNumber: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      customerGatewayId: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Foreign key to accounts.gatewayId'
      },
      customerName: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(15, 4),
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'USD'
      },
      paymentDate: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      paymentMethod: {
        type: Sequelize.ENUM('bank_transfer', 'credit_card', 'debit_card', 'paypal', 'stripe', 'cash', 'cheque', 'other'),
        allowNull: false
      },
      paymentGateway: {
        type: Sequelize.STRING(100)
      },
      transactionId: {
        type: Sequelize.STRING(255)
      },
      referenceNumber: {
        type: Sequelize.STRING(255)
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded', 'cancelled'),
        defaultValue: 'pending'
      },
      allocatedAmount: {
        type: Sequelize.DECIMAL(15, 4),
        defaultValue: 0
      },
      unappliedAmount: {
        type: Sequelize.DECIMAL(15, 4),
        defaultValue: 0
      },
      notes: {
        type: Sequelize.TEXT
      },
      customerNotes: {
        type: Sequelize.TEXT
      },
      receiptNumber: {
        type: Sequelize.STRING(50),
        unique: true
      },
      receiptPath: {
        type: Sequelize.STRING(500)
      },
      recordedBy: {
        type: Sequelize.INTEGER
      },
      recordedDate: {
        type: Sequelize.BIGINT
      },
      refundedAmount: {
        type: Sequelize.DECIMAL(15, 4),
        defaultValue: 0
      },
      refundDate: {
        type: Sequelize.BIGINT
      },
      refundReason: {
        type: Sequelize.TEXT
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Add indexes for payments
    await queryInterface.addIndex('payments', ['customerGatewayId'], {
      name: 'idx_payments_customer_gateway_id'
    });
    await queryInterface.addIndex('payments', ['paymentNumber'], { 
      unique: true,
      name: 'idx_payments_payment_number' 
    });
    await queryInterface.addIndex('payments', ['status'], {
      name: 'idx_payments_status'
    });
    await queryInterface.addIndex('payments', ['paymentDate'], {
      name: 'idx_payments_payment_date'
    });
    await queryInterface.addIndex('payments', ['transactionId'], {
      name: 'idx_payments_transaction_id'
    });

    // Create Payment Allocations table
    await queryInterface.createTable('payment_allocations', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      paymentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'payments',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      invoiceId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'invoices',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      allocatedAmount: {
        type: Sequelize.DECIMAL(15, 4),
        allowNull: false
      },
      allocationDate: {
        type: Sequelize.BIGINT,
        allowNull: false
      },
      notes: {
        type: Sequelize.TEXT
      },
      allocatedBy: {
        type: Sequelize.INTEGER
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Add indexes for payment_allocations
    await queryInterface.addIndex('payment_allocations', ['paymentId'], {
      name: 'idx_payment_allocations_payment_id'
    });
    await queryInterface.addIndex('payment_allocations', ['invoiceId'], {
      name: 'idx_payment_allocations_invoice_id'
    });
    await queryInterface.addIndex('payment_allocations', ['paymentId', 'invoiceId'], { 
      unique: true,
      name: 'idx_payment_allocations_payment_invoice'
    });

    // Add foreign key constraints (if your DB supports it)
    // Note: Foreign key to gatewayId requires the gatewayId column to have a unique index in accounts table
    // Make sure accounts table has: CREATE UNIQUE INDEX idx_accounts_gateway_id ON accounts(gatewayId);
    
    await queryInterface.addConstraint('invoices', {
      fields: ['customerGatewayId'],
      type: 'foreign key',
      name: 'fk_invoices_customer_gateway_id',
      references: {
        table: 'accounts',
        field: 'gatewayId'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    await queryInterface.addConstraint('payments', {
      fields: ['customerGatewayId'],
      type: 'foreign key',
      name: 'fk_payments_customer_gateway_id',
      references: {
        table: 'accounts',
        field: 'gatewayId'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('payment_allocations');
    await queryInterface.dropTable('payments');
    await queryInterface.dropTable('invoice_items');
    await queryInterface.dropTable('invoices');
  }
};