const { DataTypes } = require('sequelize');
const sequelize = require('./db');
const Account = require('./Account');

const CustomerRate = sequelize.define('CustomerRate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  
  accountId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Account,
      key: 'id'
    },
    comment: 'Reference to Account.id (customer account)'
  },

  trunk: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Trunk name/identifier for this rate'
  },

  rateData: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Rate information: { destination, rate, currency, effectiveDate, etc. }'
  },

  uploadedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: 'When this rate was uploaded/created'
  },

  uploadedBy: {
    type: DataTypes.INTEGER,
    comment: 'User ID who uploaded this rate'
  },

  fileReference: {
    type: DataTypes.STRING(500),
    comment: 'Reference to uploaded Excel file name (e.g., chinaskyline(1).xlsx)'
  },

  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether this rate is currently active'
  }
}, {
  tableName: 'customerrates',
  timestamps: true,
  indexes: [
    { fields: ['accountId'] },
    { fields: ['accountId', 'trunk'] },
    { unique: true, fields: ['accountId', 'trunk', 'uploadedAt'] },
    { fields: ['isActive'] }
  ]
});

// Associations
CustomerRate.associate = function(models) {
  CustomerRate.belongsTo(models.Account, {
    foreignKey: 'accountId',
    as: 'account'
  });
  
  CustomerRate.belongsTo(models.User, {
    foreignKey: 'uploadedBy',
    as: 'uploader'
  });
};

// Ensure associations exist immediately when file is required (some codebase parts
// require models directly instead of via models/index which calls associate()).
try {
  if (Account) {
    CustomerRate.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });
  }
} catch (err) {
  // ignore if association already established or Account not available yet
}

try {
  const User = require('./User');
  if (User) {
    CustomerRate.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });
  }
} catch (err) {
  // ignore
}

module.exports = CustomerRate;
