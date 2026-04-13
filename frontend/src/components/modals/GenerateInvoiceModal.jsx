import React from "react";
import {
  Box,
  Heading,
  VStack,
  Text,
  Button,
  HStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { FiFileText } from "react-icons/fi";
import { MemoizedInput as Input, MemoizedSelect as Select } from "../memoizedinput/memoizedinput";

const pad2 = (value) => String(value).padStart(2, "0");

const toLocalDateInputValue = (value) => {
  if (!value) return "";

  const source = value instanceof Date ? value : new Date(String(value).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(source.getTime())) return "";

  return `${source.getFullYear()}-${pad2(source.getMonth() + 1)}-${pad2(source.getDate())}`;
};

const shiftDateInputValue = (value, days) => {
  if (!value) return "";

  const source = value instanceof Date ? new Date(value) : new Date(String(value).slice(0, 10) + "T00:00:00");
  if (Number.isNaN(source.getTime())) return "";

  source.setDate(source.getDate() + days);
  return toLocalDateInputValue(source);
};

const GenerateInvoiceModal = ({
  isOpen,
  onClose,
  generateForm,
  setGenerateForm,
  customers,
  onGenerate,
  isSubmitting = false,
}) => {
  const getAccountSelectionValue = (account) => {
    return (
      account.gatewayId ||
      account.customerCode ||
      account.accountId ||
      ""
    );
  };

  const getSelectedAccount = (selectionValue) => {
    return customers.find((account) => {
      // Only show customers
      if (!(account.accountRole === "customer" || account.accountRole === "both")) {
        return false;
      }
      return getAccountSelectionValue(account) === selectionValue;
    });
  };

  const handleAccountChange = (selectionValue) => {
    const selectedAccount = getSelectedAccount(selectionValue);

    const customerLastBillingDate = selectedAccount?.customerLastBillingDate || selectedAccount?.lastbillingdate || "";
    const customerNextBillingDate = selectedAccount?.customerNextBillingDate || selectedAccount?.nextbillingdate || "";
    const periodStart = toLocalDateInputValue(customerLastBillingDate);
    const periodEnd = shiftDateInputValue(customerNextBillingDate, -1) || toLocalDateInputValue(customerNextBillingDate);

    setGenerateForm({
      ...generateForm,
      customerId: selectionValue,
      periodStart: periodStart || generateForm.periodStart,
      periodEnd: periodEnd || generateForm.periodEnd,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside" closeOnOverlayClick={!isSubmitting}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader
          borderTopRadius={"md"}
          bg={"blue.500"}
          borderBottomWidth="1px"
        >
          <Heading size="md" color={"white"}>
            Generate New Invoice
          </Heading>
        </ModalHeader>
        <ModalCloseButton color={"white"} />

        <ModalBody>
          <VStack spacing={6} align="stretch">
            {/* Customer Selection */}
            <FormControl isRequired>
              <FormLabel fontWeight={"bold"} color={"blue.700"}>
                Select Customer
              </FormLabel>
              <Select
                placeholder="Choose a customer..."
                value={generateForm.customerId}
                onChange={(e) => handleAccountChange(e.target.value)}
                size="md"
                isDisabled={isSubmitting}
              >
                {customers
                  .filter((c) => {
                    return c.accountRole === "customer" || c.accountRole === "both";
                  })
                  .map((customer) => (
                    <option
                      key={customer.accountId}
                      value={getAccountSelectionValue(customer)}
                    >
                      {customer.accountName} (
                      {customer.customerCode || customer.gatewayId}
                      )
                    </option>
                  ))}
              </Select>
            </FormControl>

            {/* Billing Period */}
            <Box>
              <FormLabel fontWeight={"bold"} color={"blue.700"}>
                Billing Period
              </FormLabel>
              <HStack spacing={4}>
                <FormControl isRequired>
                  <Input
                    type="date"
                    value={generateForm.periodStart}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        periodStart: e.target.value,
                      })
                    }
                    size="md"
                    isDisabled={isSubmitting}
                  />
                </FormControl>
                <Text>to</Text>
                <FormControl fontWeight={"bold"} color={"blue.700"} isRequired>
                  <Input
                    type="date"
                    value={generateForm.periodEnd}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        periodEnd: e.target.value,
                      })
                    }
                    size="md"
                    isDisabled={isSubmitting}
                  />
                </FormControl>
              </HStack>
            </Box>

            {/* Billing Cycle */}
            {/* <FormControl>
              <FormLabel fontWeight={"bold"} color={"blue.700"}>
                Billing Cycle
              </FormLabel>
              <Select
                value={generateForm.billingCycle}
                onChange={(e) =>
                  setGenerateForm({
                    ...generateForm,
                    billingCycle: e.target.value,
                  })
                }
                size="md"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </Select>
            </FormControl> */}

            {/* Customer Preview */}
            {/* {generateForm.customerId && (
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                <Box>
                  <AlertTitle>Selected Customer</AlertTitle>
                  <AlertDescription>
                    {(() => {
                      const customer = customers.find(
                        (c) =>
                          c.gatewayId === generateForm.customerId ||
                          c.customerCode === generateForm.customerId ||
                          c.accountId === generateForm.customerId,
                      );
                      return customer ? (
                        <VStack align="start" spacing={1}>
                          <Text>
                            <strong>Name:</strong> {customer.accountName}
                          </Text>
                          <Text>
                            <strong>Email:</strong> {customer.email}
                          </Text>
                        </VStack>
                      ) : null;
                    })()}
                  </AlertDescription>
                </Box>
              </Alert>
            )} */}
          </VStack>
        </ModalBody>
        <ModalFooter borderTopWidth="1px">
          <Button variant="outline" mr={3} onClick={onClose} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={onGenerate}
            isLoading={isSubmitting}
            loadingText="Generating..."
            isDisabled={!generateForm.customerId || isSubmitting}
            leftIcon={<FiFileText />}
            size="md"
          >
            Generate Invoice
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default GenerateInvoiceModal;
