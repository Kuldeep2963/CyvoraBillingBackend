export const CDR_HEADERS = [
    "callere164",
    "calleraccesse164",
    "calleee164",
    "calleeaccesse164",
    "callerip",
    "callercodec",
    "callergatewayid",
    "callerproductid",
    "callertogatewaye164",
    "callertype",
    "calleeip",
    "calleecodec",
    "calleegatewayid",
    "calleeproductid",
    "calleetogatewaye164",
    "calleetype",
    "billingmode",
    "calllevel",
    "agentfeetime",
    "starttime",
    "stoptime",
    "callerpdd",
    "calleepdd",
    "holdtime",
    "callerareacode",
    "feetime",
    "fee",
    "tax",
    "suitefee",
    "suitefeetime",
    "incomefee",
    "incometax",
    "customeraccount",
    "customername",
    "calleeareacode",
    "agentfee",
    "agenttax",
    "agentsuitefee",
    "agentsuitefeetime",
    "agentaccount",
    "agentname",
    "flowno",
    "softswitchname",
    "softswitchcallid",
    "callercallid",
    "calleroriginalcallid",
    "rtpforward",
    "enddirection",
    "endreason",
    "billingtype",
    "cdrlevel",
    "agentcdr_id"
];

// Verify the count
console.log(`Total CDR columns: ${CDR_HEADERS.length}`);

export const CDR_COLUMN_COUNT = CDR_HEADERS.length; // 52

// Helper to map CSV row to object
export function mapCDRRowToObject(row) {
    const obj = {};
    CDR_HEADERS.forEach((header, index) => {
        if (row[index] !== undefined) {
            obj[header] = row[index] ? row[index].toString().trim() : '';
        } else {
            obj[header] = '';
        }
    });
    return obj;
}

// Validate CSV row has correct number of columns
export function validateCDRRow(row) {
    if (row.length !== CDR_COLUMN_COUNT) {
        console.warn(`Row has ${row.length} columns, expected ${CDR_COLUMN_COUNT}`);
        return false;
    }
    return true;
}
