const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const CDR = sequelize.define('CDR', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: () => `cdr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },

  callere164: DataTypes.STRING,
  calleraccesse164: DataTypes.STRING,
  calleee164: DataTypes.STRING,
  calleeaccesse164: DataTypes.STRING,
  callerip: DataTypes.STRING,
  callercodec: DataTypes.STRING,
  callergatewayid: DataTypes.STRING,
  callerproductid: DataTypes.STRING,
  callertogatewaye164: DataTypes.STRING,
  callertype: DataTypes.STRING,
  calleeip: DataTypes.STRING,
  calleecodec: DataTypes.STRING,
  calleegatewayid: DataTypes.STRING,
  calleeproductid: DataTypes.STRING,
  calleetogatewaye164: DataTypes.STRING,
  calleetype: DataTypes.STRING,
  billingmode: DataTypes.STRING,
  calllevel: DataTypes.STRING,
  agentfeetime: DataTypes.STRING,
  starttime: DataTypes.STRING,
  stoptime: DataTypes.STRING,
  callerpdd: DataTypes.STRING,
  calleepdd: DataTypes.STRING,
  holdtime: DataTypes.STRING,
  callerareacode: DataTypes.STRING,
  feetime: DataTypes.STRING,
  fee: DataTypes.STRING,
  tax: DataTypes.STRING,
  suitefee: DataTypes.STRING,
  suitefeetime: DataTypes.STRING,
  incomefee: DataTypes.STRING,
  incometax: DataTypes.STRING,
  customeraccount: DataTypes.STRING,
  customername: DataTypes.STRING,
  calleeareacode: DataTypes.STRING,
  agentfee: DataTypes.STRING,
  agenttax: DataTypes.STRING,
  agentsuitefee: DataTypes.STRING,
  agentsuitefeetime: DataTypes.STRING,
  agentaccount: DataTypes.STRING,
  agentname: DataTypes.STRING,
  flowno: DataTypes.STRING,
  softswitchname: DataTypes.STRING,
  softswitchcallid: DataTypes.STRING,
  callercallid: DataTypes.STRING,
  calleroriginalcallid: DataTypes.STRING,
  rtpforward: DataTypes.STRING,
  enddirection: DataTypes.STRING,
  endreason: DataTypes.STRING,
  billingtype: DataTypes.STRING,
  cdrlevel: DataTypes.STRING,
  agentcdr_id: DataTypes.STRING,
  source_file: DataTypes.STRING

}, {
  tableName: 'cdrs',
  timestamps: true
});

module.exports = CDR;
