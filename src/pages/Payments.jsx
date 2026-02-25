import React, { useState, useEffect } from "react";
import {
  Box,
  Heading,
  VStack,
  Text,
  Button,
  useToast,
  HStack,
  Badge,
  Input,
  Select,
  Card,
  CardBody,
  SimpleGrid,
  Icon,
  Flex,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  useColorModeValue,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  InputGroup,
  InputLeftElement,
} from "@chakra-ui/react";
import {
  FiDollarSign,
  FiCalendar,
  FiSearch,
  FiFilter,
  FiDownload,
  FiCheckCircle,
  FiClock,
  FiChevronRight,
  FiRefreshCw,
} from "react-icons/fi";
import DataTable from "../components/DataTable";
import RecordPaymentModal from "../components/modals/RecordPaymentModal";
import ViewPaymentModal from "../components/modals/ViewPaymentModal";
import {
  fetchPayments,
  fetchReportAccounts,
  recordPayment,
  exportReport,
} from "../utils/api";
import { format } from "date-fns";
import { color } from "framer-motion";

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    customerId: "",
    amount: "",
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    paymentMethod: "bank_transfer",
    transactionId: "",
    referenceNumber: "",
    notes: "",
    invoiceId: "",
  });
  const [stats, setStats] = useState({
    totalCollected: 0,
    paymentCount: 0,
    unappliedAmount: 0,
    recentCount: 0,
    successRate: 100,
  });

  const toast = useToast();
  const bgColor = useColorModeValue("white", "gray.800");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterPayments();
  }, [payments, searchTerm, statusFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [paymentsRes, customersData] = await Promise.all([
        fetchPayments(),
        fetchReportAccounts(),
      ]);

      const paymentsData = paymentsRes.success ? paymentsRes.data : [];
      setPayments(paymentsData);
      setFilteredPayments(paymentsData);
      setCustomers(customersData.success ? customersData.customers : []);
      // setInvoices(invoicesRes.success ? invoicesRes.data : []);

      calculateStats(paymentsData);
    } catch (error) {
      console.error("Error loading payments:", error);
      toast({
        title: "Error loading payments",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (data) => {
    const totalCollected = data.reduce(
      (sum, p) => sum + parseFloat(p.amount || 0),
      0,
    );
    const unappliedAmount = data.reduce(
      (sum, p) => sum + parseFloat(p.unappliedAmount || 0),
      0,
    );
    const now = new Date();
    const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
    const recentCount = data.filter(
      (p) => new Date(parseInt(p.paymentDate)) >= sevenDaysAgo,
    ).length;

    const completed = data.filter((p) => p.status === "completed").length;
    const failed = data.filter((p) => p.status === "failed").length;
    const successRate =
      data.length > 0 ? (completed / (completed + failed)) * 100 : 100;

    setStats({
      totalCollected,
      paymentCount: data.length,
      unappliedAmount,
      recentCount,
      successRate: isNaN(successRate) ? 100 : successRate,
    });
  };

  const filterPayments = () => {
    let filtered = [...payments];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.paymentNumber?.toLowerCase().includes(term) ||
          p.customerName?.toLowerCase().includes(term) ||
          p.transactionId?.toLowerCase().includes(term) ||
          p.referenceNumber?.toLowerCase().includes(term),
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    setFilteredPayments(filtered);
  };

  const handleRecordPayment = async () => {
    try {
      const response = await recordPayment(paymentForm);
      if (response.success) {
        toast({
          title: "Payment recorded",
          description: "The payment has been successfully recorded.",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        setIsPaymentModalOpen(false);
        setPaymentForm({
          customerId: "",
          amount: "",
          paymentDate: format(new Date(), "yyyy-MM-dd"),
          paymentMethod: "bank_transfer",
          transactionId: "",
          referenceNumber: "",
          notes: "",
          invoiceId: "",
        });
        loadData();
      }
    } catch (error) {
      toast({
        title: "Error recording payment",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleExport = async () => {
    try {
      const exportData = filteredPayments.map((p) => ({
        "Payment #": p.paymentNumber,
        Customer: p.customerName,
        Date: format(
          new Date(
            isNaN(p.paymentDate) ? p.paymentDate : parseInt(p.paymentDate),
          ),
          "yyyy-MM-dd",
        ),
        Amount: parseFloat(p.amount).toFixed(2),
        Method: p.paymentMethod,
        Allocated: parseFloat(p.allocatedAmount).toFixed(2),
        Unapplied: parseFloat(p.unappliedAmount).toFixed(2),
        Status: p.status,
        "Transaction ID": p.transactionId || "",
        "Reference #": p.referenceNumber || "",
      }));

      await exportReport(
        exportData,
        "csv",
        `payments_export_${format(new Date(), "yyyyMMdd")}`,
      );

      toast({
        title: "Export successful",
        description: "Your payment records have been exported.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const columns = [
    {
      header: "Payment Details",
      key: "paymentNumber",
      render: (value, row) => (
        <VStack align="start" spacing={0}>
          <Text fontWeight="bold" color="blue.600">
            {value}
          </Text>
          <Text fontSize="xs" color="gray.500">
            Receipt: {row.receiptNumber}
          </Text>
        </VStack>
      ),
    },
    {
      header: "Customer",
      key: "customerName",
      render: (value, row) => (
        <VStack align="start" spacing={0}>
          <Text fontWeight="medium">{value}</Text>
          <Text fontSize="xs" color="gray.500">
            {row.customerGatewayId}
          </Text>
        </VStack>
      ),
    },
    {
      header: "Payment Date",
      key: "recordedDate",
      type: "date",
    },
    
    {
      header: "Amount",
      key: "amount",
      type: "currency",
      isNumeric: true,
      render: (value) => (
        <Text
          fontWeight="medium"
          color={parseFloat(value) > 0 ? "green.500" : "black"}
        >
          ${parseFloat(value).toFixed(4)}
        </Text>
      ),
    },
    {
      header: "Method",
      key: "paymentMethod",
      render: (value) => (
        <Badge
          variant="outline"
          colorScheme="purple"
          textTransform="capitalize"
        >
          {value?.replace("_", " ")}
        </Badge>
      ),
    },
    {
      header: "Allocated",
      key: "allocatedAmount",
      type: "currency",
      isNumeric: true,
    },
    {
      header: "Unapplied",
      key: "unappliedAmount",
      render: (value) => (
        <Text
          fontWeight="medium"
          color={parseFloat(value) > 0 ? "orange.500" : "green.500"}
        >
          ${parseFloat(value).toFixed(4)}
        </Text>
      ),
      isNumeric: true,
    },
    {
      header: "Invoices No.",
      key: "allocations",
      render: (allocations) => (
        <VStack align="start" spacing={1}>
          {allocations && allocations.length > 0 ? (
            allocations.map((alloc, idx) => (
              <Badge
                key={idx}
                colorScheme="blue"
                variant="subtle"
                fontSize="2xs"
              >
                {alloc.invoice?.invoiceNumber || alloc.invoiceNumber}
              </Badge>
            ))
          ) : (
            <Text fontSize="xs" color="gray.400">
              No allocation
            </Text>
          )}
        </VStack>
      ),
    },
    {
      header: "Status",
      key: "status",
      type: "badge",
      colorMap: {
        completed: "green",
        pending: "yellow",
        failed: "red",
        refunded: "blue",
      },
    },
  ];

  const handleViewDetails = (payment) => {
    setSelectedPayment(payment);
    setIsViewModalOpen(true);
  };

  return (
    <Box>
      <VStack spacing={6} align="stretch">
              <Flex justify="space-between" align="center" bgGradient="linear(to-r,blue.100,blue.200,blue.300)" px={4} py={2} borderRadius={"12px"} >
        
          <Box>
            <Heading size="lg" mt={2}>
              Payment Records
            </Heading>
            <Text color="gray.500">Manage and track all customer payments</Text>
          </Box>
          <HStack spacing={3}>
            <Button
              leftIcon={<FiDownload />}
              variant="outline"
              size="sm"
              colorScheme="black"
              onClick={handleExport}
              isDisabled={filteredPayments.length === 0}
            >
              Export
            </Button>
            <Button
              leftIcon={<FiDollarSign />}
              colorScheme="green"
              size="sm"
              onClick={() => setIsPaymentModalOpen(true)}
            >
              Record Payment
            </Button>
          </HStack>
        </Flex>

        {/* Stats Section */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            textAlign="left"
            bg={bgColor}
            p={2}
            pl={4}
            boxShadow={"md"}
            borderRadius={"md"}
          >
            <Stat>
              <StatLabel color="gray.500" fontWeight="medium">
                Total Collected
              </StatLabel>
              <StatNumber fontSize="2xl">
                $
                {stats.totalCollected.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </StatNumber>
              <StatHelpText>
                <Icon as={FiCheckCircle} color="green.500" mr={1} />
                From {stats.paymentCount} payments
              </StatHelpText>
            </Stat>
          </Box>
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            textAlign="left"
            bg={bgColor}
            p={2}
            pl={4}
            boxShadow={"md"}
            borderRadius={"md"}
          >
            <Stat>
              <StatLabel color="gray.500" fontWeight="medium">
                Unapplied Amount
              </StatLabel>
              <StatNumber fontSize="2xl" color="orange.500">
                $
                {stats.unappliedAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </StatNumber>
              <StatHelpText>
                <Icon as={FiClock} color="orange.500" mr={1} />
                Waiting to be allocated
              </StatHelpText>
            </Stat>
          </Box>
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            textAlign="left"
            bg={bgColor}
            p={2}
            pl={4}
            boxShadow={"md"}
            borderRadius={"md"}
            // borderTop={"2px solid green"}
          >
            <Stat>
              <StatLabel color="gray.500" fontWeight="medium">
                Recent Payments
              </StatLabel>
              <StatNumber fontSize="2xl">{stats.recentCount}</StatNumber>
              <StatHelpText>
                <Icon as={FiCalendar} color="blue.500" mr={1} />
                In the last 7 days
              </StatHelpText>
            </Stat>
          </Box>
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            textAlign="left"
            bg={bgColor}
            p={2}
            pl={4}
            boxShadow={"md"}
            borderRadius={"md"}
          >
            <Stat>
              <StatLabel color="gray.500" fontWeight="medium">
                Success Rate
              </StatLabel>
              <StatNumber fontSize="2xl">
                {stats.successRate.toFixed(1)}%
              </StatNumber>
              <StatHelpText>
                <Icon as={FiTrendingUp} color="green.500" mr={1} />
                Based on payment status
              </StatHelpText>
            </Stat>
          </Box>
        </SimpleGrid>

        {/* Filter Section */}
        <Flex gap={4}>
          <InputGroup maxW={{ md: "300px" }} bg={"white"} size={"sm"}>
            <InputLeftElement pointerEvents="none">
              <FiSearch color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Search by payment, customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
          <Select
            size={"sm"}
            bg={"white"}
            leftIcon={<FiFilter />}
            maxW="200px"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </Select>
          
        </Flex>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={filteredPayments}
          onView={handleViewDetails}
          height="calc(100vh - 400px)"
        />

        <RecordPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          paymentForm={paymentForm}
          setPaymentForm={setPaymentForm}
          customers={customers}
          onRecordPayment={handleRecordPayment}
        />

        <ViewPaymentModal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          payment={selectedPayment}
        />
      </VStack>
    </Box>
  );
};

// Helper components for icons used in filters
const Stack = ({ children, ...props }) => <Flex {...props}>{children}</Flex>;

const FiRefresh = (props) => (
  <Icon
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </Icon>
);

const FiTrendingUp = (props) => (
  <Icon
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
    <polyline points="17 6 23 6 23 12"></polyline>
  </Icon>
);

export default Payments;
