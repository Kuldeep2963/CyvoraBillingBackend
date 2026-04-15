import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Container,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  Text,
  useToast,
  VStack,
  HStack,
  Alert,
  AlertIcon,
  Spinner,
  Badge,
  Divider,
  Icon,
  Flex,
  SimpleGrid,
  useColorModeValue,
} from "@chakra-ui/react";
import { MemoizedInput as Input, MemoizedSelect as Select } from "../components/memoizedinput/memoizedinput";
import {
  FiDownload,
  FiClock,
  FiFilter,
  FiCalendar,
  FiUsers,
  FiDatabase,
  FiAlertCircle,
} from "react-icons/fi";
import PageNavBar from "../components/PageNavBar";
import { downloadCDRCSV, fetchReportAccounts } from "../utils/api";
import { fromDateTimeUtcInput, toDateTimeUtcInput } from "../utils/dateInput";

// ─── Component ──────────────────────────────────────────────────────────────

const AdminCDRDownload = () => {
  const toast = useToast();

  // Initialise once — useMemo with [] only runs on mount, which is correct here.
  const now = useMemo(() => new Date(), []);
  const oneDayBack = useMemo(() => new Date(now.getTime() -   60 * 1000), [now]);

  const [startTime, setStartTime] = useState(() => toDateTimeUtcInput(oneDayBack));
  const [endTime, setEndTime] = useState(() => toDateTimeUtcInput(now));
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [cdrSide, setCdrSide] = useState("all");
  const [customerOptions, setCustomerOptions] = useState([]);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // ── Color mode ────────────────────────────────────────────────────────────
  // useColorModeValue must be called unconditionally at the top level.
  // Previously some calls were inlined inside JSX (e.g. inside Alert's bg prop)
  // which breaks the Rules of Hooks when the component re-renders conditionally.
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const statBg = useColorModeValue("gray.50", "gray.700");

  // ── Load accounts ─────────────────────────────────────────────────────────
  // Wrapped in useCallback so the effect dependency array is stable if the
  // toast reference changes (Chakra's toast is stable, but this is a safe pattern).
  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const data = await fetchReportAccounts();

      // Support both API shapes:
      // 1) { customers: [...], vendors: [...] }
      // 2) [ { ...account, accountRole }, ... ] or { accounts: [...] }
      const splitCustomers = Array.isArray(data?.customers) ? data.customers : null;
      const splitVendors = Array.isArray(data?.vendors) ? data.vendors : null;
      const flatAccounts = Array.isArray(data)
        ? data
        : Array.isArray(data?.accounts)
          ? data.accounts
          : null;

      const dedupeById = (items) => {
        const seen = new Set();
        return (Array.isArray(items) ? items : []).filter((account) => {
          const key = String(account?.id ?? account?.accountId ?? '');
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      if (flatAccounts) {
        const normalized = flatAccounts.map((account) => ({
          ...account,
          accountRole: String(account?.accountRole || '').toLowerCase(),
        }));

        const customers = normalized.filter((a) =>
          ['customer', 'both'].includes(a.accountRole)
        );
        const vendors = normalized.filter((a) =>
          ['vendor', 'both'].includes(a.accountRole)
        );

        setCustomerOptions(dedupeById(customers));
        setVendorOptions(dedupeById(vendors));
      } else {
        setCustomerOptions(dedupeById(splitCustomers || []));
        setVendorOptions(dedupeById(splitVendors || []));
      }
    } catch (error) {
      toast({
        title: "Failed to load accounts",
        description: error?.message || "Could not load account list for filtering.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setAccountsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const accountOptions = useMemo(() => {
    if (cdrSide === "customer") return customerOptions;
    if (cdrSide === "vendor") return vendorOptions;

    const merged = [...customerOptions, ...vendorOptions];
    const seen = new Set();
    return merged.filter((account) => {
      const key = String(account.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [cdrSide, customerOptions, vendorOptions]);

  useEffect(() => {
    if (selectedAccountId === "all") return;
    const stillAvailable = accountOptions.some((acc) => String(acc.id) === selectedAccountId);
    if (!stillAvailable) {
      setSelectedAccountId("all");
    }
  }, [accountOptions, selectedAccountId]);

  // ── Download handler ───────────────────────────────────────────────────────
  const handleDownload = async () => {
    // Guard: both fields must be filled
    if (!startTime || !endTime) {
      toast({
        title: "Missing date range",
        description: "Please choose both start and end date/time.",
        status: "warning",
        duration: 3500,
        isClosable: true,
      });
      return;
    }

    const startMs = fromDateTimeUtcInput(startTime);
    const endMs = fromDateTimeUtcInput(endTime);

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      toast({
        title: "Invalid date range",
        description: "Please provide valid start and end date/time values.",
        status: "error",
        duration: 3500,
        isClosable: true,
      });
      return;
    }

    if (startMs >= endMs) {
      // Fixed: previously only checked >, allowing equal timestamps (0-duration range)
      toast({
        title: "Invalid date range",
        description: "Start time must be before end time.",
        status: "error",
        duration: 3500,
        isClosable: true,
      });
      return;
    }

    setDownloading(true);
    try {
      await downloadCDRCSV({
        startTime: new Date(startMs).toISOString(),
        endTime: new Date(endMs).toISOString(),
        // Only pass accountId when a specific account is selected
        accountId: selectedAccountId !== "all" ? selectedAccountId : undefined,
        cdrSide,
      });
      toast({
        title: "Download started",
        description: "The CDR CSV file is being downloaded.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: error?.message || "Failed to download CDR CSV.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setDownloading(false);
    }
  };

  // ── Derived display values ────────────────────────────────────────────────
  const dateRangeInfo = useMemo(() => {
    if (!startTime || !endTime) return "Not selected";
    const start = new Date(`${startTime}:00Z`);
    const end = new Date(`${endTime}:00Z`);
    if (isNaN(start) || isNaN(end) || end <= start) return "Invalid range";
    const diffHours = (end - start) / 36e5;
    const diffDays = diffHours / 24;
    return diffDays >= 1
      ? `${diffDays.toFixed(1)} days`
      : `${diffHours.toFixed(1)} hours`;
  }, [startTime, endTime]);

  const selectedAccountName = useMemo(() => {
    if (selectedAccountId === "all") return "All Accounts";
    const account = accountOptions.find(
      (acc) => String(acc.id) === selectedAccountId
    );
    return account?.accountName ?? "Selected Account";
  }, [selectedAccountId, accountOptions]);

  const cdrTypeLabel = useMemo(() => {
    if (cdrSide === "all") return "All CDRs";
    return `${cdrSide.charAt(0).toUpperCase()}${cdrSide.slice(1)} CDRs`;
  }, [cdrSide]);

  const cdrTypeSubLabel = useMemo(() => {
    if (cdrSide === "all") return "Customer & Vendor records";
    return "Filtered records";
  }, [cdrSide]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box minH="calc(100vh - 2rem)">
      <VStack spacing={6} align="stretch" >
        <PageNavBar
          title="CDR Download"
          description="Downloading CDR records within a selected time period"
        />

          <VStack spacing={4} align="stretch">

            {/* ── Quick Stats Cards ─────────────────────────────────────── */}
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              {/* Duration */}
              <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} shadow="sm" borderRadius={"12px"}>
                <CardBody px={4} py={2}>
                  <HStack spacing={4}>
                    <Icon as={FiClock} boxSize={6} color="blue.500" />
                    <Box>
                      <Text fontSize="sm" color="gray.500" fontWeight="medium">
                        Selected Duration
                      </Text>
                      <Text color={"gray.600"} fontSize="lg" fontWeight="bold">
                        {dateRangeInfo}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        Total time range
                      </Text>
                    </Box>
                  </HStack>
                </CardBody>
              </Card>

              {/* Account Filter */}
              <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} shadow="sm" borderRadius={"12px"}>
                <CardBody px={4} py={2}>
                  <HStack spacing={4}>
                    <Icon as={FiUsers} boxSize={6} color="green.500" />
                    <Box minW={0} flex={1}>
                      <Text fontSize="sm" color="gray.500" fontWeight="medium">
                        Account Filter
                      </Text>
                      {/* noOfLines prevents layout-breaking overflow on long names */}
                      <Text fontSize="lg" color="gray.600" fontWeight="bold" noOfLines={1}>
                        {selectedAccountName}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {accountOptions.length} total accounts available
                      </Text>
                    </Box>
                  </HStack>
                </CardBody>
              </Card>

              {/* CDR Type */}
              <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} shadow="sm" borderRadius={"12px"}>
                <CardBody px={4} py={2}>
                  <HStack spacing={4}>
                    <Icon as={FiDatabase} boxSize={6} color="purple.500" />
                    <Box>
                      <Text fontSize="sm" color="gray.500" fontWeight="medium">
                        CDR Type
                      </Text>
                      <Text fontSize="lg" color={"gray.600"} fontWeight="bold">
                        {cdrTypeLabel}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {cdrTypeSubLabel}
                      </Text>
                    </Box>
                  </HStack>
                </CardBody>
              </Card>
            </SimpleGrid>

            {/* ── Main Form Card ────────────────────────────────────────── */}
            <Card
              borderWidth="1px"
              borderColor={borderColor}
              shadow="md"
              bg={cardBg}
              transition="all 0.2s"
              _hover={{ shadow: "lg" }}
            >
              <CardHeader py={3} borderBottomWidth="1px" borderColor={borderColor}>
                <Flex align="center" justify="space-between" wrap="wrap" gap={3}>
                  <HStack spacing={3}>
                    
                    <Badge colorScheme="blue" fontSize="xs" px={2} py={1} borderRadius="full">
                      Admin Only
                    </Badge>
                  </HStack>
                  {/* <Text fontSize="sm" color="gray.500">
                    Configure your export parameters below
                  </Text> */}
                </Flex>
              </CardHeader>

              <CardBody>
                <VStack spacing={6} align="stretch">
                  <Grid
                    templateColumns={{ base: "1fr", md: "repeat(4, 1fr)" }}
                    gap={6}
                  >
                    {/* CDR Type selector */}
                    <GridItem>
                      <FormControl>
                        <FormLabel
                          color={"gray.600"}                          
                          display="flex"
                          alignItems="center"
                          gap={2}

                        >
                          <Icon as={FiDatabase} boxSize={4} />
                          CDR Type
                        </FormLabel>
                        <Select
                          value={cdrSide}
                          onChange={(e) => setCdrSide(e.target.value)}
                          size="md"
                          borderRadius="md"
                          _focus={{
                            borderColor: "blue.500",
                            boxShadow: "0 0 0 1px #3182ce",
                          }}
                        >
                          <option value="all">All CDRs (Both Sides)</option>
                          <option value="customer">Customer CDRs Only</option>
                          <option value="vendor">Vendor CDRs Only</option>
                        </Select>
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          {cdrSide === "all"
                            ? "Includes both customer and vendor call records"
                            : `Export only ${cdrSide} call records`}
                        </Text>
                      </FormControl>
                    </GridItem>

                    {/* Account selector */}
                    <GridItem>
                      <FormControl>
                        <FormLabel
                                                    color={"gray.600"}                          

                          display="flex"
                          alignItems="center"
                          gap={2}
                        >
                          <Icon as={FiUsers} boxSize={4} />
                          Account
                        </FormLabel>
                        {accountsLoading ? (
                          <Box
                            h="48px"
                            display="flex"
                            alignItems="center"
                            bg={statBg}
                            px={4}
                            borderRadius="md"
                          >
                            <Spinner size="sm" color="blue.500" />
                            <Text ml={3} fontSize="sm" color="gray.600">
                              Loading accounts…
                            </Text>
                          </Box>
                        ) : (
                          <Select
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            size="md"
                            borderRadius="md"
                            _focus={{
                              borderColor: "blue.500",
                              boxShadow: "0 0 0 1px #3182ce",
                            }}
                          >
                            <option value="all">All Accounts</option>
                            {accountOptions.map((account) => (
                              <option key={account.id} value={String(account.id)}>
                                {account.accountName} ({account.accountRole})
                              </option>
                            ))}
                          </Select>
                        )}
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          {accountOptions.length} accounts available for filtering
                        </Text>
                      </FormControl>
                    </GridItem>

                    {/* Start datetime */}
                    <GridItem>
                      <FormControl isRequired>
                        <FormLabel
                                                   color={"gray.600"}                          

                          display="flex"
                          alignItems="center"
                          gap={2}
                        >
                          <Icon as={FiCalendar} boxSize={4} />
                          Start Date and Time (UTC)
                        </FormLabel>
                        <Input
                          type="datetime-local"
                          value={startTime}
                          max={endTime || undefined}
                          onChange={(e) => setStartTime(e.target.value)}
                          size="md"
                          borderRadius="md"
                        />
                      </FormControl>
                    </GridItem>

                    {/* End datetime */}
                    <GridItem>
                      <FormControl isRequired>
                        <FormLabel
                                                    color={"gray.600"}                          

                          display="flex"
                          alignItems="center"
                          gap={2}
                        >
                          <Icon as={FiClock} boxSize={4} />
                          End Date and Time (UTC)
                        </FormLabel>
                        <Input
                          type="datetime-local"
                          value={endTime}
                          min={startTime || undefined}
                          onChange={(e) => setEndTime(e.target.value)}
                          size="md"
                          borderRadius="md"
                        />
                      </FormControl>
                    </GridItem>
                  </Grid>


                  
                  {/* Action */}
                  <Flex justify="flex-end">
                    <Button
                      leftIcon={<FiDownload />}
                      colorScheme="blue"
                      size="md"
                      onClick={handleDownload}
                      isLoading={downloading}
                      loadingText="Preparing CSV…"
                      isDisabled={accountsLoading}
                      px={8}
                      fontWeight="medium"
                      shadow="sm"
                      _hover={{ transform: "translateY(-1px)", shadow: "md" }}
                      transition="all 0.2s"
                    >
                      Download CDR 
                    </Button>
                  </Flex>
                </VStack>
              </CardBody>
            </Card>

           
          </VStack>
      </VStack>
    </Box>
  );
};

export default AdminCDRDownload;