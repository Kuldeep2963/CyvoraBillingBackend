import React from "react";
import {
  Box,
  Flex,
  Heading,
  Link as ChakraLink,
  VStack,
  Icon,
  useColorModeValue,
  Avatar,
  Image,
  Text,
  HStack,
  Badge,
} from "@chakra-ui/react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import {
  FiHome,
  FiUpload,
  FiList,
  FiUsers,
  FiFileText,
  FiSettings,
  FiDollarSign,
  FiBell,
  FiCreditCard,
} from "react-icons/fi";

const Layout = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Dashboard", icon: FiHome },
    { path: "/accounts", label: "Accounts", icon: FiUsers },
    { path: "/invoices", label: "Invoices", icon: FiFileText },
    { path: "/payments", label: "Payments", icon: FiCreditCard },
    { path: "/reports", label: "Reports", icon: FiFileText },
    { path: "/settings", label: "Settings", icon: FiSettings },
  ];

  return (
    <Flex h="100vh">
      {/* Sidebar */}
      <Box
        w="250px"
        bg={useColorModeValue("white", "gray.800")}
        p={4}
        borderRight="1px"
        borderColor={useColorModeValue("gray.200", "gray.700")}
        display="flex"
        flexDirection="column"
      >
        <Flex direction="column" align="center" mb={8}>
          <Image
            src="/pai-telecom-logo.png"
            alt="Xoraxsoft logo"
            boxSize="70px"
            objectFit="contain"
          />

          <Text fontSize="xs" color="gray.500" textAlign="center">
            CDR Billing System
          </Text>
        </Flex>

        <VStack spacing={1} align="stretch" flex={1}>
          {navItems.map((item) => (
            <ChakraLink
              as={RouterLink}
              to={item.path}
              key={item.path}
              p={3}
              borderRadius="md"
              bg={location.pathname === item.path ? "blue.50" : "transparent"}
              color={location.pathname === item.path ? "blue.600" : "gray.600"}
              fontWeight={location.pathname === item.path ? "600" : "500"}
              _hover={{
                bg: location.pathname === item.path ? "blue.50" : "gray.50",
                textDecoration: "none",
              }}
              display="flex"
              alignItems="center"
              transition="all 0.2s"
            >
              <Icon as={item.icon} mr={3} />
              {item.label}
              {item.path === "/invoices" && (
                <Badge
                  ml="auto"
                  colorScheme="red"
                  variant="subtle"
                  size="sm"
                  borderRadius={"full"}
                >
                  3
                </Badge> //will be replaced by the actual number of pending invoices
              )}
            </ChakraLink>
          ))}
        </VStack>

        {/* User Profile */}
        <Box
          mt="auto"
          p={3}
          borderRadius="md"
          bg={useColorModeValue("gray.50", "gray.700")}
        >
          <HStack spacing={3}>
            <Avatar size="sm" name="Admin User" color={"white"} bg="blue.700" />
            <Box flex={1}>
              <Text fontWeight="medium" fontSize="sm">
                Admin User
              </Text>
              <Text fontSize="xs" color="gray.500">
                Administrator
              </Text>
            </Box>
            <Icon as={FiBell} color="blue.500" cursor="pointer" />
          </HStack>
        </Box>
      </Box>

      {/* Main Content */}
      <Box
        flex={1}
        overflow="auto"
        bg={useColorModeValue("gray.50", "gray.900")}
      >
        {children}
      </Box>
    </Flex>
  );
};

export default Layout;
