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
  FormHelperText,
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
  isSubmitting = false,
}) => {
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  const selectedCustomer = customers.find((c) => {
    const value = paymentForm.customerId;
    if (!value) return false;
    return (
      String(c.customerCode || "") === String(value) ||
      String(c.gatewayId || "") === String(value) ||
      String(c.accountId || "") === String(value)
    );
  });

  const isPostpaidCustomer = String(selectedCustomer?.billingType || "").toLowerCase() === "postpaid";
  const accountFundsLabel = isPostpaidCustomer ? "Use Credit Limit" : "Use Balance";
  const availableFunds = isPostpaidCustomer
    ? Number(selectedCustomer?.creditLimit || 0)
    : Number(selectedCustomer?.balance || 0);

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
        // Keep only invoices that are not fully paid.
        const unpaid = response.data.filter((inv) => inv.status !== 'paid');
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
    <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside" closeOnOverlayClick={!isSubmitting}>
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
                    paymentSource: "new_payment",
                    invoiceId: "", // Reset invoice when customer changes
                    amount: ""
                  })
                }
                isDisabled={isSubmitting}
              >
                {customers.map((c) => (
                  <option
                    key={c.accountId}
                    value={c.customerCode || c.gatewayId || c.accountId}
                  >
                    {c.accountName}
                  </option>
                ))}
              </Select>
            </FormControl>

            {paymentForm.customerId && (
              <FormControl isRequired>
                <FormLabel>Pay Using</FormLabel>
                <Select
                  value={paymentForm.paymentSource || "new_payment"}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentSource: e.target.value,
                    })
                  }
                  isDisabled={isSubmitting}
                >
                  <option value="new_payment">Record New Payment</option>
                  <option value="account_funds">{accountFundsLabel}</option>
                </Select>
              </FormControl>
            )}

            {paymentForm.customerId && paymentForm.paymentSource === "account_funds" && (
              <Alert status="info" borderRadius="md" fontSize="sm">
                <AlertIcon />
                {isPostpaidCustomer
                  ? `Available credit limit: $${availableFunds.toFixed(4)}`
                  : `Available balance: $${availableFunds.toFixed(4)}`}
              </Alert>
            )}

            {paymentForm.customerId && (
              <FormControl isRequired>
                <FormLabel>
                  Select Invoice 
                  {isLoadingInvoices && <Spinner size="xs" ml={2} />}
                </FormLabel>
                <Select
                  placeholder={isLoadingInvoices ? "Loading invoices..." : "Select an unpaid invoice"}
                  value={paymentForm.invoiceId}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                  isDisabled={isLoadingInvoices || isSubmitting}
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

            {/* {paymentForm.invoiceId && (
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
            )} */}

            <SimpleGrid columns={2} spacing={4}>
              <FormControl isRequired>
                <FormLabel>Amount</FormLabel>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, amount: e.target.value })
                  }
                  isDisabled={isSubmitting || Boolean(paymentForm.invoiceId)}
                />
                {paymentForm.invoiceId && (
                  <FormHelperText>
                    Amount is locked to the selected invoice outstanding balance.
                  </FormHelperText>
                )}
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
                  isDisabled={isSubmitting}
                />
              </FormControl>
            </SimpleGrid>

            {paymentForm.paymentSource !== "account_funds" && (
              <>
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
                    isDisabled={isSubmitting}
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
                      isDisabled={isSubmitting}
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
                      isDisabled={isSubmitting}
                    />
                  </FormControl>
                </SimpleGrid>
              </>
            )}

            <FormControl>
              <FormLabel>Notes</FormLabel>
              <Input
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, notes: e.target.value })
                }
                isDisabled={isSubmitting}
              />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter borderTopWidth="1px">
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={onRecordPayment}
            isLoading={isSubmitting}
            loadingText="Recording..."
            isDisabled={!paymentForm.customerId || !paymentForm.amount || isSubmitting}
          >
            Record Payment
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default RecordPaymentModal;
