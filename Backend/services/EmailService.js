const nodemailer = require('nodemailer');
const ejs = require('ejs');
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

  async sendEmail(to, subject, templateName, data, attachments = []) {
    try {
      if (!this.isSafeSingleRecipient(to)) {
        throw new Error('Invalid recipient email format');
      }

      const templatePath = path.join(__dirname, '../templates/email', `${templateName}.ejs`);
      const html = await ejs.renderFile(templatePath, data);

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html,
        attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent: %s', info.messageId);
      return info;
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
    return this.sendEmail(
      customer.billingEmail || customer.email || invoice.customerEmail,
      `New Invoice: ${invoice.invoiceNumber}`,
      'invoice-notification',
      { invoice, customer }
    );
  }

  async sendPaymentConfirmation(payment, invoice, customer) {
    return this.sendEmail(
      customer.billingEmail || customer.email || invoice.customerEmail,
      `Payment Confirmation: ${payment.paymentNumber}`,
      'payment-confirmation',
      { payment, invoice, customer }
    );
  }

  async sendDisputeRaisedNotification(disputeData, customer) {
    // Notify admin about the dispute
    return this.sendEmail(
      process.env.EMAIL_FROM, // Send to admin
      `New Dispute Raised: ${customer.accountName}`,
      'dispute-raised',
      { disputeData, customer }
    );
  }

  async sendWelcomeEmail(user, password) {
    const portalUrl = process.env.BASE_API_URL    ? process.env.BASE_API_URL.replace(/\/+$/, '') // Remove trailing slash if present
                      : 'http://localhost:3000'; // Fallback URL for development
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
    const accountEmail = account.billingEmail || account.email;
    if (!accountEmail) {
      throw new Error('Account has no email address');
    }

    const subject = `Statement of Account - ${account.accountName} (${startDate} to ${endDate})`;

    return this.sendEmail(
      accountEmail,
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
