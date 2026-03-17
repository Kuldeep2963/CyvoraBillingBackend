'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

let sequelize;
if (config.use_env_variable && process.env[config.use_env_variable]) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  const database = process.env.DB_NAME || config.database;
  const username = process.env.DB_USER || config.username;
  const password = process.env.DB_PASS || config.password;
  const host = process.env.DB_HOST || config.host;
  const dialect = process.env.DB_DIALECT || config.dialect;
  const port = Number(process.env.DB_PORT || config.port || 5432);

  sequelize = new Sequelize(database, username, password, {
    ...config,
    host,
    dialect,
    port,
  });
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
