import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Grid,
  GridItem,
  Heading,
  Spinner,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Text,
  useToast,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { MemoizedSelect as Select } from "../components/memoizedinput/memoizedinput";
import DateRangePicker from "../components/formats/DateRangepicker";
import PageNavBar from "../components/PageNavBar";
import { fetchAccountExposure, fetchReportAccounts } from "../utils/api";

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

const ExposureStatCard = ({ label, value, color = "gray.800", help }) => (
  <Card borderWidth="1px" borderColor="gray.200" borderRadius="10px">
    <CardBody>
      <Stat>
        <StatLabel color="gray.600" fontWeight="semibold" fontSize="12px" textTransform="uppercase" letterSpacing="0.04em">
          {label}
        </StatLabel>
        <StatNumber color={color} fontSize={{ base: "xl", md: "2xl" }}>
          ${formatAmount(value)}
        </StatNumber>
        {help ? <StatHelpText mb={0}>{help}</StatHelpText> : null}
      </Stat>
    </CardBody>
  </Card>
);

const MetricsCard = ({ title, metrics, badgeText, badgeScheme }) => (
  <Card borderWidth="1px" borderColor="gray.200" borderRadius="10px" h="100%">
    <CardHeader pb={2}>
      <Flex align="center" justify="space-between">
        <Heading size="sm">{title}</Heading>
        <Badge colorScheme={badgeScheme}>{badgeText}</Badge>
      </Flex>
    </CardHeader>
    <CardBody pt={2}>
      <Grid templateColumns="repeat(4, minmax(0,1fr))" gap={4}>
        <Box>
          <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="0.04em">Attempts</Text>
          <Text fontSize="lg" fontWeight="bold">{Number(metrics?.attempts || 0).toLocaleString()}</Text>
        </Box>
        <Box>
          <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="0.04em">Completed</Text>
          <Text fontSize="lg" fontWeight="bold">{Number(metrics?.completed || 0).toLocaleString()}</Text>
        </Box>
        <Box>
          <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="0.04em">Failed</Text>
          <Text fontSize="lg" fontWeight="bold">{Number(metrics?.failed || 0).toLocaleString()}</Text>
        </Box>
        <Box>
          <Text fontSize="xs" color="gray.600" textTransform="uppercase" letterSpacing="0.04em">Duration</Text>
          <Text fontSize="lg" fontWeight="bold">{formatDuration(metrics?.duration || 0)}</Text>
        </Box>
      </Grid>
    </CardBody>
  </Card>
);

