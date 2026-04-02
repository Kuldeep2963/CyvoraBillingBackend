const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const SystemSetting = sequelize.define('SystemSetting', {
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
  value: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
  updatedBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'system_settings',
  timestamps: true,
});

module.exports = SystemSetting;
