const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const handleResponse = async (response) => {
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    window.location.href = '/';
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const fetchCDRs = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/cdr`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching CDRs:', error);
    throw error;
  }
};

export const fetchCDRCount = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/cdr/count`, {
      headers: getAuthHeaders()
    });
    const data = await handleResponse(response);
    return Number(data?.count || 0);
  } catch (error) {
    console.error('Error fetching CDR count:', error);
    throw error;
  }
};

export const fetchCDRStats = async ({ customerCode, vendorCode } = {}) => {
  try {
    const params = new URLSearchParams();
    if (customerCode) params.set('customerCode', customerCode);
    if (vendorCode) params.set('vendorCode', vendorCode);

    const response = await fetch(`${API_BASE_URL}/cdr/stats?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching CDR stats:', error);
    throw error;
  }
};

export const createCDR = async (cdrData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/cdr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(cdrData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error creating CDR:', error);
    throw error;
  }
};

export const bulkCreateCDRs = async (cdrsData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/cdr/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(cdrsData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error bulk creating CDRs:', error);
    throw error;
  }
};

export const updateCDR = async (id, cdrData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/cdr/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(cdrData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error updating CDR:', error);
    throw error;
  }
};

export const deleteCDR = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/cdr/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error deleting CDR:', error);
    throw error;
  }
};

export const fetchCustomers = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/customers`, {
      headers: getAuthHeaders()
    });
    const data = await handleResponse(response);
    return data.accounts || [];
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }
};

export const fetchVendors = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/accounts?role=vendor`, {
      headers: getAuthHeaders()
    });
    const data = await handleResponse(response);
    return data.accounts || [];
  } catch (error) {
    console.error('Error fetching vendors:', error);
    throw error;
  }
};

export const createCustomer = async (customerData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(customerData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
};

export const updateCustomer = async (id, customerData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(customerData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error updating customer:', error);
    throw error;
  }
};

export const deleteCustomer = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/customers/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error deleting customer:', error);
    throw error;
  }
};

// Report APIs
export const fetchReportAccounts = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/reports/accounts`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching report accounts:', error);
    throw error;
  }
};

export const generateReport = async (type, params) => {
  try {
    const response = await fetch(`${API_BASE_URL}/reports/${type}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(params)
    });
    return await handleResponse(response);
  } catch (error) {
    console.error(`Error generating ${type}:`, error);
    throw error;
  }
};

export const exportReport = async (data, format, fileName) => {
  try {
    const response = await fetch(`${API_BASE_URL}/reports/export-report`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ data, format, fileName })
    });
    
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/';
      return;
    }

    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName || 'report'}.${format === 'excel' ? 'xlsx' : 'csv'}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    return { success: true };
  } catch (error) {
    console.error('Error exporting report:', error);
    throw error;
  }
};

export const exportSOA = async (params) => {
  try {
    const response = await fetch(`${API_BASE_URL}/reports/export-soa`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(params)
    });
    
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/';
      return;
    }

    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SOA_${params.account?.accountName || 'Report'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    return { success: true };
  } catch (error) {
    console.error('Error exporting SOA:', error);
    throw error;
  }
};

export const sendSOAEmail = async (params) => {
  try {
    const response = await fetch(`${API_BASE_URL}/reports/send-soa-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(params),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error sending SOA email:', error);
    throw error;
  }
};

// Billing APIs
export const fetchInvoices = async (params = {}) => {
  try {
    // Remove null/undefined/empty values before serializing
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v != null && v !== '')
    );
    const query = new URLSearchParams(cleanParams).toString();
    const url = query
      ? `${API_BASE_URL}/billing/invoices?${query}`
      : `${API_BASE_URL}/billing/invoices`;

    const response = await fetch(url, { headers: getAuthHeaders() });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }
};

export const fetchLiteInvoices = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const url = query
      ? `${API_BASE_URL}/billing/invoices/lite?${query}`
      : `${API_BASE_URL}/billing/invoices/lite`;

    const response = await fetch(url, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching lite invoices:', error);
    throw error;
  }
};

export const fetchInvoiceById = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/invoices/${id}`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error(`Error fetching invoice ${id}:`, error);
    throw error;
  }
};

export const fetchInvoiceItems = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/invoices/${id}/items`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error(`Error fetching items for invoice ${id}:`, error);
    throw error;
  }
};

export const generateInvoice = async (invoiceData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/invoices/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(invoiceData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error generating invoice:', error);
    throw error;
  }
};

