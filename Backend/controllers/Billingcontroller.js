const fs = require("fs");
const path = require("path");
const { Op, fn, col } = require("sequelize");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const puppeteer = require("puppeteer");
const moment = require("moment");
const sequelize = require("../config/database");
const H = require("../utils/reportHelper");
const Invoice = require("../models/Invoice");
const InvoiceItem = require("../models/InvoiceItem");
const Payment = require("../models/Payment");
const PaymentAllocation = require("../models/PaymentAllocation");
const CDR = require("../models/CDR");
const Account = require("../models/Account");
const CountryCode = require("../models/CountryCode");
const Dispute = require("../models/Dispute");
const BillingAutomationService = require("../services/BillingAutomationService");
const EmailService = require("../services/EmailService");
const { createNotification } = require("../services/notification-service");

let hasLoggedPuppeteerExecutablePath = false;

/* ===================== HELPER: FORMAT TIME ===================== */
const formatTime = (date, hour = 0, isEnd = false) => {
  if (!date) return null;

  // Handle numeric strings (Unix timestamps)
  const numericDate = Number(date);
  const d = !isNaN(numericDate) ? new Date(numericDate) : new Date(date);

  if (isNaN(d.getTime())) return null;

  d.setHours(hour, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0);
  return d.getTime().toString();
};

/* ===================== HELPER: GET COUNTRY FROM NUMBER ===================== */
const getCountryFromNumber = (number, countryCodes) => {
  if (!number) return "Unknown";

  // remove + or 00
  let cleaned = number.toString().replace(/^(\+|00)/, "");

  // sort country codes by length (longest first)
  const sortedCodes = [...countryCodes].sort(
    (a, b) => b.code.length - a.code.length,
  );

  for (const cc of sortedCodes) {
    if (cleaned.startsWith(cc.code)) {
      return cc.country_name;
    }
  }

  return "Unknown";
};

/* ===================== HELPER: GET TRUNK NAME ===================== */
const getTrunkName = (number) => {
  if (!number) return "Unknown";
  const trunkPrefix = number.toString().substring(0, 5);
  if (trunkPrefix.startsWith("10")) return "NCLI";
  if (trunkPrefix.startsWith("20")) return "CLI";
  if (trunkPrefix.startsWith("30")) return "ORTP/TDM";
  if (trunkPrefix.startsWith("40")) return "CC";
  return "Unknown";
};

const normalizeAuthValues = (value) => {
  if (Array.isArray(value)) {
    return [
      ...new Set(value.map((v) => String(v || "").trim()).filter(Boolean)),
    ];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return [
            ...new Set(
              parsed.map((v) => String(v || "").trim()).filter(Boolean),
            ),
          ];
        }
      } catch (_error) {
        // Fall through to comma-delimited parsing.
      }
    }

    return [
      ...new Set(
        trimmed
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ];
  }

  if (value == null) return [];

  const single = String(value).trim();
  return single ? [single] : [];
};

/* ===================== HELPER: BUILD ACCOUNT CONDITIONS ===================== */
const buildAccountConditions = (account, vendorReport = false) => {
  const or = [];

  // ✅ FIX (Bug 2): Determine auth type and value independently for vendor vs customer.
  // Previously, vendor auth fell back to customerauthenticationType, which caused
  // vendor CDR queries to use customer-side fields (callerip, customeraccount),
  // resulting in zero matching CDR rows for the vendor.
  let authType, authValue;

  if (vendorReport) {
    // For vendors: ONLY use vendor auth fields, do NOT fall back to customer fields
    authType = account.vendorauthenticationType;
    authValue = account.vendorauthenticationValue;
  } else {
    // For customers: use customer auth fields only
    authType = account.customerauthenticationType;
    authValue = account.customerauthenticationValue;
  }

  const authValues = normalizeAuthValues(authValue);

  // 1️⃣ IP authentication
  if (authType === "ip" && authValues.length > 0) {
    authValues.forEach((value) => {
      if (vendorReport) {
        // For vendor reports, we check calleeip (where we send calls to the vendor)
        or.push({ calleeip: value });
      } else {
        // For customer reports, we check callerip (where calls come from)
        or.push({ callerip: value });
      }
    });
  }

  // 2️⃣ Custom authentication → search in account fields
  if (authType === "custom" && authValues.length > 0) {
    authValues.forEach((value) => {
      const v = `${value}`;
      if (vendorReport) {
        or.push({ agentaccount: { [Op.like]: v } });
        or.push({ agentname: { [Op.like]: v } });
      } else {
        or.push({ customeraccount: { [Op.like]: v } });
        or.push({ customername: { [Op.like]: v } });
      }
    });
  }

  // 3️⃣ Fallback to vendorCode/customerCode or gatewayId if nothing else matched
  if (or.length === 0) {
    if (vendorReport) {
      const vCode = account.vendorCode || account.gatewayId;
      if (vCode) or.push({ agentaccount: vCode });
    } else {
      const cCode = account.customerCode || account.gatewayId;
      if (cCode) or.push({ customeraccount: cCode });
    }
  }

  return or;
};

/* ===================== HELPER: GENERATE INVOICE NUMBER ===================== */
const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");

  const lastInvoice = await Invoice.findOne({
    where: {
      invoiceNumber: {
        [Op.like]: `INV-${year}-${month}-%`,
      },
    },
    order: [["createdAt", "DESC"]],
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastNumber = lastInvoice.invoiceNumber.split("-").pop();
    sequence = parseInt(lastNumber) + 1;
  }

  return `INV-${year}-${month}-${String(sequence).padStart(4, "0")}`;
};

/* ===================== HELPER: GENERATE PAYMENT NUMBER ===================== */
const generatePaymentNumber = async () => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");

  const lastPayment = await Payment.findOne({
    where: {
      paymentNumber: {
        [Op.like]: `PAY-${year}-${month}-%`,
      },
    },
    order: [["createdAt", "DESC"]],
  });

  let sequence = 1;
  if (lastPayment) {
    const lastNumber = lastPayment.paymentNumber.split("-").pop();
    sequence = parseInt(lastNumber) + 1;
  }

  return `PAY-${year}-${month}-${String(sequence).padStart(4, "0")}`;
};

const resolveInvoiceAccount = async (invoice, transaction = null) => {
  const query = {
    where: {
      [Op.or]: [
        { gatewayId: invoice.customerGatewayId },
        { customerCode: invoice.customerCode },
        { vendorCode: invoice.customerCode },
        { accountName: invoice.customerName },
      ],
    },
  };

  if (transaction) {
    query.transaction = transaction;
  }

  return Account.findOne(query);
};

const adjustAccountForInvoice = async (
  account,
  amount,
  transaction,
  direction,
) => {
  const normalizedAmount = Number(amount || 0);
  if (!account || normalizedAmount <= 0) return;

  if (account.billingType === "postpaid") {
    const currentLimit = Number(account.creditLimit || 0);
    const nextLimit =
      direction === "consume"
        ? currentLimit - normalizedAmount
        : currentLimit + normalizedAmount;

    const cappedLimit =
      direction === "restore" && Number(account.originalCreditLimit || 0) > 0
        ? Math.min(nextLimit, Number(account.originalCreditLimit || 0))
        : nextLimit;

    await account.update(
      {
        creditLimit: parseFloat(cappedLimit.toFixed(2)),
      },
      { transaction },
    );
    return;
  }

  const currentBalance = Number(account.balance || 0);
  const nextBalance =
    direction === "consume"
      ? currentBalance - normalizedAmount
      : currentBalance + normalizedAmount;

  await account.update(
    {
      balance: parseFloat(nextBalance.toFixed(2)),
    },
    { transaction },
  );
};

