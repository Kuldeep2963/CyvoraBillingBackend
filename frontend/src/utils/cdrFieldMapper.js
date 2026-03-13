/**
 * CDR Field Mapper Utility
 * Maps between old and new CDR schema field names for backward compatibility
 */

export const normalizeCDR = (cdr) => {
  if (!cdr) return null;

  return {
    ...cdr,
    // Ensure all new fields are present and handle common aliases if needed
    callere164: cdr.callere164 || cdr.caller_e164 || '',
    calleraccesse164: cdr.calleraccesse164 || cdr.caller_access_e164 || '',
    calleee164: cdr.calleee164 || cdr.callee_e164 || '',
    calleeaccesse164: cdr.calleeaccesse164 || cdr.callee_access_e164 || '',
    callerip: cdr.callerip || cdr.caller_ip || '',
    callercodec: cdr.callercodec || cdr.caller_codec || '',
    callergatewayid: cdr.callergatewayid || cdr.caller_gateway_name || '',
    callerproductid: cdr.callerproductid || '',
    callertogatewaye164: cdr.callertogatewaye164 || cdr.caller_to_gateway_e164 || '',
    callertype: cdr.callertype || cdr.caller_type || '',
    calleeip: cdr.calleeip || cdr.callee_ip || '',
    calleecodec: cdr.calleecodec || cdr.callee_codec || '',
    calleegatewayid: cdr.calleegatewayid || '',
    calleeproductid: cdr.calleeproductid || cdr.callee_product_name || '',
    calleetogatewaye164: cdr.calleetogatewaye164 || cdr.callee_to_gateway_e164 || '',
    calleetype: cdr.calleetype || cdr.callee_type || '',
    billingmode: cdr.billingmode || cdr.billing_mode || '',
    calllevel: cdr.calllevel || cdr.call_level || '',
    agentfeetime: cdr.agentfeetime || cdr.agent_fee_time || '',
    starttime: cdr.starttime || cdr.start_time || '',
    stoptime: cdr.stoptime || cdr.stop_time || '',
    callerpdd: cdr.callerpdd || cdr.pdd || '',
    calleepdd: cdr.calleepdd || '',
    holdtime: cdr.holdtime || '',
    callerareacode: cdr.callerareacode || '',
    feetime: cdr.feetime || '',
    fee: cdr.fee || cdr.fee_amount || '',
    tax: cdr.tax || cdr.tax_amount || '',
    suitefee: cdr.suitefee || cdr.suite_fee || '',
    suitefeetime: cdr.suitefeetime || '',
    incomefee: cdr.incomefee || cdr.income_fee || '',
    incometax: cdr.incometax || cdr.income_tax || '',
    customeraccount: cdr.customeraccount || cdr.caller_customer || cdr.customer_id || '',
    customername: cdr.customername || cdr.caller_customer_name || cdr.customer_name || '',
    calleeareacode: cdr.calleeareacode || cdr.destination_area_code || '',
    agentfee: cdr.agentfee || '',
    agenttax: cdr.agenttax || '',
    agentsuitefee: cdr.agentsuitefee || '',
    agentsuitefeetime: cdr.agentsuitefeetime || '',
    agentaccount: cdr.agentaccount || cdr.agent_account_id || '',
    agentname: cdr.agentname || cdr.agent_name || '',
    flowno: cdr.flowno || '',
    softswitchname: cdr.softswitchname || cdr.switch_name || '',
    softswitchcallid: cdr.softswitchcallid || cdr.call_unique_id || '',
    callercallid: cdr.callercallid || cdr.sip_call_id_1 || '',
    calleroriginalcallid: cdr.calleroriginalcallid || '',
    rtpforward: cdr.rtpforward || cdr.rtp_forward_flag || '',
    enddirection: cdr.enddirection || '',
    endreason: cdr.endreason || cdr.end_reason_code || '',
    billingtype: cdr.billingtype || '',
    cdrlevel: cdr.cdrlevel || '',
    agentcdr_id: cdr.agentcdr_id || ''
  };
};

export const getCDRField = (cdr, fieldName) => {
  const normalized = normalizeCDR(cdr);
  return normalized[fieldName];
};

export const transformCSVToNewSchema = (row) => {
  return normalizeCDR(row);
};

export default {
  normalizeCDR,
  getCDRField,
  transformCSVToNewSchema,
};
