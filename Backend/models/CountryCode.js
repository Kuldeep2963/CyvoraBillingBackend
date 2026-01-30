const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const CountryCode = sequelize.define('CountryCode', {
  code: {
    type: DataTypes.STRING(10),
    primaryKey: true,
    allowNull: false
  },
  country_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'country_codes',
  timestamps: false
});

module.exports = CountryCode;
