import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Grid,
  Heading,
  HStack,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  SimpleGrid,
  Text,
  VStack,
  Badge,
  Divider,
  TableContainer,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  
  Icon,
  useColorModeValue,
  useToast,
  Avatar,
  Tooltip,
  Progress,
  Circle,
  Tag,
  TagLabel,
  SkeletonText,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Input as ChakraInput,
  InputGroup as ChakraInputGroup,
  InputLeftElement as ChakraInputLeftElement,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  List,
  ListItem,
  ModalFooter,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { MemoizedInput as Input, MemoizedSelect as Select } from "../components/memoizedinput/memoizedinput";
import PageNavBar from "../components/PageNavBar";
import DataTable from "../components/DataTable";
import ConfirmDialog from "../components/ConfirmDialog";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  fetchVendors,
  uploadVendorInvoice,
  previewVendorInvoiceUsage,
  fetchVendorInvoices,
  markInvoiceAsPaid,
  deletevendorinvoice,
  fetchVendorInvoiceFiles,
  downloadVendorInvoiceFileBlob,
  deleteVendorInvoiceFile,
  updateVendorInvoice,
  uploadFilesToVendorInvoice,
} from "../utils/api";
import {
  FiUploadCloud,
  FiFile,
  FiX,
  FiCalendar,
  FiHash,
  FiDollarSign,
  FiClock,
  FiCheck,
  FiTruck,
  FiAlertTriangle,
  FiPlus,
  FiRotateCcw,
  FiFileText,
  FiSearch,
  FiMoreVertical,
  FiDownload,
  FiEye,
  FiFilter,
  FiChevronLeft,
  FiChevronRight,
  FiList,
  FiRefreshCw,
  FiTrash2,
  FiPaperclip,
  FiImage,
  FiEdit2,
} from "react-icons/fi";

const CURRENCY = ["USD", "EUR", "GBP", "INR", "AED", "SGD"];

const fmtBytes = (b) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const fmtSeconds = (s) => {
  if (!s) return "—";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (sec) parts.push(`${sec}s`);
  return parts.join(" ") || "0s";
};

const parseInvoiceFiles = (rawFilePaths) => {
  if (!rawFilePaths) return [];

  if (Array.isArray(rawFilePaths)) {
    return rawFilePaths.map((entry) => String(entry || "").trim()).filter(Boolean);
  }

  if (typeof rawFilePaths === "string") {
    const trimmed = rawFilePaths.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((entry) => String(entry || "").trim()).filter(Boolean);
        }
      } catch (_error) {
        // Fallback to comma split.
      }
    }

    return trimmed.split(",").map((entry) => entry.trim()).filter(Boolean);
  }

  return [];
};

const pickFileIcon = (name = "") => {
  const lower = String(name).toLowerCase();
  if (lower.endsWith(".pdf")) return FiFileText;
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".gif") || lower.endsWith(".webp")) return FiImage;
  if (lower.endsWith(".csv") || lower.endsWith(".xls") || lower.endsWith(".xlsx")) return FiFileText;
  return FiFile;
};

// ── Status badge helper ───────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    pending:    { color: "orange", label: "Pending" },
    approved:   { color: "green",  label: "Approved" },
    rejected:   { color: "red",    label: "Rejected" },
    processing: { color: "blue",   label: "Processing" },
    paid:       { color: "teal",   label: "Paid" },
  };
  const s = map[status?.toLowerCase()] || { color: "gray", label: status || "Unknown" };
  return <Badge colorScheme={s.color} variant="subtle" fontSize="xs" px={2} py={0.5} borderRadius="full">{s.label}</Badge>;
};