const AccountExposure = () => {
  const toast = useToast();
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
      if (!response?.success) {
        throw new Error("Failed to load accounts");
      }

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
        a.accountName.localeCompare(b.accountName),
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
    const account = accounts.find((a) => `${a.accountName}|${a.accountId || ""}` === key) || null;
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

      if (!result?.success) {
        throw new Error(result?.error || "Failed to fetch account exposure");
      }

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
    const netPosition = exposure?.summary?.netPosition;
    if (netPosition === "receivable") return { text: "Net Receivable", scheme: "green" };
    if (netPosition === "payable") return { text: "Net Payable", scheme: "red" };
    return { text: "Balanced", scheme: "gray" };
  }, [exposure]);

  const exposureBreakdown = useMemo(() => {
    const customerExpense = Number(exposure?.summary?.customerExpense || 0);
    const vendorExpense = Number(exposure?.summary?.vendorExpense || 0);
    const difference = Math.abs(customerExpense - vendorExpense);

    return {
      customerExpense,
      vendorExpense,
      totalReceivable: customerExpense > vendorExpense ? difference : 0,
      totalPayable: vendorExpense > customerExpense ? difference : 0,
      netAmount: customerExpense - vendorExpense,
    };
  }, [exposure]);

  return (
    <Box>
      <PageNavBar
      
        title="Account Exposure"
        description="Account exposure from CDR totals (till now)"
        mb={5}
      />

      {loadingAccounts ? (
        <Flex justify="center" mt={20}>
          <Spinner size="xl" color="blue.400" />
        </Flex>
      ) : (
        <>
          <Card
            mb={4}
            bg="white"
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="12px"
            borderLeft="3px solid"
            borderLeftColor="blue.400"
          >
            <CardBody py={4} px={5}>
              <Flex align="center" gap={3} flexWrap="wrap">
                <Text fontWeight="700" color="gray.600" fontSize="13px" whiteSpace="nowrap">
                  Account:
                </Text>

                <Select
                  placeholder="Select an account..."
                  border="1.5px solid"
                  minW="260px"
                  maxW="420px"
                  flex="1"
                  height="35px"
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
                  inputProps={{ minW: "260px", maxW: "320px", size: "sm" }}
                />

                <Button
                  size="sm"
                  colorScheme="blue"
                  leftIcon={<SearchIcon boxSize={3} />}
                  onClick={handleSearch}
                  isDisabled={!selectedAccount || loadingExposure}
                  isLoading={loadingExposure}
                  loadingText="Calculating"
                  minW="120px"
                  height="36px"
                  borderRadius="8px"
                  fontWeight="600"
                  fontSize="13px"
                >
                  Calculate
                </Button>
              </Flex>

              {!accounts.length ? (
                <Text fontSize="xs" color="gray.500" mt={3}>
                  No active accounts found.
                </Text>
              ) : null}
            </CardBody>
          </Card>

          {exposure ? (
            <>
              <Card mb={4} borderWidth="1px" borderColor="gray.200" borderRadius="10px">
                <CardBody py={3}>
                  <Flex align={{ base: "start", md: "center" }} justify="space-between" gap={3} flexDirection={{ base: "column", md: "row" }}>
                    <Box>
                      <Heading size="sm">{exposure.account?.accountName}</Heading>
                      <Text fontSize="xs" color="gray.600" mt={1}>
                        {exposure?.dateRange?.startDate || exposure?.dateRange?.endDate
                          ? `Snapshot from ${exposure?.dateRange?.startDate || "beginning"} to ${exposure?.dateRange?.endDate || "today"}`
                          : "Snapshot up to current time from CDR traffic"}
                      </Text>
                    </Box>
                    <Badge colorScheme={netBadge.scheme} fontSize="11px" px={2} py={1} borderRadius="6px">
                      {netBadge.text}
                    </Badge>
                  </Flex>
                </CardBody>
              </Card>

              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr", xl: netBadge.scheme === "red" ? "repeat(3, 1fr)" : netBadge.scheme === "green" ? "repeat(3, 1fr)" : "repeat(2, 1fr)" }} gap={4} mb={4}>
                <GridItem>
                  <ExposureStatCard
                    label="Customer Expense"
                      value={exposureBreakdown.customerExpense}
                    color="blue.600"
                    help="Derived from customer-side CDR revenue"
                  />
                </GridItem>
                <GridItem>
                  <ExposureStatCard
                    label="Vendor Expense"
                      value={exposureBreakdown.vendorExpense}
                    color="purple.600"
                    help="Derived from vendor-side CDR cost"
                  />
                </GridItem>
                {netBadge.scheme === "green" && (
                  <GridItem>
                    <ExposureStatCard
                      label="Total Receivable"
                        value={exposureBreakdown.totalReceivable}
                      color="green.600"
                        help="Customer expense is higher than vendor expense"
                    />
                  </GridItem>
                )}
                {netBadge.scheme === "red" && (
                  <GridItem>
                    <ExposureStatCard
                      label="Total Payable"
                        value={exposureBreakdown.totalPayable}
                      color="red.600"
                        help="Vendor expense is higher than customer expense"
                    />
                  </GridItem>
                )}
              </Grid>

              <Card mb={4} borderWidth="1px" borderColor="gray.200" borderRadius="10px">
                <CardBody>
                  <Flex align="center" justify="space-between">
                    <Text fontSize="sm" color="gray.600" textTransform="uppercase" letterSpacing="0.05em">
                      Net Exposure
                    </Text>
                    <Text
                      fontSize="2xl"
                      fontWeight="extrabold"
                      color={
                        Number(exposureBreakdown.netAmount || 0) >= 0
                          ? "green.600"
                          : "red.600"
                      }
                    >
                      ${formatAmount(Math.abs(exposureBreakdown.netAmount || 0))}
                    </Text>
                  </Flex>
                </CardBody>
              </Card>

              <Grid templateColumns={{ base: "1fr", xl: "1fr 1fr" }} gap={4}>
                <GridItem>
                  <MetricsCard
                    title="Customer Side Metrics"
                    metrics={exposure.customerMetrics}
                    badgeText="Receivable Side"
                    badgeScheme="blue"
                  />
                </GridItem>
                <GridItem>
                  <MetricsCard
                    title="Vendor Side Metrics"
                    metrics={exposure.vendorMetrics}
                    badgeText="Payable Side"
                    badgeScheme="purple"
                  />
                </GridItem>
              </Grid>
            </>
          ) : (
            <Card borderWidth="1px" borderColor="gray.200" borderRadius="10px">
              <CardBody>
                <Text fontSize="sm" color="gray.500">
                  Select an account and click Calculate to view vendor expense, customer expense, total payable, and total receivable from CDR data till now.
                </Text>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </Box>
  );
};

export default AccountExposure;
