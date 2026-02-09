import React, { useState, useEffect } from "react";
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
  Textarea,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  InputLeftElement,
  InputRightElement,
  useColorModeValue,
  Icon,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  IconButton,
  Tab,
  FormHelperText,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  SimpleGrid,
  Spacer,
  InputGroup,
  Checkbox,
  Stack,
  Divider,
  Tooltip,
  Flex,
  Grid,
  GridItem,
  Radio,
  RadioGroup,
} from "@chakra-ui/react";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiUser,
  FiDollarSign,
  FiPercent,
  FiSearch,
  FiX,
  FiBriefcase,
  FiGlobe,
  FiClock,
  FiDatabase,
  FiServer,
  FiTrendingUp,
} from "react-icons/fi";
import DataTable from "../components/DataTable";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchCDRs,
} from "../utils/api";
import { bg } from "date-fns/locale";

const Accounts = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [formData, setFormData] = useState({
    // Account Role & Type
    accountRole: "customer",
    accountType: "prepaid",
    accountStatus: "active",
    accountId: "",
    authenticationType: 'ip',
    authenticationValue: '',

    // CDR Mapping Fields
    customerCode: "",
    vendorCode: "",
    gatewayId: "",
    productId: "",

    // Basic Information

    accountName: "",
    accountOwner: "",
    ownership: "None",

    // Contact Information
    phone: "",
    vendorFax: "",
    email: "",
    billingEmail: "",

    // Account Details
    active: true,
    vatNumber: "",
    verificationStatus: "pending",
    resellerAccount: false,
    reseller: "",

    // Financial
    currency: "USD",
    nominalCode: "",
    creditLimit: 10000.0,
    balance: 0.0,
    outstandingAmount: 0.0,

    // Localization
    timezone: "UTC",
    languages: "en",

    // Description
    description: "",

    // Address
    addressLine1: "",
    addressLine2: "",
    addressLine3: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    countryCode: "US",

    // Billing
    billingClass: "standard",
    billingType: "prepaid",
    billingTimezone: "UTC",
    billingStartDate: new Date().toISOString().split("T")[0],
    billingCycle: "monthly",

    // Payment Settings
    autoPay: false,
    autoPayMethod: "credit_card",
    sendInvoiceEmail: true,
    lateFeeEnabled: true,
    lateFeePercentage: 5.0,
    gracePeriodDays: 15,

    // Telecom Specific
    telecomProvider: false,
    wholesaleCustomer: false,
    retailCustomer: false,
    carrierType: "tier2",

    // Call Rating
    defaultRatePerSecond: 0.01,
    taxRate: 18.0,
    minimumCharge: 0.01,
    roundingDecimal: 4,

    // Vendor Specific (for vendors)
    defaultCostPerSecond: 0.008,
    marginPercentage: 25.0,

    // CDR Processing
    cdrProcessingDelay: 0,
    billingDelay: 0,
  });
  const [cdrStats, setCdrStats] = useState({
    totalCalls: 0,
    totalDuration: 0,
    totalRevenue: 0,
    totalTax: 0,
    answeredCalls: 0,
  });
  const [loading, setLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const toast = useToast();
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  // Options
  const accountRoleOptions = [
    { value: "customer", label: "Customer", color: "blue" },
    { value: "vendor", label: "Vendor", color: "purple" },
    { value: "both", label: "Customer & Vendor", color: "green" },
  ];

  const accountTypeOptions = [
    { value: "prepaid", label: "Prepaid" },
    { value: "postpaid", label: "Postpaid" },
    { value: "hybrid", label: "Hybrid" },
  ];

  const statusOptions = [
    { value: "active", label: "Active", color: "green" },
    { value: "inactive", label: "Inactive", color: "gray" },
    { value: "suspended", label: "Suspended", color: "red" },
    { value: "pending", label: "Pending", color: "yellow" },
  ];

  const carrierTypeOptions = [
    { value: "tier1", label: "Tier 1 Carrier" },
    { value: "tier2", label: "Tier 2 Carrier" },
    { value: "tier3", label: "Tier 3 Carrier" },
    { value: "mobile", label: "Mobile Operator" },
    { value: "voip", label: "VoIP Provider" },
    { value: "other", label: "Other" },
  ];

  const billingCycles = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "annually", label: "Annually" },
  ];

  const paymentMethods = [
    { value: "credit_card", label: "Credit Card" },
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "paypal", label: "PayPal" },
    { value: "invoice", label: "Invoice" },
  ];

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchTerm, roleFilter, statusFilter]);

  useEffect(() => {
    if (selectedCustomer) {
      calculateCustomerStats(selectedCustomer.id);
    }
  }, [selectedCustomer]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const customersData = await fetchCustomers();
      setCustomers(customersData);
      setFilteredCustomers(customersData);
    } catch (error) {
      toast({
        title: "Error loading accounts",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setCustomers([]);
      setFilteredCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const filterCustomers = () => {
    if (!customers.length) return;

    let filtered = [...customers];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (customer) =>
          customer.accountName?.toLowerCase().includes(term) ||
          customer.email?.toLowerCase().includes(term) ||
          customer.phone?.toLowerCase().includes(term) ||
          customer.accountNumber?.toLowerCase().includes(term) ||
          customer.customerCode?.toLowerCase().includes(term) ||
          customer.vendorCode?.toLowerCase().includes(term),
      );
    }

    // Filter by role
    if (roleFilter !== "all") {
      filtered = filtered.filter(
        (customer) => customer.accountRole === roleFilter,
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      if (statusFilter === "active") {
        filtered = filtered.filter((customer) => customer.active === true);
      } else if (statusFilter === "inactive") {
        filtered = filtered.filter((customer) => customer.active === false);
      } else {
        filtered = filtered.filter(
          (customer) => customer.accountStatus === statusFilter,
        );
      }
    }

    setFilteredCustomers(filtered);
  };

  const calculateCustomerStats = async (customerId) => {
    try {
      const cdrs = await fetchCDRs();
      // Map by customerCode or vendorCode
      const customerCdrs = cdrs.filter(
        (cdr) =>
          cdr.customeraccount === selectedCustomer?.customerCode ||
          cdr.agentaccount === selectedCustomer?.vendorCode,
      );

      const stats = customerCdrs.reduce(
        (acc, cdr) => ({
          totalCalls: acc.totalCalls + 1,
          totalDuration: acc.totalDuration + (parseInt(cdr.feetime) || 0),
          totalRevenue: acc.totalRevenue + (parseFloat(cdr.fee) || 0),
          totalTax: acc.totalTax + (parseFloat(cdr.tax) || 0),
          answeredCalls:
            acc.answeredCalls + (parseInt(cdr.endreason) === 0 ? 1 : 0),
        }),
        {
          totalCalls: 0,
          totalDuration: 0,
          totalRevenue: 0,
          totalTax: 0,
          answeredCalls: 0,
        },
      );

      setCdrStats(stats);
    } catch (error) {
      console.error("Error calculating customer stats:", error);
    }
  };

  const handleAddNew = () => {
    setFormData({
      // Account Role & Type
      accountRole: "customer",
      accountType: "prepaid",
      accountStatus: "active",
      accountId: "",
      authenticationType: 'ip',
      authenticationValue: '',



      // CDR Mapping Fields
      customerCode: `C_${Math.floor(10000 + Math.random() * 90000)}`,
      vendorCode: "",
      gatewayId: "",
      productId: "",

      // Basic Information

      accountName: "",
      accountOwner: "",
      ownership: "None",

      // Contact Information
      phone: "",
      vendorFax: "",
      email: "",
      billingEmail: "",

      // Account Details
      active: true,
      vatNumber: "",
      verificationStatus: "pending",
      resellerAccount: false,
      reseller: "",

      // Financial
      currency: "USD",
      nominalCode: "",
      creditLimit: 10000.0,
      balance: 0.0,
      outstandingAmount: 0.0,

      // Localization
      timezone: "UTC",
      languages: "en",

      // Description
      description: "",

      // Address
      addressLine1: "",
      addressLine2: "",
      addressLine3: "",
      city: "",
      state: "",
      postalCode: "",
      country: "US",
      countryCode: "US",

      // Billing
      billingClass: "standard",
      billingType: "prepaid",
      billingTimezone: "UTC",
      billingStartDate: new Date().toISOString().split("T")[0],
      billingCycle: "monthly",

      // Payment Settings
      autoPay: false,
      autoPayMethod: "credit_card",
      sendInvoiceEmail: true,
      lateFeeEnabled: true,
      lateFeePercentage: 5.0,
      gracePeriodDays: 15,

      // Telecom Specific
      telecomProvider: false,
      wholesaleCustomer: false,
      retailCustomer: false,
      carrierType: "tier2",

      // Call Rating
      defaultRatePerSecond: 0.01,
      taxRate: 18.0,
      minimumCharge: 0.01,
      roundingDecimal: 4,

      // Vendor Specific (for vendors)
      defaultCostPerSecond: 0.008,
      marginPercentage: 25.0,

      // CDR Processing
      cdrProcessingDelay: 0,
      billingDelay: 0,
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
    setFormData(customer);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      toast({
        title: "Validation Error",
        description: validationErrors.join(", "),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);
    try {
      if (selectedCustomer) {
        await updateCustomer(selectedCustomer.id, formData);
      } else {
        await createCustomer(formData);
      }

      await loadCustomers();
      setIsModalOpen(false);
      setSelectedCustomer(null);

      toast({
        title: selectedCustomer ? "Account updated" : "Account created",
        description: `Account ${formData.accountName} has been ${selectedCustomer ? "updated" : "created"} successfully`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error saving account",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    setLoading(true);
    try {
      await deleteCustomer(selectedCustomer.id);
      await loadCustomers();
      setIsDeleteOpen(false);
      setSelectedCustomer(null);

      toast({
        title: "Account deleted",
        description: `Account ${selectedCustomer.accountName} has been deleted`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error deleting account",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = [];

    if (!formData.accountName?.trim()) errors.push("Account name is required");
    if (!formData.email?.trim()) errors.push("Email is required");

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      errors.push("Invalid email format");
    }

    if (!formData.phone?.trim()) errors.push("Phone is required");
    if (!formData.addressLine1?.trim())
      errors.push("Address Line 1 is required");
    if (!formData.city?.trim()) errors.push("City is required");
    if (!formData.postalCode?.trim()) errors.push("Postal Code is required");

    if (formData.defaultRatePerSecond <= 0)
      errors.push("Rate must be greater than 0");
    if (formData.taxRate < 0 || formData.taxRate > 100)
      errors.push("Tax rate must be between 0 and 100");

    // Validate customer/vendor codes based on role
    if (
      (formData.accountRole === "customer" ||
        formData.accountRole === "both") &&
      !formData.customerCode
    ) {
      errors.push("Customer code is required for customer accounts");
    }

    if (
      (formData.accountRole === "vendor" || formData.accountRole === "both") &&
      !formData.vendorCode
    ) {
      errors.push("Vendor code is required for vendor accounts");
    }

    return errors;
  };

  const handleAccountRoleChange = (role) => {
    setFormData({
      ...formData,
      accountRole: role,
      // Auto-generate codes if not set
      customerCode:
        (role === "customer" || role === "both") && !formData.customerCode
          ? `C_${Math.floor(10000 + Math.random() * 90000)}`
          : role === "vendor"
            ? ""
            : formData.customerCode,
      vendorCode:
        (role === "vendor" || role === "both") && !formData.vendorCode
          ? `P_${Math.floor(10000 + Math.random() * 90000)}`
          : role === "customer"
            ? ""
            : formData.vendorCode,
    });
  };

  const authTypeOptions = [
    { value: 'ip', label: 'IP Address', description: 'Match by source IP' },
    { value: 'custom', label: 'Custom Field', description: 'Match by custom field' },
  ];


  const columns = [
    {
      key: "accountId",
      header: "Account ID",
      render: (value) => (
        <Badge colorScheme="blue" variant="subtle" fontSize="xs">
          {value}
        </Badge>
      ),
    },
    {
      key: "accountRole",
      header: "Role",
      render: (value) => {
        const role = accountRoleOptions.find((r) => r.value === value);
        return (
          <Badge colorScheme={role?.color || "gray"}>
            {role?.label || value}
          </Badge>
        );
      },
    },
    {
      key: "accountName",
      header: "Account Name",
      render: (value, row) => (
        <Box>
          <Text fontWeight="medium">{value}</Text>
          <HStack spacing={1} mt={1}>
            {row.customerCode && (
              <Badge fontSize="xs" colorScheme="blue" variant="outline">
                C: {row.customerCode}
              </Badge>
            )}
            {row.vendorCode && (
              <Badge fontSize="xs" colorScheme="purple" variant="outline">
                V: {row.vendorCode}
              </Badge>
            )}
          </HStack>
        </Box>
      ),
    },
    {
      key: "phone",
      header: "Phone",
    },
    {
      key: "email",
      header: "Email",
      render: (value) => (
        <Text fontSize="sm" isTruncated fontWeight={"medium"} maxW="200px">
          {value}
        </Text>
      ),
    },
    {
      key: "defaultRatePerSecond",
      header: "Rate/sec",
      isNumeric: true,
      render: (value) => (
        <Text textAlign="right" fontFamily="mono">
          ${parseFloat(value).toFixed(6)}
        </Text>
      ),
    },
    {
      key: "active",
      header: "Status",
      render: (value, row) => {
        const status = statusOptions.find((s) => s.value === row.accountStatus);
        return (
          <Badge colorScheme={status?.color || (value ? "green" : "red")} variant="subtle">
            {status?.label || (value ? "Active" : "Inactive")}
          </Badge>
        );
      },
    },
    {
      key: "balance",
      header: "Balance",
      isNumeric: true,
      render: (value) => (
        <Text
          fontWeight="bold"
          textAlign="right"
          color={parseFloat(value) < 0 ? "red.600" : "green.600"}
        >
          ${parseFloat(value).toFixed(2)}
        </Text>
      ),
    },
  ];

  return (
    <Container maxW="container.xl" py={4}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" spacing={4}>
          <Box>
            <Heading size="lg" mb={2}>
              Accounts Management
            </Heading>
            <Text color="gray.600">
              Manage customers, vendors, resellers and agents
            </Text>
          </Box>

          {/* Search and Filters */}
          <HStack spacing={4} flexWrap="wrap">
            {/* Role Filter */}
            <Select
              borderRadius={"sm"}
              bg={"white"}
              size="sm"
              width="150px"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              {accountRoleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </Select>

            {/* Status Filter */}
            <Select
              bg={"white"}
              borderRadius={"sm"}
              size="sm"
              width="150px"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </Select>

            {/* Search Bar */}
            <InputGroup
              size="sm"
              bg="white"
              w={{ base: "100%", md: "300px" }}
              position="relative"
              border="2px solid"
              borderColor="gray.200"
              borderRadius="sm"
              _hover={{
                borderColor: "blue.300",
                boxShadow: "0 0 0 3px rgba(66, 153, 225, 0.1)",
              }}
              _focusWithin={{
                borderColor: "blue.500",
                boxShadow: "0 0 0 3px rgba(66, 153, 225, 0.2)",
                transform: "translateY(-1px)",
              }}
              transition="all 0.2s ease"
              overflow="hidden"
            >
              <InputLeftElement pointerEvents="none">
                <Icon as={FiSearch} color="blue.500" />
              </InputLeftElement>

              <Input
                w="100%"
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                bg="white"
                border="none"
                pl={10}
                pr={searchTerm ? 10 : 4}
                fontSize="sm"
                _placeholder={{
                  color: "gray.500",
                  fontSize: "sm",
                }}
                _focus={{
                  outline: "none",
                  boxShadow: "none",
                }}
              />

              {searchTerm && (
                <InputRightElement>
                  <IconButton
                    aria-label="Clear search"
                    icon={<FiX />}
                    size="xs"
                    variant="ghost"
                    color="gray.500"
                    _hover={{ color: "red.500", bg: "red.50" }}
                    onClick={() => setSearchTerm("")}
                  />
                </InputRightElement>
              )}
            </InputGroup>

            <Button
              borderRadius="4px"
              leftIcon={<FiPlus />}
              colorScheme="blue"
              onClick={handleAddNew}
              size="sm"
            >
              Add Account
            </Button>
          </HStack>
        </HStack>

        {/* Account Stats Summary */}
        <Grid
          templateColumns={{
            base: "1fr",
            md: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          }}
          gap={4}
        >
          <Box p={4} bg="white" borderRadius="md" display={"flex"} flexDirection={"row"} alignItems="center"
            justifyContent="space-between">
            <Text fontSize="sm"  fontWeight="bold">
              Total Accounts
            </Text>
            <Text fontSize="2xl" color="blue.600" fontWeight="bold">
              {customers.length}
            </Text>
          </Box>
          <Box p={4} bg="white" borderRadius="md" display={"flex"} flexDirection={"row"} alignItems="center"
            justifyContent="space-between">
            <Text fontSize="sm"  fontWeight="bold">
              Active Accounts
            </Text>
            <Text fontSize="2xl" color="green.600" fontWeight="bold">
              {customers.filter((c) => c.active === true).length}
            </Text>
          </Box>
          <Box p={4} bg="white" borderRadius="md" display={"flex"} flexDirection={"row"} alignItems="center"
            justifyContent="space-between">
            <Text fontSize="sm"  fontWeight="bold">
              Customers
            </Text>
            <Text fontSize="2xl" color="purple.600" fontWeight="bold">
              {
                customers.filter((c) =>
                  ["customer", "both"].includes(c.accountRole),
                ).length
              }
            </Text>
          </Box>
          <Box p={4} bg="white" borderRadius="md" display={"flex"} flexDirection={"row"} alignItems="center"
            justifyContent="space-between">
            <Text fontSize="sm"  fontWeight="bold">
              Vendors
            </Text>
            <Text fontSize="2xl" color="orange.600" fontWeight="bold">
              {
                customers.filter((c) =>
                  ["vendor", "both"].includes(c.accountRole),
                ).length
              }
            </Text>
          </Box>
        </Grid>

        {/* Data Table */}
        {loading ? (
          <Box textAlign="center" py={10}>
            <Text>Loading accounts...</Text>
          </Box>
        ) : (
          <DataTable
            columns={columns}
            data={filteredCustomers}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleView}
            striped={true}
            height="calc(100vh - 337px)"
          />
        )}

        {/* Account Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => !loading && setIsModalOpen(false)}
          size={{ base: "sm", md: "2xl", lg: "3xl" }}
          closeOnOverlayClick={!loading}
        >
          <ModalOverlay />
          <ModalContent borderRadius={"8px"} maxH="90vh">
            <ModalHeader
              borderTopRadius={"8px"}
              bgColor="blue.500"
              color="white"
              position="sticky"
              top={0}
              zIndex={1}
              borderBottom="1px"
              borderColor="gray.200"
            >
              <VStack align="start" spacing={1}>
                <Heading size="md" fontWeight={"semibold"} color={"white"}>
                  {selectedCustomer ? "Edit Account" : "Add New Account"}
                </Heading>
                {selectedCustomer && (
                  <Text fontSize="sm" color="white">
                    Account ID: {selectedCustomer.accountId}
                  </Text>
                )}
              </VStack>
              <ModalCloseButton
                color={"white"}
                top={4}
                right={4}
                isDisabled={loading}
              />
            </ModalHeader>

            <ModalBody overflowY="auto" maxH="calc(90vh - 200px)">
              <VStack spacing={6} align="stretch" pb={4}>
                <Tabs variant="line" colorScheme="blue" isFitted>
                  <TabList
                    position={"sticky"}
                    zIndex={1}
                    top={0}
                    bg={useColorModeValue("white", "gray.800")}
                    borderBottom="1px"
                    borderColor="gray.200"
                  >
                    <Tab>Account Type</Tab>
                    <Tab>Basic Info</Tab>
                    <Tab>Contact & Address</Tab>
                    <Tab>Billing & Payment</Tab>
                    <Tab>Telecom Settings</Tab>
                    {selectedCustomer && <Tab>Usage Statistics</Tab>}
                  </TabList>

                  <TabPanels>
                    {/* Tab 1: Account Type */}
                    <TabPanel>
                      <VStack spacing={6} align="stretch">
                        <Box>
                          <Heading size="sm" mb={4}>
                            Account Role & Type
                          </Heading>
                          <SimpleGrid columns={2} spacing={4}>
                            <FormControl isRequired>
                              <FormLabel>Account Role</FormLabel>
                              <Select
                                value={formData.accountRole}
                                onChange={(e) =>
                                  handleAccountRoleChange(e.target.value)
                                }
                                isDisabled={!!selectedCustomer}
                              >
                                {accountRoleOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </Select>
                              <FormHelperText>
                                Determines billing and CDR mapping
                              </FormHelperText>
                            </FormControl>

                            <FormControl isRequired>
                              <FormLabel>Account Status</FormLabel>
                              <Select
                                value={formData.accountStatus}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    accountStatus: e.target.value,
                                    active: e.target.value === "active",
                                  })
                                }
                              >
                                {statusOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </Select>
                            </FormControl>

                            <FormControl>
                              <FormLabel>Carrier Type</FormLabel>
                              <Select
                                value={formData.carrierType}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    carrierType: e.target.value,
                                  })
                                }
                              >
                                {carrierTypeOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </Select>
                            </FormControl>
                          </SimpleGrid>
                        </Box>

                        <Divider />

                        <Box>
                          <Heading size="sm" mb={4}>
                            CDR Mapping Configuration
                          </Heading>
                          <SimpleGrid columns={2} spacing={4}>
                            {(formData.accountRole === "customer" ||
                              formData.accountRole === "both") && (
                                <FormControl isRequired>
                                  <FormLabel>Customer Code</FormLabel>
                                  <Input
                                    value={formData.customerCode}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        customerCode: e.target.value,
                                      })
                                    }
                                    placeholder="C_XXXXX"
                                  />
                                  <FormHelperText>
                                    Maps to customeraccount in CDRs
                                  </FormHelperText>
                                </FormControl>
                              )}

                            {(formData.accountRole === "vendor" ||
                              formData.accountRole === "both") && (
                                <FormControl isRequired>
                                  <FormLabel>Vendor Code</FormLabel>
                                  <Input
                                    value={formData.vendorCode}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        vendorCode: e.target.value,
                                      })
                                    }
                                    placeholder="P_XXXXX"
                                  />
                                  <FormHelperText>
                                    Maps to agentaccount in CDRs
                                  </FormHelperText>
                                </FormControl>
                              )}


                            <FormControl>
                              <FormLabel>Authentication Type</FormLabel>
                              <Select
                                value={formData.authenticationType}
                                onChange={(e) => setFormData({ ...formData, authenticationType: e.target.value })}
                              >
                                {authTypeOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </Select>
                              <FormHelperText>{authTypeOptions.find(o => o.value === formData.authenticationType)?.description}</FormHelperText>
                            </FormControl>

                            <FormControl>
                              <FormLabel>Authentication Value</FormLabel>
                              <Input
                                value={formData.authenticationValue}
                                onChange={(e) => setFormData({ ...formData, authenticationValue: e.target.value })}
                                placeholder={
                                  formData.authenticationType === 'ip' ? '192.168.1.100' :
                                    formData.authenticationType === 'gateway' ? 'GW-12345' :
                                      formData.authenticationType === 'prefix' ? '91' :
                                        'Enter value'
                                }
                              />
                            </FormControl>


                            <FormControl>
                              <FormLabel>Product ID</FormLabel>
                              <Input
                                value={formData.productId}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    productId: e.target.value,
                                  })
                                }
                                placeholder="Product identifier"
                              />
                            </FormControl>
                          </SimpleGrid>
                        </Box>

                        {(formData.accountRole === "vendor" ||
                          formData.accountRole === "both") && (
                            <>
                              <Divider />
                              <Box>
                                <Heading size="sm" mb={4}>
                                  Vendor Cost Settings
                                </Heading>
                                <SimpleGrid columns={2} spacing={4}>
                                  <FormControl>
                                    <FormLabel>Default Cost per Second</FormLabel>
                                    <NumberInput
                                      value={formData.defaultCostPerSecond}
                                      onChange={(value) =>
                                        setFormData({
                                          ...formData,
                                          defaultCostPerSecond: parseFloat(value),
                                        })
                                      }
                                      min={0.000001}
                                      step={0.000001}
                                      precision={6}
                                    >
                                      <NumberInputField />
                                      <NumberInputStepper>
                                        <NumberIncrementStepper />
                                        <NumberDecrementStepper />
                                      </NumberInputStepper>
                                    </NumberInput>
                                    <FormHelperText>
                                      Vendor cost per second for calls
                                    </FormHelperText>
                                  </FormControl>

                                  <FormControl>
                                    <FormLabel>Target Margin %</FormLabel>
                                    <NumberInput
                                      value={formData.marginPercentage}
                                      onChange={(value) =>
                                        setFormData({
                                          ...formData,
                                          marginPercentage: parseFloat(value),
                                        })
                                      }
                                      min={0}
                                      max={100}
                                      step={0.1}
                                      precision={2}
                                    >
                                      <NumberInputField />
                                      <NumberInputStepper>
                                        <NumberIncrementStepper />
                                        <NumberDecrementStepper />
                                      </NumberInputStepper>
                                    </NumberInput>
                                  </FormControl>
                                </SimpleGrid>
                              </Box>
                            </>
                          )}

                        <Divider />

                        <Box>
                          <Heading size="sm" mb={4}>
                            CDR Processing Settings
                          </Heading>
                          <SimpleGrid columns={2} spacing={4}>
                            <FormControl>
                              <FormLabel>
                                CDR Processing Delay (hours)
                              </FormLabel>
                              <NumberInput
                                value={formData.cdrProcessingDelay}
                                onChange={(value) =>
                                  setFormData({
                                    ...formData,
                                    cdrProcessingDelay: parseInt(value),
                                  })
                                }
                                min={0}
                                max={72}
                              >
                                <NumberInputField />
                                <NumberInputStepper>
                                  <NumberIncrementStepper />
                                  <NumberDecrementStepper />
                                </NumberInputStepper>
                              </NumberInput>
                              <FormHelperText>
                                Hours to delay CDR processing
                              </FormHelperText>
                            </FormControl>

                            <FormControl>
                              <FormLabel>Billing Delay (days)</FormLabel>
                              <NumberInput
                                value={formData.billingDelay}
                                onChange={(value) =>
                                  setFormData({
                                    ...formData,
                                    billingDelay: parseInt(value),
                                  })
                                }
                                min={0}
                                max={30}
                              >
                                <NumberInputField />
                                <NumberInputStepper>
                                  <NumberIncrementStepper />
                                  <NumberDecrementStepper />
                                </NumberInputStepper>
                              </NumberInput>
                              <FormHelperText>
                                Days to delay billing after CDR generation
                              </FormHelperText>
                            </FormControl>
                          </SimpleGrid>
                        </Box>
                      </VStack>
                    </TabPanel>

                    {/* Tab 2: Basic Information */}
                    <TabPanel>
                      <VStack spacing={4} align="stretch">
                        <Heading size="sm" mb={2}>
                          Account Information
                        </Heading>
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl isRequired>
                            <FormLabel>Account Name</FormLabel>
                            <Input
                              value={formData.accountName}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  accountName: e.target.value,
                                })
                              }
                              placeholder="Company Name"
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Account Owner</FormLabel>
                            <Input
                              value={formData.accountOwner}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  accountOwner: e.target.value,
                                })
                              }
                              placeholder="Sales Rep Name"
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Ownership</FormLabel>
                            <Select
                              value={formData.ownership}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  ownership: e.target.value,
                                })
                              }
                            >
                              <option value="None">None</option>
                              <option value="private">Private</option>
                              <option value="public">Public</option>
                              <option value="subsidiary">Subsidiary</option>
                              <option value="others">Others</option>
                            </Select>
                          </FormControl>
                        </SimpleGrid>

                        <Heading size="sm" mb={2} mt={4}>
                          Financial Information
                        </Heading>
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl>
                            <FormLabel>Currency</FormLabel>
                            <Select
                              value={formData.currency}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  currency: e.target.value,
                                })
                              }
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
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  vatNumber: e.target.value,
                                })
                              }
                              placeholder="VAT/Tax ID"
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Nominal Code</FormLabel>
                            <Input
                              value={formData.nominalCode}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  nominalCode: e.target.value,
                                })
                              }
                              placeholder="Accounting code"
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Verification Status</FormLabel>
                            <Select
                              value={formData.verificationStatus}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  verificationStatus: e.target.value,
                                })
                              }
                            >
                              <option value="pending">Pending</option>
                              <option value="verified">Verified</option>
                              <option value="unverified">Not Verified</option>
                            </Select>
                          </FormControl>
                          <FormControl>
                            <FormLabel>Description</FormLabel>
                            <Input
                              value={formData.description}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  description: e.target.value,
                                })
                              }
                              placeholder="Account description"
                            />
                          </FormControl>
                        </SimpleGrid>
                      </VStack>
                    </TabPanel>

                    {/* Tab 3: Contact & Address */}
                    <TabPanel>
                      <VStack spacing={4} align="stretch">
                        <Heading size="sm" mb={2}>
                          Contact Information
                        </Heading>
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl isRequired>
                            <FormLabel>Email</FormLabel>
                            <Input
                              type="email"
                              value={formData.email}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  email: e.target.value,
                                })
                              }
                              placeholder="account@example.com"
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Billing Email</FormLabel>
                            <Input
                              type="email"
                              value={formData.billingEmail}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  billingEmail: e.target.value,
                                })
                              }
                              placeholder="billing@example.com"
                            />
                          </FormControl>
                          <FormControl isRequired>
                            <FormLabel>Phone</FormLabel>
                            <Input
                              value={formData.phone}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  phone: e.target.value,
                                })
                              }
                              placeholder="+1234567890"
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Vendor Fax</FormLabel>
                            <Input
                              value={formData.vendorFax}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  vendorFax: e.target.value,
                                })
                              }
                              placeholder="+1234567891"
                            />
                          </FormControl>
                        </SimpleGrid>

                        <Heading size="sm" mb={2} mt={4}>
                          Reseller Information
                        </Heading>
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl>
                            <FormLabel>Reseller Account</FormLabel>
                            <Select
                              value={formData.resellerAccount}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  resellerAccount: e.target.value === "true",
                                })
                              }
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
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    reseller: e.target.value,
                                  })
                                }
                                placeholder="Reseller company name"
                              />
                            </FormControl>
                          )}
                        </SimpleGrid>

                        <Heading size="sm" mb={2} mt={4}>
                          Address Information
                        </Heading>
                        <SimpleGrid columns={1} spacing={3}>
                          <FormControl isRequired>
                            <FormLabel>Address Line 1</FormLabel>
                            <Input
                              value={formData.addressLine1}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  addressLine1: e.target.value,
                                })
                              }
                              placeholder="Street address"
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Address Line 2</FormLabel>
                            <Input
                              value={formData.addressLine2}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  addressLine2: e.target.value,
                                })
                              }
                              placeholder="Apartment, suite, etc."
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Address Line 3</FormLabel>
                            <Input
                              value={formData.addressLine3}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  addressLine3: e.target.value,
                                })
                              }
                              placeholder="Additional address"
                            />
                          </FormControl>
                          <SimpleGrid columns={2} spacing={4}>
                            <FormControl isRequired>
                              <FormLabel>City</FormLabel>
                              <Input
                                value={formData.city}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    city: e.target.value,
                                  })
                                }
                                placeholder="City"
                              />
                            </FormControl>
                            <FormControl>
                              <FormLabel>State/Province</FormLabel>
                              <Input
                                value={formData.state}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    state: e.target.value,
                                  })
                                }
                                placeholder="State"
                              />
                            </FormControl>
                            <FormControl isRequired>
                              <FormLabel>Postal Code</FormLabel>
                              <Input
                                value={formData.postalCode}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    postalCode: e.target.value,
                                  })
                                }
                                placeholder="ZIP/Postal code"
                              />
                            </FormControl>
                            <FormControl isRequired>
                              <FormLabel>Country</FormLabel>
                              <Select
                                value={formData.country}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    country: e.target.value,
                                    countryCode: e.target.value,
                                  })
                                }
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

                    {/* Tab 4: Billing & Payment */}
                    <TabPanel>
                      <VStack spacing={4} align="stretch">
                        <Heading size="sm" mb={2}>
                          Billing Settings
                        </Heading>
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl>
                            <FormLabel>Billing Class</FormLabel>
                            <Select
                              placeholder="Select class"
                              value={formData.billingClass}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  billingClass: e.target.value,
                                })
                              }
                            >
                              <option value="standard">Standard</option>
                              <option value="premium">Premium</option>
                              <option value="enterprise">Enterprise</option>
                            </Select>
                          </FormControl>
                          <FormControl>
                            <FormLabel>Billing Type</FormLabel>
                            <Select
                              value={formData.billingType}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  billingType: e.target.value,
                                })
                              }
                            >
                              <option value="prepaid">Prepaid</option>
                              <option value="postpaid">Postpaid</option>
                            </Select>
                          </FormControl>
                          <FormControl>
                            <FormLabel>Billing Timezone</FormLabel>
                            <Select
                              value={formData.billingTimezone}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  billingTimezone: e.target.value,
                                })
                              }
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
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  billingStartDate: e.target.value,
                                })
                              }
                            />
                          </FormControl>
                          <FormControl isRequired>
                            <FormLabel>Billing Cycle</FormLabel>
                            <Select
                              value={formData.billingCycle}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  billingCycle: e.target.value,
                                })
                              }
                            >
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly</option>
                              <option value="annually">Annually</option>
                            </Select>
                          </FormControl>
                          <FormControl>
                            <FormLabel>Credit Limit ($)</FormLabel>
                            <NumberInput
                              value={formData.creditLimit}
                              onChange={(value) =>
                                setFormData({
                                  ...formData,
                                  creditLimit: parseFloat(value),
                                })
                              }
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

                        <Heading size="sm" mb={2} mt={4}>
                          Payment Settings
                        </Heading>
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl>
                            <FormLabel>Auto Pay</FormLabel>
                            <Select
                              value={formData.autoPay}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  autoPay: e.target.value === "true",
                                })
                              }
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
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    autoPayMethod: e.target.value,
                                  })
                                }
                              >
                                <option value="credit_card">Credit Card</option>
                                <option value="bank_transfer">
                                  Bank Transfer
                                </option>
                                <option value="paypal">PayPal</option>
                                <option value="debit_card">Debit Card</option>
                              </Select>
                            </FormControl>
                          )}
                          <FormControl>
                            <FormLabel>Send Invoice via Email</FormLabel>
                            <Select
                              value={formData.sendInvoiceEmail}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  sendInvoiceEmail: e.target.value === "true",
                                })
                              }
                            >
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </Select>
                          </FormControl>
                          <FormControl>
                            <FormLabel>Late Fee</FormLabel>
                            <Select
                              value={formData.lateFeeEnabled}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  lateFeeEnabled: e.target.value === "true",
                                })
                              }
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
                                  onChange={(value) =>
                                    setFormData({
                                      ...formData,
                                      lateFeePercentage: parseFloat(value),
                                    })
                                  }
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
                                  onChange={(value) =>
                                    setFormData({
                                      ...formData,
                                      gracePeriodDays: parseInt(value),
                                    })
                                  }
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

                    {/* Tab 5: Telecom Settings */}
                    <TabPanel>
                      <VStack spacing={4} align="stretch">
                        <Heading size="sm" mb={2}>
                          Account Type
                        </Heading>
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl>
                            <FormLabel>Telecom Provider</FormLabel>
                            <Select
                              value={formData.telecomProvider}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  telecomProvider: e.target.value === "true",
                                })
                              }
                            >
                              <option value="false">No</option>
                              <option value="true">Yes</option>
                            </Select>
                          </FormControl>
                          <FormControl>
                            <FormLabel>Wholesale Customer</FormLabel>
                            <Select
                              value={formData.wholesaleCustomer}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  wholesaleCustomer: e.target.value === "true",
                                })
                              }
                            >
                              <option value="false">No</option>
                              <option value="true">Yes</option>
                            </Select>
                          </FormControl>
                          <FormControl>
                            <FormLabel>Retail Customer</FormLabel>
                            <Select
                              value={formData.retailCustomer}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  retailCustomer: e.target.value === "true",
                                })
                              }
                            >
                              <option value="false">No</option>
                              <option value="true">Yes</option>
                            </Select>
                          </FormControl>
                        </SimpleGrid>

                        <Heading size="sm" mb={2} mt={4}>
                          Call Rating Settings
                        </Heading>
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl isRequired>
                            <FormLabel>Default Rate per Second</FormLabel>
                            <NumberInput
                              value={formData.defaultRatePerSecond}
                              onChange={(value) =>
                                setFormData({
                                  ...formData,
                                  defaultRatePerSecond: parseFloat(value),
                                })
                              }
                              min={0.0001}
                              step={0.0001}
                              precision={6}
                            >
                              <NumberInputField />
                              <NumberInputStepper>
                                <NumberIncrementStepper />
                                <NumberDecrementStepper />
                              </NumberInputStepper>
                            </NumberInput>
                            <FormHelperText>
                              Rate charged per second of call duration
                            </FormHelperText>
                          </FormControl>
                          <FormControl isRequired>
                            <FormLabel>Tax Rate (%)</FormLabel>
                            <NumberInput
                              value={formData.taxRate}
                              onChange={(value) =>
                                setFormData({
                                  ...formData,
                                  taxRate: parseFloat(value),
                                })
                              }
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
                              onChange={(value) =>
                                setFormData({
                                  ...formData,
                                  minimumCharge: parseFloat(value),
                                })
                              }
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
                            <FormHelperText>
                              Minimum charge per call
                            </FormHelperText>
                          </FormControl>
                          <FormControl>
                            <FormLabel>Rounding Decimal Places</FormLabel>
                            <NumberInput
                              value={formData.roundingDecimal}
                              onChange={(value) =>
                                setFormData({
                                  ...formData,
                                  roundingDecimal: parseInt(value),
                                })
                              }
                              min={0}
                              max={8}
                            >
                              <NumberInputField />
                              <NumberInputStepper>
                                <NumberIncrementStepper />
                                <NumberDecrementStepper />
                              </NumberInputStepper>
                            </NumberInput>
                            <FormHelperText>
                              Decimal places for rounding charges
                            </FormHelperText>
                          </FormControl>
                        </SimpleGrid>

                        <Heading size="sm" mb={2} mt={4}>
                          Localization
                        </Heading>
                        <SimpleGrid columns={2} spacing={4}>
                          <FormControl>
                            <FormLabel>Timezone</FormLabel>
                            <Select
                              value={formData.timezone}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  timezone: e.target.value,
                                })
                              }
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
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  languages: e.target.value,
                                })
                              }
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

                    {/* Tab 6: Usage Statistics (only for editing) */}
                    {selectedCustomer && (
                      <TabPanel>
                        <VStack spacing={4} align="stretch">
                          <Heading size="sm" mb={2}>
                            Account Usage Statistics
                          </Heading>
                          <SimpleGrid columns={3} spacing={4}>
                            <Box
                              p={4}
                              bg="blue.50"
                              borderRadius="md"
                              textAlign="center"
                            >
                              <Text
                                fontSize="sm"
                                color="blue.600"
                                fontWeight="medium"
                              >
                                Total Calls
                              </Text>
                              <Text fontSize="2xl" fontWeight="bold">
                                {cdrStats.totalCalls}
                              </Text>
                              <Text fontSize="xs" color="gray.600">
                                All time
                              </Text>
                            </Box>
                            <Box
                              p={4}
                              bg="green.50"
                              borderRadius="md"
                              textAlign="center"
                            >
                              <Text
                                fontSize="sm"
                                color="green.600"
                                fontWeight="medium"
                              >
                                Total Revenue
                              </Text>
                              <Text fontSize="2xl" fontWeight="bold">
                                ${(cdrStats.totalRevenue || 0).toFixed(2)}
                              </Text>
                              <Text fontSize="xs" color="gray.600">
                                Generated
                              </Text>
                            </Box>
                            <Box
                              p={4}
                              bg="purple.50"
                              borderRadius="md"
                              textAlign="center"
                            >
                              <Text
                                fontSize="sm"
                                color="purple.600"
                                fontWeight="medium"
                              >
                                Success Rate
                              </Text>
                              <Text fontSize="2xl" fontWeight="bold">
                                {cdrStats.totalCalls > 0
                                  ? (
                                    (cdrStats.answeredCalls /
                                      cdrStats.totalCalls) *
                                    100
                                  ).toFixed(1)
                                  : "0.0"}
                                %
                              </Text>
                              <Text fontSize="xs" color="gray.600">
                                Answered calls
                              </Text>
                            </Box>
                            <Box
                              p={4}
                              bg="orange.50"
                              borderRadius="md"
                              textAlign="center"
                            >
                              <Text
                                fontSize="sm"
                                color="orange.600"
                                fontWeight="medium"
                              >
                                Total Duration
                              </Text>
                              <Text fontSize="2xl" fontWeight="bold">
                                {Math.floor(
                                  (cdrStats.totalDuration || 0) / 3600,
                                )}
                                h{" "}
                                {Math.floor(
                                  ((cdrStats.totalDuration || 0) % 3600) / 60,
                                )}
                                m
                              </Text>
                              <Text fontSize="xs" color="gray.600">
                                Call time
                              </Text>
                            </Box>
                            <Box
                              p={4}
                              bg="red.50"
                              borderRadius="md"
                              textAlign="center"
                            >
                              <Text
                                fontSize="sm"
                                color="red.600"
                                fontWeight="medium"
                              >
                                Total Tax
                              </Text>
                              <Text fontSize="2xl" fontWeight="bold">
                                ${(cdrStats.totalTax || 0).toFixed(2)}
                              </Text>
                              <Text fontSize="xs" color="gray.600">
                                Collected
                              </Text>
                            </Box>
                            <Box
                              p={4}
                              bg="teal.50"
                              borderRadius="md"
                              textAlign="center"
                            >
                              <Text
                                fontSize="sm"
                                color="teal.600"
                                fontWeight="medium"
                              >
                                Avg Call Duration
                              </Text>
                              <Text fontSize="2xl" fontWeight="bold">
                                {cdrStats.totalCalls > 0
                                  ? Math.floor(
                                    cdrStats.totalDuration /
                                    cdrStats.totalCalls,
                                  )
                                  : 0}
                                s
                              </Text>
                              <Text fontSize="xs" color="gray.600">
                                Per call
                              </Text>
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
            <ModalFooter
              borderBottomRadius={"8px"}
              position="sticky"
              bottom={0}
              bg="white"
              borderTop="1px"
              borderColor="gray.200"
              py={4}
            >
              <HStack spacing={3} width="100%" justify="space-between">
                <Box>
                  {selectedCustomer && (
                    <Text fontSize="sm" color="gray.600">
                      Last updated:{" "}
                      {new Date(
                        selectedCustomer.updatedAt,
                      ).toLocaleDateString()}
                    </Text>
                  )}
                </Box>
                <HStack>
                  <Button
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    isDisabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    colorScheme="blue"
                    onClick={handleSave}
                    isLoading={loading}
                    leftIcon={<FiUser />}
                  >
                    {selectedCustomer ? "Update Account" : "Create Account"}
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
          title="Delete Account"
          message={`Are you sure you want to delete account ${selectedCustomer?.accountName}? This will also remove all associated CDRs and invoices.`}
          confirmText="Delete Account"
          type="danger"
        />
      </VStack>
    </Container>
  );
};

export default Accounts;
