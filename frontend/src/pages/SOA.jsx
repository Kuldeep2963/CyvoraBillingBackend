import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Grid,
  GridItem,
  Heading,
  Card,
  CardHeader,
  CardBody,
  Text,
  Spinner,
  Flex,
  Button,
  Badge,
  Divider,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  HStack,
  Tooltip,
  useDisclosure,
  Spacer,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { FiAlertCircle, FiDownload, FiMail } from "react-icons/fi";
import {
  fetchReportAccounts,
  fetchLiteInvoices,
  fetchVendorInvoices,
  exportReport,
  exportSOA,
  sendSOAEmail,
  getAllDisputes,
} from "../utils/api";
import { MemoizedSelect as Select } from "../components/memoizedinput/memoizedinput";
import DateRangePicker from "../components/formats/DateRangepicker";
import RaiseDisputeModal from "../components/modals/RaiseDisputeModal";
import PageNavBar from "../components/PageNavBar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (date) => {
  if (!date) return "N/A";
  const parsedDate = isNaN(date) ? new Date(date) : new Date(Number(date));
  if (parsedDate.toString() === "Invalid Date") return "N/A";
  return parsedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatAmount = (amount) =>
  parseFloat(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const parseDateString = (value) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateToYMD = (date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const statusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "paid":
    case "approved":
      return "green";
    case "unpaid":
    case "rejected":
      return "red";
    case "partial":
    case "processing":
      return "orange";
    case "pending":
      return "yellow";
    default:
      return "gray";
  }
};

const isCustomerAccountRole = (role) => ["customer", "both"].includes(String(role || "").toLowerCase());
const isVendorAccountRole = (role) => ["vendor", "both"].includes(String(role || "").toLowerCase());
const getAccountRoleLabel = (role) => {
  if (isCustomerAccountRole(role) && isVendorAccountRole(role)) return "Bilateral";
  if (isCustomerAccountRole(role)) return "Customer";
  if (isVendorAccountRole(role)) return "Vendor";
  return "Account";
};

const getAccountOptionValue = (account) =>
  String(account?.id ?? account?.accountId ?? `${account?.accountName || ""}:${account?.accountRole || ""}`);

