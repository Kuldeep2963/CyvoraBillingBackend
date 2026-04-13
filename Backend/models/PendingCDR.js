'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const PendingCDR = sequelize.define(
  'PendingCDR',
  {
    id: {
      type:          DataTypes.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
    },
    source_id: {
      type:      DataTypes.STRING(255),
      allowNull: false,
      comment:   'MySQLCDRFetcher sourceId, e.g. "company_b"',
    },
    table_name: {
      type:      DataTypes.STRING(64),
      allowNull: false,
      comment:   'e.g. "e_cdr_20260409"',
    },
    flowno: {
      type:      DataTypes.STRING(32),
      allowNull: false,
      comment:   'flowno from the source table, stored as string to avoid BigInt overflow',
    },
    first_seen: {
      type:      DataTypes.BIGINT,
      allowNull: false,
      comment:   'Unix epoch ms when this flowno was first observed without a stoptime',
    },
  },
  {
    tableName:  'pending_cdrs',
    timestamps: false,
    indexes:    [
      {
        unique: true,
        name:   'uq_pending_cdr_source_table_flowno',
        fields: ['source_id', 'table_name', 'flowno'],
      },
      {
        name:   'idx_pending_cdr_source_table',
        fields: ['source_id', 'table_name'],
      },
    ],
  }
);

module.exports = PendingCDR;