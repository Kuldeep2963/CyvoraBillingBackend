import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  VStack,
  Text,
  Button,
  useToast,
  HStack,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Tab,
  FormHelperText,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  SimpleGrid,
  TagLabel,
  TagCloseButton,
} from '@chakra-ui/react';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiUser,
  FiDollarSign,
  FiPercent,
} from 'react-icons/fi';
import DataTable from '../components/DataTable';
import ConfirmDialog from '../components/ConfirmDialog';
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer, fetchCDRs } from '../utils/api';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [formData, setFormData] = useState({
    
  // Basic Information
  firstName: '',
  lastName: '',
  accountName: '',
  accountOwner: '',
  ownership: 'None',
  
  // Contact Information
  phone: '',
  vendorFax: '',
  customerEmployee: '',
  email: '',
  billingEmail: '',
  
  // Account Details
  active: true,
  vatNumber: '',
  verificationStatus: 'pending',
  resellerAccount: false,
  reseller: '',
  
  // Financial
  currency: 'USD',
  nominalCode: '',
  creditLimit: 10000.00,
  balance: 0.00,
  
  // Localization
  timezone: 'UTC',
  languages: 'en',
  
  // Description
  description: '',
  
  // Address
  addressLine1: '',
  addressLine2: '',
  addressLine3: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
  
  // Billing
  billingClass: 'standard',
  billingType: 'prepaid',
  billingTimezone: 'UTC',
  billingStartDate: new Date().toISOString().split('T')[0],
  billingCycle: 'monthly',
  
  // Payment Settings
  autoPay: false,
  autoPayMethod: 'credit_card',
  sendInvoiceEmail: true,
  lateFeeEnabled: true,
  lateFeePercentage: 5.00,
  gracePeriodDays: 15,
  
  // Telecom Specific
  telecomProvider: false,
  wholesaleCustomer: false,
  retailCustomer: false,
  
  // Call Rating
  defaultRatePerSecond: 0.0100,
  taxRate: 18.00,
  minimumCharge: 0.0100,
  roundingDecimal: 4,

  });
  const [cdrStats, setCdrStats] = useState({});
  const toast = useToast();

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchTerm]);

  useEffect(() => {
    if (selectedCustomer) {
      calculateCustomerStats(selectedCustomer.id);
    }
  }, [selectedCustomer]);

  const loadCustomers = async () => {
    try {
      const customersData = await fetchCustomers();
      setCustomers(customersData);
      setFilteredCustomers(customersData);
    } catch (error) {
      toast({
        title: 'Error loading customers',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setCustomers([]);
      setFilteredCustomers([]);
    }
  };

  const filterCustomers = () => {
    if (!searchTerm) {
      setFilteredCustomers(customers);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = customers.filter(customer =>
      customer.name?.toLowerCase().includes(term) ||
      customer.email?.toLowerCase().includes(term) ||
      customer.phone?.toLowerCase().includes(term) ||
      customer.id?.toLowerCase().includes(term)
    );

    setFilteredCustomers(filtered);
  };

  const calculateCustomerStats = async (customerId) => {
    try {
      const cdrs = await fetchCDRs();
      const customerCdrs = cdrs.filter(cdr => cdr.customer_id === customerId);
      
      const stats = customerCdrs.reduce((acc, cdr) => ({
        totalCalls: acc.totalCalls + 1,
        totalDuration: acc.totalDuration + (parseInt(cdr.duration) || 0),
        totalRevenue: acc.totalRevenue + (parseFloat(cdr.fee) || 0),
        totalTax: acc.totalTax + (parseFloat(cdr.tax) || 0),
        answeredCalls: acc.answeredCalls + (cdr.status === 'ANSWERED' ? 1 : 0),
      }), {
        totalCalls: 0,
        totalDuration: 0,
        totalRevenue: 0,
        totalTax: 0,
        answeredCalls: 0,
      });

      setCdrStats(stats);
    } catch (error) {
      console.error('Error calculating customer stats:', error);
    }
  };

  const handleAddNew = () => {
  setFormData({
    // Basic Information
    firstName: '',
    lastName: '',
    accountName: '',
    accountOwner: '',
    ownership: 'None',
    
    // Contact Information
    phone: '',
    vendorFax: '',
    customerEmployee: '',
    email: '',
    billingEmail: '',
    
    // Account Details
    active: true,
    vatNumber: '',
    verificationStatus: 'pending',
    resellerAccount: false,
    reseller: '',
    
    // Financial
    currency: 'USD',
    nominalCode: '',
    creditLimit: 10000.00,
    balance: 0.00,
    
    // Localization
    timezone: 'UTC',
    languages: 'en',
    
    // Description
    description: '',
    
    // Address
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    
    // Billing
    billingClass: 'standard',
    billingType: 'prepaid',
    billingTimezone: 'UTC',
    billingStartDate: new Date().toISOString().split('T')[0],
    billingCycle: 'monthly',
    
    // Payment Settings
    autoPay: false,
    autoPayMethod: 'credit_card',
    sendInvoiceEmail: true,
    lateFeeEnabled: true,
    lateFeePercentage: 5.00,
    gracePeriodDays: 15,
    
    // Telecom Specific
    telecomProvider: false,
    wholesaleCustomer: false,
    retailCustomer: false,
    
    // Call Rating
    defaultRatePerSecond: 0.0100,
    taxRate: 18.00,
    minimumCharge: 0.0100,
    roundingDecimal: 4,
    
    createdAt: new Date().toISOString(),
  });
  
  setSelectedCustomer(null);
  setIsModalOpen(true);
};

  const handleEdit = (customer) => {
    setSelectedCustomer(customer);
    setFormData(customer);
    setIsModalOpen(true);
  };

  const handleDelete = (customer) => {
    setSelectedCustomer(customer);
    setIsDeleteOpen(true);
  };

  const handleView = (customer) => {
    setSelectedCustomer(customer);
    // You could open a view modal here
  };

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      toast({
        title: 'Validation Error',
        description: validationErrors.join(', '),
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      if (selectedCustomer) {
        await updateCustomer(selectedCustomer.id, formData);
      } else {
        await createCustomer(formData);
      }

      loadCustomers();
      setIsModalOpen(false);
      setSelectedCustomer(null);

      toast({
        title: selectedCustomer ? 'Customer updated' : 'Customer added',
        description: `Customer ${formData.accountName} has been ${selectedCustomer ? 'updated' : 'added'} successfully`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error saving customer',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteCustomer(selectedCustomer.id);
      loadCustomers();
      setIsDeleteOpen(false);
      setSelectedCustomer(null);

      toast({
        title: 'Customer deleted',
        description: `Customer ${selectedCustomer.accountName} has been deleted`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error deleting customer',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const validateForm = () => {
    const errors = [];
    // if (!formData.name?.trim()) errors.push('Name is required');
    if (!formData.email?.trim()) errors.push('Email is required');
    if (formData.rate <= 0) errors.push('Rate must be greater than 0');
    if (formData.taxRate < 0 || formData.taxRate > 1) errors.push('Tax rate must be between 0 and 1');
    return errors;
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setSelectedCustomer(null);
  };
  const columns = [
  {
    key: 'accountNumber',
    header: 'Account #',
    render: (value) => (
      <Badge colorScheme="blue" variant="subtle">
        {value}
      </Badge>
    ),
  },
  {
    key: 'accountName',
    header: 'Account Name',
    render: (value, row) => (
      <Box>
        <Text fontWeight="medium">{value}</Text>
        <Text fontSize="sm" color="gray.600">
          {row.firstName} {row.lastName}
        </Text>
      </Box>
    ),
  },
  {
    key: 'phone',
    header: 'Phone',
  },
  {
    key: 'email',
    header: 'Email',
  },
  {
    key: 'defaultRatePerSecond',
    header: 'Rate/sec',
    render: (value) => `$${parseFloat(value).toFixed(4)}`,
  },
  {
    key: 'active',
    header: 'Status',
    render: (value) => (
      <Badge colorScheme={value ? 'green' : 'red'}>
        {value ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    key: 'billingCycle',
    header: 'Billing',
    render: (value) => (
      <Badge colorScheme="purple" variant="outline">
        {value}
      </Badge>
    ),
  },
  {
    key: 'creditLimit',
    header: 'Credit Limit',
    render: (value) => `$${parseFloat(value).toFixed(2)}`,
  },
  {
    key: 'balance',
    header: 'Balance',
    render: (value) => (
      <Text color={parseFloat(value) < 0 ? 'red.600' : 'green.600'}>
        ${parseFloat(value).toFixed(2)}
      </Text>
    ),
  },
];

  const billingCycles = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'annually', label: 'Annually' },
  ];

  const paymentMethods = [
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'paypal', label: 'PayPal' },
    { value: 'invoice', label: 'Invoice' },
  ];

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'suspended', label: 'Suspended' },
  ];

  return (
    <Container maxW="container.xl" py={2}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between">
          <Box>
            <Heading size="lg" mb={2}>Customers</Heading>
            <Text color="gray.600">
              Manage customer accounts and billing rates
            </Text>
          </Box>
          <Button
            leftIcon={<FiPlus />}
            colorScheme="blue"
            onClick={handleAddNew}
          >
            Add Customer
          </Button>
        </HStack>

        {/* Search Bar */}
        <Box>
          <Input
            placeholder="Search customers by name, email, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            bg="white"
          />
        </Box>

        {/* Customer Stats Summary */}
        <HStack spacing={4} wrap="wrap">
          <Box p={4} bg="blue.50" borderRadius="md" flex={1} minW="200px">
            <Text fontSize="sm" color="blue.600" fontWeight="medium">Total Customers</Text>
            <Text fontSize="2xl" fontWeight="bold">{customers.length}</Text>
          </Box>
          <Box p={4} bg="green.50" borderRadius="md" flex={1} minW="200px">
            <Text fontSize="sm" color="green.600" fontWeight="medium">Active Customers</Text>
            <Text fontSize="2xl" fontWeight="bold">
              {customers.filter(c => c.status === 'active').length}
            </Text>
          </Box>
          <Box p={4} bg="purple.50" borderRadius="md" flex={1} minW="200px">
            <Text fontSize="sm" color="purple.600" fontWeight="medium">Avg. Rate</Text>
            <Text fontSize="2xl" fontWeight="bold">
              ${(customers.reduce((sum, c) => sum + parseFloat(c.rate), 0) / customers.length || 0).toFixed(4)}
            </Text>
          </Box>
        </HStack>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={filteredCustomers}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={handleView}
        />

        {/* Customer Modal */}
       <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="3xl" closeOnOverlayClick={false}>
  <ModalOverlay />
  <ModalContent borderRadius={"8px"} maxH="90vh">
    {/* Sticky Header */}
    <ModalHeader borderTopRadius={"8px"} bgColor="blue.500" color="white"  position="sticky" top={0}  zIndex={1} borderBottom="1px" borderColor="gray.200">
      <VStack align="start" spacing={1}>
        <Heading size="md" fontWeight={"semibold"} color={"white"}>
          {selectedCustomer ? 'Edit Customer' : 'Add New Customer'}
        </Heading>
        {selectedCustomer && (
          <Text fontSize="sm" color="gray.600">
            Account #: {selectedCustomer.accountNumber}
          </Text>
        )}
      </VStack>
      <ModalCloseButton color={"white"} top={4} right={4} />
    </ModalHeader>
    
    
    {/* Scrollable Content */}
    <ModalBody overflowY="auto" maxH="calc(90vh - 140px)">
      <VStack spacing={6} align="stretch" pb={4}>
        {/* Tabs for organized sections */}
        <Tabs variant="line" colorScheme="blue" >
          <TabList position={"sticky"} zIndex={2}>
            <Tab>Basic Info</Tab>
            <Tab>Contact & Address</Tab>
            <Tab>Billing & Payment</Tab>
            <Tab>Telecom Settings</Tab>
            {selectedCustomer && <Tab>Usage Statistics</Tab>}
          </TabList>

          <TabPanels>
            {/* Tab 1: Basic Information */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Heading size="sm" mb={2}>Account Information</Heading>
                <SimpleGrid columns={2} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>First Name</FormLabel>
                    <Input
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="John"
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Last Name</FormLabel>
                    <Input
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Doe"
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Account Name</FormLabel>
                    <Input
                      value={formData.accountName}
                      onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                      placeholder="Company Name"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Account Owner</FormLabel>
                    <Input
                      value={formData.accountOwner}
                      onChange={(e) => setFormData({ ...formData, accountOwner: e.target.value })}
                      placeholder="Sales Rep Name"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Ownership</FormLabel>
                    <Select
                      value={formData.ownership}
                      onChange={(e) => setFormData({ ...formData, ownership: e.target.value })}
                    >
                      <option value="None">None</option>
                      <option value="private">Private</option>
                      <option value="public">Public</option>
                      <option value="subsidiary">Subsidiary</option>
                      <option value="others">Others</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Active</FormLabel>
                    <Select
                      value={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.value === 'true' })}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </Select>
                  </FormControl>
                </SimpleGrid>

                <Heading size="sm" mb={2} mt={4}>Financial Information</Heading>
                <SimpleGrid columns={2} spacing={4}>
                  <FormControl>
                    <FormLabel>Currency</FormLabel>
                    <Select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="INR">INR</option>
                      <option value="AUD">AUD</option>
                      <option value="CAD">CAD</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>VAT Number</FormLabel>
                    <Input
                      value={formData.vatNumber}
                      onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                      placeholder="VAT/Tax ID"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Nominal Code</FormLabel>
                    <Input
                      value={formData.nominalCode}
                      onChange={(e) => setFormData({ ...formData, nominalCode: e.target.value })}
                      placeholder="Accounting code"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Verification Status</FormLabel>
                    <Select
                      value={formData.verificationStatus}
                      onChange={(e) => setFormData({ ...formData, verificationStatus: e.target.value })}
                    >
                      <option value="pending">Pending</option>
                      <option value="verified">Verified</option>
                      <option value="unverified"> Not Verified</option>
                      
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Description</FormLabel>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Customer description"
                    />
                  </FormControl>
                </SimpleGrid>
              </VStack>
            </TabPanel>

            {/* Tab 2: Contact & Address */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Heading size="sm" mb={2}>Contact Information</Heading>
                <SimpleGrid columns={2} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Email</FormLabel>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="customer@example.com"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Billing Email</FormLabel>
                    <Input
                      type="email"
                      value={formData.billingEmail}
                      onChange={(e) => setFormData({ ...formData, billingEmail: e.target.value })}
                      placeholder="billing@example.com"
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Phone</FormLabel>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1234567890"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Vendor Fax</FormLabel>
                    <Input
                      value={formData.vendorFax}
                      onChange={(e) => setFormData({ ...formData, vendorFax: e.target.value })}
                      placeholder="+1234567891"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Customer Employee</FormLabel>
                    <Input
                      value={formData.customerEmployee}
                      onChange={(e) => setFormData({ ...formData, customerEmployee: e.target.value })}
                      placeholder="Primary contact"
                    />
                  </FormControl>
                </SimpleGrid>

                <Heading size="sm" mb={2} mt={4}>Reseller Information</Heading>
                <SimpleGrid columns={2} spacing={4}>
                  <FormControl>
                    <FormLabel>Reseller Account</FormLabel>
                    <Select
                      value={formData.resellerAccount}
                      onChange={(e) => setFormData({ ...formData, resellerAccount: e.target.value === 'true' })}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </Select>
                  </FormControl>
                  {formData.resellerAccount && (
                    <FormControl>
                      <FormLabel>Reseller Name</FormLabel>
                      <Input
                        value={formData.reseller}
                        onChange={(e) => setFormData({ ...formData, reseller: e.target.value })}
                        placeholder="Reseller company name"
                      />
                    </FormControl>
                  )}
                </SimpleGrid>

                <Heading size="sm" mb={2} mt={4}>Address Information</Heading>
                <SimpleGrid columns={1} spacing={3}>
                  <FormControl isRequired>
                    <FormLabel>Address Line 1</FormLabel>
                    <Input
                      value={formData.addressLine1}
                      onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                      placeholder="Street address"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Address Line 2</FormLabel>
                    <Input
                      value={formData.addressLine2}
                      onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                      placeholder="Apartment, suite, etc."
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Address Line 3</FormLabel>
                    <Input
                      value={formData.addressLine3}
                      onChange={(e) => setFormData({ ...formData, addressLine3: e.target.value })}
                      placeholder="Additional address"
                    />
                  </FormControl>
                  <SimpleGrid columns={2} spacing={4}>
                    <FormControl isRequired>
                      <FormLabel>City</FormLabel>
                      <Input
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="City"
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>State/Province</FormLabel>
                      <Input
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        placeholder="State"
                      />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>Postal Code</FormLabel>
                      <Input
                        value={formData.postalCode}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        placeholder="ZIP/Postal code"
                      />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>Country</FormLabel>
                      <Select
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      >
                        <option value="US">United States</option>
                        <option value="IN">India</option>
                        <option value="GB">United Kingdom</option>
                        <option value="CA">Canada</option>
                        <option value="AU">Australia</option>
                        <option value="DE">Germany</option>
                        <option value="FR">France</option>
                        <option value="JP">Japan</option>
                        <option value="SG">Singapore</option>
                        <option value="AE">UAE</option>
                      </Select>
                    </FormControl>
                  </SimpleGrid>
                </SimpleGrid>
              </VStack>
            </TabPanel>

            {/* Tab 3: Billing & Payment */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Heading size="sm" mb={2}>Billing Settings</Heading>
                <SimpleGrid columns={2} spacing={4}>
                  <FormControl>
                    <FormLabel>Billing Class</FormLabel>
                    <Select
                      placeholder='Select class'
                      value={formData.billingClass}
                      onChange={(e) => setFormData({ ...formData, billingClass: e.target.value })}
                    >
                      <option value="paiusa">Pai USA</option>
                      <option value="paihk">Pai HK</option>
                      
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Billing Type</FormLabel>
                    <Select
                      value={formData.billingType}
                      onChange={(e) => setFormData({ ...formData, billingType: e.target.value })}
                    >
                      <option value="prepaid">Prepaid</option>
                      <option value="postpaid">Postpaid</option>
                     
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Billing Timezone</FormLabel>
                    <Select
                      value={formData.billingTimezone}
                      onChange={(e) => setFormData({ ...formData, billingTimezone: e.target.value })}
                    >
                      <option value="UTC">UTC</option>
                      <option value="EST">EST</option>
                      <option value="PST">PST</option>
                      <option value="IST">IST</option>
                      <option value="GMT">GMT</option>
                    </Select>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Billing Start Date</FormLabel>
                    <Input
                      type="date"
                      value={formData.billingStartDate}
                      onChange={(e) => setFormData({ ...formData, billingStartDate: e.target.value })}
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Billing Cycle</FormLabel>
                    <Select
                      value={formData.billingCycle}
                      onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                    >
                      <option value="daily">Daily</option>
                      <option value="fortnightly">Fortnightly</option>
                      <option value="in_specific_days">In Specific days</option>
                      <option value="manual">Manual</option>
                      <option value="monthly">Monthly</option>
                      <option value="monthly_anniversary">Monthly anniversary</option>
                      <option value="quaterly">Quaterly</option>
                      <option value="weekly">Weekly</option>
                      <option value="annually">Yearly</option>
                      
                      

                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Credit Limit ($)</FormLabel>
                    <NumberInput
                      value={formData.creditLimit}
                      onChange={(value) => setFormData({ ...formData, creditLimit: parseFloat(value) })}
                      min={0}
                      step={100}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                </SimpleGrid>

                <Heading size="sm" mb={2} mt={4}>Payment Settings</Heading>
                <SimpleGrid columns={2} spacing={4}>
                  <FormControl>
                    <FormLabel>Auto Pay</FormLabel>
                    <Select
                      value={formData.autoPay}
                      onChange={(e) => setFormData({ ...formData, autoPay: e.target.value === 'true' })}
                    >
                      <option value="false">Disabled</option>
                      <option value="true">Enabled</option>
                    </Select>
                  </FormControl>
                  {formData.autoPay && (
                    <FormControl>
                      <FormLabel>Auto Pay Method</FormLabel>
                      <Select
                        value={formData.autoPayMethod}
                        onChange={(e) => setFormData({ ...formData, autoPayMethod: e.target.value })}
                      >
                        <option value="credit_card">Credit Card</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="paypal">PayPal</option>
                        <option value="debit_card">Debit Card</option>
                      </Select>
                    </FormControl>
                  )}
                  <FormControl>
                    <FormLabel>Send Invoice via Email</FormLabel>
                    <Select
                      value={formData.sendInvoiceEmail}
                      onChange={(e) => setFormData({ ...formData, sendInvoiceEmail: e.target.value === 'true' })}
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Late Fee</FormLabel>
                    <Select
                      value={formData.lateFeeEnabled}
                      onChange={(e) => setFormData({ ...formData, lateFeeEnabled: e.target.value === 'true' })}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </Select>
                  </FormControl>
                  {formData.lateFeeEnabled && (
                    <>
                      <FormControl>
                        <FormLabel>Late Fee (%)</FormLabel>
                        <NumberInput
                          value={formData.lateFeePercentage}
                          onChange={(value) => setFormData({ ...formData, lateFeePercentage: parseFloat(value) })}
                          min={0}
                          max={100}
                          step={0.5}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      </FormControl>
                      <FormControl>
                        <FormLabel>Grace Period (days)</FormLabel>
                        <NumberInput
                          value={formData.gracePeriodDays}
                          onChange={(value) => setFormData({ ...formData, gracePeriodDays: parseInt(value) })}
                          min={0}
                          max={60}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      </FormControl>
                    </>
                  )}
                </SimpleGrid>
              </VStack>
            </TabPanel>

            {/* Tab 4: Telecom Settings */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Heading size="sm" mb={2}>Customer Type</Heading>
                <SimpleGrid columns={2} spacing={4}>
                  <FormControl>
                    <FormLabel>Telecom Provider</FormLabel>
                    <Select
                      value={formData.telecomProvider}
                      onChange={(e) => setFormData({ ...formData, telecomProvider: e.target.value === 'true' })}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Wholesale Customer</FormLabel>
                    <Select
                      value={formData.wholesaleCustomer}
                      onChange={(e) => setFormData({ ...formData, wholesaleCustomer: e.target.value === 'true' })}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Retail Customer</FormLabel>
                    <Select
                      value={formData.retailCustomer}
                      onChange={(e) => setFormData({ ...formData, retailCustomer: e.target.value === 'true' })}
                    >
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </Select>
                  </FormControl>
                </SimpleGrid>

                <Heading size="sm" mb={2} mt={4}>Call Rating Settings</Heading>
                <SimpleGrid columns={2} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Default Rate per Second</FormLabel>
                    <NumberInput
                      value={formData.defaultRatePerSecond}
                      onChange={(value) => setFormData({ ...formData, defaultRatePerSecond: parseFloat(value) })}
                      min={0.0001}
                      step={0.0001}
                      precision={4}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                    <FormHelperText>Rate charged per second of call duration</FormHelperText>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Tax Rate (%)</FormLabel>
                    <NumberInput
                      value={formData.taxRate}
                      onChange={(value) => setFormData({ ...formData, taxRate: parseFloat(value) })}
                      min={0}
                      max={100}
                      step={0.01}
                      precision={2}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Minimum Charge</FormLabel>
                    <NumberInput
                      value={formData.minimumCharge}
                      onChange={(value) => setFormData({ ...formData, minimumCharge: parseFloat(value) })}
                      min={0}
                      step={0.0001}
                      precision={4}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                    <FormHelperText>Minimum charge per call</FormHelperText>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Rounding Decimal Places</FormLabel>
                    <NumberInput
                      value={formData.roundingDecimal}
                      onChange={(value) => setFormData({ ...formData, roundingDecimal: parseInt(value) })}
                      min={0}
                      max={8}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                    <FormHelperText>Decimal places for rounding charges</FormHelperText>
                  </FormControl>
                </SimpleGrid>

                <Heading size="sm" mb={2} mt={4}>Localization</Heading>
                <SimpleGrid columns={2} spacing={4}>
                  <FormControl>
                    <FormLabel>Timezone</FormLabel>
                    <Select
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    >
                      <option value="UTC">UTC</option>
                      <option value="EST">EST</option>
                      <option value="PST">PST</option>
                      <option value="IST">IST</option>
                      <option value="GMT">GMT</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Languages</FormLabel>
                    <Select
                      value={formData.languages}
                      onChange={(e) => setFormData({ ...formData, languages: e.target.value })}
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="hi">Hindi</option>
                      <option value="zh">Chinese</option>
                      <option value="ja">Japanese</option>
                    </Select>
                  </FormControl>
                </SimpleGrid>
              </VStack>
            </TabPanel>

            {/* Tab 5: Usage Statistics (only for editing) */}
            {selectedCustomer && (
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <Heading size="sm" mb={2}>Customer Usage Statistics</Heading>
                  <SimpleGrid columns={3} spacing={4}>
                    <Box p={4} bg="blue.50" borderRadius="md" textAlign="center">
                      <Text fontSize="sm" color="blue.600" fontWeight="medium">Total Calls</Text>
                      <Text fontSize="2xl" fontWeight="bold">{cdrStats.totalCalls}</Text>
                      <Text fontSize="xs" color="gray.600">All time</Text>
                    </Box>
                    <Box p={4} bg="green.50" borderRadius="md" textAlign="center">
                      <Text fontSize="sm" color="green.600" fontWeight="medium">Total Revenue</Text>
                      <Text fontSize="2xl" fontWeight="bold">${cdrStats.totalRevenue.toFixed(2)}</Text>
                      <Text fontSize="xs" color="gray.600">Generated</Text>
                    </Box>
                    <Box p={4} bg="purple.50" borderRadius="md" textAlign="center">
                      <Text fontSize="sm" color="purple.600" fontWeight="medium">Success Rate</Text>
                      <Text fontSize="2xl" fontWeight="bold">
                        {((cdrStats.answeredCalls / cdrStats.totalCalls) * 100).toFixed(1)}%
                      </Text>
                      <Text fontSize="xs" color="gray.600">Answered calls</Text>
                    </Box>
                    <Box p={4} bg="orange.50" borderRadius="md" textAlign="center">
                      <Text fontSize="sm" color="orange.600" fontWeight="medium">Total Duration</Text>
                      <Text fontSize="2xl" fontWeight="bold">
                        {Math.floor(cdrStats.totalDuration / 3600)}h {Math.floor((cdrStats.totalDuration % 3600) / 60)}m
                      </Text>
                      <Text fontSize="xs" color="gray.600">Call time</Text>
                    </Box>
                    <Box p={4} bg="red.50" borderRadius="md" textAlign="center">
                      <Text fontSize="sm" color="red.600" fontWeight="medium">Total Tax</Text>
                      <Text fontSize="2xl" fontWeight="bold">${cdrStats.totalTax.toFixed(2)}</Text>
                      <Text fontSize="xs" color="gray.600">Collected</Text>
                    </Box>
                    <Box p={4} bg="teal.50" borderRadius="md" textAlign="center">
                      <Text fontSize="sm" color="teal.600" fontWeight="medium">Avg Call Duration</Text>
                      <Text fontSize="2xl" fontWeight="bold">{Math.floor(cdrStats.totalDuration / cdrStats.totalCalls)}s</Text>
                      <Text fontSize="xs" color="gray.600">Per call</Text>
                    </Box>
                  </SimpleGrid>
                </VStack>
              </TabPanel>
            )}
          </TabPanels>
        </Tabs>
      </VStack>
    </ModalBody>

    {/* Sticky Footer */}
    <ModalFooter borderBottomRadius={"8px"} position="sticky" bottom={0} bg="white" borderTop="1px" borderColor="gray.200" py={4}>
      <HStack spacing={3} width="100%" justify="space-between">
        <Box>
          {selectedCustomer && (
            <Text fontSize="sm" color="gray.600">
              Last updated: {new Date(selectedCustomer.updatedAt).toLocaleDateString()}
            </Text>
          )}
        </Box>
        <HStack>
          <Button variant="outline" onClick={() => setIsModalOpen(false)}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSave}>
            {selectedCustomer ? 'Update Customer' : 'Create Customer'}
          </Button>
        </HStack>
      </HStack>
    </ModalFooter>
  </ModalContent>
</Modal>
        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={confirmDelete}
          title="Delete Customer"
          message={`Are you sure you want to delete customer ${selectedCustomer?.name}? This will also remove all associated CDRs and invoices.`}
          confirmText="Delete Customer"
          type="danger"
        />
      </VStack>
    </Container>
  );
};

// Helper component for simple grid
const Simplegrid = ({ children, columns = 2, spacing = 4 }) => (
  <Box display="grid" gridTemplateColumns={`repeat(${columns}, 1fr)`} gap={spacing}>
    {children}
  </Box>
);

export default Customers;