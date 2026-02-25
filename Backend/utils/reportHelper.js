const { literal } = require('sequelize');

module.exports = {
  completedCall: literal(`
    CASE
      WHEN feetime::text ~ '^[0-9]+(\\.[0-9]+)?$'
           AND feetime::numeric > 0
      THEN 1 ELSE 0
    END
  `),

  failedCall: literal(`
    CASE
      WHEN feetime::text ~ '^[0-9]+(\\.[0-9]+)?$'
           AND feetime::numeric = 0
      THEN 1 ELSE 0
    END
  `),

  durationSec: literal(`
    CASE
      WHEN feetime::text ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN feetime::numeric
      ELSE 0
    END
  `),

  revenue: literal(`
  (
    COALESCE(NULLIF(fee::text, '')::numeric, 0) +
    COALESCE(NULLIF(tax::text, '')::numeric, 0) +
    COALESCE(NULLIF(suitefee::text, '')::numeric, 0) +
    COALESCE(NULLIF(incomefee::text, '')::numeric, 0) +
    COALESCE(NULLIF(incometax::text, '')::numeric, 0)
  )
`),

  cost: literal(`
  (
    COALESCE(NULLIF(agentfee::text, '')::numeric, 0) +
    COALESCE(NULLIF(agenttax::text, '')::numeric, 0) +
    COALESCE(NULLIF(agentsuitefee::text, '')::numeric, 0)
  )
`),

  tax: literal(`
    CASE
      WHEN tax::text ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN tax::numeric
      ELSE 0
    END
  `),

  incomeFee: literal(`
    CASE
      WHEN incomefee::text ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN incomefee::numeric
      ELSE 0
    END
  `),

  agentFee: literal(`
    CASE
      WHEN agentfee::text ~ '^[0-9]+(\\.[0-9]+)?$'
      THEN agentfee::numeric
      ELSE 0
    END
  `),

  hour: literal(`
    EXTRACT(
      HOUR FROM
      to_timestamp(
        CASE
          WHEN starttime::text ~ '^[0-9]+$'
          THEN starttime::bigint
          ELSE NULL
        END / 1000
      )
    )
  `),

  reportDate: literal(`
    DATE(
      to_timestamp(
        CASE
          WHEN starttime::text ~ '^[0-9]+$'
          THEN starttime::bigint
          ELSE NULL
        END / 1000
      )
    )
  `)
};
