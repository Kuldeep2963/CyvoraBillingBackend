import React from "react";
import {
  Card,
  CardBody,
  Flex,
  Text,
  Select,
  Button,
  Box,
  Spacer,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";

// Reusable styled date input with floating label
const DateField = ({ label, value, onChange }) => (
  <Box position="relative">
    <Text
      position="absolute"
      top="-9px"
      left="10px"
      fontSize="10px"
      fontWeight="700"
      color="gray.500"
      bg="white"
      px="4px"
      zIndex={1}
      letterSpacing="0.06em"
      textTransform="uppercase"
      pointerEvents="none"
    >
      {label}
    </Text>
    <Box
      as="input"
      type="date"
      value={value}
      onChange={onChange}
      sx={{
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1.5px solid",
        borderColor: "#E2E8F0",
        background: "#F7FAFC",
        fontSize: "13px",
        fontFamily: "inherit",
        color: "#2D3748",
        fontWeight: "500",
        outline: "none",
        minWidth: "150px",
        cursor: "pointer",
        transition: "all 0.2s",
        "&:focus": {
          borderColor: "#4299E1",
          boxShadow: "0 0 0 3px rgba(66,153,225,0.15)",
          background: "white",
        },
        "&:hover": {
          borderColor: "#CBD5E0",
        },
        "&::-webkit-calendar-picker-indicator": {
          cursor: "pointer",
          opacity: 0.45,
        },
      }}
    />
  </Box>
);

const FilterCard = ({
  dualAccounts = [],
  isLoading,
  handleSearch,
  setSelectedAccount,
  setCustomerInvoices,
  setVendorInvoices,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedAccount,
}) => {
  return (
    <Card
      mb={3}
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="12px"
      // boxShadow="0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)"
      borderLeft="3px solid"
      borderLeftColor="blue.400"
      overflow="visible"
    >
      <CardBody py={4} px={5}>
        <Flex align="center" gap={3} flexWrap="wrap">

          {/* Label */}
          <Text
            fontWeight="700"
            color="gray.600"
            fontSize="13px"
            whiteSpace="nowrap"
            letterSpacing="0.01em"
          >
            Account:
          </Text>

          {/* Account Select */}
          <Select
            size="sm"
            placeholder="Select a bilateral or vendor account..."
            bg="gray.50"
            border="1.5px solid"
            borderColor="gray.200"
            borderRadius="8px"
            fontSize="13px"
            fontWeight="500"
            color="gray.700"
            minW="220px"
            maxW="300px"
            flex="1"
            height="36px"
            _hover={{ borderColor: "gray.300" }}
            _focus={{
              borderColor: "blue.400",
              boxShadow: "0 0 0 3px rgba(66,153,225,0.15)",
              bg: "white",
            }}
            onChange={(e) => {
              const found = dualAccounts.find(
                (a) => a.vendorCode === e.target.value
              );
              setSelectedAccount(found || null);
              setCustomerInvoices([]);
              setVendorInvoices([]);
            }}
          >
            {dualAccounts.map((acc) => (
              <option key={acc.vendorCode} value={acc.vendorCode}>
                {acc.accountName} {acc.customerCode ? "(Bilateral)" : "(Vendor)"}
              </option>
            ))}
          </Select>

          {/* Styled date inputs with floating labels */}
          <DateField
            label="From"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <DateField
            label="To"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />

          {/* Search Button */}
          <Button
            size="sm"
            colorScheme="blue"
            leftIcon={<SearchIcon boxSize={3} />}
            onClick={handleSearch}
            isDisabled={!selectedAccount || isLoading || !startDate || !endDate}
            isLoading={isLoading}
            loadingText="Loading..."
            minW="100px"
            height="36px"
            borderRadius="8px"
            fontWeight="600"
            fontSize="13px"
            boxShadow="0 2px 8px rgba(49,130,206,0.25)"
            _hover={{
              boxShadow: "0 4px 12px rgba(49,130,206,0.35)",
              transform: "translateY(-1px)",
            }}
            _active={{ transform: "translateY(0)" }}
            transition="all 0.2s"
          >
            Search
          </Button>

          <Spacer />
        </Flex>

        {/* Empty state */}
        {dualAccounts.length === 0 && (
          <Text fontSize="xs" color="gray.400" mt={3}>
            No bilateral or vendor accounts found.
          </Text>
        )}
      </CardBody>
    </Card>
  );
};

export default FilterCard;