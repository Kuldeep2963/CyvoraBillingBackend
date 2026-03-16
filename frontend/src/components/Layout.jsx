import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Flex,
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
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Spinner,
} from "@chakra-ui/react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ConfirmDialog from "./ConfirmDialog";
import ChangePasswordModal from "./modals/ChangePasswordModal";
import {
  FiHome,
  FiUpload,
  FiList,
  FiUsers,
  FiUser,
  FiLock,
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
  FiAlertTriangle,
} from "react-icons/fi";
import {
  fetchNotifications,
  getGlobalSettings,
  markAllNotificationsRead,
  markNotificationRead,
} from "../utils/api";

const SidebarContent = ({ onClose, ...rest }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    isOpen: isLogoutOpen,
    onOpen: onLogoutOpen,
    onClose: onLogoutClose,
  } = useDisclosure();
  const {
    isOpen: isChangePasswordOpen,
    onOpen: onChangePasswordOpen,
    onClose: onChangePasswordClose,
  } = useDisclosure();
  const [openDropdown, setOpenDropdown] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationPollingSeconds, setNotificationPollingSeconds] = useState(10);

  const userRole = user?.role?.trim().toLowerCase();
  const pollingMs = useMemo(() => {
    const seconds = Number(notificationPollingSeconds) || 10;
    return Math.max(5, Math.min(60, seconds)) * 1000;
  }, [notificationPollingSeconds]);

  const loadNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const data = await fetchNotifications({ limit: 10 });
      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (error) {
      console.error("Failed to load notifications", error);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    getGlobalSettings()
      .then((settings) => {
        setNotificationPollingSeconds(Number(settings.notificationPollingSeconds) || 10);
      })
      .catch(() => {
        setNotificationPollingSeconds(10);
      });

    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadNotifications();
    }, pollingMs);

    return () => clearInterval(timer);
  }, [pollingMs, loadNotifications]);

  useEffect(() => {
    const onSettingsUpdated = (event) => {
      const nextPoll = Number(event?.detail?.notificationPollingSeconds) || 10;
      setNotificationPollingSeconds(nextPoll);
    };

    window.addEventListener("settings-updated", onSettingsUpdated);
    return () => window.removeEventListener("settings-updated", onSettingsUpdated);
  }, []);

  // alert(userRole);

  const navItems = [
    {
      path: "/dashboard",
      label: "Dashboard",
      icon: FiHome,
      roles: ["admin", "sales-manager", "rates-dept", "noc-dept", "view only"],
    },
    {
      path: "/accounts",
      label: "Accounts",
      icon: FiUsers,
      roles: ["admin", "sales-manager", "rates-dept", "view only"],
    },
    {
      label: "Billing",
      icon: FiDollarSign,
      isDropdown: true,
      roles: ["admin", "sales-manager", "rates-dept", "view only"],
      subItems: [
        {
          path: "/invoices",
          label: "Invoices",
          icon: FiFileText,
          roles: ["admin", "sales-manager", "rates-dept", "view only"],
        },
        {
          path: "/soa",
          label: "Account Statement",
          icon: FiDollarSign,
          roles: ["admin", "sales-manager", "view only"],
        },
        {
          path: "/vendorinvoice",
          label: "Vendor Invoices",
          icon: FiFile,
          roles: ["admin", "rates-dept", "view only"],
        },
      ],
    },
    {
      path: "/payments",
      label: "Payments",
      icon: FiCreditCard,
      roles: ["admin", "sales-manager", "rates-dept"],
    },
    {
      path: "/disputes",
      label: "Disputes",
      icon: FiAlertTriangle,
      roles: ["admin", "sales-manager", "noc-dept", "view only"],
    },
    {
      path: "/reports",
      label: "Reports",
      icon: FiFileText,
      roles: ["admin", "sales-manager", "rates-dept", "noc-dept", "view only"],
    },
    {
      path: "/settings",
      label: "Settings",
      icon: FiSettings,
      roles: ["admin"],
    },
    {
      path: "/adduser",
      label: "Add User",
      icon: FiUser,
      roles: ["admin"],
    },
  ];

  // Filter nav items based on user role
  const filteredNavItems = navItems
    .filter((item) => item.roles.includes(userRole))
    .map((item) => {
      if (item.isDropdown && item.subItems) {
        return {
          ...item,
          subItems: item.subItems.filter((sub) =>
            sub.roles.includes(userRole)
          ),
        };
      }
      return item;
    })
    .filter((item) => !item.isDropdown || item.subItems?.length > 0);

  // Auto-expand dropdown if a subitem is active on mount / route change
  React.useEffect(() => {
    filteredNavItems.forEach((item) => {
      if (item.isDropdown) {
        const isActive = item.subItems.some(
          (sub) => sub.path === location.pathname
        );
        if (isActive) {
          setOpenDropdown(item.label);
        }
      }
    });
  }, [location.pathname]);

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
      const isActive = item.subItems.some(
        (sub) => sub.path === location.pathname
      );
      const isOpen = openDropdown === item.label;

      return (
        <Box key={item.label}>
          <Flex
            p={3}
            borderRadius="md"
            bg={isActive ? "gray.800" : "transparent"}
            color={isActive ? "white" : "gray.400"}
            fontWeight={isActive ? "600" : "500"}
            _hover={{
              bg: "gray.800",
              textDecoration: "none",
              color: "white",
            }}
            alignItems="center"
            justifyContent="space-between"
            cursor="pointer"
            transition="all 0.2s"
            onClick={() => setOpenDropdown(isOpen ? null : item.label)}
          >
            <Flex alignItems="center">
              <Icon as={item.icon} mr={3} />
              <Text whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                {item.label}
              </Text>
            </Flex>
            <Icon as={isOpen ? FiChevronDown : FiChevronRight} boxSize={4} />
          </Flex>

          <Collapse in={isOpen} animateOpacity>
            <VStack spacing={1} align="stretch" mt={1} ml={6}>
              {item.subItems.map((subItem) => (
                <ChakraLink
                  as={RouterLink}
                  to={subItem.path}
                  key={subItem.path}
                  p={2}
                  pl={6}
                  borderRadius="md"
                  bg={
                    location.pathname === subItem.path
                      ? "gray.800"
                      : "transparent"
                  }
                  color={
                    location.pathname === subItem.path ? "white" : "gray.400"
                  }
                  fontWeight={
                    location.pathname === subItem.path ? "600" : "500"
                  }
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
                  <Text whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                    {subItem.label}
                  </Text>
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
        onClick={() => {
          setOpenDropdown(null);
          onClose();
        }}
      >
        <Icon as={item.icon} mr={3} />
        <Text whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
          {item.label}
        </Text>
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
      zIndex={20}
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

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={onChangePasswordClose}
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
      <VStack
        spacing={1}
        align="stretch"
        flex={1}
        h={"70vh"}
        overflowY="auto"
        sx={{
          "&::-webkit-scrollbar": {
            display: "none",
          },
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {filteredNavItems.map((item) => renderNavItem(item))}
      </VStack>

      {/* Footer Section - pinned to bottom */}
      <Box
        pt={3}
        mt={4}
        borderTop="1px solid"
        borderColor="gray.800"
        flexShrink={0}
      >
        <HStack
          spacing={3}
          p={2}
          borderRadius="md"
          cursor="pointer"
          _hover={{ bg: "gray.900" }}
          transition="all 0.2s"
        >
          <Menu placement="top-start">
            <MenuButton
              as={Box}
              display="flex"
              alignItems="center"
              gap={3}
              flex={1}
              minW={0}
            >
              <HStack spacing={3}>
                <Avatar
                  size="sm"
                  name={user?.email || "Admin User"}
                  color="white"
                  bg="green.700"
                />
                <Box flex={2} minW={0}>
                  <Text
                    fontWeight="medium"
                    color="white"
                    fontSize="sm"
                    noOfLines={1}
                  >
                    {user?.email || "Admin User"}
                  </Text>
                  <Text
                    fontSize="xs"
                    color="gray.400"
                    textTransform="capitalize"
                  >
                    {user?.role || "Administrator"}
                  </Text>
                </Box>
              </HStack>
            </MenuButton>

            <MenuList
              bg="gray.800"
              borderColor="gray.700"
              shadow="md"
              minW="150px"
              zIndex="popover"
            >
              <MenuItem
                icon={<Icon as={FiLock} />}
                bg="gray.800"
                color="white"
                _hover={{ bg: "gray.700" }}
                onClick={onChangePasswordOpen}
              >
                Change Password
              </MenuItem>
            </MenuList>
          </Menu>

          <HStack spacing={3} alignItems="center">
            <Menu placement="right-end" closeOnSelect={false}>
              <MenuButton as={Box} cursor="pointer" position="relative">
                <Tooltip
                  bg="white"
                  p={2}
                  borderRadius="lg"
                  shadow="xl"
                  color="black"
                  label="Notifications"
                  placement="right"
                  fontSize="sm"
                >
                  <Box position="relative">
                    <Icon
                      boxSize={5}
                      as={FiBell}
                      color="blue.400"
                      _hover={{ color: "blue.300" }}
                    />
                    {unreadCount > 0 && (
                      <Badge
                        position="absolute"
                        top="-6px"
                        right="-6px"
                        fontSize="2xs"
                        colorScheme="red"
                        borderRadius="full"
                        minW="16px"
                        px={1}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Badge>
                    )}
                  </Box>
                </Tooltip>
              </MenuButton>

              <MenuList
                bg="gray.800"
                borderColor="gray.700"
                color="white"
                minW="320px"
                maxW="360px"
                zIndex="popover"
              >
                <MenuItem
                  bg="gray.800"
                  color="blue.200"
                  _hover={{ bg: "gray.700" }}
                  onClick={async () => {
                    await markAllNotificationsRead();
                    await loadNotifications();
                  }}
                >
                  Mark all as read
                </MenuItem>
                <MenuDivider borderColor="gray.700" />
                {loadingNotifications && (
                  <Box px={3} py={2}>
                    <Spinner size="sm" />
                  </Box>
                )}
                {!loadingNotifications && notifications.length === 0 && (
                  <Box px={3} py={2}>
                    <Text fontSize="sm" color="gray.300">No notifications</Text>
                  </Box>
                )}
                {!loadingNotifications &&
                  notifications.map((item) => (
                    <MenuItem
                      key={item.id}
                      bg="gray.800"
                      whiteSpace="normal"
                      alignItems="flex-start"
                      _hover={{ bg: "gray.700" }}
                      onClick={async () => {
                        if (!item.isRead) {
                          await markNotificationRead(item.id);
                          await loadNotifications();
                        }
                      }}
                    >
                      <Box>
                        <Text fontSize="sm" fontWeight={item.isRead ? "500" : "700"}>{item.title}</Text>
                        <Text fontSize="xs" color="gray.300">{item.message}</Text>
                      </Box>
                    </MenuItem>
                  ))}
              </MenuList>
            </Menu>

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
        size="xs"
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
        gap={6}
      >
        <IconButton
          variant="outline"
          onClick={onOpen}
          aria-label="open menu"
          icon={<FiMenu />}
        />
        <Image
          src="./pai-telecom-logo.png"
          alt="PAI Telecom logo"
          boxSize="60px"
          objectFit="contain"
        />
      </Flex>

      {/* Main Content */}
      <Box ml={{ base: 0, md: "250px" }} p="6">
        {children}
      </Box>
    </Box>
  );
};

export default Layout;