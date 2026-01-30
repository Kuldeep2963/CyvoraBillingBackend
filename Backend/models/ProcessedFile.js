const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const ProcessedFile = sequelize.define('ProcessedFile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  filename: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'PROCESSING'
  },
  started_at: {
    type: DataTypes.DATE
  },
  completed_at: {
    type: DataTypes.DATE
  },
  records_processed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  error_message: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'processed_files',
  timestamps: true
});

module.exports = ProcessedFile;
