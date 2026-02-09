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
  FormControl,
  FormLabel,
  Input,
  Select,
  SimpleGrid,
  Heading,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";

const RecordPaymentModal = ({
  isOpen,
  onClose,
  paymentForm,
  setPaymentForm,
  customers,
  invoices,
  onRecordPayment,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader bg="green.500" color="white" borderTopRadius="md">
          <Heading size="md">Record Payment</Heading>
        </ModalHeader>
        <ModalCloseButton color="white" />
        <ModalBody py={6}>
          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel>Customer</FormLabel>
              <Select
                placeholder="Select customer"
                value={paymentForm.customerId}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, customerId: e.target.value })
                }
              >
                {customers.map((c) => (
                  <option
                    key={c.accountId}
                    value={c.gatewayId || c.customerCode || c.accountId}
                  >
                    {c.accountName}
                  </option>
                ))}
              </Select>
            </FormControl>

            {paymentForm.invoiceId && (
              <Alert status="info" size="sm">
                <AlertIcon />
                Recording payment for Invoice:{" "}
                {
                  invoices.find((inv) => inv.id === paymentForm.invoiceId)
                    ?.invoiceNumber
                }
              </Alert>
            )}

            <SimpleGrid columns={2} spacing={4}>
              <FormControl isRequired>
                <FormLabel>Amount</FormLabel>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, amount: e.target.value })
                  }
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Payment Date</FormLabel>
                <Input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentDate: e.target.value,
                    })
                  }
                />
              </FormControl>
            </SimpleGrid>

            <FormControl isRequired>
              <FormLabel>Payment Method</FormLabel>
              <Select
                value={paymentForm.paymentMethod}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    paymentMethod: e.target.value,
                  })
                }
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="credit_card">Credit Card</option>
                <option value="other">Other</option>
              </Select>
            </FormControl>

            <SimpleGrid columns={2} spacing={4}>
              <FormControl>
                <FormLabel>Transaction ID</FormLabel>
                <Input
                  value={paymentForm.transactionId}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      transactionId: e.target.value,
                    })
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>Ref Number</FormLabel>
                <Input
                  value={paymentForm.referenceNumber}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      referenceNumber: e.target.value,
                    })
                  }
                />
              </FormControl>
            </SimpleGrid>

            <FormControl>
              <FormLabel>Notes</FormLabel>
              <Input
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, notes: e.target.value })
                }
              />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter borderTopWidth="1px">
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="green"
            onClick={onRecordPayment}
            isDisabled={!paymentForm.customerId || !paymentForm.amount}
          >
            Record Payment
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default RecordPaymentModal;
