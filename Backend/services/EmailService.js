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

  async sendEmail(to, subject, templateName, data, attachments = []) {
    try {
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
    const portalUrl = process.env.BASE_API_URL || 'http://localhost:3000';
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
}

module.exports = new EmailService();
