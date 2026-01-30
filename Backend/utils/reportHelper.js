const { literal } = require('sequelize');

module.exports = {
  completedCall: literal(`CASE WHEN NULLIF(feetime, '')::numeric > 0 THEN 1 ELSE 0 END`),

  failedCall: literal(`CASE WHEN NULLIF(feetime, '')::numeric = 0 THEN 1 ELSE 0 END`),

  durationSec: literal(`COALESCE(NULLIF(feetime, '')::numeric, 0)`),

  revenue: literal(`COALESCE(NULLIF(fee, '')::numeric, 0)`),

  cost: literal(`COALESCE(NULLIF(agentfee, '')::numeric, 0)`),

  hour: literal(`EXTRACT(HOUR FROM to_timestamp(NULLIF(starttime, '')::bigint / 1000))`),

  reportDate: literal(`DATE(to_timestamp(NULLIF(starttime, '')::bigint / 1000))`)
};
