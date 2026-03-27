import React, { useState, useEffect } from "react";
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
  SimpleGrid,
  Heading,
  Alert,
  AlertIcon,
  Spinner,
  Text,
  Box,
} from "@chakra-ui/react";
import { fetchLiteInvoices } from "../../utils/api";
import { MemoizedInput as Input, MemoizedSelect as Select } from "../memoizedinput/memoizedinput";

const RecordPaymentModal = ({
  isOpen,
  onClose,
  paymentForm,
  setPaymentForm,
  customers,
  onRecordPayment,
}) => {
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  useEffect(() => {
    if (isOpen && paymentForm.customerId) {
      loadCustomerInvoices(paymentForm.customerId);
    } else {
      setCustomerInvoices([]);
    }
  }, [isOpen, paymentForm.customerId]);

  const loadCustomerInvoices = async (customerId) => {
    setIsLoadingInvoices(true);
    try {
      // Fetch only unpaid/partial invoices for this customer
      const response = await fetchLiteInvoices({ 
        customerId: customerId,
        // status: 'pending' // Optional: filter by status if needed
      });
      
      if (response.success) {
        // Filter for invoices with balance > 0
        const unpaid = response.data.filter(inv => 
          parseFloat(inv.balanceAmount) > 0 || inv.status !== 'paid'
        );
        setCustomerInvoices(unpaid);
      }
    } catch (error) {
      console.error("Error loading customer invoices:", error);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const handleInvoiceChange = (invoiceId) => {
    if (!invoiceId) {
      setPaymentForm({
        ...paymentForm,
        invoiceId: "",
        amount: "",
        notes: ""
      });
      return;
    }

    const selectedInvoice = customerInvoices.find(inv => inv.id.toString() === invoiceId.toString());
    if (selectedInvoice) {
      setPaymentForm({
        ...paymentForm,
        invoiceId: selectedInvoice.id,
        amount: selectedInvoice.balanceAmount || selectedInvoice.totalAmount,
        notes: `Payment for invoice ${selectedInvoice.invoiceNumber}`
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader bg="blue.500" color="white" borderTopRadius="md">
          <Heading size="md">Record Payment</Heading>
        </ModalHeader>
        <ModalCloseButton color="white" />
        <ModalBody py={6} maxH="60vh" overflowY="auto">
          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel>Customer</FormLabel>
              <Select
                placeholder="Select customer"
                value={paymentForm.customerId}
                onChange={(e) =>
                  setPaymentForm({ 
                    ...paymentForm, 
                    customerId: e.target.value,
                    invoiceId: "", // Reset invoice when customer changes
                    amount: ""
                  })
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

            {paymentForm.customerId && (
              <FormControl>
                <FormLabel>
                  Select Invoice (Optional)
                  {isLoadingInvoices && <Spinner size="xs" ml={2} />}
                </FormLabel>
                <Select
                  placeholder={isLoadingInvoices ? "Loading invoices..." : "Select an unpaid invoice"}
                  value={paymentForm.invoiceId}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                  isDisabled={isLoadingInvoices}
                >
                  {customerInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} - Bal: ${parseFloat(inv.balanceAmount).toFixed(4)} ({inv.status})
                    </option>
                  ))}
                </Select>
                {customerInvoices.length === 0 && !isLoadingInvoices && (
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    No unpaid invoices found for this customer.
                  </Text>
                )}
              </FormControl>
            )}

            {paymentForm.invoiceId && (
              <Alert status="info" size="sm">
                <AlertIcon />
                <Box>
                  <Text fontSize="sm" fontWeight="bold">
                    Recording payment for Invoice: {
                      customerInvoices.find(inv => inv.id === paymentForm.invoiceId)?.invoiceNumber
                    }
                  </Text>
                </Box>
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
                <option value="usdt">USDT</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
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
            colorScheme="blue"
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
