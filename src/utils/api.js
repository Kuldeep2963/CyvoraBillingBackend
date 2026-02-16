const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const fetchCDRs = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/cdr`);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching CDRs:', error);
    throw error;
  }
};

export const createCDR = async (cdrData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/cdr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error deleting CDR:', error);
    throw error;
  }
};

export const fetchCustomers = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/customers`);
    const data = await handleResponse(response);
    return data.accounts || [];
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }
};

export const createCustomer = async (customerData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    const response = await fetch(`${API_BASE_URL}/reports/accounts`);
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, format, fileName })
    });
    
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

// Billing APIs
export const fetchInvoices = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const url = query
      ? `${API_BASE_URL}/billing/invoices?${query}`
      : `${API_BASE_URL}/billing/invoices`;

    const response = await fetch(url);
    console.log("responseData",response.data )
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

    const response = await fetch(url);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching lite invoices:', error);
    throw error;
  }
};

export const fetchInvoiceById = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/invoices/${id}`);
    return await handleResponse(response);
  } catch (error) {
    console.error(`Error fetching invoice ${id}:`, error);
    throw error;
  }
};

export const fetchInvoiceItems = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/invoices/${id}/items`);
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
    });
    return await handleResponse(response);
  } catch (error) {
    console.error(`Error deleting invoice ${id}:`, error);
    throw error;
  }
};

export const recordPayment = async (paymentData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error recording payment:', error);
    throw error;
  }
};

export const fetchPayments = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const url = query
      ? `${API_BASE_URL}/billing/payments?${query}`
      : `${API_BASE_URL}/billing/payments`;

    const response = await fetch(url);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching payments:', error);
    throw error;
  }
};

export const fetchCustomerOutstanding = async (customerId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/customers/${customerId}/outstanding`);
    return await handleResponse(response);
  } catch (error) {
    console.error(`Error fetching outstanding for customer ${customerId}:`, error);
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
    const response = await fetch(url);
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
    const response = await fetch(url);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching top destinations:', error);
    throw error;
  }
};

