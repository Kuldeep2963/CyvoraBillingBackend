import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Box,
  Badge,
  Button,
  Card,
  CardBody,
  Flex,
  HStack,
  Icon,
  InputGroup,
  InputLeftElement,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  useColorModeValue,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { FiAlertTriangle, FiRefreshCw, FiSearch } from "react-icons/fi";
import PageNavBar from "../components/PageNavBar";
import DataTable from "../components/DataTable";
import { MemoizedInput as Input } from "../components/memoizedinput/memoizedinput";
import { fetchVendorInvoices } from "../utils/api";

const formatAmount = (value) =>
  parseFloat(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const statusColor = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "paid":
      return "green";
    case "pending":
      return "gray";
    case "disputed":
      return "red";
  }
};

export default function Disputes() {
  const toast = useToast();
  const cardBg = useColorModeValue("white", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, page: 1, limit: 10 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const loadDisputes = async () => {
    setIsLoading(true);
    try {
      const params = {
        page,
        limit: pageSize,
        status: "disputed",
      };

      const search = searchTerm.trim();
      if (search) {
        params.search = search;
      }

      const response = await fetchVendorInvoices(params);
      if (!response?.success) {
        throw new Error(response?.message || "Failed to load disputed vendor invoices");
      }

      setRows(Array.isArray(response.data) ? response.data : []);
      setPagination(response.pagination || { total: 0, totalPages: 1, page, limit: pageSize });
    } catch (error) {
      toast({
        title: "Unable to load disputes",
        description: error.message || "Please try again.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      setRows([]);
      setPagination({ total: 0, totalPages: 1, page, limit: pageSize });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDisputes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadDisputes();
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  

  const columns = useMemo(
    () => [
      {
        key: "invoiceNumber",
        header: "Invoice #",
        minWidth: "150px",
        render: (value) => <Text fontWeight="600">{value}</Text>,
      },
      {
        key: "vendorCode",
        header: "Vendor",
        minWidth: "180px",
        render: (value, row) => (
          <VStack align="start" spacing={0}>
            <Text fontSize="sm">{row.vendor?.accountName || value}</Text>
            <Text fontSize="xs" color="gray.500">
              {value}
            </Text>
          </VStack>
        ),
      },
      {
        key: "period",
        header: "Period",
        minWidth: "200px",
        render: (_, row) => (
          <Text fontSize="sm">
            {formatDate(row.startDate)} - {formatDate(row.endDate)}
          </Text>
        ),
      },
      {
        key: "grandTotal",
        header: "Amount",
        minWidth: "120px",
        isNumeric: true,
        render: (value) => <Text textAlign="right">${formatAmount(value)}</Text>,
      },
     
      {
        key: "status",
        header: "Status",
        minWidth: "120px",
        justifyContent: "center",
        render: (value) => <Badge colorScheme={statusColor(value)}>{value || "pending"}</Badge>,
      },
      {
        key: "dispute",
        header: "Dispute",
        minWidth: "120px",
        render: (_, row) => {
          const details = row.disputeDetails || {};
          const disputedAmount = Number(details.disputedAmount || 0);
          const disputedPercentage = Number(details.disputedPercentage || 0);
          return (
            <Text fontSize="sm" color="red.600" fontWeight="600">
              ${formatAmount(disputedAmount)} ({disputedPercentage.toFixed(2)}%)
            </Text>
          );
        },
      },
    ],
    []
  );

  return (
    <Box>
      <PageNavBar
        title="Disputed Vendor Invoices"
        description="Vendor invoices marked as disputed or needing review"
        mb={6}
      />

     

      <Flex gap={3} align="center" flexWrap="wrap" mb={4}>
        <InputGroup maxW="320px" size="sm">
          <InputLeftElement pointerEvents="none">
            <FiSearch color="gray" />
          </InputLeftElement>
          <Input
            pl={10}
            placeholder="Search invoice/vendor"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </InputGroup>

      </Flex>

      {rows.length === 0 && !isLoading ? (
        <VStack py={8} spacing={2} color="gray.500">
          <FiAlertTriangle />
          <Text fontSize="sm">No disputed vendor invoices found.</Text>
        </VStack>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          actions
          onView={(row) => setSelectedRow(row)}
          serverPagination
          page={page}
          pageSize={pageSize}
          total={pagination.total || 0}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          isPaginationDisabled={isLoading}
          striped
          height="calc(100vh - 250px)"
        />
      )}

      <Modal isOpen={Boolean(selectedRow)} onClose={() => setSelectedRow(null)} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader borderTopRadius={"md"} color={"white"} bg={"blue.500"}>Dispute Details</ModalHeader>
          <ModalCloseButton  color={"white"}/>
          <ModalBody>
            {selectedRow ? (
              <VStack align="stretch" spacing={3}>
                <SimpleGrid columns={2} spacing={3}>
                  <Box>
                    <Text fontSize="xs" color="gray.500">Invoice</Text>
                    <Text fontSize="sm" fontWeight="600">{selectedRow.invoiceNumber || "-"}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500">Vendor</Text>
                    <Text fontSize="sm" fontWeight="600">{selectedRow.vendor?.accountName || selectedRow.vendorCode || "-"}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500">Status</Text>
                    <Badge colorScheme={statusColor(selectedRow.status)}>{selectedRow.status || "pending"}</Badge>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="gray.500">Period</Text>
                    <Text fontSize="sm">{formatDate(selectedRow.startDate)} - {formatDate(selectedRow.endDate)}</Text>
                  </Box>
                </SimpleGrid>

                <Box borderWidth="1px" borderColor={borderColor} borderRadius="md" p={3}>
                  <Text fontSize="xs" color="gray.500" mb={2}>Dispute Breakdown</Text>
                  <VStack align="stretch" spacing={1}>
                    <Flex justify="space-between">
                      <Text fontSize="sm" color="gray.600">Invoice Amount</Text>
                      <Text fontSize="sm" fontWeight="600">${formatAmount(selectedRow.grandTotal || 0)}</Text>
                    </Flex>
                    <Flex justify="space-between">
                      <Text fontSize="sm" color="gray.600">Actual amount</Text>
                      <Text fontSize="sm" fontWeight="600">${formatAmount(selectedRow.disputeDetails?.actualAmount || 0)}</Text>
                    </Flex>
                    <Flex justify="space-between">
                      <Text fontSize="sm" color="gray.600">Disputed amount</Text>
                      <Text fontSize="sm" fontWeight="600" color="red.600">${formatAmount(selectedRow.disputeDetails?.disputedAmount || 0)}</Text>
                    </Flex>
                    <Flex justify="space-between">
                      <Text fontSize="sm" color="gray.600">Disputed percentage</Text>
                      <Text fontSize="sm" fontWeight="600" color="red.600">{Number(selectedRow.disputeDetails?.disputedPercentage || 0).toFixed(2)}%</Text>
                    </Flex>
                  </VStack>
                </Box>
              </VStack>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setSelectedRow(null)}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
        
    </Box>
  );
}