/* ===================== GENERATE INVOICE FROM CDRs ===================== */
exports.generateInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      customerId,
      billingPeriodStart,
      billingPeriodEnd,
      taxRate = 0,
      discountAmount = 0,
      dueInDays = 7,
      notes,
      customerNotes,
    } = req.body;

    // Validate required fields
    if (!customerId || !billingPeriodStart || !billingPeriodEnd) {
      return res.status(400).json({
        success: false,
        error: "customerId, billingPeriodStart, and billingPeriodEnd are required",
      });
    }

    // Get account details - find by gatewayId, customerCode, or accountId
    const isNumeric = /^\d+$/.test(customerId);
    const accountWhere = {
      [Op.or]: [
        { gatewayId: customerId },
        { customerCode: customerId },
      ],
    };
    if (isNumeric) accountWhere[Op.or].push({ accountId: customerId });

    const account = await Account.findOne({
      where: accountWhere,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    // Get country codes for mapping
    const countryCodes = await CountryCode.findAll({ raw: true });

    // ✅ Build CDR WHERE conditions using authentication logic (customer only)
    const authConditions = buildAccountConditions(account, false);

    if (authConditions.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Unable to build authentication conditions for this customer",
      });
    }

    const cdrWhere = {
      starttime: {
        [Op.between]: [
          formatTime(billingPeriodStart),
          formatTime(billingPeriodEnd, 23, true),
        ],
      },
      [Op.or]: authConditions,
    };

    // Fetch CDR data for the billing period using authentication conditions (customer view)
    const cdrs = await CDR.findAll({
      attributes: [
        "customeraccount",
        "customername",
        "callere164",
        "calleee164",
        "calleegatewayid",
        [fn("COUNT", col("*")), "totalCalls"],
        [fn("SUM", H.completedCall), "completedCalls"],
        [fn("SUM", H.failedCall), "failedCalls"],
        [fn("SUM", H.durationSec), "duration"],
        [fn("SUM", H.revenue), "revenue"],
      ],
      where: cdrWhere,
      group: [
        "customeraccount",
        "customername",
        "callere164",
        "calleee164",
        "calleegatewayid",
      ],
      raw: true,
    });

    if (cdrs.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No CDR records found for this customer in the billing period",
      });
    }

    // Group CDRs by destination country, prefix and trunk
    const groupedData = {};
    cdrs.forEach((cdr) => {
      let destination = "Unknown";
      let prefix = "";

      // Clean calleee164 and remove 5-digit trunk prefix
      const fullCalleee = cdr.calleee164
        ? cdr.calleee164.toString().replace(/^\+/, "")
        : "";
      const actualCalleee =
        fullCalleee.length > 5 ? fullCalleee.substring(5) : fullCalleee;

      const phoneNumber = parsePhoneNumberFromString("+" + actualCalleee);

      if (phoneNumber) {
        destination = getCountryFromNumber(actualCalleee, countryCodes);
        prefix = phoneNumber.countryCallingCode;

        const national = phoneNumber.nationalNumber;

        if (!destination) {
          console.warn(
            "Failed to detect country for:",
            actualCalleee,
            phoneNumber,
          );
        }
      } else {
        console.warn("libphonenumber parsing failed for:", actualCalleee);
        destination = getCountryFromNumber(actualCalleee, countryCodes);

        if (actualCalleee.length >= 6) {
          prefix = actualCalleee.substring(0, 3);
        } else {
          prefix = actualCalleee;
        }
      }

      const trunk = getTrunkName(cdr.calleee164);

      // Extract custom description from calleegatewayid (after second --)
      let customDescription = "";
      if (cdr.calleegatewayid) {
        const parts = cdr.calleegatewayid.split("--");
        if (parts.length >= 3) {
          customDescription = parts[2].trim();
        }
      }

      const key = `${destination}|${prefix}|${trunk}|${customDescription}`;

      if (!groupedData[key]) {
        groupedData[key] = {
          destination,
          trunk,
          prefix,
          customDescription,
          totalCalls: 0,
          completedCalls: 0,
          failedCalls: 0,
          duration: 0,
          revenue: 0,
        };
      }

      groupedData[key].totalCalls += Number(cdr.totalCalls);
      groupedData[key].completedCalls += Number(cdr.completedCalls);
      groupedData[key].failedCalls += Number(cdr.failedCalls);
      groupedData[key].duration += Number(cdr.duration);
      groupedData[key].revenue += Number(cdr.revenue);
    });

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();
    const invoiceDate = Date.now();
    const dueDate = Date.now() + dueInDays * 24 * 60 * 60 * 1000;

    // Calculate subtotal
    let subtotal = 0;
    let totalCallsCount = 0;
    const invoiceItems = Object.values(groupedData)
      .filter((item) => item.completedCalls > 0)
      .map((item, index) => {
        const amount = Number(item.revenue);
        subtotal += amount;
        totalCallsCount += Number(item.totalCalls);

        return {
          itemType: "call_charges",
          description:
            item.customDescription ||
            `Calls to ${item.destination} (${item.trunk})`,
          destination: item.destination,
          trunk: item.trunk,
          prefix: item.prefix,
          quantity: item.totalCalls,
          duration: item.duration,

          unitPrice: item.totalCalls > 0 ? amount / item.totalCalls : 0,
          amount: parseFloat(amount.toFixed(4)),
          totalCalls: item.totalCalls,
          completedCalls: item.completedCalls,
          failedCalls: item.failedCalls,
          asr:
            item.totalCalls > 0
              ? parseFloat(
                  ((item.completedCalls / item.totalCalls) * 100).toFixed(2),
                )
              : 0,
          acd:
            item.completedCalls > 0
              ? parseFloat((item.duration / item.completedCalls).toFixed(2))
              : 0,
          taxable: true,
          periodStart: formatTime(billingPeriodStart),
          periodEnd: formatTime(billingPeriodEnd, 23, true),
          sortOrder: index,
        };
      });

    if (invoiceItems.length === 0) {
      return res.status(404).json({
        success: false,
        error:
          "No successful calls found for this customer in the billing period",
      });
    }

    // Calculate tax and total
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount - discountAmount;

    // Platform linkage should use customer code
    const linkedCustomerCode = account.customerCode;

    const invoice = await Invoice.create(
      {
        invoiceNumber,
        customerGatewayId: linkedCustomerCode,
        customerName: account.accountName,
        customerCode: account.customerCode,
        customerEmail: account.email,
        customerAddress:
          account.addressLine1 +
          (account.addressLine2 ? ", " + account.addressLine2 : ""),
        customerPhone: account.phone,
        billingPeriodStart: formatTime(billingPeriodStart),
        billingPeriodEnd: formatTime(billingPeriodEnd, 23, true),
        invoiceDate,
        dueDate,
        subtotal: parseFloat(subtotal.toFixed(4)),
        taxRate,
        taxAmount: parseFloat(taxAmount.toFixed(4)),
        discountAmount: parseFloat(discountAmount),
        totalAmount: parseFloat(totalAmount.toFixed(4)),
        balanceAmount: parseFloat(totalAmount.toFixed(4)),
        totalCalls: totalCallsCount,
        status: "pending",
        notes,
        customerNotes,
        generatedBy: req.user?.id || null,
      },
      { transaction },
    );

    // Create invoice items
    for (const item of invoiceItems) {
      await InvoiceItem.create(
        {
          invoiceId: invoice.id,
          ...item,
        },
        { transaction },
      );
    }

    await transaction.commit();

    // Fetch complete invoice with items
    const completeInvoice = await Invoice.findByPk(invoice.id, {
      include: [
        {
          model: InvoiceItem,
          as: "items",
        },
      ],
    });

    // Do not auto-send invoice emails on generation.
    // Invoices are sent explicitly via the dedicated send-email endpoint.

    createNotification({
      title: "Invoice generated",
      message: `${completeInvoice.invoiceNumber} generated for ${completeInvoice.customerName}.`,
      type: "success",
      category: "invoice",
      metadata: {
        invoiceId: completeInvoice.id,
        settingGate: "notifyInvoiceGenerated",
      },
    }).catch((err) => {
      console.error("Failed to create invoice notification:", err);
    });

    res.json({
      success: true,
      message: "Invoice generated successfully",
      invoice: completeInvoice,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Generate Invoice Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== GET ALL INVOICES ===================== */
exports.getAllInvoices = async (req, res) => {
  try {
    const {
      customerId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const where = {};

    if (customerId) {
      const isNumeric = /^\d+$/.test(customerId);

      const accountWhere = {
        [Op.or]: [
          { gatewayId: customerId },
          { customerCode: customerId },
        ],
      };

      // Only add accountId to search if customerId is numeric
      if (isNumeric) {
        accountWhere[Op.or].push({ accountId: customerId });
      }

      const account = await Account.findOne({
        where: accountWhere,
      });
      if (account) {
        where.customerCode = account.customerCode;
      } else {
        // Fallback: search by customerId directly in the invoice's customerCode column
        where.customerCode = customerId;
      }
    }

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.invoiceDate = {
        [Op.between]: [formatTime(startDate), formatTime(endDate, 23, true)],
      };
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Invoice.findAndCountAll({
      where,
      order: [["invoiceDate", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Get All Invoices Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== SEARCH INVOICES BY ACCOUNT NAME ===================== */
exports.searchInvoicesByAccountName = async (req, res) => {
  try {
    const {
      accountName,
      accountname,
      search,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const rawSearch = (accountName || accountname || search || "").trim();

    if (!rawSearch) {
      return res.status(400).json({
        success: false,
        error: "accountName or search query is required",
      });
    }

    const where = {};

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.invoiceDate = {
        [Op.between]: [formatTime(startDate), formatTime(endDate, 23, true)],
      };
    }

    const matchedAccounts = await Account.findAll({
      where: {
        accountName: {
          [Op.iLike]: `%${rawSearch}%`,
        },
      },
      attributes: ["customerCode", "vendorCode", "gatewayId"],
      raw: true,
    });

    const candidateCodes = new Set();
    matchedAccounts.forEach((account) => {
      if (account.customerCode) candidateCodes.add(account.customerCode);
      if (account.vendorCode) candidateCodes.add(account.vendorCode);
      if (account.gatewayId) candidateCodes.add(account.gatewayId);
    });

    const orConditions = [
      { customerName: { [Op.iLike]: `%${rawSearch}%` } },
      { invoiceNumber: { [Op.iLike]: `%${rawSearch}%` } },
    ];

    if (candidateCodes.size > 0) {
      orConditions.push({
        customerCode: {
          [Op.in]: Array.from(candidateCodes),
        },
      });
    }

    where[Op.or] = orConditions;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows } = await Invoice.findAndCountAll({
      where,
      order: [["invoiceDate", "DESC"]],
      limit: parseInt(limit, 10),
      offset,
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(count / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    console.error("Search Invoices By Account Name Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== GET INVOICE BY ID ===================== */
exports.getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    // Use specific where clause to avoid casting error if id is not numeric
    const isNumeric = /^\d+$/.test(id);
    const whereClause = isNumeric
      ? { [Op.or]: [{ id: parseInt(id) }, { invoiceNumber: id }] }
      : { invoiceNumber: id };

    const invoice = await Invoice.findOne({
      where: whereClause,
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    res.json({
      success: true,
      invoice,
    });
  } catch (error) {
    console.error("Get Invoice By ID Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== GET INVOICE ITEMS ===================== */
exports.getInvoiceItems = async (req, res) => {
  try {
    const { id } = req.params;

    const items = await InvoiceItem.findAll({
      where: { invoiceId: id },
      order: [["sortOrder", "ASC"]],
    });

    res.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error("Get Invoice Items Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== DOWNLOAD INVOICE PDF ===================== */
exports.downloadInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    // Find invoice with items
    const invoice = await Invoice.findByPk(id, {
      include: [
        {
          model: InvoiceItem,
          as: "items",
        },
      ],
    });

    if (!invoice) {
      // Also try to find by invoice number if id is not numeric
      const isNumeric = /^\d+$/.test(id);
      if (!isNumeric) {
        const invoiceByNum = await Invoice.findOne({
          where: { invoiceNumber: id },
          include: [
            {
              model: InvoiceItem,
              as: "items",
            },
          ],
        });
        if (invoiceByNum) return exports.generatePdf(invoiceByNum, res);
      }
      return res
        .status(404)
        .json({ success: false, error: "Invoice not found" });
    }

    return exports.generatePdf(invoice, res);
  } catch (error) {
    console.error("Download Invoice Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== SEND INVOICE EMAIL ===================== */
exports.sendInvoiceEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const isNumeric = /^\d+$/.test(id);
    if (!isNumeric) {
      return res
        .status(404)
        .json({ success: false, error: "Invoice not found" });
    }

    const invoice = await Invoice.findByPk(id, {
      include: [
        {
          model: InvoiceItem,
          as: "items",
        },
      ],
    });

    if (!invoice) {
      return res
        .status(404)
        .json({ success: false, error: "Invoice not found" });
    }

    const pdfBuffer = await generateInvoicePDFBuffer(invoice);

    // Fetch account to get billing email
    const account = await Account.findOne({
      where: {
        [Op.or]: [
          { gatewayId: invoice.customerGatewayId },
          { customerCode: invoice.customerCode },
          { accountName: invoice.customerName },
        ],
      },
    });

    const recipients = EmailService.getBillingRecipients(
      account || {},
      invoice,
    );
    if (recipients.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Customer has no billing email address",
        });
    }

    await EmailService.sendInvoiceWithAttachment(
      recipients,
      invoice,
      pdfBuffer,
    );

    // Update status to 'sent' if it was 'generated' or 'pending'
    if (["generated", "pending"].includes(invoice.status)) {
      await invoice.update({ status: "sent" });
    }

    res.json({
      success: true,
      message: `Invoice email sent to ${recipients.join(", ")}`,
    });
  } catch (error) {
    console.error("Send Invoice Email Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== HELPER: GENERATE PDF BUFFER ===================== */
const generateInvoicePDFBuffer = async (invoice) => {
  let browser;
  try {
    const invoiceData = invoice.toJSON();

    const logoCandidates = [
      process.env.INVOICE_LOGO_PATH,
      path.resolve(process.cwd(), "frontend/public/Cyvora.png"),
      path.resolve(__dirname, "../../frontend/public/Cyvora.png"),
      path.resolve(__dirname, "../../../frontend/public/Cyvora.png"),
    ].filter(Boolean);
    const logoPath = logoCandidates.find((candidate) =>
      fs.existsSync(candidate),
    );

    let logoSrc = "";
    if (logoPath) {
      const ext = path.extname(logoPath).toLowerCase();
      const mime =
        ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
      const logoBase64 = fs.readFileSync(logoPath).toString("base64");
      logoSrc = `data:${mime};base64,${logoBase64}`;
    } else {
      console.warn(
        "[Invoice PDF] Cyvora logo not found. Checked paths:",
        logoCandidates.join(", "),
      );
    }

    // Format dates for the template
    const formattedInvoiceDate = moment(
      parseInt(invoiceData.invoiceDate),
    ).format("DD-MM-YYYY");
    const formattedDueDate = moment(parseInt(invoiceData.dueDate)).format(
      "DD-MM-YYYY",
    );
    const formattedPeriodStart = moment(
      parseInt(invoiceData.billingPeriodStart),
    ).format("DD MMM");
    const formattedPeriodEnd = moment(
      parseInt(invoiceData.billingPeriodEnd),
    ).format("DD MMM YYYY");

    const invoiceHtml = `
      <html>
        <head>
          <title>Invoice ${invoiceData.invoiceNumber}</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 0;
              color: #333;
              background-color: #fff;
            }
            .invoice-container {
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            .invoice-header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 40px;
              border-bottom: 3px solid #1a365d;
              padding-bottom: 20px;
            }
            .company-logo {
              height: 65px;
              width: auto;
              display: block;
              object-fit: contain;
            }
            .invoice-title {
              font-size: 20px;
              font-weight: bold;
              color: #2d3748;
              text-align: right;
            }
            .address-section {
              display: flex;
              justify-content: space-between;
              margin-bottom: 40px;
            }
            .address-box {
              width: 45%;
            }
            .address-label {
              font-weight: bold;
              color: #4a5568;
              text-transform: uppercase;
              font-size: 12px;
              margin-bottom: 8px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
            }
            .address-content {
              font-size: 14px;
              line-height: 1.6;
            }
            .details-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 20px;
              background-color: #f7fafc;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 40px;
              border: 1px solid #e2e8f0;
            }
            .detail-item {
              display: flex;
              flex-direction: column;
            }
            .detail-label {
              font-size: 11px;
              color: #718096;
              text-transform: uppercase;
              font-weight: bold;
            }
            .detail-value {
              font-size: 14px;
              color: #2d3748;
              font-weight: 600;
            }
            .table-section {
              margin-bottom: 40px;
            }
            .invoice-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            .invoice-table th {
              background-color: #1a365d;
              color: white;
              text-align: left;
              padding: 12px 8px;
              text-transform: uppercase;
              font-weight: 600;
            }
            .invoice-table td {
              padding: 10px 8px;
              border-bottom: 1px solid #e2e8f0;
            }
            .invoice-table tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .text-right { text-align: right; }
            .totals-section {
              display: flex;
              justify-content: flex-end;
              margin-bottom: 40px;
            }
            .totals-box {
              width: 250px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
            }
            .total-grand {
              border-top: 2px solid #1a365d;
              margin-top: 8px;
              padding-top: 12px;
              font-weight: bold;
              font-size: 18px;
              color: #1a365d;
            }
            .bank-section {
              background-color: #f8fafc;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #1a365d;
              font-size: 12px;
            }
            .bank-title {
              font-weight: bold;
              margin-bottom: 10px;
              color: #1a365d;
              text-transform: uppercase;
            }
            .footer {
              margin-top: 60px;
              text-align: center;
              font-size: 11px;
              color: #3c3c3d;
              border-top: 1px solid #e2e8f0;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="invoice-header">
              <div>
                ${
                  logoSrc
                    ? `<img class="company-logo" src="${logoSrc}" alt="Cyvora Logo" />`
                    : '<h2 style="color: #1a365d; margin: 0;">Cyvora</h2>'
                }
              </div>
              <div class="invoice-title">${invoiceData.invoiceNumber || "INVOICE"}</div>
            </div>

            <div class="address-section">
              <div class="address-box">
                <div class="address-label">From</div>
                <div class="address-content">
                  <strong>Cyvora LLC,</strong><br>
1229 Mustaqillik Street, 
Istiglol Neighborhood, Bekabad District, 
Tashkent Region, Uzbekistan<br>
                  Email: account.voice@cyvoratech.com
                </div>
              </div>
              <div class="address-box">
                <div class="address-label">Bill To</div>
                <div class="address-content">
                  <strong>${invoiceData.customerName || "Customer"}</strong><br>
                  ${invoiceData.customerAddress || ""}<br>
                  ${invoiceData.customerEmail || ""}<br>
                  ${invoiceData.customerPhone || ""}
                </div>
              </div>
            </div>

            <div class="details-grid">
              <div class="detail-item">
                <span class="detail-label">Invoice Number</span>
                <span class="detail-value">${invoiceData.invoiceNumber}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Invoice Date</span>
                <span class="detail-value">${formattedInvoiceDate}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Due Date</span>
                <span class="detail-value">${formattedDueDate}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Billing Period</span>
                <span class="detail-value">${formattedPeriodStart} - ${formattedPeriodEnd}</span>
              </div>
            </div>

            <div class="table-section">
              <table class="invoice-table">
                <thead>
                  <tr>
                    <th>Trunk</th>
                    <th>Prefix</th>
                    <th>Destination</th>
                    <th>Description</th>
                    <th class="text-right">Calls</th>
                    <th class="text-right">Duration (Min)</th>
                    <th class="text-right">Rate</th>
                    <th class="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${invoiceData.items
                    ?.map(
                      (item) => `
                    <tr>
                      <td>${item.trunk || "-"}</td>
                      <td>${item.prefix || "-"}</td>
                      <td>${item.destination || "-"}</td>
                      <td>${item.description || "-"}</td>
                      <td class="text-right">${item.totalCalls}</td>
                      <td class="text-right">${(item.duration / 60).toFixed(2)}</td>
                      <td class="text-right">$${parseFloat(item.unitPrice).toFixed(4)}</td>
                      <td class="text-right">$${parseFloat(item.amount).toFixed(4)}</td>
                    </tr>
                  `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>

            <div class="totals-section">
              <div class="totals-box">
                <div class="total-row">
                  <span>Subtotal</span>
                  <span>$${parseFloat(invoiceData.subtotal).toFixed(4)}</span>
                </div>
               
                <div class="total-row total-grand">
                  <span>Total Amount</span>
                  <span>$${parseFloat(invoiceData.totalAmount).toFixed(4)}</span>
                </div>
              </div>
            </div>

            <div class="bank-section">
              <div class="bank-title">Payment Information</div>
              <strong>Beneficiary Name:</strong> Cyvora LLC<br>
              <strong>Bank Name:</strong> KAPITAL BANK<br>
              <strong>SWIFT Code:</strong> KACHUZ22<br>
              <strong>Account No:</strong> 20208840207358100001<br>
              <strong>IBAN:</strong> 01158<br>
              <strong>Bank Address:</strong> Sailgokh Street 7, 100047, Tashkent, Uzbekistan<br>
              <strong>Account Currency:</strong> USD
            </div>

            <div class="footer">
              Thank you for your business. Please contact accounts.voice@cyvoratech.com for any billing inquiries.<br>
              Generated by CDR Billing System
            </div>
          </div>
        </body>
      </html>
    `;

    const envChromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    let puppeteerDefaultPath = null;
    try {
      puppeteerDefaultPath = puppeteer.executablePath();
    } catch (_error) {
      // Keep null and continue with system candidates.
    }

    const chromiumCandidates = [
      envChromiumPath,
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/snap/bin/chromium",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      puppeteerDefaultPath,
    ].filter(Boolean);

    const checkedPaths = [...new Set(chromiumCandidates)];
    let executablePath = checkedPaths.find((candidate) =>
      fs.existsSync(candidate),
    );

    if (executablePath) {
      // Check if executable has execute permissions.
      try {
        fs.accessSync(executablePath, fs.constants.X_OK);
      } catch (permError) {
        console.error(
          "[Puppeteer] ERROR: File exists but not executable:",
          executablePath,
        );
        throw new Error(
          `Chromium executable found at "${executablePath}" but it's not executable. Try: chmod +x "${executablePath}"`,
        );
      }

      if (!hasLoggedPuppeteerExecutablePath) {
        console.log("[Puppeteer] Using executablePath:", executablePath);
        hasLoggedPuppeteerExecutablePath = true;
      }
    } else {
      console.warn(
        "[Puppeteer] No local Chromium executable found in known paths. Will attempt Puppeteer-managed default. Checked:",
        checkedPaths.join(", "),
      );
    }

    const launchArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process",
    ];

    const launchOptions = {
      headless: true,
      args: launchArgs,
    };

    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    let launchError = null;
    try {
      browser = await puppeteer.launch(launchOptions);
    } catch (firstLaunchError) {
      launchError = firstLaunchError;

      // Retry without forcing executablePath in case system chrome exists but is broken.
      if (launchOptions.executablePath) {
        console.warn(
          "[Puppeteer] Launch with explicit executablePath failed, retrying with Puppeteer default executable.",
        );
        try {
          browser = await puppeteer.launch({
            headless: true,
            args: launchArgs,
          });
          launchError = null;
          executablePath = null;
        } catch (secondLaunchError) {
          launchError = secondLaunchError;
        }
      }
    }

    if (launchError || !browser) {
      const launchMsg =
        launchError && launchError.message
          ? launchError.message
          : String(launchError || "Unknown launch error");
      console.error("[Puppeteer] ERROR launching browser:", launchMsg);
      // Check if it's a common system dependency issue.
      const errorLower = launchMsg.toLowerCase();
      let suggestion =
        "See https://pptr.dev/troubleshooting for detailed troubleshooting.";

      if (
        errorLower.includes("libnss3") ||
        errorLower.includes("libxss") ||
        errorLower.includes("missing") ||
        errorLower.includes("library")
      ) {
        suggestion =
          "Missing system dependencies. Try: sudo apt-get install -y libnss3 libxss1 libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libharfbuzz0b libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxinerama1 libxrandr2 libxrender1 libxss1 libxtst6";
      } else if (
        errorLower.includes("permission") ||
        errorLower.includes("denied")
      ) {
        suggestion = executablePath
          ? `Permission denied. Try: chmod +x "${executablePath}"`
          : "Permission denied while launching Chromium. Ensure browser binary is executable.";
      }

      throw new Error(`Failed to launch browser: ${launchMsg}. ${suggestion}`);
    }

    const page = await browser.newPage();

    try {
      await page.setContent(invoiceHtml, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });
    } catch (contentError) {
      console.warn(
        "[Puppeteer] Page content warning (will continue):",
        contentError.message,
      );
      // Continue anyway - networkidle0 might fail but HTML can still render
    }

    try {
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "20px",
          right: "20px",
          bottom: "20px",
          left: "20px",
        },
      });
      await browser.close();
      return pdf;
    } catch (pdfError) {
      await browser.close();
      throw new Error(`PDF rendering failed: ${pdfError.message}`);
    }
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
};

/* ===================== HELPER: GENERATE PDF AND SEND ===================== */
exports.generatePdf = async (invoice, res) => {
  try {
    const pdf = await generateInvoicePDFBuffer(invoice);
    const invoiceNumber = invoice.invoiceNumber;

    res.contentType("application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Invoice_${invoiceNumber}.pdf`,
    );
    res.send(pdf);
  } catch (error) {
    console.error("PDF Generation Error:", error);
    const errorMessage = error.message || "Failed to generate PDF";
    res.status(500).json({ success: false, error: errorMessage });
  }
};

/* ===================== UPDATE INVOICE ===================== */
exports.updateInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const updateData = req.body;
    const isNumeric = /^\d+$/.test(id);
    if (!isNumeric) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    if (Object.prototype.hasOwnProperty.call(updateData, "status")) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: "Manual invoice status updates are disabled. Status is updated by send-email and payment events.",
      });
    }

    // Prevent updating certain fields if invoice is paid
    if (
      invoice.status === "paid" &&
      (updateData.totalAmount || updateData.items)
    ) {
      return res.status(400).json({
        success: false,
        error: "Cannot modify amount of a paid invoice",
      });
    }

    // Convert dates to timestamps if present
    if (updateData.invoiceDate)
      updateData.invoiceDate = formatTime(updateData.invoiceDate);
    if (updateData.dueDate) updateData.dueDate = formatTime(updateData.dueDate);
    if (updateData.billingPeriodStart)
      updateData.billingPeriodStart = formatTime(updateData.billingPeriodStart);
    if (updateData.billingPeriodEnd)
      updateData.billingPeriodEnd = formatTime(
        updateData.billingPeriodEnd,
        23,
        true,
      );
    if (updateData.paymentDate)
      updateData.paymentDate = formatTime(updateData.paymentDate);

    await invoice.update(updateData, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Invoice updated successfully",
      data: invoice,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Update Invoice Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== DELETE INVOICE ===================== */
exports.deleteInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const isNumeric = /^\d+$/.test(id);
    if (!isNumeric) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    // Only allow deletion of draft or cancelled invoices
    if (!["draft", "pending", "cancelled", "void"].includes(invoice.status)) {
      return res.status(400).json({
        success: false,
        error: "Only draft, cancelled, or void invoices can be deleted",
      });
    }

    // Delete invoice items
    await InvoiceItem.destroy({
      where: { invoiceId: id },
      transaction,
    });

    // Delete invoice
    await invoice.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Delete Invoice Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== RECORD PAYMENT ===================== */
exports.recordPayment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      customerId,
      amount,
      paymentDate,
      paymentMethod,
      transactionId,
      referenceNumber,
      notes,
      paymentSource = "new_payment",
      invoiceId,
      invoiceAllocations = [], // Array of { invoiceId, amount }
    } = req.body;

    // Handle single invoiceId if provided
    let allocations = [...invoiceAllocations];
    if (invoiceId && allocations.length === 0) {
      allocations.push({ invoiceId, amount });
    }

    // Validate
    if (!customerId || !amount || !paymentDate) {
      return res.status(400).json({
        success: false,
        error: "customerId, amount, and paymentDate are required",
      });
    }

    if (!["new_payment", "account_funds"].includes(paymentSource)) {
      return res.status(400).json({
        success: false,
        error: "paymentSource must be either new_payment or account_funds",
      });
    }

    if (paymentSource === "new_payment" && !paymentMethod) {
      return res.status(400).json({
        success: false,
        error: "paymentMethod is required for new payments",
      });
    }

    if (paymentSource === "account_funds" && allocations.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Invoice allocation is required when paying from account funds",
      });
    }

    // Resolve customer with customerCode as primary identifier.
    const isNumeric = /^\d+$/.test(customerId);
    let customer = await Account.findOne({
      where: { customerCode: customerId },
    });

    if (!customer) {
      const fallbackWhere = {
        [Op.or]: [{ gatewayId: customerId }],
      };
      if (isNumeric) {
        fallbackWhere[Op.or].push({ accountId: parseInt(customerId, 10) });
      }

      customer = await Account.findOne({ where: fallbackWhere });
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    // Generate payment number
    const paymentNumber = await generatePaymentNumber();
    const receiptNumber = `RCP-${paymentNumber.split("-").slice(1).join("-")}`;

    // Calculate allocated and unapplied amounts
    let totalAllocated = 0;
    if (allocations.length > 0) {
      totalAllocated = allocations.reduce(
        (sum, alloc) => sum + Number(alloc.amount),
        0,
      );
    }

    if (totalAllocated > amount) {
      return res.status(400).json({
        success: false,
        error: "Total allocated amount cannot exceed payment amount",
      });
    }

    if (paymentSource === "account_funds") {
      if (Math.abs(Number(amount) - totalAllocated) > 0.0001) {
        return res.status(400).json({
          success: false,
          error: "When paying from account funds, amount must match the allocated invoice amount",
        });
      }

      const availableFunds =
        customer.billingType === "postpaid"
          ? Number(customer.creditLimit || 0)
          : Number(customer.balance || 0);

      if (availableFunds < totalAllocated) {
        return res.status(400).json({
          success: false,
          error:
            customer.billingType === "postpaid"
              ? "Insufficient credit limit for this payment"
              : "Insufficient balance for this payment",
        });
      }
    }

    // Create payment using customerCode
    const payment = await Payment.create(
      {
        paymentNumber,
        receiptNumber,
        customerGatewayId: customer.gatewayId,
        customerCode: customer.customerCode,
        customerName: customer.accountName,
        partyType: "customer",
        paymentDirection: "inbound",
        amount: parseFloat(amount),
        paymentDate: formatTime(paymentDate),
        paymentMethod:
          paymentSource === "account_funds" ? "other" : paymentMethod,
        transactionId,
        referenceNumber,
        allocatedAmount: parseFloat(totalAllocated),
        unappliedAmount: parseFloat(amount - totalAllocated),
        notes:
          paymentSource === "account_funds"
            ? notes
              ? `${notes} | Paid using account funds`
              : "Paid using account funds"
            : notes,
        recordedBy: req.user?.id || null,
        recordedDate: Date.now(),
      },
      { transaction },
    );

    // Create allocations and update invoices
    for (const allocation of allocations) {
      const invoice = await Invoice.findByPk(allocation.invoiceId, {
        transaction,
      });

      if (!invoice) {
        throw new Error(`Invoice ${allocation.invoiceId} not found`);
      }

      // Verify invoice belongs to this customer using customerCode only.
      const invoiceCode = String(invoice.customerCode || "").trim();
      const customerCode = String(customer.customerCode || "").trim();
      const requestedCode = String(customerId || "").trim();

      const codeMatches =
        (invoiceCode && customerCode && invoiceCode === customerCode) ||
        (invoiceCode && requestedCode && invoiceCode === requestedCode);

      if (!codeMatches) {
        throw new Error(
          `Invoice ${allocation.invoiceId} does not belong to selected customer (${requestedCode || customerCode})`,
        );
      }

      // Create allocation
      await PaymentAllocation.create(
        {
          paymentId: payment.id,
          invoiceId: allocation.invoiceId,
          allocatedAmount: parseFloat(allocation.amount),
          allocationDate: formatTime(paymentDate),
          allocatedBy: req.user?.id || null,
        },
        { transaction },
      );

      // Update invoice
      const newPaidAmount =
        Number(invoice.paidAmount) + Number(allocation.amount);
      const newBalance = Number(invoice.totalAmount) - newPaidAmount;

      let newStatus = invoice.status;
      if (newBalance <= 0) {
        newStatus = "paid";
      } else if (newPaidAmount > 0) {
        newStatus = "partial";
      }

      await invoice.update(
        {
          paidAmount: parseFloat(newPaidAmount.toFixed(4)),
          balanceAmount: parseFloat(newBalance.toFixed(4)),
          status: newStatus,
          paymentDate:
            newStatus === "paid"
              ? formatTime(paymentDate)
              : invoice.paymentDate,
        },
        { transaction },
      );

    }

    if (paymentSource === "account_funds" && totalAllocated > 0) {
      await adjustAccountForInvoice(
        customer,
        totalAllocated,
        transaction,
        "consume",
      );
      await customer.reload({ transaction });
    }

    await transaction.commit();

    // Fetch complete payment with allocations
    const completePayment = await Payment.findByPk(payment.id, {
      include: [
        {
          model: PaymentAllocation,
          as: "allocations",
          include: [
            {
              model: Invoice,
              as: "invoice",
            },
          ],
        },
      ],
    });

    // Send payment confirmation email
    if (completePayment.allocations && completePayment.allocations.length > 0) {
      const firstInvoice = completePayment.allocations[0].invoice;
      EmailService.sendPaymentConfirmation(
        completePayment,
        firstInvoice,
        customer,
      ).catch((err) => {
        console.error("Failed to send payment confirmation email:", err);
      });
    }

    createNotification({
      title: "Payment received",
      message: `${completePayment.paymentNumber} received from ${completePayment.customerName}.`,
      type: "success",
      category: "payment_received",
      metadata: {
        paymentId: completePayment.id,
        settingGate: "notifyPaymentReceived",
      },
    }).catch((err) => {
      console.error("Failed to create payment notification:", err);
    });

    res.json({
      success: true,
      message: "Payment recorded successfully",
      payment: completePayment,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Record Payment Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== GET ALL PAYMENTS ===================== */
exports.getAllPayments = async (req, res) => {
  try {
    const {
      customerId,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (parsedPage - 1) * parsedLimit;

    const where = {};

    if (customerId) {
      const isNumeric = /^\d+$/.test(customerId);
      const customerWhere = {
        [Op.or]: [{ gatewayId: customerId }, { customerCode: customerId }],
      };

      // Only add accountId to search if customerId is numeric
      if (isNumeric) {
        customerWhere[Op.or].push({ accountId: customerId });
      }

      const customer = await Account.findOne({
        where: customerWhere,
      });
      if (customer) {
        where.customerCode = customer.customerCode;
      } else {
        // Fallback to direct code/gateway search to avoid returning all rows for unknown customerId
        where[Op.or] = [
          { customerCode: customerId },
          { customerGatewayId: customerId },
        ];
      }
    }

    if (search && String(search).trim()) {
      const searchTerm = `%${String(search).trim()}%`;
      const searchConditions = [
        { paymentNumber: { [Op.iLike]: searchTerm } },
        { customerName: { [Op.iLike]: searchTerm } },
        { customerCode: { [Op.iLike]: searchTerm } },
        { customerGatewayId: { [Op.iLike]: searchTerm } },
        { transactionId: { [Op.iLike]: searchTerm } },
        { referenceNumber: { [Op.iLike]: searchTerm } },
      ];

      if (where[Op.or]) {
        where[Op.and] = [
          { [Op.or]: where[Op.or] },
          { [Op.or]: searchConditions },
        ];
        delete where[Op.or];
      } else {
        where[Op.or] = searchConditions;
      }
    }

    where.partyType = "customer";
    where.paymentDirection = "inbound";

    if (startDate && endDate) {
      where.paymentDate = {
        [Op.between]: [formatTime(startDate), formatTime(endDate, 23, true)],
      };
    }

    const { count, rows } = await Payment.findAndCountAll({
      where,
      include: [
        {
          model: PaymentAllocation,
          as: "allocations",
          include: [
            {
              model: Invoice,
              as: "invoice",
              attributes: ["invoiceNumber", "totalAmount", "balanceAmount"],
            },
          ],
        },
      ],
      order: [["paymentDate", "DESC"]],
      distinct: true,
      limit: parsedLimit,
      offset,
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(count / parsedLimit),
      },
    });
  } catch (error) {
    console.error("Get All Payments Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== GET CUSTOMER OUTSTANDING ===================== */
exports.getCustomerOutstanding = async (req, res) => {
  try {
    const { customerId } = req.params;
    const isNumeric = /^\d+$/.test(customerId);
    const customerWhere = {
      [Op.or]: [{ gatewayId: customerId }, { customerCode: customerId }],
    };
    if (isNumeric) customerWhere[Op.or].push({ accountId: customerId });

    const customer = await Account.findOne({
      where: customerWhere,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    const invoices = await Invoice.findAll({
      where: {
        customerGatewayId: customer.gatewayId,
        status: {
          [Op.in]: ["pending", "sent", "partial", "overdue"],
        },
      },
      order: [["dueDate", "ASC"]],
    });

    const totalOutstanding = invoices.reduce(
      (sum, inv) => sum + Number(inv.balanceAmount),
      0,
    );
    const overdueInvoices = invoices.filter(
      (inv) => Number(inv.dueDate) < Date.now(),
    );
    const totalOverdue = overdueInvoices.reduce(
      (sum, inv) => sum + Number(inv.balanceAmount),
      0,
    );

    res.json({
      success: true,
      customer: {
        gatewayId: customer.gatewayId,
        name: customer.accountName,
        code: customer.customerCode,
      },
      summary: {
        totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
        totalOverdue: parseFloat(totalOverdue.toFixed(2)),
        invoiceCount: invoices.length,
        overdueCount: overdueInvoices.length,
      },
      invoices,
    });
  } catch (error) {
    console.error("Get Customer Outstanding Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== GET AGING REPORT ===================== */
exports.getAgingReport = async (req, res) => {
  try {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    const invoices = await Invoice.findAll({
      where: {
        status: {
          [Op.in]: ["pending", "sent", "partial", "overdue"],
        },
      },
      order: [
        ["customerGatewayId", "ASC"],
        ["dueDate", "ASC"],
      ],
    });

    const customerAging = {};

    invoices.forEach((invoice) => {
      const balance = Number(invoice.balanceAmount);
      const dueDate = Number(invoice.dueDate);

      if (!customerAging[invoice.customerGatewayId]) {
        customerAging[invoice.customerGatewayId] = {
          customerGatewayId: invoice.customerGatewayId,
          customerName: invoice.customerName,
          customerCode: invoice.customerCode,
          current: 0,
          days1_30: 0,
          days31_60: 0,
          days61_90: 0,
          days90Plus: 0,
          total: 0,
        };
      }

      if (dueDate >= now) {
        customerAging[invoice.customerGatewayId].current += balance;
      } else if (dueDate >= thirtyDaysAgo) {
        customerAging[invoice.customerGatewayId].days1_30 += balance;
      } else if (dueDate >= sixtyDaysAgo) {
        customerAging[invoice.customerGatewayId].days31_60 += balance;
      } else if (dueDate >= ninetyDaysAgo) {
        customerAging[invoice.customerGatewayId].days61_90 += balance;
      } else {
        customerAging[invoice.customerGatewayId].days90Plus += balance;
      }

      customerAging[invoice.customerGatewayId].total += balance;
    });

    const agingData = Object.values(customerAging).map((customer) => ({
      ...customer,
      current: parseFloat(customer.current.toFixed(2)),
      days1_30: parseFloat(customer.days1_30.toFixed(2)),
      days31_60: parseFloat(customer.days31_60.toFixed(2)),
      days61_90: parseFloat(customer.days61_90.toFixed(2)),
      days90Plus: parseFloat(customer.days90Plus.toFixed(2)),
      total: parseFloat(customer.total.toFixed(2)),
    }));

    const totals = {
      current: agingData.reduce((sum, c) => sum + c.current, 0),
      days1_30: agingData.reduce((sum, c) => sum + c.days1_30, 0),
      days31_60: agingData.reduce((sum, c) => sum + c.days31_60, 0),
      days61_90: agingData.reduce((sum, c) => sum + c.days61_90, 0),
      days90Plus: agingData.reduce((sum, c) => sum + c.days90Plus, 0),
      total: agingData.reduce((sum, c) => sum + c.total, 0),
    };

    res.json({
      success: true,
      data: agingData,
      totals,
    });
  } catch (error) {
    console.error("Get Aging Report Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== GET LITE INVOICES (FOR DROPDOWNS) ===================== */
exports.getLiteInvoices = async (req, res) => {
  try {
    const { customerId, status, startDate, endDate } = req.query;
    const where = {};

    if (customerId) {
      const isNumeric = /^\d+$/.test(customerId);
      let account = await Account.findOne({
        where: { customerCode: customerId },
      });

      if (!account) {
        const fallbackWhere = {
          [Op.or]: [{ gatewayId: customerId }],
        };
        if (isNumeric) {
          fallbackWhere[Op.or].push({ accountId: customerId });
        }
        account = await Account.findOne({ where: fallbackWhere });
      }

      where.customerCode = (account?.customerCode || customerId)
        .toString()
        .trim();
    }

    // Default behavior for payment dropdown: show all invoices except paid.
    if (status) {
      where.status = status;
    } else {
      where.status = { [Op.ne]: "paid" };
    }

    if (startDate && endDate) {
      where.billingPeriodStart = { [Op.gte]: formatTime(startDate) };
      where.billingPeriodEnd = { [Op.lte]: formatTime(endDate, 23, true) };
    } else if (startDate) {
      where.billingPeriodStart = { [Op.gte]: formatTime(startDate) };
    } else if (endDate) {
      where.billingPeriodEnd = { [Op.lte]: formatTime(endDate, 23, true) };
    }

    const invoices = await Invoice.findAll({
      where,
      attributes: [
        "id",
        "invoiceNumber",
        "customerName",
        "customerCode",
        "status",
        "totalAmount",
        "balanceAmount",
        "invoiceDate",
        "dueDate",
        "billingPeriodStart",
        "billingPeriodEnd",
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    console.error("Get Lite Invoices Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== GET VENDOR USAGE FOR PERIODS ===================== */
exports.getVendorUsage = async (req, res) => {
  try {
    const { vendorCode, periods } = req.body;

    if (!vendorCode || !periods || !Array.isArray(periods)) {
      return res
        .status(400)
        .json({
          success: false,
          error: "vendorCode and periods (array) are required",
        });
    }

    // ✅ FIX (Bug 3): Also search by accountId (consistent with customer lookup)
    const isNumeric = /^\d+$/.test(vendorCode);
    const vendorWhere = {
      [Op.or]: [{ gatewayId: vendorCode }, { vendorCode: vendorCode }],
    };
    if (isNumeric) vendorWhere[Op.or].push({ accountId: vendorCode });

    const vendor = await Account.findOne({ where: vendorWhere });
    if (!vendor)
      return res
        .status(404)
        .json({ success: false, error: "Vendor not found" });

    // ✅ FIX (Bug 2): buildAccountConditions now correctly uses vendorauthenticationType only
    const authConditions = buildAccountConditions(vendor, true);

    // 🛡️ Extra safety: log what conditions were built for debugging
    console.log(
      "[getVendorUsage] Auth conditions for vendor",
      vendorCode,
      ":",
      JSON.stringify(authConditions),
    );

    if (authConditions.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Unable to build authentication conditions for this vendor",
        });
    }

    const results = [];
    for (const period of periods) {
      const { startDate, endDate } = period;
      const cdrWhere = {
        starttime: {
          [Op.between]: [formatTime(startDate), formatTime(endDate, 23, true)],
        },
        [Op.or]: authConditions,
      };

      // ✅ FIX (Bug 1): Use H.cost for vendor (what we owe the vendor), NOT H.revenue
      // H.revenue = what customer pays us (our income)
      // H.cost    = what we pay the vendor (our expense / vendor's receivable)
      // Both must be defined in reportHelper.js pointing to correct CDR columns.
      const usage = await CDR.findOne({
        attributes: [
          [fn("COUNT", col("*")), "totalCalls"],
          [fn("SUM", H.completedCall), "completedCalls"],
          [fn("SUM", H.durationSec), "duration"],
          // ✅ Use H.cost — the amount we owe the vendor per CDR row
          // If H.cost is still returning null/0, verify that reportHelper.js
          // maps H.cost to the correct CDR column (e.g., 'agentcost', 'vendorcost', 'cost', etc.)
          [fn("SUM", H.cost), "totalAmount"],
        ],
        where: cdrWhere,
        raw: true,
      });

      // ✅ FIX: Safely parse values — SUM of NULL rows returns null, not 0
      const totalCalls = parseInt(usage?.totalCalls || 0);
      const completedCalls = parseInt(usage?.completedCalls || 0);
      const duration = parseFloat(usage?.duration || 0);
      const totalAmount = parseFloat(usage?.totalAmount || 0); // null-safe

      results.push({
        id: `usage_${startDate}_${endDate}`,
        invoiceNumber: "USAGE-ONLY",
        invoiceType: "vendor",
        customerGatewayId:
          vendor.vendorauthenticationType === "gateway" &&
          vendor.vendorauthenticationValue
            ? vendor.vendorauthenticationValue
            : vendor.gatewayId,
        customerName: vendor.accountName,
        customerCode: vendor.vendorCode,
        customerEmail: vendor.email,
        customerAddress:
          vendor.addressLine1 +
          (vendor.addressLine2 ? ", " + vendor.addressLine2 : ""),
        customerPhone: vendor.phone,
        invoiceDate: Date.now(),
        billingPeriodStart: formatTime(startDate),
        billingPeriodEnd: formatTime(endDate, 23, true),
        dueDate: Date.now(),
        subtotal: totalAmount,
        taxRate: 0,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount,
        balanceAmount: totalAmount,
        totalCalls,
        completedCalls,
        duration,
        status: "unpaid",
      });
    }

    console.log("[getVendorUsage] Results:", results);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error("Error fetching vendor usage:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch vendor usage" });
  }
};

/* ===================== RUN BILLING AUTOMATION ===================== */
exports.runBillingAutomation = async (req, res) => {
  try {
    const results = await BillingAutomationService.runAutomation();
    res.json({
      success: true,
      message: "Billing automation process completed",
      results,
    });
  } catch (error) {
    console.error("Billing Automation Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== RAISE DISPUTE ===================== */
exports.raiseDispute = async (req, res) => {
  try {
    const {
      customerId,
      comment,
      mismatchedCount,
      invoiceNumber,
      disputeAmount,
      invoiceIds,
    } = req.body;

    // Validate required fields
    if (!customerId || !customerId.trim()) {
      return res.status(400).json({
        success: false,
        error: "Customer ID is required",
      });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        error: "Dispute comment is required",
      });
    }

    if (!invoiceNumber || !invoiceNumber.trim()) {
      return res.status(400).json({
        success: false,
        error: "Invoice number(s) are required",
      });
    }

    if (mismatchedCount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Mismatch count must be greater than 0",
      });
    }

    const isNumeric = /^\d+$/.test(customerId);
    const customer = await Account.findOne({
      where: {
        [Op.or]: [
          { customerCode: customerId },
          { gatewayId: customerId },
          ...(isNumeric ? [{ accountId: parseInt(customerId) }] : []),
        ],
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    // Save dispute to database
    const dispute = await Dispute.create({
      customerCode: customer.customerCode,
      customerName: customer.accountName,
      comment: comment.trim(),
      mismatchedCount: parseInt(mismatchedCount) || 0,
      invoiceNumber: invoiceNumber.trim(),
      disputeAmount: parseFloat(disputeAmount) || 0,
      invoiceIds: Array.isArray(invoiceIds) ? invoiceIds : [],
      status: "open",
    });

    // Send email notification
    await EmailService.sendDisputeRaisedNotification(
      {
        comment,
        mismatchedCount,
        invoiceNumber,
        disputeAmount,
        customerName: customer.accountName,
      },
      customer,
    );

    createNotification({
      title: "Dispute raised",
      message: `${customer.accountName} raised a dispute on invoice(s): ${invoiceNumber.trim()}.`,
      type: "warning",
      category: "dispute",
      metadata: {
        disputeId: dispute.id,
        settingGate: "notifyDisputes",
      },
    }).catch((err) => {
      console.error("Failed to create dispute notification:", err);
    });

    res.json({
      success: true,
      message: "Dispute raised and notification sent successfully",
      data: {
        disputeId: dispute.id,
        status: dispute.status,
      },
    });
  } catch (error) {
    console.error("Raise Dispute Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to raise dispute",
    });
  }
};

/* ===================== GET ALL DISPUTES ===================== */
exports.getAllDisputes = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const rawStatus = req.query.status;
    const normalizedStatus =
      rawStatus === undefined || rawStatus === null
        ? ""
        : String(rawStatus).trim().toLowerCase();
    const validStatuses = ["open", "in_review", "resolved", "closed"];
    const status = validStatuses.includes(normalizedStatus)
      ? normalizedStatus
      : "";

    const where = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where[Op.or] = [
        { customerName: { [Op.iLike]: `%${search}%` } },
        { customerCode: { [Op.iLike]: `%${search}%` } },
        { invoiceNumber: { [Op.iLike]: `%${search}%` } },
      ];
    }

    console.log("GET All Disputes - querying database...");
    const { rows, count } = await Dispute.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
    console.log(
      `GET All Disputes - found ${rows.length} disputes on page ${page}`,
    );
    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Get All Disputes Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== DELETE DISPUTE ===================== */
exports.updateDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const rawStatus = req.body?.status;
    const normalizedStatus =
      rawStatus === undefined || rawStatus === null
        ? ""
        : String(rawStatus).trim().toLowerCase();

    const valid = ["open", "in_review", "resolved", "closed"];
    const status = valid.includes(normalizedStatus) ? normalizedStatus : "";
    const statusProvided =
      normalizedStatus !== "" &&
      normalizedStatus !== "undefined" &&
      normalizedStatus !== "null";

    // Check if there's at least a status change or a comment
    if (!statusProvided && !comment) {
      return res.status(400).json({
        success: false,
        error: "Provide either a status change or a comment",
      });
    }

    // If status is provided, validate it
    if (statusProvided && !status) {
      return res.status(400).json({
        success: false,
        error: "Invalid status value",
      });
    }

    const dispute = await Dispute.findByPk(id);
    if (!dispute) {
      return res.status(404).json({
        success: false,
        error: "Dispute not found",
      });
    }

    // if transitioning to a final state, record resolution info
    if (
      status &&
      ["resolved", "closed"].includes(status) &&
      dispute.status !== status
    ) {
      dispute.resolvedAt = Date.now();
      if (req.user && req.user.id) {
        dispute.resolvedBy = req.user.id;
      }
    }

    // Handle comments
    if (comment && comment.trim()) {
      const existingComments = dispute.comments || [];
      // Ensure we have an array (in case it's stored as JSON string)
      const comments = Array.isArray(existingComments) ? existingComments : [];
      const firstName = req.user?.firstName || "";
      const lastName = req.user?.lastName || "";
      const userName =
        `${firstName} ${lastName}`.trim() || req.user?.email || "Unknown User";
      const newComment = {
        text: comment.trim(),
        timestamp: Date.now(),
        userId: req.user?.id || null,
        userName: userName,
      };
      // Create a new array to ensure Sequelize detects the change
      const updatedComments = [...comments, newComment];
      dispute.comments = updatedComments;
      // Explicitly mark the field as changed for Sequelize
      dispute.changed("comments", true);
    }

    // Update status only if provided
    if (status) {
      dispute.status = status;
    }

    await dispute.save();

    // optional: notify customer/admin of status change
    if (status && ["resolved", "closed", "in_review"].includes(status)) {
      try {
        const customer = await Account.findOne({
          where: {
            [Op.or]: [
              { customerCode: dispute.customerCode },
              { accountName: dispute.customerName },
            ],
          },
        });

        if (customer) {
          await EmailService.sendDisputeStatusUpdateNotification(
            dispute,
            status,
            customer,
          );
        } else {
          console.warn(
            "No customer account found for dispute status email:",
            dispute.id,
          );
        }
      } catch (e) {
        console.error("Failed to send status update email", e);
      }
    }

    res.json({
      success: true,
      data: dispute,
    });
  } catch (error) {
    console.error("Update Dispute Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.deleteDispute = async (req, res) => {
  try {
    const { id } = req.params;

    const dispute = await Dispute.findByPk(id);

    if (!dispute) {
      return res.status(404).json({
        success: false,
        error: "Dispute not found",
      });
    }

    await dispute.destroy();

    res.json({
      success: true,
      message: "Dispute deleted successfully",
    });
  } catch (error) {
    console.error("Delete Dispute Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* ===================== ACCOUNT TOPUP FOR PREPAID ===================== */
exports.topupAccount = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      customerId,
      amount,
      paymentMethod,
      paymentReference,
      paymentProof,
      notes,
      topupDate,
    } = req.body;

    // Validate required fields
    if (
      !customerId ||
      amount === undefined ||
      amount === null ||
      !paymentMethod
    ) {
      return res.status(400).json({
        success: false,
        error: "customerId, amount, and paymentMethod are required",
      });
    }

    if (!paymentReference || !String(paymentReference).trim()) {
      return res.status(400).json({
        success: false,
        error: "paymentReference is required",
      });
    }

    // Validate amount is positive
    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Amount must be greater than zero",
      });
    }

    const normalizedTopupDate = topupDate ? Number(topupDate) : Date.now();
    if (!Number.isFinite(normalizedTopupDate)) {
      return res.status(400).json({
        success: false,
        error: "Invalid topupDate",
      });
    }

    // Get customer
    const isNumeric = /^\d+$/.test(customerId);
    const customerWhere = {
      [Op.or]: [{ customerCode: customerId }, { gatewayId: customerId }],
    };
    if (isNumeric) {
      customerWhere[Op.or].push({ accountId: parseInt(customerId) });
    }

    const customer = await Account.findOne({
      where: customerWhere,
      transaction,
    });

    if (!customer) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    // Verify account is prepaid
    if (customer.billingType !== "prepaid") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: "Topup is only available for prepaid accounts",
      });
    }

    // Update balance
    const newBalance = Number(customer.balance) + normalizedAmount;
    await customer.update(
      {
        balance: parseFloat(newBalance.toFixed(2)),
      },
      { transaction },
    );

    // Record topup as a payment
    const paymentNumber = await generatePaymentNumber();
    const receiptNumber = `RCP-${paymentNumber.split("-").slice(1).join("-")}`;

    const topupPayment = await Payment.create(
      {
        paymentNumber,
        receiptNumber,
        customerGatewayId: customer.gatewayId,
        customerCode: customer.customerCode,
        customerName: customer.accountName,
        partyType: "customer",
        paymentDirection: "inbound",
        amount: parseFloat(normalizedAmount),
        paymentDate: formatTime(normalizedTopupDate),
        paymentMethod,
        transactionId: String(paymentReference).trim(),
        referenceNumber: String(paymentReference).trim(),
        allocatedAmount: 0,
        unappliedAmount: parseFloat(normalizedAmount),
        notes: `Prepaid Topup - ${notes || ""}`,
        recordedBy: req.user?.id || null,
        recordedDate: Date.now(),
      },
      { transaction },
    );

    await transaction.commit();

    const completePayment = await Payment.findByPk(topupPayment.id);

    res.json({
      success: true,
      message: "Account topup successful",
      newBalance: parseFloat(newBalance.toFixed(2)),
      payment: completePayment,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Topup Account Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = exports;
