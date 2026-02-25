import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Grid,
  GridItem,
  Heading,
  Select,
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
  Spacer,
  VStack,
  HStack,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  SimpleGrid,
  Tooltip,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { FiAlertCircle, FiDownload, FiRefreshCw, FiMail } from "react-icons/fi";
import {
  fetchReportAccounts,
  fetchLiteInvoices,
  fetchVendorUsage,
} from "../utils/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (timestamp) => {
  if (!timestamp) return "N/A";
  return new Date(Number(timestamp)).toLocaleDateString("en-US", {
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

const statusColor = (status) => {
  switch (status) {
    case "paid":
      return "green";
    case "unpaid":
      return "red";
    case "partial":
      return "orange";
    case "pending":
      return "yellow";
    default:
      return "gray";
  }
};

// ─── Invoice Table ─────────────────────────────────────────────────────────────

const InvoiceTable = ({
  invoices,
  loading,
  emptyLabel = "No invoices to display.",
}) => {
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
      <Box maxH="240px" overflowY="auto">
        <Table size="sm" variant="simple">
          <Thead position="sticky" top="0" zIndex="1" bg="gray.200">
            <Tr>
              <Th color={"gray.700"} fontSize="12px">
                Invoice No.
              </Th>
              <Th color={"gray.700"} fontSize="12px">
                Invoice Date
              </Th>
              <Th color={"gray.700"} fontSize="12px">
                Billing Period
              </Th>
              <Th color={"gray.700"} fontSize="12px">
                Due Date
              </Th>
              <Th color={"gray.700"} isNumeric fontSize="12px">
                Amount
              </Th>
              <Th color={"gray.700"} isNumeric fontSize="12px">
                Balance
              </Th>
              <Th color={"gray.700"} fontSize="12px">
                Status
              </Th>
            </Tr>
          </Thead>

          <Tbody>
            {invoices.map((inv) => (
              <Tr
                key={inv.id}
                _hover={{ bg: "blue.50" }}
                transition="background 0.15s"
              >
                <Td fontWeight="medium" fontSize="sm">
                  {inv.invoiceNumber}
                </Td>
                <Td fontSize="sm">{formatDate(inv.invoiceDate)}</Td>
                <Td fontSize="sm" whiteSpace="nowrap">
                  {formatDate(inv.billingPeriodStart)} —{" "}
                  {formatDate(inv.billingPeriodEnd)}
                </Td>
                <Td fontSize="sm">{formatDate(inv.dueDate)}</Td>
                <Td isNumeric fontSize="sm">
                  ${formatAmount(inv.totalAmount)}
                </Td>
                <Td
                  isNumeric
                  fontSize="sm"
                  color={
                    parseFloat(inv.balanceAmount) > 0 ? "red.500" : "green.500"
                  }
                  fontWeight="semibold"
                >
                  ${formatAmount(inv.balanceAmount)}
                </Td>
                <Td>
                  <Badge colorScheme={statusColor(inv.status)} fontSize="12px">
                    {inv.status}
                  </Badge>
                </Td>
              </Tr>
            ))}
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

// ─── Comparison Summary Bar ────────────────────────────────────────────────────

const ComparisonSummary = ({ customerInvoices, vendorInvoices }) => {
  if (!customerInvoices.length && !vendorInvoices.length) return null;

  const customerTotal = customerInvoices.reduce(
    (s, i) => s + parseFloat(i.totalAmount || 0),
    0,
  );
  const vendorTotal = vendorInvoices.reduce(
    (s, i) => s + parseFloat(i.totalAmount || 0),
    0,
  );
  const margin = customerTotal - vendorTotal;
  const marginPct = customerTotal > 0 ? (margin / customerTotal) * 100 : 0;

  const customerCalls = customerInvoices.reduce(
    (s, i) => s + (parseInt(i.totalCalls) || 0),
    0,
  );
  const vendorCalls = vendorInvoices.reduce(
    (s, i) => s + (parseInt(i.totalCalls) || 0),
    0,
  );
  const callDiff = customerCalls - vendorCalls;

  return (
    <Card
      mb={2}
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="8px"
    >
      <CardBody py={2} px={5}>
        <Flex  gap={2} justify="space-between"  flexDirection={{base:"column",md:"row"}} >
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
          <Flex align={"center"} gap={3} flexDirection={{base:"column",md:"row"}}>
          <Button
            size="sm"
            leftIcon={<FiMail />}
            borderRadius="4px"
            bg="green.600"
            color="white"
            _hover={{ bg: "green.700" }}
            _active={{ bg: "green.800" }}
            minW="130px"
          >
            Send on Email
          </Button>
          <Button
            variant={"outline"}
            size="sm"
            colorScheme="blue"
            leftIcon={<FiDownload />}
          >
            Export
          </Button>

          <Button
            size="sm"
            leftIcon={<FiAlertCircle />}
            borderRadius="4px"
            bg="red.600"
            color="white"
            _hover={{ bg: "red.700" }}
            _active={{ bg: "red.800" }}
            minW="130px"
          >
            Raise Dispute
          </Button>
          </Flex>
          </Flex>
      </CardBody>
    </Card>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

const SOAPage = () => {
  const toast = useToast();

  const [dualAccounts, setDualAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [vendorInvoices, setVendorInvoices] = useState([]);

  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [loadingVendor, setLoadingVendor] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ── Load bilateral accounts ────────────────────────────────────────────────
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setLoadingAccounts(true);
        const response = await fetchReportAccounts();
        if (response.success) {
          const customers = response.customers || [];
          const vendors = response.vendors || [];

          const vendorMap = new Map();
          vendors.forEach((v) => vendorMap.set(v.accountName, v));

          const dual = customers
            .filter((c) => vendorMap.has(c.accountName))
            .map((c) => ({
              accountName: c.accountName,
              customerCode: c.customerCode,
              vendorCode: vendorMap.get(c.accountName).vendorCode,
            }));

          setDualAccounts(dual);
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
  }, []);

  // ── Fetch customer invoices then auto-load vendor usage ────────────────────
  const handleSearch = useCallback(async () => {
    if (!selectedAccount) return;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast({
        title: "Start date cannot be after end date",
        status: "warning",
        duration: 3000,
      });
      return;
    }

    setCustomerInvoices([]);
    setVendorInvoices([]);
    setLoadingCustomer(true);

    let fetchedInvoices = [];

    try {
      const customerRes = await fetchLiteInvoices({
        customerId: selectedAccount.customerCode,
        startDate: startDate || null,
        endDate: endDate || null,
      });

      if (customerRes.success && customerRes.data?.length) {
        fetchedInvoices = customerRes.data;
        setCustomerInvoices(fetchedInvoices);
      } else {
        toast({
          title: "No customer invoices found for this account.",
          status: "warning",
          duration: 3000,
        });
      }
    } catch {
      toast({
        title: "Error fetching customer invoices",
        status: "error",
        duration: 3000,
      });
    } finally {
      setLoadingCustomer(false);
    }

    // Auto-load vendor usage using same filtered periods
    if (fetchedInvoices.length > 0) {
      setLoadingVendor(true);
      try {
        const periods = fetchedInvoices.map((inv) => ({
          startDate: inv.billingPeriodStart,
          endDate: inv.billingPeriodEnd,
        }));

        const vendorRes = await fetchVendorUsage({
          vendorCode: selectedAccount.vendorCode,
          periods,
        });

        if (vendorRes.success) {
          setVendorInvoices(vendorRes.data || []);
        } else {
          toast({
            title: "Could not load vendor usage data.",
            status: "warning",
            duration: 3000,
          });
        }
      } catch {
        toast({
          title: "Error fetching vendor usage",
          status: "error",
          duration: 3000,
        });
      } finally {
        setLoadingVendor(false);
      }
    }
  }, [selectedAccount, startDate, endDate, toast]);

  // ── Refresh vendor usage independently (re-use same periods) ──────────────
  const handleRefreshVendor = useCallback(async () => {
    if (!selectedAccount || !customerInvoices.length) return;
    setLoadingVendor(true);
    setVendorInvoices([]);
    try {
      const periods = customerInvoices.map((inv) => ({
        startDate: inv.billingPeriodStart,
        endDate: inv.billingPeriodEnd,
      }));
      const vendorRes = await fetchVendorUsage({
        vendorCode: selectedAccount.vendorCode,
        periods,
      });
      if (vendorRes.success) setVendorInvoices(vendorRes.data || []);
    } catch {
      toast({
        title: "Error refreshing vendor usage",
        status: "error",
        duration: 3000,
      });
    } finally {
      setLoadingVendor(false);
    }
  }, [selectedAccount, customerInvoices, toast]);

  const isLoading = loadingCustomer || loadingVendor;

  return (
    <Box bg="gray.50" minH="100vh">
      {/* ── Header ── */}
      <Flex
        mb={5}
        bgGradient="linear(to-r, blue.100, blue.200, blue.300)"
        px={5}
        py={2}
        borderRadius="10px"
        align="center"
        justify="space-between"
      >
        <Box>
          <Heading size="lg" color="gray.700">
            Statement of Account
          </Heading>
          <Text fontSize="sm" color="gray.500">
            Compare customer billing vs. vendor costs for bilateral accounts
          </Text>
        </Box>
      </Flex>

      {loadingAccounts ? (
        <Flex justify="center" mt={20}>
          <Spinner size="xl" color="blue.400" />
        </Flex>
      ) : (
        <>
          {/* ── Account Selector ── */}
          <Card
            mb={3}
            bg="white"
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="8px"
          >
            <CardBody py={3}>
              <Flex align="center" gap={5} flexWrap="wrap">
                <Text
                  fontWeight="semibold"
                  color="gray.700"
                  fontSize="sm"
                  whiteSpace="nowrap"
                >
                  Bilateral Account:
                </Text>
                <Select
                  bg="gray.200"
                  borderRadius="4px"
                  maxW="350px"
                  size="sm"
                  placeholder="Select an account..."
                  onChange={(e) => {
                    const found = dualAccounts.find(
                      (a) => a.customerCode === e.target.value,
                    );
                    setSelectedAccount(found || null);
                    setCustomerInvoices([]);
                    setVendorInvoices([]);
                  }}
                >
                  {dualAccounts.map((acc) => (
                    <option key={acc.customerCode} value={acc.customerCode}>
                      {acc.accountName}
                    </option>
                  ))}
                </Select>

                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />

                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />

                <Button
                  borderRadius="4px"
                  size="sm"
                  colorScheme="blue"
                  leftIcon={<SearchIcon />}
                  onClick={handleSearch}
                  isDisabled={
                    !selectedAccount || isLoading || !startDate || !endDate
                  }
                  isLoading={isLoading}
                  loadingText="Loading..."
                  minW="100px"
                >
                  Search
                </Button>

                <Spacer />
              </Flex>

              {dualAccounts.length === 0 && (
                <Text fontSize="xs" color="gray.400" mt={2}>
                  No accounts found with both a customer and vendor code.
                </Text>
              )}
            </CardBody>
          </Card>

          {/* ── Comparison Summary ── */}
          <ComparisonSummary
            customerInvoices={customerInvoices}
            vendorInvoices={vendorInvoices}
          />

          {/* ── Side-by-side Tables ── */}
          <Grid templateColumns={"1fr"} gap={4}>
            {/* Customer Invoices */}
            <GridItem>
              <Card
                h="300px"
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="8px"
              >
                <CardHeader pb={2} borderBottom="1px" borderColor="gray.100">
                  <Flex align="center" justify="space-between">
                    <Box>
                      <Flex align="center" gap={4}>
                        <Heading size="sm">Customer Invoices</Heading>
                        {/* <Text fontSize="xs" color="gray.600" mt={0.5}> all invoices issued for selected customer will going to be displayed</Text> */}
                        {customerInvoices.length > 0 && (
                          <Badge colorScheme="blue" fontSize="10px">
                            {customerInvoices.length}
                          </Badge>
                        )}
                      </Flex>
                      {selectedAccount && (
                        <Text fontSize="xs" color="gray.600" mt={0.5}>
                          {selectedAccount.accountName} ·{" "}
                          {selectedAccount.customerCode}
                        </Text>
                      )}
                    </Box>
                  </Flex>
                </CardHeader>
                <CardBody pt={3} overflow="hidden">
                  <InvoiceTable
                    invoices={customerInvoices}
                    loading={loadingCustomer}
                    emptyLabel={
                      selectedAccount
                        ? "No customer invoices found."
                        : "Select an account and search."
                    }
                  />
                </CardBody>
              </Card>
            </GridItem>

            {/* Vendor Usage */}
            <GridItem>
              <Card
                h="300px"
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="8px"
              >
                <CardHeader pb={2} borderBottom="1px" borderColor="gray.100">
                  <Flex align="center" justify="space-between">
                    <Box>
                      <Flex align="center" gap={4}>
                        <Heading size="sm">Vendor Costs</Heading>
                        {/* <Text fontSize="xs" color="gray.600" mt={0.5}> All vendor settlement done with customer having bilateral relationship will going to be displayed</Text> */}
                        {vendorInvoices.length > 0 && (
                          <Badge colorScheme="purple" fontSize="10px">
                            {vendorInvoices.length}
                          </Badge>
                        )}
                      </Flex>
                      {selectedAccount && (
                        <Text fontSize="xs" color="gray.600" mt={0.5}>
                          {selectedAccount.accountName} ·{" "}
                          {selectedAccount.vendorCode}
                        </Text>
                      )}
                    </Box>
                    <Button
                      leftIcon={<FiRefreshCw />}
                      size="xs"
                      borderRadius="4px"
                      variant="outline"
                      colorScheme="blue"
                      onClick={handleRefreshVendor}
                      isLoading={loadingVendor}
                      isDisabled={
                        customerInvoices.length === 0 || loadingVendor
                      }
                    >
                      Refresh
                    </Button>
                  </Flex>
                </CardHeader>
                <CardBody pt={3} overflow="hidden">
                  <InvoiceTable
                    invoices={vendorInvoices}
                    loading={loadingVendor}
                    emptyLabel={
                      customerInvoices.length === 0
                        ? "Load customer invoices first."
                        : "No vendor usage data found."
                    }
                  />
                </CardBody>
              </Card>
            </GridItem>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default SOAPage;
