import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  Badge,
  Divider,
  SimpleGrid,
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Icon,
} from "@chakra-ui/react";
import { FiDollarSign, FiCalendar, FiUser, FiCreditCard, FiHash, FiInfo, FiArrowDown, FiArrowUp } from "react-icons/fi";
import { format } from "date-fns";

const ViewPaymentModal = ({ isOpen, onClose, payment }) => {
  if (!payment) return null;

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";
    try {
      const date = isNaN(dateValue) ? new Date(dateValue) : new Date(parseInt(dateValue));
      return format(date, "MMM dd, yyyy");
    } catch (e) {
      return "Invalid Date";
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent mt={7} mb={4}>
        <ModalHeader borderBottomWidth="1px" bg={"blue.500"} borderTopRadius={"md"}>
          <HStack justify="space-between" pr={8}>
            <VStack align="start" spacing={0}>
              <Text fontSize="sm" color="white" fontWeight="normal">Payment Receipt</Text>
              <Heading size="md" color={"white"}>{payment.paymentNumber}</Heading>
            </VStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton  color={"white"}/>
        
        <ModalBody py={6}>
          <VStack spacing={6} align="stretch">
            <SimpleGrid columns={2} spacing={8}>
              <VStack align="start" spacing={4}>
                <Box>
                  <HStack color="gray.500" mb={1}>
                    <Icon as={FiUser} />
                    <Text fontSize="xs" fontWeight="bold" textTransform="uppercase">Account Name</Text>
                  </HStack>
                  <Text fontWeight="bold">{payment.customerName}</Text>
                  <Text fontSize="sm" color="gray.600">{payment.customerGatewayId}</Text>
                </Box>

                <Box>
                  <HStack color="gray.500" mb={1}>
                    <Icon as={String(payment.paymentDirection).toLowerCase() === 'outbound' ? FiArrowDown : FiArrowUp} />
                    <Text fontSize="xs" fontWeight="bold" textTransform="uppercase">Flow</Text>
                  </HStack>
                  <Badge colorScheme={String(payment.paymentDirection).toLowerCase() === 'outbound' ? 'red' : 'green'} variant="subtle" textTransform="capitalize">
                    {payment.paymentDirection || 'inbound'}
                  </Badge>
                </Box>
                
                <Box>
                  <HStack color="gray.500" mb={1}>
                    <Icon as={FiCalendar} />
                    <Text fontSize="xs" fontWeight="bold" textTransform="uppercase">Payment Date</Text>
                  </HStack>
                  <Text fontWeight="medium">{formatDate(payment.paymentDate)}</Text>
                </Box>
              </VStack>

              <VStack align="start" spacing={4}>
                <Box>
                  <HStack color="gray.500" mb={1}>
                    <Icon as={FiCreditCard} />
                    <Text fontSize="xs" fontWeight="bold" textTransform="uppercase">Payment Method</Text>
                  </HStack>
                  <Badge variant="subtle" colorScheme="purple" textTransform="capitalize">
                    {payment.paymentMethod?.replace("_", " ")}
                  </Badge>
                </Box>
                
                <Box>
                  <HStack color="gray.500" mb={1}>
                    <Icon as={FiHash} />
                    <Text fontSize="xs" fontWeight="bold" textTransform="uppercase">Transaction Details</Text>
                  </HStack>
                  <Text fontSize="sm">ID: {payment.transactionId || "N/A"}</Text>
                  <Text fontSize="sm">Ref: {payment.referenceNumber || "N/A"}</Text>
                </Box>
              </VStack>
            </SimpleGrid>

            <Divider />

            <Box bg="gray.50" p={4} borderRadius="md">
              <SimpleGrid columns={Number(payment.creditNoteAmount || 0) > 0 ? 4 : 3} spacing={4}>
                <VStack align="center">
                  <Text fontSize="xs" color="gray.500" fontWeight="bold">Total Amount</Text>
                  <Text fontSize="xl" fontWeight="bold" color="blue.600">
                    ${parseFloat(payment.amount).toFixed(4)}
                  </Text>
                </VStack>
                <VStack align="center">
                  <Text fontSize="xs" color="gray.500" fontWeight="bold">Allocated</Text>
                  <Text fontSize="xl" fontWeight="bold" color="green.600">
                    ${parseFloat(payment.allocatedAmount).toFixed(4)}
                  </Text>
                </VStack>
                <VStack align="center">
                  <Text fontSize="xs" color="gray.500" fontWeight="bold">Unapplied</Text>
                  <Text fontSize="xl" fontWeight="bold" color="orange.600">
                    ${parseFloat(payment.unappliedAmount).toFixed(4)}
                  </Text>
                </VStack>
                {Number(payment.creditNoteAmount || 0) > 0 && (
                  <VStack align="center">
                    <Text fontSize="xs" color="gray.500" fontWeight="bold">Credit Note</Text>
                    <Text fontSize="xl" fontWeight="bold" color="orange.500">
                      ${parseFloat(payment.creditNoteAmount).toFixed(4)}
                    </Text>
                  </VStack>
                )}
              </SimpleGrid>
            </Box>

            {payment.allocations && payment.allocations.length > 0 && (
              <Box>
                <Heading size="sm" mb={3}>Invoice Allocations</Heading>
                <Table size="sm" variant="simple">
                  <Thead bg={"gray.300"}>
                    <Tr>
                      <Th color={"black"}>Invoice #</Th>
                      <Th color={"black"} isNumeric>Date</Th>
                      <Th color={"black"} isNumeric>Amount Applied</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {payment.allocations.map((alloc, index) => (
                      <Tr key={index}>
                        <Td fontWeight="medium"><Badge>{alloc.invoice?.invoiceNumber || alloc.invoiceNumber || "N/A"}</Badge></Td>
                        <Td isNumeric>{formatDate(alloc.allocationDate)}</Td>
                        <Td isNumeric color={"green.600"} fontWeight="bold">${parseFloat(alloc.allocatedAmount || alloc.amount).toFixed(4)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}

            {payment.notes && (
              <Box>
                <HStack color="gray.500" mb={1}>
                  <Icon as={FiInfo} />
                  <Text fontSize="xs" fontWeight="bold" textTransform="uppercase">Notes</Text>
                </HStack>
                <Text fontSize="sm" fontStyle="italic" p={3} bg="gray.50" borderRadius="md">
                  {payment.notes}
                </Text>
              </Box>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter borderTopWidth="1px">
          <Button colorScheme="blue" onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ViewPaymentModal;
