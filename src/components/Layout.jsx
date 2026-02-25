import React, { useState } from "react";
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
  Tooltip,
  Collapse,
} from "@chakra-ui/react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ConfirmDialog from "./ConfirmDialog";
import {
  FiHome,
  FiUpload,
  FiList,
  FiUsers,
  FiUser,
  FiFileText,
  FiSettings,
  FiDollarSign,
  FiBell,
  FiCreditCard,
  FiMenu,
  FiLogOut,
  FiChevronDown,
  FiChevronRight,
  FiFile,
} from "react-icons/fi";

const SidebarContent = ({ onClose, ...rest }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isOpen: isLogoutOpen, onOpen: onLogoutOpen, onClose: onLogoutClose } = useDisclosure();
  const [isBillingOpen, setIsBillingOpen] = useState(false);

  // Check if any billing subitem is active
  const isBillingActive = ['/soa', '/invoices'].includes(location.pathname);
  
  // Auto-expand billing if a subitem is active
  React.useEffect(() => {
    if (isBillingActive) {
      setIsBillingOpen(true);
    }
  }, [isBillingActive]);

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: FiHome },
    { path: "/accounts", label: "Accounts", icon: FiUsers },
    {
      label: "Billing",
      icon: FiDollarSign,
      isDropdown: true,
      isOpen: isBillingOpen,
      onClick: () => setIsBillingOpen(!isBillingOpen),
      subItems: [
        { path: "/invoices", label: "Invoices", icon: FiFileText },
        { path: "/soa", label: "Account Statement", icon: FiDollarSign },
        { path: "/vendorinvoice", label: "Vendor Invoices", icon: FiFile },
        

      ]
    },
    { path: "/payments", label: "Payments", icon: FiCreditCard },
    { path: "/reports", label: "Reports", icon: FiFileText },
    { path: "/settings", label: "Settings", icon: FiSettings },
    { path: "/adduser", label: "Add User", icon: FiUser },
  ];

  const handleLogout = () => {
    onLogoutOpen();
  };

  const onLogoutConfirm = () => {
    logout();
    navigate("/");
    onLogoutClose();
  };

  const renderNavItem = (item) => {
    if (item.isDropdown) {
      return (
        <Box key={item.label}>
          <Flex
            p={3}
            borderRadius="md"
            bg={isBillingActive ? "gray.800" : "transparent"}
            color={isBillingActive ? "white" : "gray.400"}
            fontWeight={isBillingActive ? "600" : "500"}
            _hover={{
              bg: "gray.800",
              textDecoration: "none",
              color: "white",
            }}
            alignItems="center"
            justifyContent="space-between"
            cursor="pointer"
            transition="all 0.2s"
            onClick={item.onClick}
          >
            <Flex alignItems="center">
              <Icon as={item.icon} mr={3} />
              {item.label}
            </Flex>
            <Icon 
              as={item.isOpen ? FiChevronDown : FiChevronRight} 
              boxSize={4}
            />
          </Flex>
          
          <Collapse in={item.isOpen} animateOpacity>
            <VStack spacing={1} align="stretch" mt={1} ml={6}>
              {item.subItems.map((subItem) => (
                <ChakraLink
                  as={RouterLink}
                  to={subItem.path}
                  key={subItem.path}
                  p={2}
                  pl={6}
                  borderRadius="md"
                  bg={location.pathname === subItem.path ? "gray.800" : "transparent"}
                  color={location.pathname === subItem.path ? "white" : "gray.400"}
                  fontWeight={location.pathname === subItem.path ? "600" : "500"}
                  _hover={{
                    bg: "gray.800",
                    textDecoration: "none",
                    color: "white",
                  }}
                  display="flex"
                  alignItems="center"
                  fontSize="sm"
                  transition="all 0.2s"
                  onClick={onClose}
                >
                  <Icon as={subItem.icon} mr={2} boxSize={3.5} />
                  {subItem.label}
                </ChakraLink>
              ))}
            </VStack>
          </Collapse>
        </Box>
      );
    }

    return (
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
    );
  };

  return (
    <Box
      bg={"black"}
      p={4}
      borderRight="1px"
      borderColor={useColorModeValue("gray.200", "gray.700")}
      w={{ base: "full", md: "250px" }}
      pos="fixed"
      h="full"
      display="flex"
      flexDirection="column"
      {...rest}
    >
      <ConfirmDialog
        isOpen={isLogoutOpen}
        onClose={onLogoutClose}
        onConfirm={onLogoutConfirm}
        title="Logout Confirmation"
        message="Are you sure you want to log out of your account?"
        confirmText="Logout"
        type="danger"
      />
      
      {/* Header Section */}
      <Flex direction="column" align="center" mb={8}>
        <Image
          src="/pai-telecom-logo.png"
          alt="PAI Telecom logo"
          boxSize="70px"
          objectFit="contain"
        />
        <Text fontSize="xs" color="gray.400" textAlign="center">
          CDR Billing System
        </Text>
      </Flex>

      {/* Navigation Section */}
      <VStack spacing={1} align="stretch" flex={1} h={"70vh"} overflowY="auto">
        {navItems.map((item) => renderNavItem(item))}
      </VStack>

      {/* Footer Section - pinned to bottom */}
      <Box
        pt={3}
        mt={4}
        borderTop="1px solid"
        borderColor="gray.800"
        flexShrink={0}
      >
        <HStack spacing={3} p={2} borderRadius="md">
          <Avatar size="sm" name={user?.username || "Admin User"} color={"white"} bg="green.700" />
          <Box flex={2} minW={0}>
            <Text
              fontWeight="medium"
              color={"white"}
              fontSize="sm"
              noOfLines={1}
            >
              {user?.username || "Admin User"}
            </Text>
            <Text fontSize="xs" color="gray.400" textTransform="capitalize">
              {user?.role || "Administrator"}
            </Text>
          </Box>
          <HStack
            spacing={3}
            flex={1}
            alignItems="center"
            justifyContent="flex-end"
          >
            <Box position="relative">
              <Icon
                boxSize={5}
                as={FiBell}
                color="blue.400"
                cursor="pointer"
                _hover={{ color: "blue.300" }}
              />
              <Badge
                position="absolute"
                top="-6px"
                right="-6px"
                fontSize="2xs"
                colorScheme="red"
                borderRadius="full"
                boxSize="16px"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                3
              </Badge>
            </Box>
            <Icon
              as={FiLogOut}
              color="gray.400"
              cursor="pointer"
              _hover={{ color: "red.400" }}
              onClick={handleLogout}
            />
          </HStack>
        </HStack>
      </Box>
    </Box>
  );
};

const Layout = ({ children }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box minH="100vh" bg={useColorModeValue("gray.50", "gray.900")}>
      {/* Desktop Sidebar */}
      <SidebarContent
        onClose={onClose}
        display={{ base: "none", md: "block" }}
      />

      {/* Mobile Drawer */}
      <Drawer
        autoFocus={false}
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        returnFocusOnClose={false}
        onOverlayClick={onClose}
        size="full"
      >
        <DrawerOverlay />
        <DrawerContent bg="black">
          <DrawerCloseButton color="white" />
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
        position="sticky"
        top={0}
        zIndex={10}
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

      {/* Main Content */}
      <Box ml={{ base: 0, md: "250px" }} p="6">
        {children}
      </Box>
    </Box>
  );
};

export default Layout;