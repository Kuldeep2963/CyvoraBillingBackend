const STORAGE_KEYS = {
  CDRS: 'cdrs',
  CUSTOMERS: 'customers',
  INVOICES: 'invoices',
  SETTINGS: 'settings',
};

export const loadFromStorage = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Error loading ${key} from storage:`, error);
    return [];
  }
};

export const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Error saving ${key} to storage:`, error);
    return false;
  }
};

export const getCDRs = () => loadFromStorage(STORAGE_KEYS.CDRS);
export const saveCDRs = (cdrs) => saveToStorage(STORAGE_KEYS.CDRS, cdrs);

export const getCustomers = () => loadFromStorage(STORAGE_KEYS.CUSTOMERS);
export const saveCustomers = (customers) => saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);

export const getInvoices = () => loadFromStorage(STORAGE_KEYS.INVOICES);
export const saveInvoices = (invoices) => saveToStorage(STORAGE_KEYS.INVOICES, invoices);

export const getSettings = () => {
  const defaultSettings = {
    taxRate: 0.18,
    defaultRate: 0.01,
    billingCycle: 'monthly',
    currency: 'USD',
    companyName: 'Telecom Billing Co.',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
  };
  
  try {
    const settings = loadFromStorage(STORAGE_KEYS.SETTINGS);
    return { ...defaultSettings, ...settings };
  } catch (error) {
    return defaultSettings;
  }
};

export const saveSettings = (settings) => saveToStorage(STORAGE_KEYS.SETTINGS, settings);

export const addCDR = (cdr) => {
  const cdrs = getCDRs();
  const newCdr = {
    ...cdr,
    id: `cdr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString(),
  };
  cdrs.push(newCdr);
  saveCDRs(cdrs);
  return newCdr;
};

export const updateCDR = (id, updates) => {
  const cdrs = getCDRs();
  const index = cdrs.findIndex(cdr => cdr.id === id);
  if (index !== -1) {
    cdrs[index] = { ...cdrs[index], ...updates, updated_at: new Date().toISOString() };
    saveCDRs(cdrs);
    return cdrs[index];
  }
  return null;
};

export const deleteCDR = (id) => {
  const cdrs = getCDRs();
  const filteredCdrs = cdrs.filter(cdr => cdr.id !== id);
  saveCDRs(filteredCdrs);
  return filteredCdrs;
};

export const clearAllData = () => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};

export const exportAllData = () => {
  const data = {};
  Object.values(STORAGE_KEYS).forEach(key => {
    data[key] = loadFromStorage(key);
  });
  return data;
};

export const importData = (data) => {
  Object.entries(data).forEach(([key, value]) => {
    if (Object.values(STORAGE_KEYS).includes(key)) {
      saveToStorage(key, value);
    }
  });
};