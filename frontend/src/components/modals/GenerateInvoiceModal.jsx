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
  RadioGroup,
  Radio,
} from "@chakra-ui/react";
import { FiFileText } from "react-icons/fi";
import { MemoizedInput as Input, MemoizedSelect as Select } from "../memoizedinput/memoizedinput";

const GenerateInvoiceModal = ({
  isOpen,
  onClose,
  generateForm,
  setGenerateForm,
  customers,
  onGenerate,
}) => {
  const getAccountSelectionValue = (account, invoiceType) => {
    return (
      account.gatewayId ||
      (invoiceType === "vendor" ? account.vendorCode : account.customerCode) ||
      account.accountId ||
      ""
    );
  };

  const getSelectedAccount = (selectionValue, invoiceType) => {
    return customers.find((account) => {
      if (invoiceType === "vendor" && !(account.accountRole === "vendor" || account.accountRole === "both")) {
        return false;
      }
      if (invoiceType !== "vendor" && !(account.accountRole === "customer" || account.accountRole === "both")) {
        return false;
      }
      return getAccountSelectionValue(account, invoiceType) === selectionValue;
    });
  };

  const handleAccountChange = (selectionValue) => {
    const selectedAccount = getSelectedAccount(selectionValue, generateForm.invoiceType);

    setGenerateForm({
      ...generateForm,
      customerId: selectionValue,
      periodStart: selectedAccount?.lastbillingdate || generateForm.periodStart,
      periodEnd: selectedAccount?.nextbillingdate || generateForm.periodEnd,
    });
  };

  const handleInvoiceTypeChange = (invoiceType) => {
    const selectedAccount = getSelectedAccount(generateForm.customerId, invoiceType);

    setGenerateForm({
      ...generateForm,
      invoiceType,
      customerId: selectedAccount ? generateForm.customerId : "",
      periodStart: selectedAccount?.lastbillingdate || generateForm.periodStart,
      periodEnd: selectedAccount?.nextbillingdate || generateForm.periodEnd,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
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
            {/* Invoice Type selection */}
            <FormControl>
              <FormLabel fontWeight={"bold"} color={"blue.700"}>
                Invoice Type
              </FormLabel>

              <RadioGroup
                value={generateForm.invoiceType}
                onChange={handleInvoiceTypeChange}
              >
                <HStack spacing={6}>
                  <Radio value="customer">Customer Invoice</Radio>
                  <Radio value="vendor">Vendor Invoice</Radio>
                </HStack>
              </RadioGroup>
            </FormControl>
            {/* Customer Selection */}
            <FormControl isRequired>
              <FormLabel fontWeight={"bold"} color={"blue.700"}>
                Select {generateForm.invoiceType === "vendor" ? "Vendor" : "Customer"}
              </FormLabel>
              <Select
                placeholder={`Choose a ${generateForm.invoiceType === "vendor" ? "vendor" : "customer"}...`}
                value={generateForm.customerId}
                onChange={(e) => handleAccountChange(e.target.value)}
                size="md"
              >
                {customers
                  .filter((c) => {
                    if (generateForm.invoiceType === "vendor") {
                      return c.accountRole === "vendor" || c.accountRole === "both";
                    }
                    return c.accountRole === "customer" || c.accountRole === "both";
                  })
                  .map((customer) => (
                    <option
                      key={customer.accountId}
                      value={getAccountSelectionValue(customer, generateForm.invoiceType)}
                    >
                      {customer.accountName} (
                      {(generateForm.invoiceType === "vendor"
                        ? customer.vendorCode
                        : customer.customerCode) || customer.gatewayId}
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
          <Button variant="outline" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={onGenerate}
            isDisabled={!generateForm.customerId}
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
