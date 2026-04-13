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
  useColorModeValue,
  Icon,
  IconButton,
  Spacer,
  Grid,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Stack,
  Spinner,
  Tooltip,
  Flex,
} from "@chakra-ui/react";
import {
  MemoizedInput as Input,
  MemoizedSelect as Select,
} from "../components/memoizedinput/memoizedinput";
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
  FiUpload,
} from "react-icons/fi";
import DataTable from "../components/DataTable";
import ConfirmDialog from "../components/ConfirmDialog";
import CreateAccountModal from "../components/modals/CreateAccountModal";
import TopupModal from "../components/modals/TopupModal";
import BulkAccountUploadModal from "../components/modals/BulkAccountUploadModal";
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
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1,
  });
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
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [selectedAccountForTopup, setSelectedAccountForTopup] = useState(null);

  const toast = useToast();
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  // Options
  const accountRoleOptions = [
    { value: "customer", label: "Customer", color: "gray" },
    { value: "vendor", label: "Vendor", color: "gray" },
    { value: "both", label: "Bilateral", color: "gray" },
  ];

  const accountTypeOptions = [
    { value: "prepaid", label: "Prepaid" },
    { value: "postpaid", label: "Postpaid" },
    { value: "hybrid", label: "Hybrid" },
  ];

  const statusOptions = [
    { value: "active", label: "Active", color: "green" },
    { value: "inactive", label: "Inactive", color: "gray" },
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
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 800);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    loadCustomers();
  }, [debouncedSearch, roleFilter, statusFilter, ownerFilter, page, pageSize]);

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
        console.error("Error fetching users:", error);
      }
    };
    loadUsers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const customersData = await fetchCustomers({
        role: roleFilter,
        status: statusFilter,
        owner: ownerFilter,
        query: debouncedSearch,
        page,
        limit: pageSize,
      });
      setCustomers(customersData.accounts || []);
      setPagination({
        total: Number(customersData.total || 0),
        page: Number(customersData.page || page),
        limit: Number(customersData.limit || pageSize),
        totalPages: Number(customersData.totalPages || 1),
      });
    } catch (error) {
      toast({
        title: "Error loading accounts",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setCustomers([]);
      setPagination({ total: 0, page: 1, limit: pageSize, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  };

  const calculateCustomerStats = async () => {
    try {
      const accountId = selectedCustomer?.id;
      const customerCode = selectedCustomer?.customerCode;
      const vendorCode = selectedCustomer?.vendorCode;

      // Reset first to avoid showing stale numbers while loading a different account.
      setCdrStats(DEFAULT_CDR_STATS);

      if (!accountId && !customerCode && !vendorCode) {
        return;
      }

      const stats = await fetchCDRStats({
        accountId,
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
      customerauthenticationType: "ip",
      customerauthenticationValue: "",
      vendorauthenticationType: "ip",
      vendorauthenticationValue: "",

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
      lastbillingdate: null,
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
    if (customer.billingType !== "prepaid") {
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
    const safeBalance = Number(newBalance);
    toast({
      title: "Topup successful",
      description: `Account balance updated to $${(Number.isFinite(safeBalance) ? safeBalance : 0).toFixed(2)}`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
    loadCustomers();
  };

  const handleBulkUploadClick = () => {
    setIsBulkUploadModalOpen(true);
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
      header: "Account Owner",
      minWidth: "150px",
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
      header: "Account Type",
      minWidth: "130px",
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
          <Text fontWeight="medium" fontSize="sm" noOfLines={1}>
            {value}
          </Text>
          <HStack spacing={1} mt={1}>
            {row.customerCode && (
              <Badge fontSize="xs" colorScheme="black" variant="outline">
                {row.customerCode}
              </Badge>
            )}
            {row.vendorCode && (
              <Badge fontSize="xs" colorScheme="black" variant="outline">
                {row.vendorCode}
              </Badge>
            )}
          </HStack>
        </Box>
      ),
    },
    // {
    //   key: "email",
    //   header: "Email",
    //   // minWidth: "150px",
    //   render: (value) => (
    //     <Text fontSize="sm" isTruncated fontWeight={"medium"}>
    //       {value}
    //     </Text>
    //   ),
    // },
    {
      key: "active",
      header: "Status",
      // minWidth: "90px",
      render: (value, row) => {
        const status = statusOptions.find((s) => s.value === row.accountStatus);
        return (
          <Badge
            borderRadius={"full"}
            px={2}
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
          fontWeight="medium"
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
      minWidth: "120px",
      isNumeric: true,
      render: (value) => (
        <Text
          fontWeight="medium"
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
      minWidth: "120px",
      render: (value) => value || "-",
    },
    {
      key: "nextbillingdate",
      header: "Next Billing",
      minWidth: "130px",
      render: (value) => value || "-",
    },
  ];

  return (
    <Box>
      <VStack spacing={4} align="stretch">
        {/* Header */}
        <PageNavBar
          title="Accounts Management"
          description="Manage customers, vendors, resellers and agents"
          rightContent={
            <Flex
              align={{ base: "stretch", md: "center" }}
              direction={{ base: "column", md: "row" }}
              gap={2}
              w={{ base: "full", md: "auto" }}
            >
              {user.role === "admin" && (
                <Button
                  borderRadius="6px"
                  leftIcon={<FiUpload />}
                  colorScheme="blue"
                  variant="solid"
                  onClick={handleBulkUploadClick}
                  size="sm"
                >
                  Bulk Upload
                </Button>
              )}
              <Button
                borderRadius="6px"
                leftIcon={<FiPlus />}
                color="white"
                bgGradient="linear(to-r, blue.500, blue.600)"
                _hover={{ bgGradient: "linear(to-r, blue.600, blue.700)" }}
                onClick={handleAddNew}
                size="sm"
              >
                Add Account
              </Button>
            </Flex>
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
          {[
            { label: "Total Accounts", value: pagination.total },
            {
              label: "Active Accounts",
              value: customers.filter((c) => c.active === true).length,
            },
            {
              label: "Customers",
              value: customers.filter((c) =>
                ["customer", "both"].includes(c.accountRole),
              ).length,
            },
            {
              label: "Vendors",
              value: customers.filter((c) =>
                ["vendor", "both"].includes(c.accountRole),
              ).length,
            },
          ].map(({ label, value }) => (
            <Box
              key={label}
              p={4}
              px={5}
              bg="gray.50"
              borderRadius="lg"
              border={"1px solid"}
              borderColor="gray.200"
              shadow="sm"
            >
              <Text
                fontSize="xs"
                fontWeight="500"
                color="gray.600"
                letterSpacing="wider"
                textTransform="uppercase"
                mb={1}
              >
                {label}
              </Text>
              <HStack spacing={2} align={"baseline"}>
                <Text
                  fontSize="2xl"
                  fontWeight="500"
                  color="gray.700"
                  lineHeight="1"
                >
                  {value}
                </Text>
                <Text fontSize="xs" color="gray.400">
                  accounts
                </Text>
              </HStack>
            </Box>
          ))}
        </Grid>
        <Flex
          align={{ base: "stretch", md: "center" }}
          direction={{ base: "column", md: "row" }}
          gap={2}
          w="full"
        >
          <Select
            // borderRadius={"md"}
            // bg={"white"}
            size="sm"
            width={{ base: "100%", md: "150px" }}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Roles</option>
            {accountRoleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </Select>

          <Select
            // bg={"white"}
            // borderRadius={"md"}
            size="sm"
            width={{ base: "100%", md: "150px" }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Status</option>
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </Select>

          <Select
            // bg={"white"}
            // borderRadius={"md"}
            size="sm"
            width={{ base: "100%", md: "190px" }}
            value={ownerFilter}
            onChange={(e) => {
              setOwnerFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Owners</option>
            {users.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {`${u.first_name || u.firstName || ""} ${u.last_name || u.lastName || ""}`.trim() ||
                  u.email ||
                  `User ${u.id}`}
              </option>
            ))}
          </Select>

          <InputGroup
            size="sm"
            // bg="white"
            w={{ base: "100%", md: "320px" }}
            position="relative"
            // borderRadius="md"

            transition="all 0.2s ease"
            overflow="hidden"
          >
            <InputLeftElement pointerEvents="none">
              <Icon as={FiSearch} color="blue.500" />
            </InputLeftElement>

            <Input
              w="100%"
              placeholder="Search by account name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              border="none"
              pl={8}
              pr={searchTerm ? 10 : 4}
              _placeholder={{
                color: "gray.600",
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
        </Flex>
        {/* Data Table */}
        {loading ? (
          <Box textAlign="center" py={10}>
            <Spinner size="lg" color="gray.500" />
            <Text>Loading accounts...</Text>
          </Box>
        ) : (
          <DataTable
            columns={columns}
            data={customers}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleView}
            serverPagination
            page={pagination.page || page}
            pageSize={pagination.limit || pageSize}
            total={pagination.total || 0}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            isPaginationDisabled={loading}
            // render a topup button beside the three‑dot menu when the account is
            // prepaid; this keeps both actions in the same column
            rowActions={(row) =>
              row.billingType === "prepaid" ? (
                <Button
                  size="xs"
                  colorScheme="green"
                  variant="ghost"
                  leftIcon={<FiArrowUp />}
                  onClick={() => handleTopup(row)}
                  mr={2}
                >
                  Topup
                </Button>
              ) : null
            }
            striped={true}
            height="calc(100vh - 350px)"
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
        <BulkAccountUploadModal
          isOpen={isBulkUploadModalOpen}
          onClose={() => setIsBulkUploadModalOpen(false)}
          onUploaded={loadCustomers}
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
          isLoading={loading}
        />
      </VStack>
    </Box>
  );
};

export default Accounts;
