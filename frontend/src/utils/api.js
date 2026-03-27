const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

let isRefreshing = false;
let refreshPromise = null;

const getAuthHeaders = () => {
  const accessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  return accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {};
};

const refreshAccessToken = async () => {
  try {
    const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Token refresh failed');
    }

    // Determine which storage was used
    const storage = localStorage.getItem('accessToken') ? localStorage : sessionStorage;
    storage.setItem('accessToken', data.accessToken);

    return data.accessToken;
  } catch (error) {
    console.error('Token refresh error:', error);
    // Clear auth and redirect to login
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    window.location.href = '/';
    throw error;
  }
};

const handleResponse = async (response, originalRequest) => {
  if (response.status === 401) {
    // Try to refresh token if we haven't already
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        refreshPromise = refreshAccessToken();
        await refreshPromise;
        isRefreshing = false;
        refreshPromise = null;
        
        // Retry original request with new token
        if (originalRequest) {
          const retryResponse = await fetch(originalRequest.url, {
            ...originalRequest.options,
            headers: {
              ...originalRequest.options.headers,
              ...getAuthHeaders(),
            },
          });
          return await handleResponse(retryResponse);
        }
      } catch (error) {
        isRefreshing = false;
        refreshPromise = null;
        throw error;
      }
    } else if (refreshPromise) {
      // Wait for ongoing refresh
      try {
        await refreshPromise;
        // Retry original request with new token
        if (originalRequest) {
          const retryResponse = await fetch(originalRequest.url, {
            ...originalRequest.options,
            headers: {
              ...originalRequest.options.headers,
              ...getAuthHeaders(),
            },
          });
          return await handleResponse(retryResponse);
        }
      } catch (error) {
        throw error;
      }
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

const fetchWithTokenRefresh = async (url, options = {}) => {
  const { responseType = 'json', ...fetchOptions } = options;
  const originalRequest = { url, options };
  
  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      ...getAuthHeaders(),
      ...fetchOptions.headers,
    },
  });

  // Handle 401 with token refresh
  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        refreshPromise = refreshAccessToken();
        await refreshPromise;
        isRefreshing = false;
        refreshPromise = null;
        
        // Retry original request with new token
        const retryResponse = await fetch(url, {
          ...fetchOptions,
          headers: {
            ...getAuthHeaders(),
            ...fetchOptions.headers,
          },
        });
        
        if (retryResponse.status === 401) {
          throw new Error('Unauthorized');
        }
        
        if (!retryResponse.ok) {
          const error = await retryResponse.json().catch(() => ({ error: 'Network error' }));
          throw new Error(error.error || `HTTP error! status: ${retryResponse.status}`);
        }
        
        return responseType === 'blob' ? await retryResponse.blob() : await retryResponse.json();
      } catch (error) {
        isRefreshing = false;
        refreshPromise = null;
        throw error;
      }
    } else if (refreshPromise) {
      // Wait for ongoing refresh
      try {
        await refreshPromise;
        const retryResponse = await fetch(url, {
          ...fetchOptions,
          headers: {
            ...getAuthHeaders(),
            ...fetchOptions.headers,
          },
        });
        
        if (retryResponse.status === 401) {
          throw new Error('Unauthorized');
        }
        
        if (!retryResponse.ok) {
          const error = await retryResponse.json().catch(() => ({ error: 'Network error' }));
          throw new Error(error.error || `HTTP error! status: ${retryResponse.status}`);
        }
        
        return responseType === 'blob' ? await retryResponse.blob() : await retryResponse.json();
      } catch (error) {
        throw error;
      }
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return responseType === 'blob' ? await response.blob() : await response.json();
};

export const fetchCDRs = async () => {
  try {
    return await fetchWithTokenRefresh(`${API_BASE_URL}/cdr`);
  } catch (error) {
    console.error('Error fetching CDRs:', error);
    throw error;
  }
};

export const fetchCDRCount = async () => {
  try {
    const data = await fetchWithTokenRefresh(`${API_BASE_URL}/cdr/count`);
    return Number(data?.count || 0);
  } catch (error) {
    console.error('Error fetching CDR count:', error);
    throw error;
  }
};

export const fetchCDRStats = async ({ accountId, customerCode, vendorCode } = {}) => {
  try {
    const params = new URLSearchParams();
    if (accountId) params.set('accountId', accountId);
    if (customerCode) params.set('customerCode', customerCode);
    if (vendorCode) params.set('vendorCode', vendorCode);

    return await fetchWithTokenRefresh(`${API_BASE_URL}/cdr/stats?${params.toString()}`);
  } catch (error) {
    console.warn('CDR stats unavailable, returning safe defaults:', error?.message || error);
    return {
      totalCalls: 0,
      totalDuration: 0,
      totalRevenue: 0,
      totalTax: 0,
      answeredCalls: 0,
      degraded: true,
    };
  }
};

export const downloadCDRCSV = async ({ startTime, endTime, accountId, cdrSide = 'all' }) => {
  try {
    const params = new URLSearchParams({ startTime, endTime });
    if (accountId && accountId !== 'all') {
      params.set('accountId', accountId);
    }
    if (cdrSide && cdrSide !== 'all') {
      params.set('cdrSide', cdrSide);
    }
    
    const blob = await fetchWithTokenRefresh(`${API_BASE_URL}/cdr/export?${params.toString()}`, {
      responseType: 'blob'
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cdrs_${startTime}_to_${endTime}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    return { success: true };
  } catch (error) {
    console.error('Error downloading CDR CSV:', error);
    throw error;
  }
};

export const fetchMissingGateways = async ({ startDate, endDate, search = '', page = 1, limit = 25 } = {}) => {
  try {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('limit', String(limit));

    return await fetchWithTokenRefresh(`${API_BASE_URL}/cdr/missing-gateways?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
  } catch (error) {
    console.error('Error fetching missing gateways:', error);
    throw error;
  }
};

export const createCDR = async (cdrData) => {
  try {
    return await fetchWithTokenRefresh(`${API_BASE_URL}/cdr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cdrData),
    });
  } catch (error) {
    console.error('Error creating CDR:', error);
    throw error;
  }
};

