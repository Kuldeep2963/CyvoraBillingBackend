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
  CardHeader,
  SimpleGrid,
  Icon,
  Flex,
  Stat,
  StatLabel,
  StatNumber,
  useColorModeValue,
  InputGroup,
  InputLeftElement,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Divider,
  Skeleton,
  SkeletonText,
  IconButton,
} from "@chakra-ui/react";
import {
  FiAlertCircle,
  FiSearch,
  FiRefreshCw,
  FiEye,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiUser,
  FiFileText,
  FiDollarSign,
  FiCalendar,
  FiMessageSquare,
  FiTrash2,
} from "react-icons/fi";
import { getAllDisputes, deleteDispute } from "../utils/api";
import ConfirmDialog from "../components/ConfirmDialog";
import { format } from "date-fns";

// ── Status helpers ────────────────────────────────────────────
const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "open":       return "red";
    case "in_review":  return "orange";
    case "resolved":   return "blue";
    case "closed":     return "green";
    default:           return "gray";
  }
};

const getStatusIcon = (status) => {
  switch (status?.toLowerCase()) {
    case "open":       return FiAlertCircle;
    case "in_review":  return FiClock;
    case "resolved":   return FiCheckCircle;
    case "closed":     return FiCheckCircle;
    default:           return FiAlertTriangle;
  }
};

