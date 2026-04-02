const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const NotificationRead = sequelize.define('NotificationRead', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  notificationId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'notification_id',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'read_at',
  },
}, {
  tableName: 'notification_reads',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['notification_id', 'user_id'],
    },
    {
      fields: ['user_id', 'read_at'],
    },
  ],
});

module.exports = NotificationRead;
