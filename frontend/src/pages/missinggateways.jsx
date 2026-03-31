import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  FormControl,
  FormLabel,
  Grid,
  Heading,
  HStack,
  InputGroup,
  InputLeftElement,
  SimpleGrid,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { MemoizedInput as Input } from "../components/memoizedinput/memoizedinput";
import { SearchIcon } from "@chakra-ui/icons";
import { FiDownload, FiRefreshCw } from "react-icons/fi";
import { fetchMissingGateways } from "../utils/api";
import { toDateInput } from "../utils/dateInput";
import TablePagination from "../components/TablePagination";

const formatDuration = (seconds) => {
  const n = Number(seconds) || 0;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
};

const MissingGateways = () => {
  const toast = useToast();
  const [from, setFrom] = useState(toDateInput(new Date(Date.now() ))); 
  const [to, setTo] = useState(toDateInput(new Date()));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, uniqueGateways: 0, totalDuration: 0, newGateways: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 1 });
  const [hasAppliedFilters, setHasAppliedFilters] = useState(false);

  const loadData = async (pageNum = 1) => {
    setLoading(true);
    setPage(pageNum); // Reset to specified page (usually 1 for new filters)
    try {
      const result = await fetchMissingGateways({
        startDate: from,
        endDate: to,
        search,
        page: pageNum,
        limit: pageSize,
      });
      setRows(result?.data || []);
      setSummary(result?.summary || { total: 0, uniqueGateways: 0, totalDuration: 0, newGateways: 0 });
      setPagination(result?.pagination || { total: 0, page: pageNum, limit: pageSize, totalPages: 1 });
    } catch (error) {
      toast({
        title: "Failed to load missing gateways",
        description: error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setHasAppliedFilters(true);
    loadData(1);
  };

  // Load data when page or pageSize changes
  useEffect(() => {
    if (hasAppliedFilters && (page > 1 || pageSize !== 25)) {
      loadData(page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, hasAppliedFilters]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  const exportCSV = () => {
    const header = ["gateway", "callerip", "customeraccount", "customername", "cli", "called", "duration", "status", "starttime"];
    const lines = filtered.map((r) => [
      r.gateway,
      r.callerip,
      r.customeraccount,
      r.customername,
      r.cli,
      r.called,
      r.duration,
      r.status,
      new Date(Number(r.starttime) || 0).toISOString(),
    ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));

    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `missing_gateways_${from}_to_${to}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  return (
    <VStack spacing={4} align="stretch">
      <Card>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Grid alignItems={"center"} templateColumns={{ base: "1fr", md: "1fr 1fr 1fr 1fr" }} gap={4}>
              <FormControl>
                <FormLabel >From Date</FormLabel>
                <Input 
                  type="date" 
                  value={from} 
                  onChange={(e) => setFrom(e.target.value)}
                  disabled={loading}
                />
              </FormControl>
              <FormControl>
                <FormLabel >To Date</FormLabel>
                <Input 
                  type="date" 
                  value={to} 
                  onChange={(e) => setTo(e.target.value)}
                  disabled={loading}
                />
              </FormControl>
              <FormControl>
                <FormLabel >Search</FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <SearchIcon color="gray.400"  />
                  </InputLeftElement>
                  <Input
                    pl={10}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Gateway, account, CLI, called..."
                    disabled={loading}
                  />
                </InputGroup>
              </FormControl>
            

            <FormControl>
              <FormLabel >Status Filter</FormLabel>
              <HStack spacing={2}>
                <Button 
                  size="sm" 
                  variant={statusFilter === "all" ? "solid" : "outline"} 
                  colorScheme={statusFilter === "all" ? "blue" : "gray"}
                  onClick={() => setStatusFilter("all")}
                  disabled={loading}
                >
                  All
                </Button>
                <Button 
                  size="sm" 
                  variant={statusFilter === "new" ? "solid" : "outline"} 
                  colorScheme={statusFilter === "new" ? "red" : "gray"}
                  onClick={() => setStatusFilter("new")}
                  disabled={loading}
                >
                  New
                </Button>
                <Button 
                  size="sm" 
                  variant={statusFilter === "recurring" ? "solid" : "outline"} 
                  colorScheme={statusFilter === "recurring" ? "orange" : "gray"}
                  onClick={() => setStatusFilter("recurring")}
                  disabled={loading}
                >
                  Recurring
                </Button>
              </HStack>
            </FormControl>
            </Grid>

            <HStack spacing={3}>
              <Button 
                size="sm" 
                leftIcon={<FiRefreshCw />} 
                colorScheme="blue"
                onClick={handleApplyFilters}
                isLoading={loading}
              >
                Apply Filters & Search
              </Button>
              <Button 
                size="sm" 
                leftIcon={<FiDownload />} 
                colorScheme="teal"
                onClick={exportCSV} 
                isDisabled={!filtered.length || loading}
              >
                Export CSV ({filtered.length})
              </Button>
            </HStack>
          </VStack>
        </CardBody>
      </Card>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
        <Card bg="white" shadow={"lg"} _hover={{ boxShadow: "md" }} transition="all 0.2s">
          <CardBody>
            <Stat>
              <StatLabel fontSize="sm" fontWeight="bold" mb={2}>Total CDRs</StatLabel>
              <StatNumber fontSize="2xl" color="blue.600">{(summary.total || 0).toLocaleString()}</StatNumber>
              <Text fontSize="xs" color="gray.500" mt={1}>Unmatched records</Text>
            </Stat>
          </CardBody>
        </Card>
        <Card bg="white" shadow={"lg"} _hover={{ boxShadow: "md" }} transition="all 0.2s">
          <CardBody>
            <Stat>
              <StatLabel fontSize="sm" fontWeight="bold" mb={2}>Unique Gateways</StatLabel>
              <StatNumber fontSize="2xl" color="purple.600">{(summary.uniqueGateways || 0).toLocaleString()}</StatNumber>
              <Text fontSize="xs" color="gray.500" mt={1}>Distinct sources</Text>
            </Stat>
          </CardBody>
        </Card>
        <Card bg="white" shadow={"lg"} _hover={{ boxShadow: "md" }} transition="all 0.2s">
          <CardBody>
            <Stat>
              <StatLabel fontSize="sm" fontWeight="bold" mb={2}>Total Duration</StatLabel>
              <StatNumber fontSize="2xl" color="green.600">{Math.round((summary.totalDuration || 0) / 60).toLocaleString()} min</StatNumber>
              <Text fontSize="xs" color="gray.500" mt={1}>{(summary.totalDuration || 0).toLocaleString()} seconds</Text>
            </Stat>
          </CardBody>
        </Card>
        <Card bg="white" shadow={"lg"} _hover={{ boxShadow: "md" }} transition="all 0.2s">
          <CardBody>
            <Stat>
              <StatLabel fontSize="sm" fontWeight="bold" mb={2}>New Gateways</StatLabel>
              <StatNumber fontSize="2xl" color="red.600">{(summary.newGateways || 0).toLocaleString()}</StatNumber>
              <Text fontSize="xs" color="gray.500" mt={1}>First occurrence</Text>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      <Card>
        <CardBody>
          {loading ? (
            <HStack py={8} justify="center" spacing={3}>
              <Spinner color="blue.500" />
              <Text fontWeight="medium">Loading missing gateways...</Text>
            </HStack>
          ) : !filtered.length ? (
            <Alert status="info" borderRadius="md" colorScheme="gray">
              <AlertIcon />
              <VStack align="start" spacing={1}>
                <Text fontWeight="bold">No missing gateway CDRs found</Text>
                <Text fontSize="sm">All CDRs in the date range match configured accounts.</Text>
              </VStack>
            </Alert>
          ) : (
            <>
              <Box overflowX="auto" maxH="600px" overflowY="auto" borderWidth="1px" borderRadius="md">
                <Table size="sm" variant="simple">
                  <Thead position="sticky" top={0} zIndex={1} bg="gray.100">
                    <Tr>
                      {/* <Th fontWeight="bold">Gateway/IP</Th> */}
                      {/* <Th fontWeight="bold">Customer Account</Th> */}
                      <Th fontWeight="bold">Caller IP</Th>
                      <Th fontWeight="bold">Customer Name</Th>
                      <Th fontWeight="bold">CLI (Caller)</Th>
                      <Th fontWeight="bold">Called</Th>
                      <Th isNumeric fontWeight="bold">Duration</Th>
                      <Th fontWeight="bold" textAlign="center">Status</Th>
                      <Th fontWeight="bold">First Seen</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filtered.map((r, idx) => (
                      <Tr key={r.id || idx} _hover={{ bg: "gray.50" }}>
                        {/* <Td fontFamily="mono" fontSize="xs" fontWeight="bold">{r.gateway}</Td> */}
                        {/* <Td fontSize="sm">{r.customeraccount || <Text color="gray.400">—</Text>}</Td> */}
                        <Td fontFamily="mono" fontSize="xs">{r.callerip || <Text color="gray.400">—</Text>}</Td>
                        <Td fontSize="sm">{r.customername || <Text color="gray.400">—</Text>}</Td>
                        <Td fontFamily="mono" fontSize="xs">{r.cli || <Text color="gray.400">—</Text>}</Td>
                        <Td fontFamily="mono" fontSize="xs">{r.called || <Text color="gray.400">—</Text>}</Td>
                        <Td isNumeric fontSize="xs" fontFamily="mono">{formatDuration(r.duration)}</Td>
                        <Td textAlign="center">
                          <Badge 
                            colorScheme={r.status === "new" ? "red" : "orange"}
                            variant="subtle"
                            px={1}
                            py={0}
                          >
                            {r.status?.toUpperCase()}
                          </Badge>
                        </Td>
                        <Td fontSize="xs">
                          {r.starttime 
                            ? new Date(Number(r.starttime)).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })
                            : <Text color="gray.400">—</Text>
                          }
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
              <Divider my={3} />
              <HStack justify="space-between" fontSize="sm">
                <Text color="gray.600">
                  Showing <strong>{filtered.length}</strong> of <strong>{summary.total || 0}</strong> records
                </Text>
                <Text color="gray.600">
                  <strong>{new Set(filtered.map(r => r.gateway)).size}</strong> unique gateways in view
                </Text>
              </HStack>
            </>
          )}
        </CardBody>
        {filtered.length > 0 && (
          <TablePagination
            page={pagination.page || page}
            pageSize={pagination.limit || pageSize}
            total={pagination.total || 0}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            isDisabled={loading}
          />
        )}
      </Card>
    </VStack>
  );
};

export default MissingGateways;