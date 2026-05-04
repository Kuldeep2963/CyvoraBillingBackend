import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Flex,
  Grid,
  GridItem,
  Heading,
  Icon,
  Spinner,
  Text,
} from "@chakra-ui/react";
import useNotify from "../utils/notify";
import { SearchIcon } from "@chakra-ui/icons";
import { MemoizedSelect as Select } from "../components/memoizedinput/memoizedinput";
import DateRangePicker from "../components/formats/DateRangepicker";
import PageNavBar from "../components/PageNavBar";
import { fetchAccountExposure, fetchReportAccounts } from "../utils/api";

// ─── Formatters ──────────────────────────────────────────────────────────────

const formatAmount = (amount) =>
  Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
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

const formatDuration = (seconds) => {
  const total = Number(seconds || 0);
  if (!total) return "0m";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({ label, value, color, help }) => (
  <Card
    bg="white"
    borderWidth="0.5px"
    borderColor="gray.200"
    borderRadius="10px"
    boxShadow="none"
  >
    <CardBody px={5} py={4}>
      <Text
        fontSize="10px"
        fontWeight="600"
        textTransform="uppercase"
        letterSpacing="0.07em"
        color="gray.500"
        mb={2}
      >
        {label}
      </Text>
      <Text fontSize="xl" fontWeight="500" color={color} fontVariantNumeric="tabular-nums">
        ${formatAmount(value)}
      </Text>
      {help && (
        <Text fontSize="11px" color="gray.400" mt={1}>
          {help}
        </Text>
      )}
    </CardBody>
  </Card>
);

const MetricItem = ({ label, value }) => (
  <Box>
    <Text
      fontSize="10px"
      fontWeight="600"
      textTransform="uppercase"
      letterSpacing="0.06em"
      color="gray.400"
      mb={1}
    >
      {label}
    </Text>
    <Text fontSize="15px" fontWeight="500" color="gray.800" fontVariantNumeric="tabular-nums">
      {value}
    </Text>
  </Box>
);

const MetricsCard = ({ title, metrics, badgeText }) => (
  <Card
    bg="white"
    borderWidth="0.5px"
    borderColor="gray.200"
    borderRadius="10px"
    boxShadow="none"
    h="100%"
  >
    <CardHeader px={5} py={3} borderBottomWidth="0.5px" borderColor="gray.100">
      <Flex align="center" justify="space-between">
        <Text fontSize="13px" fontWeight="500" color="gray.700">
          {title}
        </Text>
        <Badge
          bg="gray.100"
          color="gray.500"
          fontSize="12px"
          fontWeight="500"
          px={2}
          py="2px"
          borderRadius="full"
          textTransform="none"
          letterSpacing="0"
        >
          {badgeText}
        </Badge>
      </Flex>
    </CardHeader>
    <CardBody px={5} py={4}>
      <Grid templateColumns="repeat(4, 1fr)" gap={4}>
        <MetricItem label="Attempts" value={Number(metrics?.attempts || 0).toLocaleString()} />
        <MetricItem label="Completed" value={Number(metrics?.completed || 0).toLocaleString()} />
        <MetricItem label="Failed" value={Number(metrics?.failed || 0).toLocaleString()} />
        <MetricItem label="Duration" value={formatDuration(metrics?.duration || 0)} />
      </Grid>
    </CardBody>
  </Card>
);

const EmptyState = () => (
  <Card
    bg="gray.50"
    borderWidth="0.5px"
    borderColor="gray.200"
    borderRadius="10px"
    boxShadow="none"
  >
    <CardBody px={6} py={10} textAlign="center">
      <Box mb={3} color="gray.300">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: "inline-block" }}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      </Box>
      <Text fontSize="13px" color="gray.400" maxW="340px" mx="auto" lineHeight="1.7">
        Select an account and date range, then click Calculate to view exposure from CDR records.
      </Text>
    </CardBody>
  </Card>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const AccountExposure = () => {
  const toast = useNotify();
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [selectedAccountKey, setSelectedAccountKey] = useState("");
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [startDate, setStartDate] = useState(formatDateToYMD(yesterday));
  const [endDate, setEndDate] = useState(formatDateToYMD(today));
  const [loadingExposure, setLoadingExposure] = useState(false);
  const [exposure, setExposure] = useState(null);

  const loadAccounts = useCallback(async () => {
    try {
      setLoadingAccounts(true);
      const response = await fetchReportAccounts();
      if (!response?.success) throw new Error("Failed to load accounts");

      const customers = Array.isArray(response.customers) ? response.customers : [];
      const vendors = Array.isArray(response.vendors) ? response.vendors : [];
      const byName = new Map();

      customers.forEach((acc) => {
        if (!byName.has(acc.accountName)) {
          byName.set(acc.accountName, {
            accountName: acc.accountName,
            accountId: acc.accountId,
            id: acc.id,
            ownerName: acc.ownerName,
            customerCode: acc.customerCode || null,
            vendorCode: null,
            customerRole: true,
            vendorRole: false,
          });
        } else {
          const existing = byName.get(acc.accountName);
          existing.customerCode = acc.customerCode || existing.customerCode;
          existing.customerRole = true;
        }
      });

      vendors.forEach((acc) => {
        if (!byName.has(acc.accountName)) {
          byName.set(acc.accountName, {
            accountName: acc.accountName,
            accountId: acc.accountId,
            id: acc.id,
            ownerName: acc.ownerName,
            customerCode: null,
            vendorCode: acc.vendorCode || null,
            customerRole: false,
            vendorRole: true,
          });
        } else {
          const existing = byName.get(acc.accountName);
          existing.vendorCode = acc.vendorCode || existing.vendorCode;
          existing.vendorRole = true;
          if (!existing.id) existing.id = acc.id;
          if (!existing.accountId) existing.accountId = acc.accountId;
          if (!existing.ownerName) existing.ownerName = acc.ownerName;
        }
      });

      const merged = Array.from(byName.values()).sort((a, b) =>
        a.accountName.localeCompare(b.accountName)
      );
      setAccounts(merged);
    } catch (error) {
      toast({
        title: "Error loading accounts",
        description: error.message,
        status: "error",
        duration: 3500,
        isClosable: true,
      });
    } finally {
      setLoadingAccounts(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleAccountChange = (event) => {
    const key = event.target.value;
    setSelectedAccountKey(key);
    const account =
      accounts.find((a) => `${a.accountName}|${a.accountId || ""}` === key) || null;
    setSelectedAccount(account);
    setExposure(null);
  };

  const handleSearch = async () => {
    if (!selectedAccount) return;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast({
        title: "Invalid date range",
        description: "Start date cannot be after end date",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setLoadingExposure(true);
      const result = await fetchAccountExposure({
        accountId: selectedAccount.id || selectedAccount.accountId || selectedAccount.accountName,
        account: selectedAccount,
        startDate: startDate || null,
        endDate: endDate || null,
      });

      if (!result?.success) throw new Error(result?.error || "Failed to fetch account exposure");
      setExposure(result);
    } catch (error) {
      setExposure(null);
      toast({
        title: "Failed to load account exposure",
        description: error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setLoadingExposure(false);
    }
  };

  const netBadge = useMemo(() => {
    const pos = exposure?.summary?.netPosition;
    if (pos === "receivable") return { text: "Net Receivable", colorScheme: "green" };
    if (pos === "payable") return { text: "Net Payable", colorScheme: "red" };
    return { text: "Balanced", colorScheme: "gray" };
  }, [exposure]);

  const breakdown = useMemo(() => {
    const customerExpense = Number(exposure?.summary?.customerExpense || 0);
    const vendorExpense = Number(exposure?.summary?.vendorExpense || 0);
    const diff = Math.abs(customerExpense - vendorExpense);
    return {
      customerExpense,
      vendorExpense,
      totalReceivable: customerExpense > vendorExpense ? diff : 0,
      totalPayable: vendorExpense > customerExpense ? diff : 0,
      netAmount: customerExpense - vendorExpense,
    };
  }, [exposure]);

  // Semantic color maps — no funky accents
  const netAmountColor =
    breakdown.netAmount >= 0 ? "green.700" : "red.600";

  return (
    <Box>
      <PageNavBar
        title="Account Exposure"
        description="CDR-based customer and vendor exposure summary"
        mb={5}
      />

      {loadingAccounts ? (
        <Flex justify="center" mt={20}>
          <Spinner size="lg" color="gray.400" thickness="2px" />
        </Flex>
      ) : (
        <>
          {/* ── Filter Bar ── */}
          <Card
            mb={4}
            bg="white"
            borderWidth="0.5px"
            borderColor="gray.200"
            borderRadius="10px"
            boxShadow="none"
          >
            <CardBody py={3} px={5}>
              <Flex align="center" gap={3} flexWrap="wrap">
                <Text
                  fontSize="10px"
                  fontWeight="600"
                  color="gray.400"
                  textTransform="uppercase"
                  letterSpacing="0.07em"
                  whiteSpace="nowrap"
                >
                  Account
                </Text>

                <Select
                  placeholder="Select an account..."
                  borderWidth="0.5px"
                  borderColor="gray.200"
                  bg="gray.50"
                  _hover={{ borderColor: "gray.300" }}
                  _focus={{ borderColor: "gray.400", boxShadow: "none" }}
                  borderRadius="8px"
                  fontSize="13px"
                  height="34px"
                  minW="220px"
                  maxW="360px"
                  flex="1"
                  onChange={handleAccountChange}
                  value={selectedAccountKey}
                >
                  {accounts.map((acc) => {
                    const roleLabel =
                      acc.customerRole && acc.vendorRole
                        ? "Bilateral"
                        : acc.vendorRole
                        ? "Vendor"
                        : "Customer";
                    const value = `${acc.accountName}|${acc.accountId || ""}`;
                    return (
                      <option key={value} value={value}>
                        {acc.accountName} ({roleLabel})
                      </option>
                    );
                  })}
                </Select>

                <DateRangePicker
                  value={{
                    startDate: parseDateString(startDate),
                    endDate: parseDateString(endDate),
                  }}
                  onChange={(range) => {
                    setStartDate(formatDateToYMD(range?.startDate));
                    setEndDate(formatDateToYMD(range?.endDate));
                    setExposure(null);
                  }}
                  placeholder="Select date range"
                  inputProps={{ minW: "220px", maxW: "300px", size: "sm" }}
                />

                <Button
                  size="sm"
                  bg="blue.500"
                  color="white"
                  _hover={{ bg: "blue.600" }}
                  _active={{ bg: "blue.700" }}
                  leftIcon={<SearchIcon boxSize="11px" />}
                  onClick={handleSearch}
                  isDisabled={!selectedAccount || loadingExposure}
                  isLoading={loadingExposure}
                  loadingText="Calculating"
                  height="34px"
                  px={5}
                  borderRadius="8px"
                  fontWeight="500"
                  fontSize="13px"
                  boxShadow="none"
                >
                  Calculate
                </Button>
              </Flex>
            </CardBody>
          </Card>

          {exposure ? (
            <>
              {/* ── Account Header ── */}
              <Card
                mb={3}
                bg="gray.50"
                borderWidth="0.5px"
                borderColor="gray.200"
                borderRadius="10px"
                boxShadow="none"
              >
                <CardBody py={3} px={5}>
                  <Flex
                    align={{ base: "start", md: "center" }}
                    justify="space-between"
                    gap={3}
                    flexDirection={{ base: "column", md: "row" }}
                  >
                    <Box>
                      <Text fontSize="14px" fontWeight="500" color="gray.800">
                        {exposure.account?.accountName}
                      </Text>
                      <Text fontSize="11px" color="gray.400" mt="2px">
                        {exposure?.dateRange?.startDate || exposure?.dateRange?.endDate
                          ? `Snapshot from ${exposure?.dateRange?.startDate || "beginning"} to ${exposure?.dateRange?.endDate || "today"}`
                          : "Snapshot up to current time from CDR traffic"}
                      </Text>
                    </Box>
                    <Badge
                      colorScheme={netBadge.colorScheme}
                      fontSize="12px"
                      fontWeight="500"
                      px={3}
                      py={1}
                      borderRadius="full"
                      textTransform="none"
                    >
                      {netBadge.text}
                    </Badge>
                  </Flex>
                </CardBody>
              </Card>

              {/* ── Stat Cards ── */}
              <Grid
                templateColumns={{
                  base: "1fr",
                  md: "1fr 1fr",
                  xl: "repeat(3, 1fr)",
                }}
                gap={3}
                mb={3}
              >
                <StatCard
                  label="Customer Expense"
                  value={breakdown.customerExpense}
                  color="blue.700"
                  help="Revenue from customer-side CDR"
                />
                <StatCard
                  label="Vendor Expense"
                  value={breakdown.vendorExpense}
                  color="purple.700"
                  help="Cost from vendor-side CDR"
                />
                {netBadge.colorScheme === "green" && (
                  <StatCard
                    label="Total Receivable"
                    value={breakdown.totalReceivable}
                    color="green.700"
                    help="Customer expense exceeds vendor expense"
                  />
                )}
                {netBadge.colorScheme === "red" && (
                  <StatCard
                    label="Total Payable"
                    value={breakdown.totalPayable}
                    color="red.600"
                    help="Vendor expense exceeds customer expense"
                  />
                )}
                {netBadge.colorScheme === "gray" && (
                  <StatCard
                    label="Net Difference"
                    value={0}
                    color="gray.600"
                    help="Customer and vendor expenses are equal"
                  />
                )}
              </Grid>

              {/* ── Net Exposure Bar ── */}
              <Card
                mb={3}
                bg="white"
                borderWidth="0.5px"
                borderColor="gray.200"
                borderRadius="10px"
                boxShadow="none"
              >
                <CardBody py={4} px={5}>
                  <Flex align="center" justify="space-between">
                    <Text
                      fontSize="12px"
                      fontWeight="600"
                      textTransform="uppercase"
                      letterSpacing="0.07em"
                      color="gray.400"
                    >
                      Net Exposure
                    </Text>
                    <Text
                      fontSize="xl"
                      fontWeight="500"
                      color={netAmountColor}
                      fontVariantNumeric="tabular-nums"
                    >
                      ${formatAmount(Math.abs(breakdown.netAmount))}
                    </Text>
                  </Flex>
                </CardBody>
              </Card>

              {/* ── Metrics Cards ── */}
              <Grid templateColumns={{ base: "1fr", xl: "1fr 1fr" }} gap={3}>
                <GridItem>
                  <MetricsCard
                    title="Customer Metrics"
                    metrics={exposure.customerMetrics}
                    badgeText="Receivable side"
                  />
                </GridItem>
                <GridItem>
                  <MetricsCard
                    title="Vendor Metrics"
                    metrics={exposure.vendorMetrics}
                    badgeText="Payable side"
                  />
                </GridItem>
              </Grid>
            </>
          ) : (
            <EmptyState />
          )}
        </>
      )}
    </Box>
  );
};

export default AccountExposure;