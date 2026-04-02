const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const environment = process.env.NODE_ENV || 'development';
const allConfig = require('../config/config.json');
const config = allConfig[environment] || {};

const database = process.env.DB_NAME || config.database;
const username = process.env.DB_USER || config.username;
const password = process.env.DB_PASS || config.password;
const host = process.env.DB_HOST || config.host || '127.0.0.1';
const dialect = process.env.DB_DIALECT || config.dialect || 'postgres';
const port = Number(process.env.DB_PORT || config.port || 5432);

if (!database || !username) {
  throw new Error('Database configuration is incomplete. Set DB_NAME and DB_USER in environment variables.');
}

const sequelize = new Sequelize(
  database,
  username,
  password,
  {
    host,
    dialect,
    port,
    logging: false
  }
);

module.exports = sequelize;
