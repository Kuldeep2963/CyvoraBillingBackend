import React, { useEffect, useMemo, useState } from "react";
import {
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
import { MemoizedInput as Input, MemoizedSelect as Select } from "../components/memoizedinput/memoizedinput";
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
    case "approved":
      return "green";
    case "pending":
      return "orange";
    case "processing":
      return "blue";
    case "rejected":
      return "red";
    default:
      return "gray";
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(false);

  const loadDisputes = async () => {
    setIsLoading(true);
    try {
      const params = {
        page,
        limit: pageSize,
        isDisputed: true,
      };

      const search = searchTerm.trim();
      if (search) {
        params.search = search;
      }

      if (statusFilter !== "all") {
        params.status = statusFilter;
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
  }, [page, pageSize, statusFilter]);

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
        key: "totalSeconds",
        header: "Seconds",
        minWidth: "120px",
        isNumeric: true,
        render: (value) => <Text textAlign="right">{Number(value || 0).toLocaleString()}</Text>,
      },
      {
        key: "status",
        header: "Status",
        minWidth: "120px",
        render: (value) => <Badge colorScheme={statusColor(value)}>{value || "pending"}</Badge>,
      },
      {
        key: "isDisputed",
        header: "Disputed",
        minWidth: "120px",
        render: (value) => (
          <Badge colorScheme={value ? "red" : "gray"}>{value ? "disputed" : "No"}</Badge>
        ),
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

        <Select
          maxW="220px"
          size="sm"
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </Select>

        
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
          actions={false}
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
        
    </Box>
  );
}