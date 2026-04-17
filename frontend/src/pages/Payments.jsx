import React, { useState, useEffect } from "react";
import {
  Box,
  VStack,
  Text,
  Button,
  useToast,
  Badge,
  Flex,
  InputGroup,
  InputLeftElement,
} from "@chakra-ui/react";
import { MemoizedInput as Input } from "../components/memoizedinput/memoizedinput";
import PageNavBar from "../components/PageNavBar";
import {
  FiDollarSign,
  FiSearch,
  FiDownload,
  FiArrowDown,
  FiArrowUp,
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

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
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
  const toast = useToast();

  const getPaymentFlowMeta = (payment) => {
    const direction = String(payment?.paymentDirection || "inbound").toLowerCase();
    return {
      direction,
      label: direction === "outbound" ? "Outbound" : "Inbound",
      colorScheme: direction === "outbound" ? "red" : "green",
      icon: direction === "outbound" ? FiArrowUp : FiArrowDown,
    };
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    loadPayments();
  }, [debouncedSearch, page, pageSize]);

  const loadCustomers = async () => {
    try {
      const customersData = await fetchReportAccounts();
      setCustomers(customersData.success ? customersData.customers : []);
    } catch (error) {
      console.error("Error loading customers:", error);
    }
  };

  const loadPayments = async () => {
    setIsLoading(true);
    try {
      const paymentsRes = await fetchPayments({
        page,
        limit: pageSize,
        search: debouncedSearch,
      });

      const paymentsData = paymentsRes.success ? paymentsRes.data : [];
      setPayments(paymentsData);
      setPagination(
        paymentsRes.pagination || {
          total: paymentsData.length,
          page,
          limit: pageSize,
          totalPages: 1,
        },
      );
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

  const handleRecordPayment = async () => {
    if (isRecordingPayment) return;
    setIsRecordingPayment(true);
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
        loadPayments();
      }
    } catch (error) {
      toast({
        title: "Error recording payment",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const handleExport = async () => {
    try {
      const exportData = payments.map((p) => ({
        "Payment #": p.paymentNumber,
        "Account Name": p.customerName,
        Date: format(
          new Date(
            isNaN(p.paymentDate) ? p.paymentDate : parseInt(p.paymentDate),
          ),
          "yyyy-MM-dd",
        ),
        Amount: parseFloat(p.amount).toFixed(2),
        Direction: String(p.paymentDirection || "inbound").toUpperCase(),
        "Account Type": String(p.partyType || "customer").toUpperCase(),
        Method: p.paymentMethod,
        Allocated: parseFloat(p.allocatedAmount).toFixed(2),
        Unapplied: parseFloat(p.unappliedAmount).toFixed(2),
        "Credit Note": parseFloat(p.creditNoteAmount || 0).toFixed(2),
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
    // {
    //   header: "Payment Details",
    //   key: "paymentNumber",
    //   render: (value, row) => (
    //     <VStack align="start" spacing={0}>
    //       <Text fontWeight="bold" color="blue.600">
    //         {value}
    //       </Text>
    //       <Text fontSize="xs" color="gray.500">
    //          {String(row.partyType || "customer").toUpperCase()}
    //       </Text>
    //     </VStack>
    //   ),
    // },
    {
      header: "Payment Direction",
      key: "paymentDirection",
      render: (_, row) => {
        const flow = getPaymentFlowMeta(row);
        return (
          <Badge colorScheme={flow.colorScheme} variant="subtle" textTransform="capitalize" display="inline-flex" alignItems="center" gap={1}>
            <Box as={flow.icon} />
            {flow.label}
          </Badge>
        );
      },
    },
    {
      header: "Account Name",
      maxWidth: "200px",
      key: "customerName",
      render: (value, row) => (
        <VStack align="start" spacing={0}>
          <Text noOfLines={2} maxWidth="250px" fontWeight="medium">{value}</Text>
          
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
      header: "Credit Note",
      key: "creditNoteAmount",
      type: "currency",
      isNumeric: true,
      render: (value) => (
        <Text fontWeight="medium" color={Number(value || 0) > 0 ? "orange.500" : "gray.500"}>
          ${Number(value || 0).toFixed(4)}
        </Text>
      ),
    },
    {
      header: "Method",
      key: "paymentMethod",
      render: (value) => (
        <Badge
          variant="ghost"
          colorScheme="blue"
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
                fontSize="xs"
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
    // {
    //   header: "Status",
    //   key: "status",
    //   type: "badge",
    //   colorMap: {
    //     completed: "green",
    //     pending: "yellow",
    //     failed: "red",
    //     refunded: "blue",
    //   },
    // },
  ];

  const handleViewDetails = (payment) => {
    setSelectedPayment(payment);
    setIsViewModalOpen(true);
  };

  return (
    <Box>
      <VStack spacing={4} align="stretch">
        <PageNavBar
        mb={2}
          title="Payment Records"
          description="Manage and track inbound and outbound payments"
          rightContent={
            <Flex gap={3}>
              <Button
                leftIcon={<FiDownload />}
                variant="solid"
                size="sm"
                colorScheme="green"
                onClick={handleExport}
                isDisabled={payments.length === 0}
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
            </Flex>
          }
        />

        

        {/* Filter Section */}
        <Flex gap={4} alignItems={"center"}>
          <InputGroup  maxW={{ md: "300px" }}  size={"sm"}>
            <InputLeftElement pointerEvents="none">
              <FiSearch color="gray.400" />
            </InputLeftElement>
            <Input
              pl={8}
              placeholder="Search by payment, account..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </Flex>

        {/* Data Table */}
        <DataTable
          m = {2}
          mt = {0}
          columns={columns}
          data={payments}
          onView={handleViewDetails}
          height="calc(100vh - 250px)"
          serverPagination
          page={pagination.page || page}
          pageSize={pagination.limit || pageSize}
          total={pagination.total || 0}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          isPaginationDisabled={isLoading}
        />

        <RecordPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          paymentForm={paymentForm}
          setPaymentForm={setPaymentForm}
          customers={customers}
          onRecordPayment={handleRecordPayment}
          isSubmitting={isRecordingPayment}
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

export default Payments;
