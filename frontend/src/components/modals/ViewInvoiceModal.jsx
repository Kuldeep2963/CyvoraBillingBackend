import React, { useState, useEffect } from "react";
import {
  Box,
  Heading,
  VStack,
  Text,
  Button,
  HStack,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Icon,
  Th,
  Td,
  Card,
  CardBody,
  SimpleGrid,
  Flex,
  Divider,
  Grid,
  TableContainer,
  CardHeader,
  Menu,
  MenuButton,
  MenuList,
  InputGroup,
  InputLeftElement,
  MenuItem,
  Spinner,
  Center,
} from "@chakra-ui/react";
import { MemoizedInput as Input } from "../memoizedinput/memoizedinput";
import {
  FiDownload,
  FiMail,
  FiPhone,
  FiCreditCard,
  FiMoreVertical,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { format } from "date-fns";
import { fetchInvoiceItems } from "../../utils/api";

const ViewInvoiceModal = ({
  isOpen,
  onClose,
  selectedInvoice,
  getStatusColor,
  onRecordPayment,
  onDownload,
  onSendEmail,
  onUpdateStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && selectedInvoice) {
      if (selectedInvoice.items && selectedInvoice.items.length > 0) {
        setItems(selectedInvoice.items);
      } else {
        loadInvoiceItems();
      }
    }
  }, [isOpen, selectedInvoice]);

  const loadInvoiceItems = async () => {
    try {
      setIsLoading(true);
      const response = await fetchInvoiceItems(selectedInvoice.id);
      if (response.success) {
        setItems(response.items);
      }
    } catch (error) {
      console.error("Error loading invoice items:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!selectedInvoice) return null;

  const filteredItems = items?.filter((item) => {
    const term = searchTerm.toLowerCase();

    return (
      item.destination?.toLowerCase().includes(term) ||
      item.description?.toLowerCase().includes(term) ||
      item.trunk?.toLowerCase().includes(term)
    );
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl">
      <ModalOverlay />
      <ModalContent maxH="90vh" overflow="hidden" mt={6} mb={2}>
        <ModalHeader borderBottomWidth="1px" bg={"blue.500"}>
          <Flex gap={6} align="center">
            <Box>
              <Heading color={"white"} size="md">
                Invoice Details
              </Heading>
              <Text color="gray.300" fontSize="sm">
                {selectedInvoice.invoiceNumber} • {selectedInvoice.customerName}
              </Text>
            </Box>
            <Badge
              colorScheme={getStatusColor(selectedInvoice.status)}
              fontSize="sm"
              px={3}
              py={1}
              borderRadius="full"
            >
              {selectedInvoice.status?.toUpperCase()}
            </Badge>
          </Flex>
        </ModalHeader>
        <ModalCloseButton color={"white"} />

        <ModalBody overflowY="auto" mb={4}>
          <VStack spacing={6} align="stretch">
            {/* Top Section: Customer Info & Summary */}
            <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={8}>
              {/* Customer Info */}
              <Card variant="outline">
                <CardBody>
                  <SimpleGrid columns={2} spacing={6}>
                    <Box>
                      <Text fontSize="sm" color="gray.600" mb={1}>
                        Bill To
                      </Text>
                      <Text fontSize="lg" fontWeight="bold">
                        {selectedInvoice.customerName}
                      </Text>
                      <Text color="gray.600">
                        {selectedInvoice.customerGatewayId}
                      </Text>
                      <HStack spacing={2}>
                        <Icon as={FiMail} color="red.600" />
                        <Text color="gray.800">
                          {selectedInvoice.customerEmail}
                        </Text>
                      </HStack>

                      <HStack spacing={2}>
                        <Icon as={FiPhone} color="blue.500" />
                        <Text color="black">
                          {selectedInvoice.customerPhone}
                        </Text>
                      </HStack>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.600" mb={1}>
                        Invoice Details
                      </Text>
                      <VStack align="start" spacing={1}>
                        <Text>
                          <strong>Invoice No. : </strong>{" "}
                          {selectedInvoice.invoiceNumber}
                        </Text>
                        <Text>
                          <strong>Generated: </strong>{" "}
                          {format(
                            new Date(parseInt(selectedInvoice.invoiceDate)),
                            "MMMM dd, yyyy",
                          )}
                        </Text>
                        <Text>
                          <strong>Due Date:</strong>{" "}
                          {format(
                            new Date(parseInt(selectedInvoice.dueDate)),
                            "MMMM dd, yyyy",
                          )}
                        </Text>
                        <Text color={"blue.800"}>
                          <strong>Period:</strong>{" "}
                          {format(
                            new Date(
                              parseInt(selectedInvoice.billingPeriodStart),
                            ),
                            "MMM dd",
                          )}{" "}
                          -{" "}
                          {format(
                            new Date(
                              parseInt(selectedInvoice.billingPeriodEnd),
                            ),
                            "MMM dd, yyyy",
                          )}
                        </Text>
                      </VStack>
                    </Box>
                  </SimpleGrid>
                </CardBody>
              </Card>

              {/* Summary Card - Moved next to Customer Info */}
              <Card variant="outline" bg="blue.50">
                <CardBody>
                  <Heading
                    size="xs"
                    mb={3}
                    textTransform="uppercase"
                    color="blue.700"
                  >
                    Invoice Summary
                  </Heading>
                  <VStack spacing={2} align="stretch">
                    <Flex justify="space-between" fontSize="sm">
                      <Text color="gray.600">Subtotal</Text>
                      <Text fontWeight="semibold">
                        ${parseFloat(selectedInvoice.subtotal || 0).toFixed(2)}
                      </Text>
                    </Flex>
                    <Flex justify="space-between" fontSize="sm">
                      <Text color="gray.600">
                        Tax (
                        {parseFloat(selectedInvoice.taxRate || 0).toFixed(0)}%)
                      </Text>
                      <Text color="orange.600">
                        ${parseFloat(selectedInvoice.taxAmount || 0).toFixed(2)}
                      </Text>
                    </Flex>
                    <Flex justify="space-between" fontSize="sm">
                      <Text color="gray.600">Discount</Text>
                      <Text color="green.600">
                        $
                        {parseFloat(
                          selectedInvoice.discountAmount || 0,
                        ).toFixed(2)}
                      </Text>
                    </Flex>
                    <Divider borderColor="blue.200" />
                    <Flex justify="space-between">
                      <Text fontWeight="bold">Total</Text>
                      <Text fontWeight="bold" color="green.600">
                        $
                        {parseFloat(selectedInvoice.totalAmount || 0).toFixed(
                          2,
                        )}
                      </Text>
                    </Flex>
                    <Flex justify="space-between" fontSize="sm">
                      <Text color="gray.600">Balance Due</Text>
                      <Text fontWeight="bold" color="red.600">
                        $
                        {parseFloat(selectedInvoice.balanceAmount || 0).toFixed(
                          2,
                        )}
                      </Text>
                    </Flex>
                  </VStack>
                </CardBody>
              </Card>
            </Grid>

            {/* Quick Actions - Moved to top of Table section */}
            <Card variant="outline">
              <CardHeader pb={2} pt={3} mb={2}>
                <HStack justify="space-between">
                  <Heading size="sm">Call Details & Actions</Heading>
                  <HStack spacing={2}>
                    <InputGroup size="sm" w="200px" borderRadius={"md"}>
                      <InputLeftElement bg={"gray.100"} pointerEvents="none">
                        <FiSearch color="gray" />
                      </InputLeftElement>
                      <Input
                        pl={10}
                        placeholder="Search Destination...."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </InputGroup>
                    <Button
                      borderRadius="2px"
                      size="sm"
                      leftIcon={<FiCreditCard />}
                      colorScheme="blue"
                      onClick={() => onRecordPayment(selectedInvoice)}
                      isDisabled={selectedInvoice.status === "paid"}
                    >
                      Record Payment
                    </Button>

                    <Button
                      borderRadius="2px"
                      size="sm"
                      leftIcon={<FiMail />}
                      colorScheme="green"
                      onClick={() => onSendEmail(selectedInvoice)}
                    >
                      Send on Mail
                    </Button>
                    <Button
                      borderRadius="2px"
                      size="sm"
                      leftIcon={<FiDownload />}
                      variant="outline"
                      onClick={() => onDownload(selectedInvoice)}
                    >
                      Download PDF
                    </Button>
                    <Menu>
                      <MenuButton
                        borderRadius="2px"
                        as={Button}
                        size="sm"
                        rightIcon={<FiMoreVertical />}
                        variant="outline"
                      >
                        More Actions
                      </MenuButton>
                      <MenuList>
                        <MenuItem
                          icon={<FiCheckCircle />}
                          onClick={() =>
                            onUpdateStatus(selectedInvoice.id, "paid")
                          }
                        >
                          Mark as Paid
                        </MenuItem>
                        <MenuItem
                          icon={<FiClock />}
                          onClick={() =>
                            onUpdateStatus(selectedInvoice.id, "sent")
                          }
                        >
                          Mark as Sent
                        </MenuItem>
                        <MenuItem
                          icon={<FiAlertTriangle />}
                          onClick={() =>
                            onUpdateStatus(selectedInvoice.id, "overdue")
                          }
                        >
                          Mark as Overdue
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  </HStack>
                </HStack>
              </CardHeader>
              <CardBody p={0}>
                {/* Table with fixed height and sticky header */}
                <Box maxH="300px" overflowY="auto">
                  {isLoading ? (
                    <Center p={10}>
                      <VStack spacing={4}>
                        <Spinner size="xl" color="blue.500" thickness="4px" />
                        <Text color="gray.500">Loading call details...</Text>
                      </VStack>
                    </Center>
                  ) : filteredItems && filteredItems.length > 0 ? (
                    <Table variant="simple" size="sm">
                      <Thead
                        position="sticky"
                        top={0}
                        bg="gray.200"
                        zIndex={1}
                        boxShadow="sm"
                        h={"30px"}
                      >
                        <Tr>
                          <Th isNumeric color={"black"}>
                            Trunk
                          </Th>
                          <Th isNumeric color={"black"}>
                            Prefix
                          </Th>
                          <Th color={"black"}>Destination</Th>
                          <Th color={"black"}>Description</Th>
                          <Th color={"black"} isNumeric>
                            Calls
                          </Th>
                          <Th color={"black"} isNumeric>
                            Duration(Sec)
                          </Th>
                          <Th color={"black"} isNumeric>
                            Duration(Min)
                          </Th>
                          <Th color={"black"} isNumeric>
                            Rate
                          </Th>
                          <Th color={"black"} isNumeric>
                            Amount
                          </Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {filteredItems.map((item, index) => (
                          <Tr key={index} _hover={{ bg: "gray.50" }}>
                            <Td>{item.trunk || "-"}</Td>
                            <Td>{item.prefix || "-"}</Td>
                            <Td>{item.destination || "-"}</Td>
                            <Td>{item.description}</Td>
                            <Td isNumeric>{item.totalCalls}</Td>
                            <Td isNumeric>{item.duration.toFixed(2)} sec</Td>
                            <Td isNumeric>
                              {(item.duration / 60).toFixed(2)} min
                            </Td>
                            <Td color={"blue"} isNumeric>
                              $ {parseFloat(item.unitPrice).toFixed(4)}
                            </Td>
                            <Td color={"green"} isNumeric>
                              $ {parseFloat(item.amount).toFixed(4)}
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  ) : (
                    <Center p={10}>
                      <Text color="gray.500">No call details found for this invoice.</Text>
                    </Center>
                  )}
                </Box>
              </CardBody>
            </Card>
          </VStack>
        </ModalBody>
        {/* <ModalFooter borderTopWidth="1px">
          <Button
            leftIcon={<FiX />}
            colorScheme="gray"
            variant="ghost"
            mr={3}
            onClick={onClose}
          >
            Close
          </Button>
        </ModalFooter> */}
      </ModalContent>
    </Modal>
  );
};

export default ViewInvoiceModal;
