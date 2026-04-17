const nodemailer = require('nodemailer');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  isSafeSingleRecipient(email) {
    if (typeof email !== 'string') return false;
    const trimmed = email.trim();

    // Disallow recipient lists/groups and header-injection characters.
    if (!trimmed || /[,;:\r\n]/.test(trimmed)) return false;

    // Keep recipient format strict because this app sends one recipient per email.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }

  parseEmailCandidates(value) {
    if (value == null) return [];

    if (Array.isArray(value)) {
      return value.flatMap((item) => this.parseEmailCandidates(item));
    }

    if (typeof value !== 'string') {
      return [];
    }

    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.flatMap((item) => this.parseEmailCandidates(item));
        }
      } catch (_error) {
        // Fall through to split parsing.
      }
    }

    return trimmed
      .split(/[,;]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  normalizeRecipients(...values) {
    const unique = new Map();

    for (const value of values) {
      const candidates = this.parseEmailCandidates(value);
      for (const candidate of candidates) {
        const email = candidate.trim();
        const key = email.toLowerCase();
        if (!this.isSafeSingleRecipient(email) || unique.has(key)) continue;
        unique.set(key, email);
      }
    }

    return Array.from(unique.values());
  }

  getBillingRecipients(customer = {}, invoice = {}) {
    return this.normalizeRecipients(
      customer.billingEmails,
      customer.billingEmail,
      invoice.customerEmail
    );
  }

  getSOARecipients(account = {}) {
    return this.normalizeRecipients(
      account.soaEmail
    );
  }

  getDisputeRecipients(customer = {}) {
    return this.normalizeRecipients(
      customer.disputeEmails,
      customer.disputeEmail
    );
  }

  getRatesRecipients(account = {}) {
    return this.normalizeRecipients(
      account.ratesEmails
    );
  }

  getNOCRecipients(account = {}) {
    return this.normalizeRecipients(
      account.nocEmails,
      account.nocEmail
    );
  }

  getLogoAsset() {
    const logoCandidates = [
      path.resolve(process.cwd(), 'frontend/public/Cyvora.png'),
      path.resolve(process.cwd(), '../frontend/public/Cyvora.png'),
      path.resolve(__dirname, '../../frontend/public/Cyvora.png'),
      path.resolve(__dirname, '../../../frontend/public/Cyvora.png'),
      path.resolve(__dirname, '../../../../frontend/public/Cyvora.png'),
    ];

    const logoPath = logoCandidates.find((candidate) => fs.existsSync(candidate));
    if (!logoPath) return { logoSrc: '', attachment: null };

    return {
      logoSrc: 'cid:cyvora-logo',
      attachment: {
        filename: path.basename(logoPath),
        path: logoPath,
        cid: 'cyvora-logo',
      },
    };
  }

  async sendEmail(to, subject, templateName, data, attachments = []) {
    try {
      const recipients = this.normalizeRecipients(to);
      if (recipients.length === 0) {
        throw new Error('Invalid recipient email format');
      }

      const smtpUser = String(process.env.EMAIL_USER || '').trim();
      const configuredFrom = String(process.env.EMAIL_FROM || '').trim();
      const fromAddress = configuredFrom || smtpUser;

      if (!fromAddress) {
        throw new Error('Email sender is not configured. Set EMAIL_FROM or EMAIL_USER.');
      }

      const { logoSrc, attachment: logoAttachment } = this.getLogoAsset();

      const templatePath = path.join(__dirname, '../templates/email', `${templateName}.ejs`);
      const templateData = {
        ...(data || {}),
        logoSrc,
      };
      const html = await ejs.renderFile(templatePath, templateData);

      const deliveryResults = [];
      for (const recipient of recipients) {
        const mailOptions = {
          from: fromAddress,
          to: recipient,
          subject,
          html,
          attachments: logoAttachment ? [...attachments, logoAttachment] : attachments,
          // Ensure the SMTP RCPT TO is always the intended recipient.
          envelope: {
            from: smtpUser || fromAddress,
            to: [recipient],
          },
        };

        if (configuredFrom && smtpUser && configuredFrom.toLowerCase() !== smtpUser.toLowerCase()) {
          mailOptions.replyTo = configuredFrom;
        }

        const info = await this.transporter.sendMail(mailOptions);
        deliveryResults.push(info);
        console.log(
          'Email send result -> to: %s | accepted: %s | rejected: %s | id: %s',
          recipient,
          JSON.stringify(info.accepted || []),
          JSON.stringify(info.rejected || []),
          info.messageId
        );
      }

      return deliveryResults.length === 1 ? deliveryResults[0] : deliveryResults;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async sendInvoiceWithAttachment(to, invoice, pdfBuffer) {
    return this.sendEmail(
      to,
      `Invoice ${invoice.invoiceNumber}`,
      'invoice-notification',
      { invoice, customer: { accountName: invoice.customerName } },
      [{
        filename: `Invoice_${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    );
  }

  async sendInvoiceEmail(invoice, customer) {
    const recipients = this.getBillingRecipients(customer, invoice);
    if (recipients.length === 0) {
      throw new Error('Customer has no billing email address');
    }

    return this.sendEmail(
      recipients,
      `New Invoice: ${invoice.invoiceNumber}`,
      'invoice-notification',
      { invoice, customer }
    );
  }

  async sendPaymentConfirmation(payment, invoice, customer) {
    const recipients = this.getBillingRecipients(customer, invoice);
    if (recipients.length === 0) {
      throw new Error('Customer has no billing email address');
    }

    return this.sendEmail(
      recipients,
      `Payment Confirmation: ${payment.paymentNumber}`,
      'payment-confirmation',
      { payment, invoice, customer }
    );
  }

  async sendDisputeRaisedNotification(disputeData, customer) {
    const recipients = this.getDisputeRecipients(customer);
    if (recipients.length === 0) {
      throw new Error('Account has no dispute email address');
    }

    return this.sendEmail(
      recipients,
      `New Dispute Raised: ${customer.accountName}`,
      'dispute-raised',
      { disputeData, customer }
    );
  }

  async sendDisputeStatusUpdateNotification(dispute, status, customer) {
    const recipients = this.getDisputeRecipients(customer);
    if (recipients.length === 0) {
      throw new Error('Account has no dispute email address');
    }

    return this.sendEmail(
      recipients,
      `Dispute ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      'dispute-status-update',
      { dispute, status, customer }
    );
  }

  async sendWelcomeEmail(user, password) {
    const portalUrl = (
      process.env.PORTAL_URL ||
      process.env.FRONTEND_URL ||
      process.env.BASE_API_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');

    return this.sendEmail(
      user.email,
      'Welcome to CDR Billing System - Your Login Credentials',
      'welcome-credentials',
      {
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        password,
        role: user.role,
        phone: user.phone,
        portalUrl
      }
    );
  }

  async sendSOAEmail(account, startDate, endDate, soaData) {
    const recipients = this.getSOARecipients(account);
    if (recipients.length === 0) {
      throw new Error('Account has no SOA email address');
    }

    const subject = `Statement of Account - ${account.accountName} (${startDate} to ${endDate})`;

    return this.sendEmail(
      recipients,
      subject,
      'soa-statement',
      {
        account,
        startDate,
        endDate,
        soaData
      }
    );
  }
}

module.exports = new EmailService();
