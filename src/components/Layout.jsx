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
  IconButton,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
  Spacer,
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
  FiMenu,
} from "react-icons/fi";

const SidebarContent = ({ onClose, ...rest }) => {
  const location = useLocation();
  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: FiHome },
    { path: "/accounts", label: "Accounts", icon: FiUsers },
    { path: "/invoices", label: "Invoices", icon: FiFileText },
    { path: "/payments", label: "Payments", icon: FiCreditCard },
    { path: "/reports", label: "Reports", icon: FiFileText },
    { path: "/settings", label: "Settings", icon: FiSettings },
  ];

  return (
    <Box
      bg={"black"}
      p={4}
      borderRight="1px"
      borderColor={useColorModeValue("gray.200", "gray.700")}
      w={{ base: "full", md: "250px" }}
      pos="fixed"
      h="full"
      {...rest}
    >
      <Flex direction="column" align="center" mb={8}>
        <Image
          src="/pai-telecom-logo.png"
          alt="Xoraxsoft logo"
          boxSize="70px"
          objectFit="contain"
        />
        <Text fontSize="xs" color="gray.400" textAlign="center">
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
            bg={location.pathname === item.path ? "gray.800" : "transparent"}
            color={location.pathname === item.path ? "white" : "gray.400"}
            fontWeight={location.pathname === item.path ? "600" : "500"}
            _hover={{
              bg: "gray.800",
              textDecoration: "none",
              color: "white",
            }}
            display="flex"
            alignItems="center"
            transition="all 0.2s"
            onClick={onClose}
          >
            <Icon as={item.icon} mr={3} />
            {item.label}
          </ChakraLink>
        ))}
      </VStack>
   
      <Box mt="auto" p={3} borderRadius="md">
        <HStack spacing={3}>
          <Avatar size="sm" name="Admin User" color={"white"} bg="green.700" />
          <Box flex={1}>
            <Text fontWeight="medium" color={"white"} fontSize="sm">
              Admin User
            </Text>
            <Text fontSize="xs" color="white">
              Administrator
            </Text>
          </Box>
          <Icon as={FiBell} color="blue.500" cursor="pointer" />
        </HStack>
      </Box>
    </Box>
  );
};

const Layout = ({ children }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box minH="100vh" bg={useColorModeValue("gray.50", "gray.900")}>
      <SidebarContent
        onClose={onClose}
        display={{ base: "none", md: "block" }}
      />
      <Drawer
        autoFocus={false}
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        returnFocusOnClose={false}
        onOverlayClick={onClose}
        size="full"
      >
        <DrawerContent>
          <SidebarContent onClose={onClose} />
        </DrawerContent>
      </Drawer>
      {/* Mobile nav */}
      <Flex
        display={{ base: "flex", md: "none" }}
        ml={{ base: 0, md: 60 }}
        px={{ base: 4, md: 24 }}
        height="20"
        alignItems="center"
        bg={useColorModeValue("white", "gray.900")}
        borderBottomWidth="1px"
        borderBottomColor={useColorModeValue("gray.200", "gray.700")}
        justifyContent="flex-start"
      >
        <IconButton
          variant="outline"
          onClick={onOpen}
          aria-label="open menu"
          icon={<FiMenu />}
        />
        <Text fontSize="2xl" ml="8" fontWeight="bold">
          PAI Telecom
        </Text>
      </Flex>
      <Box ml={{ base: 0, md: "250px" }} p="4">
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