// ─── Invoice Table ─────────────────────────────────────────────────────────────
const InvoiceTable = ({
  invoices,
  loading,
  emptyLabel = "No invoices to display.",
  mismatchedInvoices = [],
  disputes = [],
}) => {
  const getInvoiceDispute = (invoiceNumber) => {
    if (!disputes.length) return null;
    return disputes.find((d) =>
      d.invoiceNumber?.includes(invoiceNumber)
    );
  };

  if (loading) {
    return (
      <Flex justify="center" align="center" py={10}>
        <Spinner size="md" color="blue.400" />
      </Flex>
    );
  }

  if (!invoices.length) {
    return (
      <Flex direction="column" align="center" justify="center" py={10} gap={2}>
        <Text color="gray.400" fontSize="sm">
          {emptyLabel}
        </Text>
      </Flex>
    );
  }

  const totalBalance = invoices.reduce(
    (sum, inv) => sum + parseFloat(inv.balanceAmount || 0),
    0,
  );
  const totalAmount = invoices.reduce(
    (sum, inv) => sum + parseFloat(inv.totalAmount || 0),
    0,
  );

  return (
    <Flex direction="column" h="100%">
      {/* Scrollable table */}
      <Box maxH="280px" overflowY="auto">
        <Table size="sm" variant="simple">
          <Thead position="sticky" top="0" zIndex="1" bg="gray.200">
            <Tr>
              <Th color="gray.700" fontSize="12px">
                Invoice No.
              </Th>
              <Th color="gray.700" fontSize="12px">
                Invoice Date
              </Th>
              <Th color="gray.700" fontSize="12px">
                Billing Period
              </Th>
              <Th color="gray.700" isNumeric fontSize="12px">
                Amount
              </Th>
              <Th color="gray.700" isNumeric fontSize="12px">
                Balance
              </Th>
              <Th color="gray.700" fontSize="12px">
                Status
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {invoices.map((inv) => {
              const isMismatched = mismatchedInvoices.includes(inv.id);
              return (
                <Tr
                  key={inv.id}
                  _hover={{ bg: isMismatched ? "red.50" : "blue.50" }}
                  bg={isMismatched ? "red.50" : "transparent"}
                  transition="background 0.15s"
                >
                  <Td fontWeight="medium" fontSize="sm">
                    <HStack>
                      <Box>
                        {inv.invoiceNumber}
                        {isMismatched && (
                          <Tooltip label="Amount mismatch with corresponding invoice">
                            <Box as="span" ml={2}>
                              <FiAlertCircle
                                color="red"
                                style={{ display: "inline" }}
                              />
                            </Box>
                          </Tooltip>
                        )}
                      </Box>
                      {getInvoiceDispute(inv.invoiceNumber) && (
                        <Badge colorScheme="red" fontSize="10px">
                          Disputed
                        </Badge>
                      )}
                    </HStack>
                  </Td>
                  <Td fontSize="sm">{formatDate(inv.invoiceDate)}</Td>
                  <Td fontSize="sm" whiteSpace="nowrap">
                    {formatDate(inv.billingPeriodStart)} —{" "}
                    {formatDate(inv.billingPeriodEnd)}
                  </Td>
                  <Td isNumeric fontSize="sm">
                    ${formatAmount(inv.totalAmount)}
                  </Td>
                  <Td
                    isNumeric
                    fontSize="sm"
                    color={
                      parseFloat(inv.balanceAmount) > 0
                        ? "red.500"
                        : "green.500"
                    }
                    fontWeight="semibold"
                  >
                    ${formatAmount(inv.balanceAmount)}
                  </Td>
                  <Td>
                    <Badge
                      colorScheme={statusColor(inv.status)}
                      fontSize="12px"
                    >
                      {inv.status}
                    </Badge>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Box>

      {/* Footer totals */}
      <Divider mt={3} mb={2} />
      <Flex justify="space-between" align="center" px={1}>
        <Text fontSize="xs" color="gray.700">
          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
        </Text>
        <HStack spacing={6}>
          <Box textAlign="right">
            <Text
              fontSize="12px"
              color="gray.700"
              textTransform="uppercase"
              letterSpacing="wide"
            >
              Total Amount
            </Text>
            <Text fontSize="sm" fontWeight="bold">
              ${formatAmount(totalAmount)}
            </Text>
          </Box>
          <Box textAlign="right">
            <Text
              fontSize="12px"
              color="gray.700"
              textTransform="uppercase"
              letterSpacing="wide"
            >
              Outstanding
            </Text>
            <Text
              fontSize="sm"
              fontWeight="bold"
              color={totalBalance > 0 ? "red.500" : "green.500"}
            >
              ${formatAmount(totalBalance)}
            </Text>
          </Box>
        </HStack>
      </Flex>
    </Flex>
  );
};

// ─── Comparison Summary ────────────────────────────────────────────────────────
const ComparisonSummary = ({
  customerInvoices,
  uploadedVendorInvoices,
  hasMismatch,
  onExport,
  onEmail,
  onDispute,
  hasExistingDispute = false,
}) => {
  if (!customerInvoices.length && !uploadedVendorInvoices.length)
    return null;

  const customerTotal = customerInvoices.reduce(
    (s, i) => s + parseFloat(i.totalAmount || 0),
    0,
  );
  const vendorTotal = uploadedVendorInvoices.reduce(
    (s, i) => s + parseFloat(i.totalAmount || 0),
    0,
  );

  const margin = customerTotal - vendorTotal;
  const marginPct = customerTotal > 0 ? (margin / customerTotal) * 100 : 0;

  return (
    <Card
      mb={3}
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="8px"
    >
      <CardBody py={2} px={5}>
        <Flex
          gap={4}
          justify="space-between"
          align={{ base: "start", md: "center" }}
          flexDirection={{ base: "column", md: "row" }}
        >
          <Box>
            <Text
              fontSize="12px"
              color="gray.700"
              textTransform="uppercase"
              letterSpacing="wide"
              mb={1}
            >
              Customer Revenue
            </Text>
            <Text fontSize="lg" fontWeight="bold" color="blue.600">
              ${formatAmount(customerTotal)}
            </Text>
          </Box>
          <Box>
            <Text
              fontSize="12px"
              color="gray.700"
              textTransform="uppercase"
              letterSpacing="wide"
              mb={1}
            >
              Vendor Cost
            </Text>
            <Text fontSize="lg" fontWeight="bold" color="purple.600">
              ${formatAmount(vendorTotal)}
            </Text>
          </Box>
          <Box>
            <Text
              fontSize="12px"
              color="gray.700"
              textTransform="uppercase"
              letterSpacing="wide"
              mb={1}
            >
              Margin
            </Text>
            <Flex align="baseline" gap={2}>
              <Text
                fontSize="lg"
                fontWeight="bold"
                color={margin >= 0 ? "green.600" : "red.600"}
              >
                ${formatAmount(Math.abs(margin))}
              </Text>
              <Badge
                colorScheme={margin >= 0 ? "green" : "red"}
                fontSize="10px"
              >
                {margin >= 0 ? "▲" : "▼"} {Math.abs(marginPct).toFixed()}%
              </Badge>
            </Flex>
          </Box>
          <Flex align="center" gap={3} flexWrap="wrap">
            <Button
              size="sm"
              leftIcon={<FiMail />}
              borderRadius="4px"
              bg="green.600"
              color="white"
              _hover={{ bg: "green.700" }}
              _active={{ bg: "green.800" }}
              minW="130px"
              onClick={onEmail}
            >
              Send on Email
            </Button>
            <Button
              variant="outline"
              size="sm"
              colorScheme="blue"
              leftIcon={<FiDownload />}
              onClick={onExport}
            >
              Export
            </Button>
            {hasMismatch && (
              <Button
                size="sm"
                leftIcon={<FiAlertCircle />}
                borderRadius="4px"
                bg={hasExistingDispute ? "gray.400" : "red.600"}
                color="white"
                _hover={{ bg: hasExistingDispute ? "gray.400" : "red.700" }}
                _active={{ bg: hasExistingDispute ? "gray.400" : "red.800" }}
                minW="130px"
                onClick={onDispute}
                isDisabled={hasExistingDispute}
                cursor={hasExistingDispute ? "not-allowed" : "pointer"}
                title={hasExistingDispute ? "Dispute already raised for these invoices" : ""}
              >
                Raise Dispute
              </Button>
            )}
          </Flex>
        </Flex>
      </CardBody>
    </Card>
  );
};

// ─── Invoice Card wrapper ──────────────────────────────────────────────────────
const InvoiceCard = ({
  title,
  badge,
  badgeScheme,
  subtitle,
  rightSlot,
  invoices,
  loading,
  emptyLabel,
  mismatchedInvoices,
  disputes = [],
}) => (
  <Card
    borderWidth="1px"
    borderColor="gray.200"
    borderRadius="8px"
    h="320px"
    display="flex"
    flexDirection="column"
  >
    <CardHeader pb={2} borderBottom="1px" borderColor="gray.100" flexShrink={0}>
      <Flex align="center" justify="space-between">
        <Box>
          <Flex align="center" gap={3}>
            <Heading size="sm">{title}</Heading>
            {badge > 0 && (
              <Badge colorScheme={badgeScheme} fontSize="10px">
                {badge}
              </Badge>
            )}
          </Flex>
          {subtitle && (
            <Text fontSize="xs" color="gray.600" mt={0.5}>
              {subtitle}
            </Text>
          )}
        </Box>
        {rightSlot}
      </Flex>
    </CardHeader>
    {/* FIX: overflow hidden on CardBody so inner scroll works correctly */}
    <CardBody pt={3} flex={1} overflow="hidden">
      <InvoiceTable
        invoices={invoices}
        loading={loading}
        emptyLabel={emptyLabel}
        mismatchedInvoices={mismatchedInvoices}
        disputes={disputes}
      />
    </CardBody>
  </Card>
);

// ─── Vendor fetch helper ────────────────────────────────────────────────────────
const fetchAllVendorData = async (selectedAccount, startDate, endDate) => {
  if (!selectedAccount?.vendorCode && !selectedAccount?.vendorId) {
    return { uploadedInvoices: [] };
  }

  const manualRes = await fetchVendorInvoices({
    vendorCode: selectedAccount.vendorCode,
    vendorId: selectedAccount.vendorId,
    startDate: startDate || null,
    endDate: endDate || null,
  });

  // ── Uploaded vendor invoices ──────────────────────────────────
  let uploadedInvoices = [];
  const manualRows = Array.isArray(manualRes)
    ? manualRes
    : (Array.isArray(manualRes?.data) ? manualRes.data : []);

  if (manualRows.length > 0) {
    uploadedInvoices = manualRows
      .filter((inv) => {
        // Double check matching by vendorCode or vendorId using loose equality (==)
        // to handle cases where one side might be a string and the other a number
        const matchCode =
          (inv.vendorCode || inv.vendor?.vendorCode) ==
            selectedAccount.vendorCode ||
          (inv.vendorId || inv.vendorid || inv.vendor?.id) ==
            selectedAccount.vendorId;
        if (!matchCode) return false;
        // Date range filter
        if (startDate && new Date(inv.startDate) < new Date(startDate))
          return false;
        if (endDate && new Date(inv.endDate) > new Date(endDate)) return false;
        return true;
      })
      .map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.issueDate,
        billingPeriodStart: inv.startDate,
        billingPeriodEnd: inv.endDate,
        dueDate: inv.dueDate || inv.issueDate,
        totalAmount: inv.grandTotal,
        // FIX: balanceAmount was set equal to grandTotal always — use paidAmount if present
        balanceAmount:
          parseFloat(inv.grandTotal || 0) - parseFloat(inv.paidAmount || 0),
        status: inv.status,
        type: "uploaded",
      }));
  }

  return { uploadedInvoices };
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const SOAPage = () => {
  const toast = useToast();

  const {
    isOpen: isDisputeOpen,
    onOpen: onDisputeOpen,
    onClose: onDisputeClose,
  } = useDisclosure();

  const [allAccounts, setAllAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [uploadedVendorInvoices, setUploadedVendorInvoices] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [loadingVendor, setLoadingVendor] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchDisputes = useCallback(async () => {
    try {
      const res = await getAllDisputes();
      if (res.success) {
        setDisputes(res.data || []);
      }
    } catch (error) {
      console.error("Error fetching disputes:", error);
    }
  }, []);

  // ── Load report accounts (customer/vendor/bilateral) ───────────────────────
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setLoadingAccounts(true);
        const [accountsResponse, disputesResponse] = await Promise.all([
          fetchReportAccounts(),
          getAllDisputes(),
        ]);

        if (accountsResponse.success) {
          const customers = accountsResponse.customers || [];
          const vendors = accountsResponse.vendors || [];
          const accountMap = new Map();

          customers.forEach((c) => {
            const key = c.id || c.accountId || c.accountName;
            accountMap.set(key, {
              id: c.id,
              accountId: c.accountId,
              accountName: c.accountName,
              accountRole: "customer",
              customerCode: c.customerCode || null,
              vendorCode: c.vendorCode || null,
              vendorId: c.id || c.accountId,
            });
          });

          vendors.forEach((v) => {
            const key = v.id || v.accountId || v.accountName;
            const existing = accountMap.get(key);
            const mergedRole = existing ? "both" : "vendor";
            accountMap.set(key, {
              ...(existing || {}),
              id: v.id || existing?.id,
              accountId: v.accountId || existing?.accountId,
              accountName: v.accountName || existing?.accountName,
              accountRole: mergedRole,
              customerCode: existing?.customerCode || v.customerCode || null,
              vendorCode: v.vendorCode || existing?.vendorCode || null,
              vendorId: v.id || v.vendorid || v.accountId || existing?.vendorId,
            });
          });

          const mergedAccounts = Array.from(accountMap.values()).sort((a, b) =>
            String(a.accountName || "").localeCompare(String(b.accountName || "")),
          );

          setAllAccounts(mergedAccounts);
        }

        if (disputesResponse.success) {
          setDisputes(disputesResponse.data || []);
        }
      } catch {
        toast({
          title: "Error loading accounts",
          status: "error",
          duration: 3000,
        });
      } finally {
        setLoadingAccounts(false);
      }
    };
    loadAccounts();
  }, [toast]);

  // ── Mismatch detection ─────────────────────────────────────────────────────
  const mismatchedInvoices = [];
  const mismatchedInvoiceNumbers = "";
  const totalDisputeAmount = 0;
  const mismatchedPairCount = 0;

  // ── Search: fetch ALL three tables in parallel ─────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!selectedAccount) return;

    const includeCustomer = isCustomerAccountRole(selectedAccount.accountRole);
    const includeVendor = isVendorAccountRole(selectedAccount.accountRole);

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast({
        title: "Start date cannot be after end date",
        status: "warning",
        duration: 3000,
      });
      return;
    }

    // Clear previous results
    setCustomerInvoices([]);
    setUploadedVendorInvoices([]);

    // FIX: run customer + vendor fetches in PARALLEL instead of sequentially
    setLoadingCustomer(true);
    setLoadingVendor(true);

    const [customerResult, vendorResult] = await Promise.allSettled([
      // ── Customer invoices ──────────────────────────────────────
      includeCustomer && selectedAccount.customerCode
        ? fetchLiteInvoices({
            customerId: selectedAccount.customerCode,
            includePaid: true,
            startDate: startDate || null,
            endDate: endDate || null,
          })
        : Promise.resolve(null),

      // ── Vendor invoices (uploaded) ──────────────────────────────
      includeVendor
        ? fetchAllVendorData(selectedAccount, startDate, endDate)
        : Promise.resolve({ uploadedInvoices: [] }),
    ]);

    // ── Handle customer result ─────────────────────────────────────────────
    setLoadingCustomer(false);
    if (customerResult.status === "fulfilled" && customerResult.value) {
      const res = customerResult.value;
      if (res?.success && res.data?.length) {
        setCustomerInvoices(res.data);
      } else if (includeCustomer && selectedAccount.customerCode) {
        toast({
          title: "No customer invoices found for this account.",
          status: "warning",
          duration: 3000,
        });
      }
    } else if (customerResult.status === "rejected") {
      toast({
        title: "Error fetching customer invoices",
        status: "error",
        duration: 3000,
      });
    }

    // ── Handle vendor result ───────────────────────────────────────────────
    setLoadingVendor(false);
    if (vendorResult.status === "fulfilled") {
      const { uploadedInvoices } = vendorResult.value;
      setUploadedVendorInvoices(uploadedInvoices);

      if (includeVendor && uploadedInvoices.length === 0) {
        toast({
          title: "No uploaded vendor invoices found.",
          status: "warning",
          duration: 3000,
        });
      }
    } else {
      console.error("Error fetching vendor data:", vendorResult.reason);
      toast({
        title: "Error fetching vendor data",
        status: "error",
        duration: 3000,
      });
    }
  }, [selectedAccount, startDate, endDate, toast]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!selectedAccount) return;
    try {
      await exportSOA({
        account: selectedAccount,
        startDate,
        endDate,
      });
      toast({ title: "SOA exported successfully", status: "success" });
    } catch {
      toast({ title: "Failed to export SOA", status: "error" });
    }
  }, [
    selectedAccount,
    startDate,
    endDate,
    toast,
  ]);

  // ── Email ──────────────────────────────────────────────────────────────────
  const handleEmail = useCallback(async () => {
    if (!selectedAccount) return;
    try {
      await sendSOAEmail({
        account: selectedAccount,
        startDate,
        endDate,
      });
      toast({ title: "SOA sent via email successfully", status: "success" });
    } catch {
      toast({ title: "Failed to send SOA via email", status: "error" });
    }
  }, [
    selectedAccount,
    startDate,
    endDate,
    toast,
  ]);

  // ── Dispute ────────────────────────────────────────────────────────────────
  // Check if a dispute already exists for the current mismatched invoices
  const hasExistingDispute = React.useMemo(() => {
    if (mismatchedInvoices.length === 0 || !disputes.length) return false;
    
    // Get the invoice numbers of mismatched invoices
    const misatchedInvoiceNums = new Set();
    mismatchedInvoices.forEach((id) => {
      const uploadedInv = uploadedVendorInvoices.find((inv) => inv.id === id);
      if (uploadedInv) misatchedInvoiceNums.add(uploadedInv.invoiceNumber);
    });

    // Check if any dispute covers these invoice numbers
    return disputes.some((dispute) => {
      if (!dispute.invoiceNumber) return false;
      // Check if any of our current mismatched numbers are mentioned in this dispute
      return Array.from(misatchedInvoiceNums).some((num) =>
        dispute.invoiceNumber.toLowerCase().includes(num.toLowerCase())
      );
    });
  }, [
    mismatchedInvoices,
    disputes,
    uploadedVendorInvoices,
  ]);

  // Show toast when a dispute is already raised for mismatched invoices
  useEffect(() => {
    if (hasExistingDispute && (loadingCustomer || loadingVendor) === false) {
      toast({
        title: "Dispute Already Raised",
        description:
          "A dispute has already been raised for the current mismatched invoices.",
        status: "info",
        duration: 5000,
        isClosable: true,
        position: "top",
      });
    }
  }, [hasExistingDispute, loadingCustomer, loadingVendor, toast]);

  const handleDispute = useCallback(() => {
    if (hasExistingDispute) {
      toast({
        title: "Dispute Already Raised",
        description: "A dispute has already been raised for the mismatched invoices.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    onDisputeOpen();
  }, [onDisputeOpen, hasExistingDispute, toast]);

  const isLoading = loadingCustomer || loadingVendor;
  const showCustomerSection = !selectedAccount || isCustomerAccountRole(selectedAccount.accountRole);
  const showVendorSection = !selectedAccount || isVendorAccountRole(selectedAccount.accountRole);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Box bg="gray.50" minH="100vh">
      <PageNavBar
        title="Statement of Account"
        description="Compare invoices and payments by account role (customer, vendor, bilateral)"
        mb={5}
      />

      {loadingAccounts ? (
        <Flex justify="center" mt={20}>
          <Spinner size="xl" color="blue.400" />
        </Flex>
      ) : (
        <>
          {/* ── Filter / Account Selector ──────────────────────────────────── */}
          <Card
            mb={3}
            bg="white"
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="12px"
            borderLeft="3px solid"
            borderLeftColor="blue.400"
            overflow="visible"
          >
            <CardBody py={4} px={5}>
              <Flex align="center" gap={3} flexWrap="wrap">
                <Text
                  fontWeight="700"
                  color="gray.600"
                  fontSize="13px"
                  whiteSpace="nowrap"
                  letterSpacing="0.01em"
                >
                  Account:
                </Text>

                <Select
                  size="sm"
                  placeholder="Select an account..."
                  bg="gray.50"
                  border="1.5px solid"
                  borderColor="gray.200"
                  borderRadius="8px"
                  fontSize="13px"
                  fontWeight="500"
                  color="gray.700"
                  minW="220px"
                  maxW="300px"
                  flex="1"
                  height="36px"
                  _hover={{ borderColor: "gray.300" }}
                  _focus={{
                    borderColor: "blue.400",
                    boxShadow: "0 0 0 3px rgba(66,153,225,0.15)",
                    bg: "white",
                  }}
                  value={selectedAccount ? getAccountOptionValue(selectedAccount) : ""}
                  onChange={(e) => {
                    const found = allAccounts.find(
                      (a) => getAccountOptionValue(a) === e.target.value,
                    );
                    setSelectedAccount(found || null);
                    setCustomerInvoices([]);
                    setUploadedVendorInvoices([]);
                  }}
                >
                  {allAccounts.map((acc) => (
                    <option key={getAccountOptionValue(acc)} value={getAccountOptionValue(acc)}>
                      {acc.accountName} ({getAccountRoleLabel(acc.accountRole)})
                    </option>
                  ))}
                </Select>

                <DateRangePicker
                  value={{
                    startDate: parseDateString(startDate),
                    endDate: parseDateString(endDate),
                  }}
                  onChange={(range) => {
                    setStartDate(formatDateToYMD(range?.startDate));
                    setEndDate(formatDateToYMD(range?.endDate));
                  }}
                  placeholder="Select date range"
                  inputProps={{ minW: "260px", maxW: "320px", size: "sm" }}
                />

                <Button
                  size="sm"
                  colorScheme="blue"
                  leftIcon={<SearchIcon boxSize={3} />}
                  onClick={handleSearch}
                  isDisabled={!selectedAccount || isLoading || !startDate || !endDate}
                  isLoading={isLoading}
                  loadingText="Loading..."
                  minW="100px"
                  height="36px"
                  borderRadius="8px"
                  fontWeight="600"
                  fontSize="13px"
                  boxShadow="0 2px 8px rgba(49,130,206,0.25)"
                  _hover={{
                    boxShadow: "0 4px 12px rgba(49,130,206,0.35)",
                    transform: "translateY(-1px)",
                  }}
                  _active={{ transform: "translateY(0)" }}
                  transition="all 0.2s"
                >
                  Search
                </Button>

                <Spacer />
              </Flex>

              {allAccounts.length === 0 && (
                <Text fontSize="xs" color="gray.400" mt={3}>
                  No report accounts found.
                </Text>
              )}
            </CardBody>
          </Card>

          {/* ── Comparison Summary bar ─────────────────────────────────────── */}
          <ComparisonSummary
            customerInvoices={customerInvoices}
            uploadedVendorInvoices={uploadedVendorInvoices}
            hasMismatch={mismatchedInvoices.length > 0}
            onExport={handleExport}
            onEmail={handleEmail}
            onDispute={handleDispute}
            hasExistingDispute={hasExistingDispute}
          />

          {/* ── Three invoice tables ───────────────────────────────────────── */}
          <Grid templateColumns={{ base: "1fr", lg: "1fr" }} gap={4}>
            {/* Customer Invoices */}
            {showCustomerSection && (
              <GridItem>
                <InvoiceCard
                  title="Customer Invoices"
                  badge={customerInvoices.length}
                  badgeScheme="blue"
                  subtitle={
                    selectedAccount?.customerCode
                      ? `${selectedAccount.accountName} · ${selectedAccount.customerCode}`
                      : selectedAccount
                        ? "Not configured as a customer"
                        : undefined
                  }
                  invoices={customerInvoices}
                  loading={loadingCustomer}
                  emptyLabel={
                    selectedAccount?.customerCode
                      ? "No customer invoices found."
                      : "Selected account is not a customer."
                  }
                  disputes={disputes}
                />
              </GridItem>
            )}

            {/* Vendor Invoices — Uploaded */}
            {showVendorSection && (
              <GridItem>
                <InvoiceCard
                  title="Vendor Invoices (Uploaded)"
                  badge={uploadedVendorInvoices.length}
                  badgeScheme="orange"
                  subtitle={
                    selectedAccount
                      ? `${selectedAccount.accountName} · ${selectedAccount.vendorCode || selectedAccount.vendorId}`
                      : undefined
                  }
                  invoices={uploadedVendorInvoices}
                  loading={loadingVendor}
                  emptyLabel="No uploaded vendor invoices found."
                  mismatchedInvoices={mismatchedInvoices}
                  disputes={disputes}
                />
              </GridItem>
            )}
          </Grid>

          <RaiseDisputeModal
            isOpen={isDisputeOpen}
            onClose={onDisputeClose}
            selectedAccount={selectedAccount}
            mismatchedCount={mismatchedPairCount}
            invoiceNumbers={mismatchedInvoiceNumbers}
            disputeAmount={totalDisputeAmount}
            onSuccess={fetchDisputes}
          />
        </>
      )}
    </Box>
  );
};

export default SOAPage;