export const bulkCreateCDRs = async (cdrsData) => {
  try {
    return await fetchWithTokenRefresh(`${API_BASE_URL}/cdr/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cdrsData),
    });
  } catch (error) {
    console.error('Error bulk creating CDRs:', error);
    throw error;
  }
};

export const updateCDR = async (id, cdrData) => {
  try {
    return await fetchWithTokenRefresh(`${API_BASE_URL}/cdr/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cdrData),
    });
  } catch (error) {
    console.error('Error updating CDR:', error);
    throw error;
  }
};

export const deleteCDR = async (id) => {
  try {
    return await fetchWithTokenRefresh(`${API_BASE_URL}/cdr/${id}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Error deleting CDR:', error);
    throw error;
  }
};

export const fetchCustomers = async () => {
  try {
    const data = await fetchWithTokenRefresh(`${API_BASE_URL}/customers`);
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
    return await fetchWithTokenRefresh(`${API_BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerData),
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
};

export const bulkCreateCustomers = async ({ accounts, continueOnError = true }) => {
  try {
    return await fetchWithTokenRefresh(`${API_BASE_URL}/customers/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accounts, continueOnError }),
    });
  } catch (error) {
    console.error('Error bulk creating customers:', error);
    throw error;
  }
};

export const updateCustomer = async (id, customerData) => {
  try {
    return await fetchWithTokenRefresh(`${API_BASE_URL}/customers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerData),
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    throw error;
  }
};

export const uploadAccountDocument = async (accountId, { title, file }) => {
  try {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('file', file);

    return await fetchWithTokenRefresh(`${API_BASE_URL}/customers/${accountId}/documents`, {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    console.error('Error uploading account document:', error);
    throw error;
  }
};

export const deleteAccountDocument = async (accountId, documentId) => {
  try {
    return await fetchWithTokenRefresh(`${API_BASE_URL}/customers/${accountId}/documents/${documentId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Error deleting account document:', error);
    throw error;
  }
};

export const downloadAccountDocument = async (accountId, documentId, documentName) => {
  try {
    const blob = await fetchWithTokenRefresh(`${API_BASE_URL}/customers/${accountId}/documents/${documentId}/download`, {
      method: 'GET',
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = documentName || `document-${documentId}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error downloading account document:', error);
    throw error;
  }
};

export const viewAccountDocument = (accountId, documentId) => {
  try {
    const token = localStorage.getItem('authToken');
    const url = `${API_BASE_URL}/customers/${accountId}/documents/${documentId}/view`;
    const documentUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
    window.open(documentUrl, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Error opening document viewer:', error);
    throw error;
  }
};

export const deleteCustomer = async (id) => {
  try {
    return await fetchWithTokenRefresh(`${API_BASE_URL}/customers/${id}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    throw error;
  }
};

// Report APIs
export const fetchReportAccounts = async () => {
  try {
    return await fetchWithTokenRefresh(`${API_BASE_URL}/reports/accounts`);
  } catch (error) {
    console.error('Error fetching report accounts:', error);
    throw error;
  }
};

export const generateReport = async (type, params) => {
  try {
    return await fetchWithTokenRefresh(`${API_BASE_URL}/reports/${type}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    });
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
    return await fetchWithTokenRefresh(`${API_BASE_URL}/billing/invoices/${id}/send-email`, {
      method: 'POST',
    });
  } catch (error) {
    console.error(`Error sending email for invoice ${id}:`, error);
    throw error;
  }
};

export const recordPayment = async (paymentData) => {
  try {
    return await fetchWithTokenRefresh(`${API_BASE_URL}/billing/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });
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

export const getAllDisputes = async (params = {}) => {
  try {
    const sanitizedParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => {
        if (value === undefined || value === null) return false;
        const normalized = String(value).trim().toLowerCase();
        return normalized !== '' && normalized !== 'undefined' && normalized !== 'null';
      })
    );
    const query = new URLSearchParams(sanitizedParams).toString();
    const url = query
      ? `${API_BASE_URL}/billing/disputes?${query}`
      : `${API_BASE_URL}/billing/disputes`;

    const response = await fetch(url, {
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
    const response = await fetch(`${API_BASE_URL}/users`, {
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
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v != null && v !== '')
    );
    const query = new URLSearchParams(cleanParams).toString();
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

export const uploadCountryCodes = async (formData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/country-codes/upload`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders()
      },
      body: formData,
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error uploading country codes:', error);
    throw error;
  }
};

export const fetchCountryCodes = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/country-codes`, {
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching country codes:', error);
    throw error;
  }
};

export const addCountryCode = async (payload) => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/country-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error adding country code:', error);
    throw error;
  }
};

export const deleteCountryCode = async (code) => {
  try {
    const response = await fetch(`${API_BASE_URL}/settings/country-codes/${encodeURIComponent(code)}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error deleting country code:', error);
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

