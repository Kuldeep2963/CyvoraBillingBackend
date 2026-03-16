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
  Input,
  useColorModeValue,
  Icon,
  IconButton,
  Spacer,
  Select,
  Grid,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Stack,
  Tooltip,
  Flex,
} from "@chakra-ui/react";
import PageNavBar from "../components/PageNavBar";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiX,
  FiBriefcase,
  FiGlobe,
  FiClock,
  FiTrendingUp,
  FiArrowUp,
} from "react-icons/fi";
import DataTable from "../components/DataTable";
import ConfirmDialog from "../components/ConfirmDialog";
import CreateAccountModal from "../components/modals/CreateAccountModal";
import TopupModal from "../components/modals/TopupModal";
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchCDRStats,
  fetchUsers,
} from "../utils/api";
import { useAuth } from "../context/AuthContext";

const Accounts = () => {
  const DEFAULT_CDR_STATS = {
    totalCalls: 0,
    totalDuration: 0,
    totalRevenue: 0,
    totalTax: 0,
    answeredCalls: 0,
  };

  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [accountModalMode, setAccountModalMode] = useState("create");
  const [formData, setFormData] = useState({
    // Account Role & Type
    accountRole: "customer",
    accountType: "prepaid",
    accountStatus: "active",
    accountId: "",
    customerauthenticationType: "ip",
    customerauthenticationValue: "",
    vendorauthenticationType: "ip",
    vendorauthenticationValue: "",

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
    billingClass: "paiusa",
    billingType: "prepaid",
    billingTimezone: "UTC",
    billingStartDate: new Date().toISOString().split("T")[0],
    billingCycle: "monthly",
    lastbillingdate: null,
    nextbillingdate: null,

    // Payment Settings
    sendInvoiceEmail: true,
    lateFeeEnabled: true,
  });
  const [cdrStats, setCdrStats] = useState(DEFAULT_CDR_STATS);
  const [loading, setLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
  const [selectedAccountForTopup, setSelectedAccountForTopup] = useState(null);

  const toast = useToast();
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  // Options
  const accountRoleOptions = [
    { value: "customer", label: "Customer", color: "blue" },
    { value: "vendor", label: "Vendor", color: "purple" },
    { value: "both", label: "Cust & Ven", color: "green" },
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
      calculateCustomerStats();
    }
  }, [selectedCustomer]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetchUsers();
        if (response && response.length > 0) {
          setUsers(response);
        } else if (response && response.data) {
          setUsers(response.data);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    loadUsers();
  }, []);

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

  const calculateCustomerStats = async () => {
    try {
      const customerCode = selectedCustomer?.customerCode;
      const vendorCode = selectedCustomer?.vendorCode;

      // Reset first to avoid showing stale numbers while loading a different account.
      setCdrStats(DEFAULT_CDR_STATS);

      if (!customerCode && !vendorCode) {
        return;
      }

      const stats = await fetchCDRStats({
        customerCode,
        vendorCode,
      });

      setCdrStats({
        totalCalls: Number(stats?.totalCalls || 0),
        totalDuration: Number(stats?.totalDuration || 0),
        totalRevenue: Number(stats?.totalRevenue || 0),
        totalTax: Number(stats?.totalTax || 0),
        answeredCalls: Number(stats?.answeredCalls || 0),
      });
    } catch (error) {
      console.error("Error calculating customer stats:", error);
      setCdrStats(DEFAULT_CDR_STATS);
    }
  };

  const handleAddNew = () => {
    setAccountModalMode("create");
    setFormData({
      // Account Role & Type
      accountRole: "customer",
      accountType: "prepaid",
      accountStatus: "active",
      accountId: "",
      authenticationType: "ip",
      authenticationValue: "",

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
      billingClass: "",
      billingType: "prepaid",
      billingTimezone: "UTC",
      billingStartDate: new Date().toISOString().split("T")[0],
      billingCycle: "monthly",
      lastbillingdate: "",
      nextbillingdate: "",

      // Payment Settings
      sendInvoiceEmail: true,
      lateFeeEnabled: true,
    });

    setSelectedCustomer(null);
    setIsModalOpen(true);
  };

  const handleEdit = (customer) => {
    setAccountModalMode("edit");
    setSelectedCustomer(customer);
    setFormData(customer);
    setIsModalOpen(true);
  };

  const handleDelete = (customer) => {
    setSelectedCustomer(customer);
    setIsDeleteOpen(true);
  };

  const handleView = (customer) => {
    setAccountModalMode("view");
    setSelectedCustomer(customer);
    setFormData(customer);
    setIsModalOpen(true);
  };

  const handleTopup = (customer) => {
    if (customer.billingType !== 'prepaid') {
      toast({
        title: "Not applicable",
        description: "Topup is only available for prepaid accounts",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    setSelectedAccountForTopup(customer);
    setIsTopupModalOpen(true);
  };

  const handleTopupSuccess = (newBalance) => {
    toast({
      title: "Topup successful",
      description: `Account balance updated to $${newBalance.toFixed(2)}`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
    loadCustomers();
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
    { value: "ip", label: "IP Address", description: "Match by source IP" },
    {
      value: "custom",
      label: "Custom Field",
      description: "Match by custom field",
    },
  ];

  const columns = [
    
    {
      key: "accountOwner",
      header: "Owner",
      minWidth: "130px",
      render: (value, row) => {
        if (row.owner) {
          return `${row.owner.first_name} ${row.owner.last_name}`;
        }
        if (!value) return "-";
        const u = userMap[value];
        if (u) return `${u.first_name} ${u.last_name}`;
        return value; // fall back to whatever was stored
      },
    },
    {
      key: "accountRole",
      header: "Role",
      // minWidth: "90px",
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
      // minWidth: "200px",
      render: (value, row) => (
        <Box>
          <Text fontWeight="medium" fontSize="sm" noOfLines={1}>{value}</Text>
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
      key: "email",
      header: "Email",
      // minWidth: "150px",
      render: (value) => (
        <Text fontSize="sm" isTruncated fontWeight={"medium"}>
          {value}
        </Text>
      ),
    },
    {
      key: "active",
      header: "Status",
      // minWidth: "90px",
      render: (value, row) => {
        const status = statusOptions.find((s) => s.value === row.accountStatus);
        return (
          <Badge
            colorScheme={status?.color || (value ? "green" : "red")}
            variant="subtle"
          >
            {status?.label || (value ? "Active" : "Inactive")}
          </Badge>
        );
      },
    },
    {
      key: "balance",
      header: "Balance",
      // minWidth: "110px",
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
    {
      key: "creditLimit",
      header: "Credit Limit",
      // minWidth: "120px",
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
    {
      key: "lastbillingdate",
      header: "Last Billing",
      // minWidth: "110px",
      render: (value) => value || "N/A",
    },
    {
      key: "nextbillingdate",
      header: "Next Billing",
      // minWidth: "110px",
      render: (value) => value || "N/A",
    },
  ];

  return (
    <Box>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <PageNavBar
          title="Accounts Management"
          description="Manage customers, vendors, resellers and agents"
          rightContent={
            <>
              {/* Role Filter */}
              <Select
                borderRadius={"md"}
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
                borderRadius={"md"}
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
                borderRadius="md"
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

              {user.role === "admin" && (
                <Button
                  borderRadius="4px"
                  leftIcon={<FiPlus />}
                  colorScheme="green"
                  onClick={handleAddNew}
                  size="sm"
                >
                  Add Account
                </Button>
              )}
            </>
          }
        />

        {/* Account Stats Summary */}
        <Grid
          templateColumns={{
            base: "1fr",
            md: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          }}
          gap={4}
        >
          <Box
            p={4}
            px={6}
            bgGradient="linear(to-tr, rgba(255, 255, 255, 0.8), rgba(240, 245, 255, 0.5))"
            borderRadius="md"
            display={"flex"}
            shadow={"md"}
            flexDirection={"row"}
            alignItems="center"
            justifyContent="space-between"
          >
            <Text fontSize="sm" fontWeight="bold">
              Total Accounts
            </Text>
            <Text fontSize="2xl" color="blue.600" fontWeight="bold">
              {customers.length}
            </Text>
          </Box>
          <Box
            p={4}
            px={6}
            bgGradient="linear(to-tr, rgba(255, 255, 255, 0.8), rgba(240, 245, 255, 0.5))"
            borderRadius="md"
            display={"flex"}
            shadow={"md"}
            flexDirection={"row"}
            alignItems="center"
            justifyContent="space-between"
          >
            <Text fontSize="sm" fontWeight="bold">
              Active Accounts
            </Text>
            <Text fontSize="2xl" color="green.600" fontWeight="bold">
              {customers.filter((c) => c.active === true).length}
            </Text>
          </Box>
          <Box
            p={4}
            px={6}
            bgGradient="linear(to-tr,rgba(255, 255, 255, 0.8), rgba(240, 245, 255, 0.5))"
            borderRadius="md"
            display={"flex"}
            shadow={"md"}
            flexDirection={"row"}
            alignItems="center"
            justifyContent="space-between"
          >
            <Text fontSize="sm" fontWeight="bold">
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
          <Box
            p={4}
            px={6}
            bgGradient="linear(to-tr, rgba(255, 255, 255, 0.8), rgba(240, 245, 255, 0.5))"
            borderRadius="md"
            display={"flex"}
            shadow={"md"}
            flexDirection={"row"}
            alignItems="center"
            justifyContent="space-between"
          >
            <Text fontSize="sm" fontWeight="bold">
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
            // render a topup button beside the three‑dot menu when the account is
            // prepaid; this keeps both actions in the same column
            rowActions={(row) =>
              row.billingType === 'prepaid' ? (
                <Button
                  size="xs"
                  colorScheme="green"
                  variant="outline"
                  leftIcon={<FiArrowUp />}
                  onClick={() => handleTopup(row)}
                  mr={2}
                >
                  Topup
                </Button>
              ) : null
            }
            striped={true}
            height="calc(100vh - 337px)"
          />
        )}

        {/* Account Modal */}
        <CreateAccountModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedCustomer(null);
            setAccountModalMode("create");
            setCdrStats(DEFAULT_CDR_STATS);
          }}
          onSuccess={loadCustomers}
          selectedCustomer={selectedCustomer}
          mode={accountModalMode}
          cdrStats={cdrStats}
          users={users}
        />
        {/* Topup Modal */}
        <TopupModal
          isOpen={isTopupModalOpen}
          onClose={() => setIsTopupModalOpen(false)}
          account={selectedAccountForTopup}
          onTopupSuccess={handleTopupSuccess}
        />
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
    </Box>
  );
};

export default Accounts;