export const updateInvoiceStatus = async (id, statusData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/invoices/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(statusData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error(`Error updating invoice ${id}:`, error);
    throw error;
  }
};

export const deleteInvoice = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/invoices/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error(`Error deleting invoice ${id}:`, error);
    throw error;
  }
};

export const downloadInvoice = async (id, invoiceNumber) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/invoices/${id}/download`, {
      headers: getAuthHeaders()
    });

    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/';
      return;
    }

    if (!response.ok) throw new Error('Download failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_${invoiceNumber || id}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    return { success: true };
  } catch (error) {
    console.error(`Error downloading invoice ${id}:`, error);
    throw error;
  }
};

export const sendInvoiceEmail = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/invoices/${id}/send-email`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error(`Error sending email for invoice ${id}:`, error);
    throw error;
  }
};

export const recordPayment = async (paymentData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(paymentData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error recording payment:', error);
    throw error;
  }
};

export const raiseDispute = async (disputeData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/dispute/raise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(disputeData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error raising dispute:', error);
    throw error;
  }
};

export const getAllDisputes = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/disputes`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching disputes:', error);
    throw error;
  }
};

export const deleteDispute = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/disputes/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error(`Error deleting dispute ${id}:`, error);
    throw error;
  }
};

export const updateDisputeStatus = async (id, statusData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/disputes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(statusData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error(`Error updating dispute ${id}:`, error);
    throw error;
  }
};

export const fetchPayments = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const url = query
      ? `${API_BASE_URL}/billing/payments?${query}`
      : `${API_BASE_URL}/billing/payments`;

    const response = await fetch(url, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching payments:', error);
    throw error;
  }
};

export const fetchCustomerOutstanding = async (customerId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/customers/${customerId}/outstanding`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error(`Error fetching outstanding for customer ${customerId}:`, error);
    throw error;
  }
};

export const fetchVendorUsage = async (payload) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/vendor-usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching vendor usage:', error);
    throw error;
  }
};

export const runBillingAutomation = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/automation/run`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error running billing automation:', error);
    throw error;
  }
};

// Dashboard APIs
export const fetchDashboardStats = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const url = query
      ? `${API_BASE_URL}/dashboard/stats?${query}`
      : `${API_BASE_URL}/dashboard/stats`;
    const response = await fetch(url, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
};

export const fetchTopDestinations = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const url = query
      ? `${API_BASE_URL}/dashboard/top-destinations?${query}`
      : `${API_BASE_URL}/dashboard/top-destinations`;
    const response = await fetch(url, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching top destinations:', error);
    throw error;
  }
};

// User APIs
export const createUser = async (userData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(userData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};
export const fetchUsers = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/users`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const deleteUser = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

export const uploadVendorInvoice = async (formData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/vendor-invoices`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders()
      },
      body: formData,
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error uploading vendor invoice:', error);
    throw error;
  }
};

export const fetchVendorInvoices = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const url = query
      ? `${API_BASE_URL}/vendor-invoices?${query}`
      : `${API_BASE_URL}/vendor-invoices`;

    const response = await fetch(url, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching vendor invoices:', error);
    throw error;
  }
};

export const markInvoiceAsPaid = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/vendor-invoices/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ status: 'paid' }),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error(`Error marking vendor invoice ${id} as paid:`, error);
    throw error;
  }
};

export const topupAccount = async (topupData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/account/topup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(topupData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error processing topup:', error);
    throw error;
  }
};

export const deletevendorinvoice = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/vendor-invoices/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error(`Error deleting vendor invoice ${id}:`, error);
    throw error;
  }
};

// Settings and Notifications APIs
export const getGlobalSettings = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching global settings:', error);
    throw error;
  }
};

export const updateGlobalSettings = async (settings) => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(settings),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error updating global settings:', error);
    throw error;
  }
};

export const runRetentionCleanup = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/retention/run`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error running retention cleanup:', error);
    throw error;
  }
};

export const fetchNotifications = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const url = query
      ? `${API_BASE_URL}/notifications?${query}`
      : `${API_BASE_URL}/notifications`;

    const response = await fetch(url, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

export const markNotificationRead = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error marking notification read:', error);
    throw error;
  }
};

export const markAllNotificationsRead = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    throw error;
  }
};

export const createTestNotification = async (payload = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/notifications/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error creating test notification:', error);
    throw error;
  }
};