const formatAmount = (val) =>
  parseFloat(val || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

// ── Detail Row used inside modal ──────────────────────────────
const DetailRow = ({ icon, label, children }) => (
  <Box>
    <HStack spacing={2} mb={1}>
      <Icon as={icon} color="blue.400" boxSize={3.5} />
      <Text fontSize="11px" fontWeight="700" color="gray.400"
        textTransform="uppercase" letterSpacing="0.08em">
        {label}
      </Text>
    </HStack>
    <Box pl={6}>{children}</Box>
  </Box>
);

// ── Main Component ────────────────────────────────────────────
const Disputes = () => {
  const [disputes,         setDisputes]         = useState([]);
  const [filteredDisputes, setFilteredDisputes] = useState([]);
  const [searchTerm,       setSearchTerm]       = useState("");
  const [statusFilter,     setStatusFilter]     = useState("all");
  const [isLoading,        setIsLoading]        = useState(true);
  const [selectedDispute,  setSelectedDispute]  = useState(null);
  const [disputeToDelete,  setDisputeToDelete]  = useState(null);
  const [isDeleting,       setIsDeleting]       = useState(false);
  const [stats, setStats] = useState({
    openDisputes: 0, totalDisputes: 0, totalDisputedAmount: 0, inReviewCount: 0,
  });

  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isConfirmOpen, onOpen: onConfirmOpen, onClose: onConfirmClose } = useDisclosure();
  const toast       = useToast();
  const cardBg      = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const hoverBg     = useColorModeValue("blue.50",  "gray.700");

  // ── Load ────────────────────────────────────────────────────
  useEffect(() => { loadDisputes(); }, []);

  useEffect(() => {
    let filtered = disputes;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.customerName?.toLowerCase().includes(t) ||
          d.customerCode?.toLowerCase().includes(t) ||
          d.invoiceNumber?.toLowerCase().includes(t),
      );
    }
    if (statusFilter !== "all") filtered = filtered.filter((d) => d.status === statusFilter);
    setFilteredDisputes(filtered);
  }, [disputes, searchTerm, statusFilter]);

  const loadDisputes = async () => {
    setIsLoading(true);
    try {
      const response = await getAllDisputes();
      if (response.success) {
        const data = response.data || [];
        setDisputes(data);
        setStats({
          openDisputes:        data.filter((d) => d.status === "open").length,
          inReviewCount:       data.filter((d) => d.status === "in_review").length,
          totalDisputes:       data.length,
          totalDisputedAmount: data.reduce((s, d) => s + parseFloat(d.disputeAmount || 0), 0),
        });
      } else {
        toast({ title: "Failed to load disputes", description: response.error, status: "error", duration: 3000, isClosable: true });
      }
    } catch (err) {
      toast({ title: "Error loading disputes", description: err.message, status: "error", duration: 3000, isClosable: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (dispute) => {
    setDisputeToDelete(dispute);
    onConfirmOpen();
  };

  const handleConfirmDelete = async () => {
    if (!disputeToDelete) return;

    setIsDeleting(true);
    try {
      const response = await deleteDispute(disputeToDelete.id);
      if (response.success) {
        toast({
          title: "Dispute deleted",
          description: `Dispute for ${disputeToDelete.customerName} has been deleted successfully.`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        onConfirmClose();
        loadDisputes();
      } else {
        toast({
          title: "Failed to delete dispute",
          description: response.error || "An error occurred while deleting the dispute.",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (err) {
      toast({
        title: "Error deleting dispute",
        description: err.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleView = (dispute) => { setSelectedDispute(dispute); onOpen(); };

  // ── Stat card data ──────────────────────────────────────────
  const statCards = [
    { label: "Total Disputes",  value: stats.totalDisputes,                                            color: "blue"   },
    { label: "Open",            value: stats.openDisputes,                                             color: "red"    },
    { label: "In Review",       value: stats.inReviewCount,                                            color: "orange" },
    { label: "Disputed Amount", value: `$${formatAmount(stats.totalDisputedAmount)}`, color: "purple" },
  ];

  // ── Table columns ───────────────────────────────────────────
  const columns = [
    {
      header: "Customer",
      cell: (d) => (
        <Box>
          <Text fontWeight="600" fontSize="sm" color="gray.800">{d.customerName}</Text>
          <Text fontSize="xs" color="gray.400">{d.customerCode}</Text>
        </Box>
      ),
    },
    {
      header: "Invoice(s)",
      cell: (d) => (
        <Text fontSize="sm" maxW="180px" isTruncated color="blue.600" fontWeight="500">
          {d.invoiceNumber}
        </Text>
      ),
    },
    {
      header: "Amount",
      cell: (d) => (
        <Text fontWeight="700" color="red.500" fontSize="sm">
          ${formatAmount(d.disputeAmount)}
        </Text>
      ),
    },
    {
      header: "Mismatches",
      cell: (d) => (
        <Badge colorScheme="orange" variant="subtle" px={2} borderRadius="full">
          {d.mismatchedCount}
        </Badge>
      ),
    },
    {
      header: "Status",
      cell: (d) => {
        const StatusIcon = getStatusIcon(d.status);
        return (
          <Badge
            colorScheme={getStatusColor(d.status)}
            display="inline-flex" alignItems="center" gap={1}
            px={2} py={0.5} borderRadius="full" fontSize="11px"
          >
            <StatusIcon size={10} />
            {d.status?.replace("_", " ").toUpperCase()}
          </Badge>
        );
      },
    },
    {
      header: "Raised On",
      cell: (d) => (
        <Text fontSize="xs" color="gray.500">
          {d.createdAt ? format(new Date(d.createdAt), "MMM dd, yyyy") : "N/A"}
        </Text>
      ),
    },
    {
      header: "Actions",
      cell: (d) => (
        <HStack spacing={2}>
          <IconButton
            size="xs" colorScheme="red" icon={<FiTrash2/>} onClick={() => handleDeleteClick(d)} variant="ghost"
          />
          <Button size="xs" colorScheme="blue" variant="ghost"
            leftIcon={<FiEye />} borderRadius="6px" onClick={() => handleView(d)}>
            View
          </Button>
        </HStack>
      ),
    },
  ];

  return (
    <Box>
      {/* ── Header ─────────────────────────────────────────── */}
      <Flex
        mb={5} px={5} py={2} borderRadius="12px"
        bgGradient="linear(to-r, blue.100, blue.200, blue.300)"
        align="center" justify="space-between"
      >
        <Box>
          <Heading size="lg" color="gray.600">Dispute Management</Heading>
          <Text color="gray.500" fontSize="sm">Track and manage all raised disputes</Text>
        </Box>
        <Button leftIcon={<FiRefreshCw />} size="sm" colorScheme="blue"
          variant="outline" onClick={loadDisputes} isLoading={isLoading}
          bg="white" _hover={{ bg: "blue.50" }}>
          Refresh
        </Button>
      </Flex>

      {/* ── Stat Cards ─────────────────────────────────────── */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={5}>
        {statCards.map(({ label, value, color }) => (
          <Card key={label} bg={cardBg} borderWidth="1px" borderColor={borderColor}
            shadow="sm" borderRadius="10px">
            <CardBody py={3} px={4}>
              <Text fontSize="11px" fontWeight="700" color="gray.400"
                textTransform="uppercase" letterSpacing="0.06em" mb={1}>
                {label}
              </Text>
              {isLoading
                ? <Skeleton h="28px" w="60%" borderRadius="4px" />
                : <Text fontSize="xl" fontWeight="800" color={`${color}.500`}>{value}</Text>
              }
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      {/* ── Filter Bar ─────────────────────────────────────── */}
      <Card bg={cardBg} borderWidth="1px" borderColor={borderColor} shadow="sm"
        borderRadius="10px" mb={4}>
        <CardBody py={3} px={4}>
          <Flex gap={3} flexWrap="wrap" align="center">
            <InputGroup size="sm" maxW="280px">
              <InputLeftElement pointerEvents="none" color="gray.400">
                <FiSearch />
              </InputLeftElement>
              <Input
                pl={9} placeholder="Search customer, code, invoice…"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                borderRadius="8px" borderColor={borderColor} fontSize="13px"
                _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
              />
            </InputGroup>
            <Select size="sm" maxW="180px" borderRadius="8px" borderColor={borderColor}
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              fontSize="13px">
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_review">In Review</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </Select>
            {(searchTerm || statusFilter !== "all") && (
              <Button size="sm" variant="ghost" colorScheme="gray" fontSize="12px"
                onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}>
                Clear
              </Button>
            )}
            <Text ml="auto" fontSize="12px" color="gray.400">
              {filteredDisputes.length} result{filteredDisputes.length !== 1 ? "s" : ""}
            </Text>
          </Flex>
        </CardBody>
      </Card>

      {/* ── Table Card ─────────────────────────────────────── */}
      <Card bg={cardBg} borderWidth="1px" borderColor={borderColor}
        shadow="sm" borderRadius="10px" overflow="hidden">
        <CardHeader py={3} px={4} borderBottom="1px" borderColor={borderColor}>
          <HStack>
            <Box w={1} h={5} bg="blue.500" borderRadius="full" />
            <Heading size="sm" color="gray.800">Disputes</Heading>
            <Badge colorScheme="blue" variant="subtle" fontSize="xs" borderRadius="full">
              {filteredDisputes.length}
            </Badge>
          </HStack>
        </CardHeader>

        <TableContainer h="320px" overflowY="auto" overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead bg="gray.200" position="sticky" top={0} zIndex={1}>
              <Tr>
                {columns.map((col, i) => (
                  <Th key={i} color="gray.700" fontSize="11px" fontWeight="700"
                    textTransform="uppercase" letterSpacing="0.06em" py={3}
                    borderColor={borderColor}>
                    {col.header}
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Tr key={i}>
                    {columns.map((_, j) => (
                      <Td key={j} borderColor={borderColor} py={3}>
                        <Skeleton h="14px" borderRadius="4px" />
                      </Td>
                    ))}
                  </Tr>
                ))
              ) : filteredDisputes.length === 0 ? (
                <Tr>
                  <Td colSpan={columns.length} border="none">
                    <Flex direction="column" align="center" py={14} gap={2}>
                      <Icon as={FiAlertCircle} w={10} h={10} color="gray.200" />
                      <Text color="gray.400" fontSize="sm" fontWeight="500">No disputes found</Text>
                      {(searchTerm || statusFilter !== "all") && (
                        <Text color="gray.400" fontSize="xs">Try adjusting your filters</Text>
                      )}
                    </Flex>
                  </Td>
                </Tr>
              ) : (
                filteredDisputes.map((dispute) => (
                  <Tr key={dispute.id} _hover={{ bg: hoverBg }} transition="background 0.15s"
                    borderBottom="1px" borderColor={borderColor}>
                    {columns.map((col, j) => (
                      <Td key={j} py={3} borderColor={borderColor}>
                        {col.cell(dispute)}
                      </Td>
                    ))}
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </TableContainer>
      </Card>

      {/* ── Dispute Detail Modal ────────────────────────────── */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
        <ModalOverlay backdropFilter="blur(3px)" />
        <ModalContent borderRadius="12px" overflow="hidden">

          <ModalHeader
            bgGradient="linear(to-r, blue.500, blue.600)"
            color="white" py={4} px={5}
          >
            <HStack spacing={3}>
              <Box p={2} bg="whiteAlpha.200" borderRadius="8px">
                <FiAlertCircle size={18} />
              </Box>
              <Box>
                <Text fontSize="sm" fontWeight="700">Dispute Details</Text>
                {selectedDispute && (
                  <Text fontSize="xs" opacity={0.8} fontWeight="400">
                    {selectedDispute.customerName}
                  </Text>
                )}
              </Box>
            </HStack>
          </ModalHeader>
          <ModalCloseButton color="white" top={4} right={4} />

          <ModalBody py={5} px={5} overflowY="auto">
            {selectedDispute && (
              <VStack spacing={4} align="stretch">

                <Flex align="center" justify="space-between"
                  bg="gray.50" borderRadius="8px" px={4} py={3}>
                  <Text fontSize="xs" color="gray.500" fontWeight="600" textTransform="uppercase">
                    Current Status
                  </Text>
                  <Badge
                    colorScheme={getStatusColor(selectedDispute.status)}
                    px={3} py={1} borderRadius="full" fontSize="12px"
                    display="inline-flex" alignItems="center" gap={1}
                  >
                    {React.createElement(getStatusIcon(selectedDispute.status), { size: 11 })}
                    {selectedDispute.status?.replace("_", " ").toUpperCase()}
                  </Badge>
                </Flex>

                <Divider />

                <DetailRow icon={FiUser} label="Customer">
                  <Text fontSize="sm" fontWeight="600" color="gray.800">
                    {selectedDispute.customerName}
                  </Text>
                  <Text fontSize="xs" color="gray.400">Code: {selectedDispute.customerCode}</Text>
                </DetailRow>

                <DetailRow icon={FiFileText} label="Mismatched Invoices">
                  <Text fontSize="sm" fontFamily="mono" color="blue.600"
                    whiteSpace="pre-wrap" wordBreak="break-all">
                    {selectedDispute.invoiceNumber}
                  </Text>
                </DetailRow>

                <DetailRow icon={FiAlertTriangle} label="Mismatch Count">
                  <Badge colorScheme="orange" variant="subtle" px={3} py={0.5}
                    borderRadius="full" fontSize="13px">
                    {selectedDispute.mismatchedCount} mismatch{selectedDispute.mismatchedCount !== 1 ? "es" : ""}
                  </Badge>
                </DetailRow>

                <DetailRow icon={FiDollarSign} label="Dispute Amount">
                  <Text fontSize="xl" fontWeight="800" color="red.500">
                    ${formatAmount(selectedDispute.disputeAmount)}
                  </Text>
                </DetailRow>

                <Divider />

                <DetailRow icon={FiMessageSquare} label="Reason for Dispute">
                  <Box p={3} bg="blue.50" borderRadius="8px"
                    borderLeft="3px solid" borderColor="blue.400">
                    <Text fontSize="sm" color="gray.700" lineHeight="1.6">
                      {selectedDispute.comment || "No reason provided."}
                    </Text>
                  </Box>
                </DetailRow>

                <DetailRow icon={FiCalendar} label="Raised On">
                  <Text fontSize="sm" color="gray.600">
                    {selectedDispute.createdAt
                      ? format(new Date(selectedDispute.createdAt), "MMMM dd, yyyy · HH:mm:ss")
                      : "N/A"}
                  </Text>
                </DetailRow>

              </VStack>
            )}
          </ModalBody>

          <ModalFooter borderTop="1px" borderColor="gray.100" py={3} px={5}>
            <Button size="sm" variant="ghost" colorScheme="gray" onClick={onClose}
              borderRadius="8px">
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── Delete Confirmation Dialog ─────────────────────── */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={onConfirmClose}
        onConfirm={handleConfirmDelete}
        title="Delete Dispute"
        message={
          disputeToDelete
            ? `Are you sure you want to delete the dispute for ${disputeToDelete.customerName}? This action cannot be undone.`
            : "Are you sure you want to delete this dispute?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        isLoading={isDeleting}
      />
    </Box>
  );
};

export default Disputes;