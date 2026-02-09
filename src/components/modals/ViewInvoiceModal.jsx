import React from "react";
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
  MenuItem,
} from "@chakra-ui/react";
import {
  FiDownload,
  FiMail,
  FiPhone,
  FiCreditCard,
  FiMoreVertical,
  FiCheckCircle,
  FiClock,
  FiAlertTriangle,
} from "react-icons/fi";
import { format } from "date-fns";

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
  if (!selectedInvoice) return null;

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

        <ModalBody overflowY="auto">
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
                        <Text >
                          <strong>Invoice No. : </strong>{" "}
                          {selectedInvoice.invoiceNumber}
                        </Text>
                        <Text >
                          <strong>Generated: </strong>{" "}
                          {format(
                            new Date(parseInt(selectedInvoice.invoiceDate)),
                            "MMMM dd, yyyy",
                          )}
                        </Text>
                        <Text >
                          <strong>Due Date:</strong>{" "}
                          {format(
                            new Date(parseInt(selectedInvoice.dueDate)),
                            "MMMM dd, yyyy",
                          )}
                        </Text>
                        <Text color={"blue.600"}>
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
                <Box maxH="400px" overflowY="auto">
                  <Table variant="simple" size="sm">
                    <Thead
                      position="sticky"
                      top={0}
                      bg="gray.200"
                      zIndex={1}
                      boxShadow="sm"
                    >
                      <Tr>
                        <Th color={"black"}>Description</Th>
                        <Th color={"black"}>Destination</Th>
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
                      {selectedInvoice.items?.map((item, index) => (
                        <Tr key={index} _hover={{ bg: "gray.50" }}>
                          <Td>{item.description}</Td>
                          <Td>{item.destination || "-"}</Td>
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
                </Box>
              </CardBody>
            </Card>
          </VStack>
        </ModalBody>
        <ModalFooter borderTopWidth="1px">
          <Button variant="ghost" mr={3} onClick={onClose}>
            Close
          </Button>
          <Button
            colorScheme="blue"
            onClick={() => {
              onUpdateStatus(selectedInvoice.id, "paid");
              onClose();
            }}
          >
            Mark as Paid & Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ViewInvoiceModal;