// ── Invoices List Tab ─────────────────────────────────────────
const InvoicesTab = ({ onAddNew }) => {
  const toast  = useToast();
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.700");
  const [search, setSearch]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]       = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceFiles, setInvoiceFiles] = useState([]);
  const [isFilesOpen, setIsFilesOpen] = useState(false);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [isDeleteInvoiceLoading, setIsDeleteInvoiceLoading] = useState(false);
  const [deleteFileTarget, setDeleteFileTarget] = useState(null);
  const [deleteInvoiceTarget, setDeleteInvoiceTarget] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editInvoiceFiles, setEditInvoiceFiles] = useState([]);
  const [isEditFilesLoading, setIsEditFilesLoading] = useState(false);
  const [isEditFilesUploading, setIsEditFilesUploading] = useState(false);
  const [uploadTargetInvoice, setUploadTargetInvoice] = useState(null);
  const [isQuickUploading, setIsQuickUploading] = useState(false);
  const [editForm, setEditForm] = useState({
    invoiceNumber: "",
    issueDate: "",
    startDate: "",
    endDate: "",
    grandTotal: "",
    currency: "USD",
    totalSeconds: "",
  });
  const editFilesRef = useRef(null);
  const quickAddFilesRef = useRef(null);
  const isSelectedInvoicePaid = String(selectedInvoice?.status || "").toLowerCase() === "paid";

  const safeOpenBlob = (blob, nameHint = "file") => {
    const blobUrl = window.URL.createObjectURL(blob);
    const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = nameHint;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000);
  };

  const safeDownloadBlob = (blob, filename) => {
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || "vendor-invoice-file";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
  };

  const openFilesModal = async (row) => {
    setSelectedInvoice(row);
    setIsFilesOpen(true);
    setIsFilesLoading(true);

    try {
      const response = await fetchVendorInvoiceFiles(row.id);
      const files = response?.data?.files || [];
      setInvoiceFiles(Array.isArray(files) ? files : []);
    } catch (err) {
      setInvoiceFiles([]);
      toast({
        title: "Failed to load attachments",
        description: err.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsFilesLoading(false);
    }
  };

  const openEditModal = async (row) => {
    setSelectedInvoice(row);
    setIsEditFilesLoading(true);
    setEditInvoiceFiles([]);
    setEditForm({
      invoiceNumber: row.invoiceNumber || "",
      issueDate: row.issueDate || "",
      startDate: row.startDate || "",
      endDate: row.endDate || "",
      grandTotal: row.grandTotal != null ? String(row.grandTotal) : "",
      currency: row.currency || "USD",
      totalSeconds: row.totalSeconds != null ? String(row.totalSeconds) : "0",
    });
    setIsEditOpen(true);

    try {
      const response = await fetchVendorInvoiceFiles(row.id);
      const files = response?.data?.files || [];
      setEditInvoiceFiles(Array.isArray(files) ? files : []);
    } catch (err) {
      toast({
        title: "Failed to load invoice attachments",
        description: err.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsEditFilesLoading(false);
    }
  };

  const handleEditField = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveEdit = async () => {
    if (!selectedInvoice?.id) return;

    if (!editForm.invoiceNumber.trim()) {
      toast({ title: "Invoice number is required", status: "error", duration: 3000, isClosable: true });
      return;
    }

    if (editForm.startDate && editForm.endDate && new Date(editForm.startDate) > new Date(editForm.endDate)) {
      toast({ title: "End date must be after start date", status: "error", duration: 3000, isClosable: true });
      return;
    }

    setIsEditSaving(true);
    try {
      await updateVendorInvoice(selectedInvoice.id, {
        invoiceNumber: editForm.invoiceNumber.trim(),
        issueDate: editForm.issueDate,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        grandTotal: Number(editForm.grandTotal || 0),
        currency: editForm.currency,
        totalSeconds: Number(editForm.totalSeconds || 0),
      });

      toast({ title: "Vendor invoice updated", status: "success", duration: 3000, isClosable: true });
      setIsEditOpen(false);
      await loadInvoices();
    } catch (err) {
      toast({ title: "Failed to update invoice", description: err.message, status: "error", duration: 4000, isClosable: true });
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleViewFile = async (row, file) => {
    try {
      const blob = await downloadVendorInvoiceFileBlob(row.id, file.fileIndex, "inline");
      safeOpenBlob(blob, file.originalName);
    } catch (err) {
      toast({
        title: "Unable to open file",
        description: err.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const handleDownloadFile = async (row, file) => {
    try {
      const blob = await downloadVendorInvoiceFileBlob(row.id, file.fileIndex, "attachment");
      safeDownloadBlob(blob, file.originalName);
    } catch (err) {
      toast({
        title: "Unable to download file",
        description: err.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const handleDeleteFile = async (row, file) => {
    setIsDeletingFile(true);
    try {
      await deleteVendorInvoiceFile(row.id, file.fileIndex);
      const response = await fetchVendorInvoiceFiles(row.id);
      const files = response?.data?.files || [];
      setInvoiceFiles(Array.isArray(files) ? files : []);
      setEditInvoiceFiles(Array.isArray(files) ? files : []);
      await loadInvoices();
      toast({ title: "Attachment deleted", status: "success", duration: 3000, isClosable: true });
      setDeleteFileTarget(null);
    } catch (err) {
      toast({ title: "Failed to delete attachment", description: err.message, status: "error", duration: 4000, isClosable: true });
    } finally {
      setIsDeletingFile(false);
    }
  };

  const handleUploadEditFiles = async (event) => {
    const incomingFiles = Array.from(event?.target?.files || []);
    if (!selectedInvoice?.id || incomingFiles.length === 0) {
      if (event?.target) event.target.value = "";
      return;
    }

    const formData = new FormData();
    incomingFiles.forEach((file) => formData.append("files", file));

    setIsEditFilesUploading(true);
    try {
      await uploadFilesToVendorInvoice(selectedInvoice.id, formData);
      const response = await fetchVendorInvoiceFiles(selectedInvoice.id);
      const files = response?.data?.files || [];
      setEditInvoiceFiles(Array.isArray(files) ? files : []);
      setInvoiceFiles(Array.isArray(files) ? files : []);
      await loadInvoices();
      toast({
        title: "Files uploaded",
        description: `${incomingFiles.length} file${incomingFiles.length > 1 ? "s" : ""} added to invoice`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: "Failed to upload files",
        description: err.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsEditFilesUploading(false);
      if (event?.target) event.target.value = "";
    }
  };

  const openQuickAddFiles = (row) => {
    setUploadTargetInvoice(row);
    quickAddFilesRef.current?.click();
  };

  const handleQuickAddFiles = async (event) => {
    const incomingFiles = Array.from(event?.target?.files || []);
    if (!uploadTargetInvoice?.id || incomingFiles.length === 0) {
      if (event?.target) event.target.value = "";
      return;
    }

    const formData = new FormData();
    incomingFiles.forEach((file) => formData.append("files", file));

    setIsQuickUploading(true);
    try {
      await uploadFilesToVendorInvoice(uploadTargetInvoice.id, formData);

      if (selectedInvoice?.id === uploadTargetInvoice.id) {
        const response = await fetchVendorInvoiceFiles(uploadTargetInvoice.id);
        const files = response?.data?.files || [];
        const normalized = Array.isArray(files) ? files : [];
        setInvoiceFiles(normalized);
        setEditInvoiceFiles(normalized);
      }

      await loadInvoices();
      toast({
        title: "Files uploaded",
        description: `${incomingFiles.length} file${incomingFiles.length > 1 ? "s" : ""} added to invoice`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: "Failed to upload files",
        description: err.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsQuickUploading(false);
      setUploadTargetInvoice(null);
      if (event?.target) event.target.value = "";
    }
  };

  const handleDeleteInvoice = async (id) => {
    setIsDeleteInvoiceLoading(true);
    try {
      await deletevendorinvoice(id);
      toast({
        title: "Invoice deleted",
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      setDeleteInvoiceTarget(null);
      loadInvoices(); // Reload invoices to reflect the updated status
    } catch (err) {
      toast({
        title: "Failed to delete invoice",
        description: err.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsDeleteInvoiceLoading(false);
    }
  };

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchVendorInvoices({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
      });
      const rows = response?.data || response || [];
      setInvoices(Array.isArray(rows) ? rows : []);
      setPagination(response?.pagination || { total: rows.length || 0, page, limit: pageSize, totalPages: 1 });
    } catch (err) {
      setError(err.message || "Failed to load invoices");
      toast({
        title: "Failed to load invoices",
        description: err.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, page, pageSize, debouncedSearch]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const handleMarkAsPaid = async (id) => {
    try {
      await markInvoiceAsPaid(id);
      toast({
        title: "Invoice marked as paid",
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      loadInvoices(); // Reload invoices to reflect the updated status
    } catch (err) {
      toast({
        title: "Failed to mark invoice as paid",
        description: err.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const columns = [
    {
      key: "invoiceNumber",
      header: "Invoice No.",
      render: (_, row) => (
        <Text fontSize="13px" fontWeight="600" color="blue.600">{row.invoiceNumber || "N/A"}</Text>
      ),
    },
    {
      key: "vendor",
      header: "Vendor",
      render: (_, row) => (
        <VStack spacing={0} align="start">
          <Text fontSize="13px" fontWeight="500" color="gray.700">{row.vendor?.accountName || "N/A"}</Text>
          <Text fontSize="11px" color="gray.400">{row.vendor?.vendorCode || "N/A"}</Text>
        </VStack>
      ),
    },
    {
      key: "issueDate",
      header: "Issue Date",
      render: (value) => (
        <Text fontSize="13px" color="gray.600">
          {value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
        </Text>
      ),
    },
    {
      key: "billingPeriod",
      header: "Billing Period",
      render: (_, row) => (
        <Text fontSize="13px" color="gray.600">
          {row.startDate ? new Date(row.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "N/A"}
          {" - "}
          {row.endDate ? new Date(row.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
        </Text>
      ),
    },
    {
      key: "grandTotal",
      header: "Grand Total",
      render: (value, row) => (
        <Text fontSize="13px" fontWeight="700" color="gray.800">
          {row.currency || "USD"} {Number(value || 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      key: "totalSeconds",
      header: "Duration",
      render: (value) => (
        <Text fontSize="13px" color="teal.600" fontWeight="500">{fmtSeconds(value)}</Text>
      ),
    },
    {
      key: "filePaths",
      header: "Attachments",
      render: (value, row) => {
        const count = parseInvoiceFiles(value).length;
        const isPaid = String(row?.status || "").toLowerCase() === "paid";

        return (
          <HStack spacing={2}>
            {count > 0 ? (
              <Button
                size="xs"
                variant="outline"
                leftIcon={<FiPaperclip />}
                borderRadius="999px"
                onClick={() => openFilesModal(row)}
              >
                {count} file{count > 1 ? "s" : ""}
              </Button>
            ) : (
              <Text fontSize="12px" color="gray.400">No files</Text>
            )}

            <Tooltip label={isPaid ? "Cannot add files to paid invoice" : "Add files"}>
              <IconButton
                size="xs"
                variant="ghost"
                colorScheme="blue"
                icon={<FiPlus />}
                aria-label="Add attachment"
                isDisabled={isPaid || isQuickUploading}
                isLoading={isQuickUploading && uploadTargetInvoice?.id === row.id}
                onClick={() => openQuickAddFiles(row)}
              />
            </Tooltip>
          </HStack>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: "actions",
      header: "Actions",
      minWidth: "80px",
      render: (_, row) => (
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<FiMoreVertical />}
            variant="ghost"
            size="xs"
            color="gray.600"
            aria-label="Invoice actions"
            _hover={{ color: "gray.700", bg: "gray.100" }}
            borderRadius="6px"
          />
          <MenuList fontSize="sm" minW="140px" shadow="lg" borderColor={border}>
            <MenuItem icon={<FiPaperclip />} onClick={() => openFilesModal(row)} fontSize="13px">View files</MenuItem>
            {String(row?.status || "").toLowerCase() === "paid" ? (
              <MenuItem icon={<FiEye />} onClick={() => openEditModal(row)} fontSize="13px">View details</MenuItem>
            ) : (
              <>
                <MenuItem icon={<FiEdit2 />} onClick={() => openEditModal(row)} fontSize="13px">Edit invoice</MenuItem>
                <MenuItem icon={<FiTrash2 />} onClick={() => setDeleteInvoiceTarget(row)} fontSize="13px">Delete</MenuItem>
                <MenuItem icon={<FiCheck />} onClick={() => handleMarkAsPaid(row.id)} fontSize="13px">Mark as paid</MenuItem>
              </>
            )}
          </MenuList>
        </Menu>
      ),
    },
  ];

  return (
    <VStack spacing={4} align="stretch">
      <input
        ref={quickAddFilesRef}
        type="file"
        multiple
        hidden
        accept=".pdf,.png,.jpg,.jpeg,.csv,.xls,.xlsx"
        onChange={handleQuickAddFiles}
      />

      {/* Table card */}
      <Card bg={cardBg} border="1px" borderColor={border} shadow="sm" borderRadius="12px">
        <CardHeader pb={3}>
          <Flex align="center" justify="space-between" flexWrap="wrap" gap={3}>
            <HStack>
              <Box w={1} h={5} bg="blue.500" borderRadius="full" />
              <Heading size="sm" color="gray.800">Vendor Invoices</Heading>
              <Badge colorScheme="blue" variant="subtle" fontSize="xs">{pagination.total || invoices.length} records</Badge>
            </HStack>
            <HStack spacing={3}>
              {/* Search */}
              <InputGroup size="sm" maxW="240px">
                <InputLeftElement pointerEvents="none" color="gray.400"><FiSearch /></InputLeftElement>
                <Input
                  pl={8}
                  placeholder="Search invoices..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                  }}
                  borderRadius="8px"
                  borderColor={border}
                  fontSize="13px"
                  _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
                />
              </InputGroup>
              {/* Refresh */}
              <Tooltip label="Refresh" placement="top">
                <IconButton
                  icon={<FiRefreshCw />}
                  size="sm"
                  variant="outline"
                  borderRadius="8px"
                  borderColor={border}
                  color="gray.500"
                  aria-label="Refresh invoices"
                  isLoading={isLoading}
                  onClick={loadInvoices}
                  _hover={{ borderColor: "blue.400", color: "blue.500" }}
                />
              </Tooltip>
              <Button size="sm" px={6} leftIcon={<FiPlus />} colorScheme="blue" borderRadius="8px" onClick={onAddNew}
                fontSize="13px" fontWeight="600" boxShadow="0 2px 8px rgba(49,130,206,0.25)">
                New Invoice
              </Button>
            </HStack>
          </Flex>
        </CardHeader>

        <CardBody p={3}>
          {error ? (
            <Flex direction="column" align="center" py={10} color="red.400">
              <FiAlertTriangle size={32} style={{ marginBottom: "8px", opacity: 0.6 }} />
              <Text fontSize="sm" fontWeight="600">Failed to load invoices</Text>
              <Text fontSize="xs" color="gray.400" mt={1} mb={4}>{error}</Text>
              <Button size="sm" leftIcon={<FiRefreshCw />} colorScheme="blue" variant="outline" borderRadius="8px" onClick={loadInvoices}>
                Try Again
              </Button>
            </Flex>
          ) : (
            <DataTable
              columns={columns}
              data={isLoading ? [] : invoices}
              actions={false}
              compact
              striped
              height="420px"
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
          )}
        </CardBody>
      </Card>

      <Modal isOpen={isFilesOpen} onClose={() => setIsFilesOpen(false)} size="xl" isCentered>
        <ModalOverlay />
        <ModalContent borderRadius="12px">
          <ModalHeader>
            <HStack spacing={2}>
              <FiPaperclip />
              <Text fontSize="md">Invoice Attachments</Text>
            </HStack>
            <Text fontSize="xs" color="gray.500" mt={1}>
              {selectedInvoice?.invoiceNumber || "Vendor invoice"}
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={5} maxH={"350px"} overflowY={"auto"}>
            {isFilesLoading ? (
              <VStack spacing={3} align="stretch">
                <SkeletonText noOfLines={2} spacing="2" />
                <SkeletonText noOfLines={2} spacing="2" />
                <SkeletonText noOfLines={2} spacing="2" />
              </VStack>
            ) : invoiceFiles.length === 0 ? (
              <Flex direction="column" align="center" py={8} color="gray.500">
                <FiFile size={28} style={{ marginBottom: 8, opacity: 0.7 }} />
                <Text fontSize="sm">No uploaded files found for this invoice.</Text>
              </Flex>
            ) : (
              <List spacing={3}>
                {invoiceFiles.map((file) => {
                  const IconComp = pickFileIcon(file.originalName);
                  return (
                    <ListItem key={`${file.fileIndex}-${file.originalName}`}>
                      <Flex align="center" border="1px" borderColor={border} borderRadius="10px" p={3} gap={3}>
                        <Box color="blue.500"><Icon as={IconComp} boxSize={5} /></Box>
                        <Box minW={0} flex={1}>
                          <Text fontSize="sm" fontWeight="600" color="gray.700" isTruncated>{file.originalName}</Text>
                          <Text fontSize="xs" color="gray.500">{(file.extension || "").toUpperCase().replace('.', '') || 'FILE'}</Text>
                        </Box>
                        <HStack spacing={2}>
                          <Button size="xs" variant="outline" leftIcon={<FiEye />} onClick={() => handleViewFile(selectedInvoice, file)}>
                            View
                          </Button>
                          <Button size="xs" colorScheme="blue" leftIcon={<FiDownload />} onClick={() => handleDownloadFile(selectedInvoice, file)}>
                            Download
                          </Button>
                          <IconButton
                            size="xs"
                            colorScheme="red"
                            variant="ghost"
                            icon={<FiTrash2 />}
                            aria-label="Delete attachment"
                            isLoading={isDeletingFile}
                            onClick={() => setDeleteFileTarget({ row: selectedInvoice, file })}
                          />
                        </HStack>
                      </Flex>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} size="lg" isCentered>
        <ModalOverlay />
        <ModalContent borderRadius="12px">
          <ModalHeader>{isSelectedInvoicePaid ? "View Vendor Invoice Details" : "Edit Vendor Invoice"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={5} maxH={"400px"} overflowY={"auto"}>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel fontSize="sm">Invoice Number</FormLabel>
                <Input isDisabled={isSelectedInvoicePaid} value={editForm.invoiceNumber} onChange={(e) => handleEditField("invoiceNumber", e.target.value)} />
              </FormControl>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Issue Date</FormLabel>
                  <Input isDisabled={isSelectedInvoicePaid} type="date" value={editForm.issueDate} onChange={(e) => handleEditField("issueDate", e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Start Date</FormLabel>
                  <Input isDisabled={isSelectedInvoicePaid} type="date" value={editForm.startDate} onChange={(e) => handleEditField("startDate", e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">End Date</FormLabel>
                  <Input isDisabled={isSelectedInvoicePaid} type="date" value={editForm.endDate} onChange={(e) => handleEditField("endDate", e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Currency</FormLabel>
                  <Select disabled={isSelectedInvoicePaid} value={editForm.currency} onChange={(e) => handleEditField("currency", e.target.value)}>
                    {CURRENCY.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Grand Total</FormLabel>
                  <Input isDisabled={isSelectedInvoicePaid} type="number" min={0} step="0.01" value={editForm.grandTotal} onChange={(e) => handleEditField("grandTotal", e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Total Seconds</FormLabel>
                  <Input isDisabled={isSelectedInvoicePaid} type="number" min={0} step="1" value={editForm.totalSeconds} onChange={(e) => handleEditField("totalSeconds", e.target.value)} />
                </FormControl>
              </SimpleGrid>

              <Box>
                <Flex align="center" justify="space-between" mb={2}>
                  <FormLabel fontSize="sm" mb={0}>Attachments</FormLabel>
                  <Button
                    size="xs"
                    leftIcon={<FiPlus />}
                    colorScheme="blue"
                    variant="outline"
                    isLoading={isEditFilesUploading}
                    isDisabled={isSelectedInvoicePaid || isEditFilesUploading}
                    onClick={() => editFilesRef.current?.click()}
                  >
                    Add Files
                  </Button>
                  <input
                    ref={editFilesRef}
                    type="file"
                    multiple
                    hidden
                    accept=".pdf,.png,.jpg,.jpeg,.csv,.xls,.xlsx"
                    onChange={handleUploadEditFiles}
                  />
                </Flex>
                {isEditFilesLoading ? (
                  <VStack spacing={2} align="stretch">
                    <SkeletonText noOfLines={2} spacing="2" />
                    <SkeletonText noOfLines={2} spacing="2" />
                  </VStack>
                ) : editInvoiceFiles.length === 0 ? (
                  <Text fontSize="sm" color="gray.500">No attachments uploaded for this invoice.</Text>
                ) : (
                  <List spacing={2}>
                    {editInvoiceFiles.map((file) => {
                      const IconComp = pickFileIcon(file.originalName);
                      return (
                        <ListItem key={`edit-${file.fileIndex}-${file.originalName}`}>
                          <Flex align="center" border="1px" borderColor={border} borderRadius="10px" p={2.5} gap={3}>
                            <Box color="blue.500"><Icon as={IconComp} boxSize={4} /></Box>
                            <Box minW={0} flex={1}>
                              <Text fontSize="sm" fontWeight="600" color="gray.700" isTruncated>{file.originalName}</Text>
                              <Text fontSize="xs" color="gray.500">{(file.extension || "").toUpperCase().replace('.', '') || 'FILE'}</Text>
                            </Box>
                            <HStack spacing={1.5}>
                              <Button size="xs" variant="outline" leftIcon={<FiEye />} onClick={() => handleViewFile(selectedInvoice, file)}>
                                View
                              </Button>
                              {!isSelectedInvoicePaid && (
                                <>
                                  <Button size="xs" colorScheme="blue" leftIcon={<FiDownload />} onClick={() => handleDownloadFile(selectedInvoice, file)}>
                                    Download
                                  </Button>
                                  <IconButton
                                    size="xs"
                                    colorScheme="red"
                                    variant="ghost"
                                    icon={<FiTrash2 />}
                                    aria-label="Delete attachment"
                                    isLoading={isDeletingFile}
                                    onClick={() => setDeleteFileTarget({ row: selectedInvoice, file })}
                                  />
                                </>
                              )}
                            </HStack>
                          </Flex>
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </Box>

             
            </VStack>
          </ModalBody>
          <ModalFooter>
             <HStack justify="flex-end" spacing={3}>
                {isSelectedInvoicePaid ? (
                  <Button colorScheme="blue" onClick={() => setIsEditOpen(false)}>Close</Button>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => setIsEditOpen(false)} isDisabled={isEditSaving}>Cancel</Button>
                    <Button colorScheme="blue" onClick={handleSaveEdit} isLoading={isEditSaving}>Save Changes</Button>
                  </>
                )}
              </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteFileTarget}
        onClose={() => {
          if (!isDeletingFile) setDeleteFileTarget(null);
        }}
        onConfirm={() => {
          if (deleteFileTarget?.row && deleteFileTarget?.file) {
            handleDeleteFile(deleteFileTarget.row, deleteFileTarget.file);
          }
        }}
        title="Delete Attachment"
        message={deleteFileTarget?.file?.originalName
          ? `Are you sure you want to delete ${deleteFileTarget.file.originalName}?`
          : "Are you sure you want to delete this attachment?"}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        isLoading={isDeletingFile}
      />

      <ConfirmDialog
        isOpen={!!deleteInvoiceTarget}
        onClose={() => {
          if (!isDeleteInvoiceLoading) setDeleteInvoiceTarget(null);
        }}
        onConfirm={() => {
          if (deleteInvoiceTarget?.id) {
            handleDeleteInvoice(deleteInvoiceTarget.id);
          }
        }}
        title="Delete Vendor Invoice"
        message={deleteInvoiceTarget?.invoiceNumber
          ? `Are you sure you want to delete invoice ${deleteInvoiceTarget.invoiceNumber}?`
          : "Are you sure you want to delete this vendor invoice?"}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        isLoading={isDeleteInvoiceLoading}
      />
    </VStack>
   


  );
};

// ── Upload Form Tab ───────────────────────────────────────────
const UploadTab = ({ onViewInvoices, onSuccess }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef();
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [isLoadingVendors, setIsLoadingVendors] = useState(true);
  const [usageComparison, setUsageComparison] = useState(null);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);

  const [form, setForm] = useState({
    vendorCode: "", invoiceNumber: "", issueDate: "",
    startDate: "", endDate: "", grandTotal: "", currency: "USD", totalSeconds: "",
  });
  const [errors, setErrors] = useState({});

  const cardBg     = useColorModeValue("white", "gray.800");
  const border     = useColorModeValue("gray.200", "gray.700");
  const label      = useColorModeValue("gray.500", "gray.400");

  useEffect(() => {
    const loadVendors = async () => {
      try {
        const data = await fetchVendors();
        setVendors(data);
      } catch (error) {
        toast({ title: "Error fetching vendors", description: error.message, status: "error", duration: 3000, isClosable: true });
      } finally {
        setIsLoadingVendors(false);
      }
    };
    loadVendors();
  }, [toast]);

  const handleField = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: "" }));
    if (["vendorCode", "startDate", "endDate", "grandTotal"].includes(k)) {
      setUsageComparison(null);
    }
  };

  const addFiles = (incoming) => {
    const valid = [...incoming].filter(f =>
      ["application/pdf","image/png","image/jpeg","image/jpg",
       "application/vnd.ms-excel",
       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
       "text/csv"].includes(f.type)
    );

    if (valid.length !== incoming.length) {
      toast({ title: "Some files were skipped", description: "Only PDF, PNG, JPG, CSV, XLS/XLSX allowed.", status: "warning", duration: 3000 });
    }

    const newEntries = valid.map((f) => ({
      file: f,
      id: Math.random().toString(36).slice(2),
      done: true,
    }));

    setFiles((prev) => [...prev, ...newEntries]);
  };

  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const validate = () => {
    const e = {};
    if (!form.vendorCode)      e.vendorCode      = "Please select a vendor";
    if (!form.invoiceNumber) e.invoiceNumber = "Invoice number is required";
    if (!form.issueDate)     e.issueDate     = "Issue date is required";
    if (!form.startDate)     e.startDate     = "Start date is required";
    if (!form.endDate)       e.endDate       = "End date is required";
    if (form.startDate && form.endDate && form.startDate > form.endDate)
      e.endDate = "End date must be after start date";
    if (!form.grandTotal)    e.grandTotal    = "Grand total is required";
    else if (isNaN(form.grandTotal) || +form.grandTotal < 0) e.grandTotal = "Enter a valid amount";
    if (files.length === 0)  e.files         = "Please attach at least one invoice file";
    return e;
  };

  const handleCheckUsage = async () => {
    const e = {};
    if (!form.vendorCode) e.vendorCode = "Please select a vendor";
    if (!form.startDate) e.startDate = "Start date is required";
    if (!form.endDate) e.endDate = "End date is required";
    if (!form.grandTotal) e.grandTotal = "Grand total is required";
    if (Object.keys(e).length) {
      setErrors((prev) => ({ ...prev, ...e }));
      toast({ title: "Please complete vendor/date/amount to check usage", status: "warning", duration: 3000, isClosable: true });
      return;
    }

    setIsCheckingUsage(true);
    try {
      const response = await previewVendorInvoiceUsage({
        vendorCode: form.vendorCode,
        startDate: form.startDate,
        endDate: form.endDate,
        grandTotal: Number(form.grandTotal || 0),
      });
      setUsageComparison(response.usageComparison || null);
      const comparison = response?.usageComparison || null;
      const isMismatch = Boolean(comparison?.mismatchDetected);
      const canRaiseDispute = Boolean(comparison?.canRaiseDispute);
      toast({
        title: isMismatch ? (canRaiseDispute ? "Mismatch detected" : "Favorable mismatch detected") : "Usage matched",
        status: isMismatch ? (canRaiseDispute ? "warning" : "info") : "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({ title: "Usage check failed", description: error.message, status: "error", duration: 4000, isClosable: true });
    } finally {
      setIsCheckingUsage(false);
    }
  };

  const handleSubmit = async (disputeAction = null) => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      toast({ title: "Please fix the highlighted fields", status: "error", duration: 3000, isClosable: true });
      return;
    }

    if (!usageComparison) {
      toast({ title: "Please check vendor usage first", status: "warning", duration: 3000, isClosable: true });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      if (disputeAction) {
        formData.append("disputeAction", disputeAction);
      }
      files.forEach(f => formData.append("files", f.file));
      const response = await uploadVendorInvoice(formData);
      setUsageComparison(response.usageComparison || null);
      setSubmitted(true);
      toast({ title: "Invoice Submitted Successfully", description: `Invoice ${form.invoiceNumber} has been saved.`, status: "success", duration: 5000, isClosable: true });
      if (onSuccess) onSuccess();
    } catch (error) {
      toast({ title: "Submission Failed", description: error.message, status: "error", duration: 5000, isClosable: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm({ vendorCode: "", invoiceNumber: "", issueDate: "", startDate: "", endDate: "", grandTotal: "", currency: "USD", totalSeconds: "" });
    setFiles([]); setErrors({}); setSubmitted(false); setUsageComparison(null);
  };

  const selectedVendor = vendors.find(v => (v.vendorCode || v.accountId).toString() === form.vendorCode.toString());

  if (submitted) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" p={6}>
        <Card bg={cardBg} border="1px" borderColor={border} shadow="lg" maxW="580px" w="full" textAlign="center" borderRadius="16px">
          <CardBody py={12} px={10}>
            <Circle size="80px" bg="green.50" border="2px" borderColor={usageComparison?.mismatchDetected ? "orange.200" : "green.200"} mx="auto" mb={6}>
              <Box color={usageComparison?.mismatchDetected ? "orange.500" : "green.500"} fontSize="3xl"><FiCheck /></Box>
            </Circle>
            <Heading size="md" color="gray.800" mb={2}>Invoice Submitted!</Heading>
            <Text color="gray.500" fontSize="sm" mb={1}>Invoice <b>{form.invoiceNumber}</b></Text>
            <Text color="gray.500" fontSize="sm" mb={6}>
              {selectedVendor?.name} · {files.length} file{files.length !== 1 ? "s" : ""} attached
            </Text>

            {/* Display usage comparison if available */}
            {usageComparison && (
              <Box mb={6} p={4} bg={usageComparison.mismatchDetected ? (usageComparison.canRaiseDispute ? "orange.50" : "blue.50") : "green.50"} borderRadius="lg" border="1px" borderColor={usageComparison.mismatchDetected ? (usageComparison.canRaiseDispute ? "orange.200" : "blue.200") : "green.200"}>
                <VStack align="start" spacing={2}>
                  <HStack width="100%" justify="space-between">
                    <Text fontSize="xs" fontWeight="bold" color="gray.600">Uploaded Amount:</Text>
                    <Text fontSize="sm" fontWeight="bold" color="gray.800">${usageComparison.uploadedAmount.toFixed(4)}</Text>
                  </HStack>
                  <HStack width="100%" justify="space-between">
                    <Text fontSize="xs" fontWeight="bold" color="gray.600">Actual Usage:</Text>
                    <Text fontSize="sm" fontWeight="bold" color="gray.800">${usageComparison.actualUsage.toFixed(4)}</Text>
                  </HStack>
                  {usageComparison.mismatchDetected && (
                    <>
                      <Divider my={2} />
                      <HStack width="100%" justify="space-between">
                        <Text fontSize="xs" fontWeight="bold" color={usageComparison.canRaiseDispute ? "orange.700" : "blue.700"}>Mismatch Amount:</Text>
                        <Text fontSize="sm" fontWeight="bold" color={usageComparison.canRaiseDispute ? "orange.600" : "blue.600"}>${usageComparison.mismatchAmount.toFixed(4)}</Text>
                      </HStack>
                      <HStack width="100%" justify="space-between">
                        <Text fontSize="xs" fontWeight="bold" color={usageComparison.canRaiseDispute ? "orange.700" : "blue.700"}>Difference:</Text>
                        <Text fontSize="sm" fontWeight="bold" color={usageComparison.canRaiseDispute ? "orange.600" : "blue.600"}>{usageComparison.percentageDiff}</Text>
                      </HStack>
                      <Alert status={usageComparison.disputeRaised ? "warning" : "info"} borderRadius="md" mt={2} variant="subtle">
                        <AlertIcon />
                        <Box>
                          <AlertTitle fontSize="xs">Mismatch Detected</AlertTitle>
                          <AlertDescription fontSize="xs">
                            {usageComparison.disputeRaised
                              ? "A dispute has been raised for this invoice due to overbilling mismatch."
                              : "Uploaded amount is not higher than usage, so no dispute action was required."}
                          </AlertDescription>
                        </Box>
                      </Alert>
                    </>
                  )}
                </VStack>
              </Box>
            )}

            <HStack justify="center" spacing={3}>
              <Button colorScheme="blue" size="sm" onClick={handleReset}>Upload Another</Button>
              <Button variant="outline" size="sm" onClick={onViewInvoices} borderColor={border}>View All Invoices</Button>
            </HStack>
          </CardBody>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Grid templateColumns={{ base: "1fr", lg: "1fr 300px" }} gap={6}>
        {/* LEFT */}
        <VStack spacing={6} align="stretch">
          {/* Vendor & Invoice Details */}
          <Card bg={cardBg} border="1px" borderColor={border} shadow="sm" borderRadius="12px">
            <CardHeader pb={3}>
              <HStack><Box w={1} h={5} bg="blue.500" borderRadius="full" /><Heading size="sm" color="gray.800">Vendor & Invoice Details</Heading></HStack>
            </CardHeader>
            <CardBody pt={0}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isInvalid={!!errors.vendorCode} isRequired gridColumn={{ md: "span 2" }}>
                  <FormLabel fontSize="sm" color={label} fontWeight="500">Vendor</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none" color="gray.400"><FiTruck /></InputLeftElement>
                    <Select pl={10} placeholder={isLoadingVendors ? "Loading vendors..." : "Select vendor…"} value={form.vendorCode}
                      onChange={e => handleField("vendorCode", e.target.value)} borderColor={border} fontSize="sm"
                      disabled={isLoadingVendors}
                      _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}>
                      {vendors.map(v => (  
                        <option key={v.vendorCode || v.accountId} value={v.vendorCode || v.accountId}>
                          {v.accountName} ({v.vendorCode || v.accountId}) {v.accountRole === "both" ? "[Bilateral]" : ""}
                        </option>
                      ))}
                    </Select>
                  </InputGroup>
                  <FormErrorMessage fontSize="xs">{errors.vendorCode}</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!!errors.invoiceNumber} isRequired>
                  <FormLabel fontSize="sm" color={label} fontWeight="500">Invoice Number</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none" color="gray.400"><FiHash /></InputLeftElement>
                    <Input pl={10} placeholder="INV-2024-00123" value={form.invoiceNumber}
                      onChange={e => handleField("invoiceNumber", e.target.value)} borderColor={border} fontSize="sm"
                      _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                  </InputGroup>
                  <FormErrorMessage fontSize="xs">{errors.invoiceNumber}</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!!errors.issueDate} isRequired>
                  <FormLabel fontSize="sm" color={label} fontWeight="500">Issue Date</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none" color="gray.400"><FiCalendar /></InputLeftElement>
                    <Input pl={10} type="date" value={form.issueDate}
                      onChange={e => handleField("issueDate", e.target.value)} borderColor={border} fontSize="sm"
                      _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                  </InputGroup>
                  <FormErrorMessage fontSize="xs">{errors.issueDate}</FormErrorMessage>
                </FormControl>

                <FormControl isInvalid={!!errors.files} isRequired gridColumn={{ md: "span 2" }}>
                  <FormLabel fontSize="sm" color={label} fontWeight="500">Invoice Documents</FormLabel>
                  <HStack spacing={2} align="center" mb={2}>
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      hidden
                      accept=".pdf,.png,.jpg,.jpeg,.csv,.xls,.xlsx"
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      size="sm"
                      leftIcon={<FiUploadCloud size={14} />}
                      variant="outline"
                      borderColor={border}
                      onClick={() => fileRef.current?.click()}
                      isLoading={isSubmitting}
                      loadingText="Uploading"
                      isDisabled={isSubmitting}
                    >
                      Upload Files
                    </Button>
                    <Text fontSize="xs" color="gray.500">PDF, PNG, JPG, CSV, XLS/XLSX</Text>
                  </HStack>

                  {files.length > 0 && (
  <Grid templateColumns="repeat(2, 1fr)" gap={2}>
    {files.map(({ file, id }) => (
      <Flex
        key={id}
        align="center"
        justify="space-between"
        p={2}
        border="1px"
        borderColor={border}
        borderRadius="md"
        bg="gray.50"
      >
        <HStack spacing={2} minW={0}>
          <Box color="blue.500"><FiFile size={14} /></Box>
          <Text fontSize="xs" fontWeight="500" color="gray.700" isTruncated>
            {file.name}
          </Text>
          <Text fontSize="xs" color="gray.500">
            ({fmtBytes(file.size)})
          </Text>
        </HStack>
        <IconButton
          size="xs"
          variant="ghost"
          colorScheme="red"
          aria-label="Remove file"
          icon={<FiX size={14} />}
          onClick={() => removeFile(id)}
          isDisabled={isSubmitting}
        />
      </Flex>
    ))}
  </Grid>
)}

                  {errors.files && (
                    <HStack mt={2} color="red.500" spacing={1}>
                      <FiAlertTriangle />
                      <Text fontSize="xs">{errors.files}</Text>
                    </HStack>
                  )}
                </FormControl>
              </SimpleGrid>
            </CardBody>
          </Card>

          {/* Billing Period */}
          <Card bg={cardBg} border="1px" borderColor={border} shadow="sm" borderRadius="12px">
            <CardHeader pb={3}>
              <HStack><Box w={1} h={5} bg="purple.500" borderRadius="full" /><Heading size="sm" color="gray.800">Billing Period</Heading></HStack>
            </CardHeader>
            <CardBody pt={0}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isInvalid={!!errors.startDate} isRequired>
                  <FormLabel fontSize="sm" color={label} fontWeight="500">Usage Start Date</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none" color="gray.400"><FiCalendar /></InputLeftElement>
                    <Input pl={10} type="date" value={form.startDate}
                      onChange={e => handleField("startDate", e.target.value)} borderColor={border} fontSize="sm"
                      _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                  </InputGroup>
                  <FormErrorMessage fontSize="xs">{errors.startDate}</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!!errors.endDate} isRequired>
                  <FormLabel fontSize="sm" color={label} fontWeight="500">Usage End Date</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none" color="gray.400"><FiCalendar /></InputLeftElement>
                    <Input pl={10} type="date" value={form.endDate}
                      onChange={e => handleField("endDate", e.target.value)} borderColor={border} fontSize="sm"
                      _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                  </InputGroup>
                  <FormErrorMessage fontSize="xs">{errors.endDate}</FormErrorMessage>
                </FormControl>
                {form.startDate && form.endDate && form.startDate <= form.endDate && (
                  <Box gridColumn={{ md: "span 2" }} p={3} bg="purple.50" borderRadius="lg" border="1px" borderColor="purple.100">
                    <HStack spacing={2}>
                      <Box color="purple.500"><FiCalendar /></Box>
                      <Text fontSize="xs" color="purple.700" fontWeight="500">
                        Billing period:{" "}
                        {Math.round((new Date(form.endDate) - new Date(form.startDate)) / (1000 * 60 * 60 * 24) + 1)} days
                        &nbsp;({new Date(form.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        &nbsp;→&nbsp;
                        {new Date(form.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })})
                      </Text>
                    </HStack>
                  </Box>
                )}
              </SimpleGrid>
            </CardBody>
          </Card>

          {/* Financials */}
          <Card bg={cardBg} border="1px" borderColor={border} shadow="sm" borderRadius="12px">
            <CardHeader pb={3}>
              <HStack><Box w={1} h={5} bg="green.500" borderRadius="full" /><Heading size="sm" color="gray.800">Financial & Usage Summary</Heading></HStack>
            </CardHeader>
            <CardBody pt={0}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isInvalid={!!errors.grandTotal} isRequired>
                  <FormLabel fontSize="sm" color={label} fontWeight="500">Grand Total</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none" color="gray.400"><FiDollarSign /></InputLeftElement>
                    <Input pl={10} pr="90px" type="number" min={0} step="0.01" placeholder="0.00"
                      value={form.grandTotal} onChange={e => handleField("grandTotal", e.target.value)}
                      borderColor={border} fontSize="sm"
                      _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                    <InputRightElement w="80px" pr={1}>
                      <Select size="xs" value={form.currency} border="none"
                        onChange={e => handleField("currency", e.target.value)}
                        fontWeight="600" fontSize="xs" color="gray.600" bg="transparent" cursor="pointer">
                        {CURRENCY.map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </InputRightElement>
                  </InputGroup>
                  <FormErrorMessage fontSize="xs">{errors.grandTotal}</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!!errors.totalSeconds}>
                  <FormLabel fontSize="sm" color={label} fontWeight="500">
                    Total Seconds (Usage)
                    <Tooltip label="Sum of all call durations in seconds as reported by the vendor" placement="top">
                      <Box as="span" ml={1.5} color="gray.400" display="inline-flex" verticalAlign="middle"><FiAlertTriangle /></Box>
                    </Tooltip>
                  </FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none" color="gray.400"><FiClock /></InputLeftElement>
                    <Input pl={10} type="number" min={0} placeholder="e.g. 3600000"
                      value={form.totalSeconds} onChange={e => handleField("totalSeconds", e.target.value)}
                      borderColor={border} fontSize="sm"
                      _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                  </InputGroup>
                  {form.totalSeconds && !isNaN(form.totalSeconds) && +form.totalSeconds > 0 && (
                    <Text fontSize="xs" color="teal.600" mt={1} fontWeight="500">≈ {fmtSeconds(+form.totalSeconds)}</Text>
                  )}
                  <FormErrorMessage fontSize="xs">{errors.totalSeconds}</FormErrorMessage>
                </FormControl>
               
              </SimpleGrid>
            </CardBody>
          </Card>

          {/* Usage comparison */}
          <Card bg={cardBg} border="1px" borderColor={border} shadow="sm" borderRadius="12px">
            <CardHeader pb={3}>
              <HStack><Box w={1} h={5} bg="orange.500" borderRadius="full" /><Heading size="sm" color="gray.800">Vendor Usage Comparison</Heading></HStack>
            </CardHeader>
            <CardBody pt={0}>
              <Button
                mb={3}
                size="sm"
                colorScheme="orange"
                variant="outline"
                onClick={handleCheckUsage}
                isLoading={isCheckingUsage}
                isDisabled={isSubmitting}
              >
                Check Vendor Usage
              </Button>

              {usageComparison ? (
                <TableContainer border="1px" borderColor={border} borderRadius="md">
                  <Table size="sm">
                    <Thead bg="gray.50">
                      <Tr>
                        <Th>Metric</Th>
                        <Th isNumeric>Value</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {(usageComparison.rows || []).map((row) => (
                        <Tr key={row.label}>
                          <Td>{row.label}</Td>
                          <Td isNumeric fontWeight="600">
                            {typeof row.value === "number" ? `${form.currency} ${row.value.toFixed(4)}` : row.value}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              ) : (
                <Text fontSize="xs" color="gray.500">Run usage check to view vendor invoice amount vs vendor usage difference and percentage.</Text>
              )}
            </CardBody>
          </Card>
        </VStack>

        {/* RIGHT */}
        <VStack spacing={5} align="stretch">
          <Card bg="blue.700" border="none" shadow="md" color="white" borderRadius="12px">
            <CardBody p={5}>
              <Text fontSize="xs" fontWeight="600" color="whiteAlpha.800" letterSpacing="1px" mb={4} textTransform="uppercase">Invoice Summary</Text>
              <VStack spacing={3} align="stretch">
                {[
                  { label: "Vendor",     value: selectedVendor?.name || "—" },
                  { label: "Invoice #",  value: form.invoiceNumber || "—" },
                  { label: "Issue Date", value: form.issueDate ? new Date(form.issueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—" },
                  { label: "Period",     value: form.startDate && form.endDate ? `${new Date(form.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${new Date(form.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}` : "—" },
                ].map(({ label: l, value: v }) => (
                  <Flex key={l} justify="space-between" align="flex-start">
                    <Text fontSize="xs" color="whiteAlpha.600">{l}</Text>
                    <Text fontSize="xs" fontWeight="600" textAlign="right" maxW="60%" color="white">{v}</Text>
                  </Flex>
                ))}
                <Divider borderColor="whiteAlpha.200" />
                <Flex justify="space-between" align="baseline">
                  <Text fontSize="xs" color="whiteAlpha.600">Grand Total</Text>
                  <Text fontSize="xl" fontWeight="800" color="white" letterSpacing="-0.5px">
                    {form.grandTotal ? `${form.currency} ${Number(form.grandTotal).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                  </Text>
                </Flex>
                <Flex justify="space-between" align="center">
                  <Text fontSize="xs" color="whiteAlpha.600">Total Duration</Text>
                  <Text fontSize="sm" fontWeight="600" color="teal.200">{form.totalSeconds ? fmtSeconds(+form.totalSeconds) : "—"}</Text>
                </Flex>
                <Flex justify="space-between" align="center">
                  <Text fontSize="xs" color="whiteAlpha.600">Files Attached</Text>
                  <Badge colorScheme={files.filter(f => f.done).length === files.length && files.length > 0 ? "green" : "yellow"} fontSize="xs">
                    {files.filter(f => f.done).length}/{files.length} ready
                  </Badge>
                </Flex>
              </VStack>
            </CardBody>
          </Card>

          {/* Checklist */}
          <Card bg={cardBg} border="1px" borderColor={border} shadow="sm" borderRadius="12px">
            <CardBody p={4}>
              <Text fontSize="xs" fontWeight="600" color="gray.400" letterSpacing="1px" mb={3} textTransform="uppercase">Completion</Text>
              <VStack spacing={2} align="stretch">
                {[
                  { label: "Vendor selected",   done: !!form.vendorId },
                  { label: "Invoice number",     done: !!form.invoiceNumber },
                  { label: "Issue date",         done: !!form.issueDate },
                  { label: "Billing period",     done: !!form.startDate && !!form.endDate },
                  { label: "Grand total",        done: !!form.grandTotal },
                  { label: "Total seconds",      done: !!form.totalSeconds },
                  { label: "File(s) attached",   done: files.length > 0 && files.every(f => f.done) },
                ].map(({ label: l, done }) => (
                  <Flex key={l} align="center" justify="space-between">
                    <HStack spacing={2}>
                      <Circle size="18px" bg={done ? "green.100" : "gray.100"} border="1px" borderColor={done ? "green.200" : "gray.200"}>
                        <Box color={done ? "green.500" : "gray.300"} transform="scale(0.8)"><FiCheck /></Box>
                      </Circle>
                      <Text fontSize="xs" color={done ? "gray.700" : "gray.400"} fontWeight={done ? "500" : "400"}>{l}</Text>
                    </HStack>
                    {done && <Badge colorScheme="green" fontSize="xs" variant="subtle">✓</Badge>}
                  </Flex>
                ))}
              </VStack>
              <Box mt={3}>
                {(() => {
                  const checks = [!!form.vendorId, !!form.invoiceNumber, !!form.issueDate, !!form.startDate && !!form.endDate, !!form.grandTotal, !!form.totalSeconds, files.length > 0 && files.every(f => f.done)];
                  const pct = Math.round(checks.filter(Boolean).length / checks.length * 100);
                  return (
                    <>
                      <Flex justify="space-between" mb={1}>
                        <Text fontSize="xs" color="gray.400">Form completion</Text>
                        <Text fontSize="xs" fontWeight="600" color={pct === 100 ? "green.500" : "blue.500"}>{pct}%</Text>
                      </Flex>
                      <Progress value={pct} size="sm" colorScheme={pct === 100 ? "green" : "blue"} borderRadius="full" bg="gray.100" />
                    </>
                  );
                })()}
              </Box>
            </CardBody>
          </Card>

          <VStack spacing={2}>
            {usageComparison?.mismatchDetected && usageComparison?.canRaiseDispute ? (
              <>
                <Button
                  w="full"
                  colorScheme="yellow"
                  size="md"
                  fontWeight="600"
                  onClick={() => handleSubmit("without_dispute")}
                  isLoading={isSubmitting}
                  loadingText="Saving..."
                  borderRadius="8px"
                >
                  Save Without Dispute
                </Button>
                <Button
                  w="full"
                  colorScheme="red"
                  size="md"
                  fontWeight="600"
                  onClick={() => handleSubmit("raise_dispute")}
                  isLoading={isSubmitting}
                  loadingText="Saving..."
                  borderRadius="8px"
                >
                  Save and Raise Dispute
                </Button>
              </>
            ) : (
              <Button
                w="full"
                colorScheme="green"
                size="md"
                fontWeight="600"
                onClick={() => handleSubmit("without_dispute")}
                isLoading={isSubmitting}
                loadingText="Submitting…"
                borderRadius="8px"
              >
                Submit Invoice
              </Button>
            )}
            <Button w="full" variant="ghost" leftIcon={<FiRotateCcw />} size="sm" color="gray.600" onClick={handleReset}>
              Reset Form
            </Button>
          </VStack>
        </VStack>
      </Grid>
    </Box>
  );
};

// ── Main Page with Custom Tabs ────────────────────────────────
export default function VendorInvoicePage() {
  const [activeTab, setActiveTab] = useState(0); // 0 = Invoices, 1 = Upload
  const border = useColorModeValue("gray.200", "gray.700");
  const cardBg = useColorModeValue("white", "gray.800");

  const tabs = [
    { label: "Invoices",       icon: FiList,        index: 0 },
    { label: "Upload Invoice", icon: FiUploadCloud,  index: 1 },
  ];

  return (
    <Box>
      {/* Page header */}
      <PageNavBar
        title="Vendor Invoices"
        description="Manage and upload vendor usage invoices"
      />

      {/* Custom Tab Bar */}
      <Box
        bg={cardBg}
        border="1px"
        borderColor={border}
        borderRadius="12px"
        p={1}
        display="inline-flex"
        mb={4}
        mt={4}
        boxShadow="0 1px 4px rgba(0,0,0,0.05)"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.index;
          return (
            <Flex
              key={tab.index}
              align="center"
              gap={2}
              px={5}
              py={2}
              borderRadius="9px"
              cursor="pointer"
              fontWeight={isActive ? "600" : "500"}
              fontSize="14px"
              color={isActive ? "white" : "gray.500"}
              bg={isActive ? "blue.500" : "transparent"}
              boxShadow={isActive ? "0 2px 8px rgba(49,130,206,0.35)" : "none"}
              transition="all 0.2s"
              onClick={() => setActiveTab(tab.index)}
              _hover={!isActive ? { bg: "gray.100", color: "gray.700" } : {}}
              userSelect="none"
            >
              <Box as={tab.icon} boxSize="15px" />
              {tab.label}
            </Flex>
          );
        })}
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && <InvoicesTab onAddNew={() => setActiveTab(1)} />}
      {activeTab === 1 && (
        <UploadTab
          onViewInvoices={() => setActiveTab(0)}
          onSuccess={() => setActiveTab(0)}
        />
      )}
    </Box>
  );
}