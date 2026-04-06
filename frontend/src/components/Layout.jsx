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
  Tooltip,
  Collapse,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Portal,
  Spinner,
  useDisclosure,
} from "@chakra-ui/react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ConfirmDialog from "./ConfirmDialog";
import ChangePasswordModal from "./modals/ChangePasswordModal";
import {
  FiHome,
  FiUsers,
  FiUser,
  FiLock,
  FiFileText,
  FiSettings,
  FiDollarSign,
  FiBell,
  FiCreditCard,
  FiLogOut,
  FiChevronDown,
  FiChevronRight,
  FiFile,
  FiAlertTriangle,
  FiBellOff,
  FiDownload,
  FiTrendingUp,
  FiShoppingBag,
  FiCheckCircle,
} from "react-icons/fi";
import {
  fetchNotifications,
  getGlobalSettings,
  markAllNotificationsRead,
  markNotificationRead,
} from "../utils/api";
import { formatNotificationTime } from "../utils/notificationTime";

const SidebarContent = () => {
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
  const [notificationPollingSeconds, setNotificationPollingSeconds] =
    useState(10);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const userRole = user?.role?.trim().toLowerCase();
  const pollingMs = useMemo(() => {
    const seconds = Number(notificationPollingSeconds);
    return Math.max(5, Math.min(3600, seconds)) * 1000;
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
        setNotificationPollingSeconds(
          Number(settings.notificationPollingSeconds) || 10,
        );
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

    const onNotificationsRefreshRequested = () => {
      loadNotifications();
    };

    window.addEventListener("settings-updated", onSettingsUpdated);
    window.addEventListener("notifications-refresh-requested", onNotificationsRefreshRequested);

    return () => {
      window.removeEventListener("settings-updated", onSettingsUpdated);
      window.removeEventListener("notifications-refresh-requested", onNotificationsRefreshRequested);
    };
  }, [loadNotifications]);

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
          roles: ["admin", "sales-manager", "rates-dept", "view only"],
        },
      ],
    },
    {
      label: "Rates",
      icon: FiTrendingUp,
      isDropdown: true,
      roles: ["admin", "sales-manager", "rates-dept", "view only"],
      subItems: [
        {
          path: "/customer-rates",
          label: "Customer Rates",
          icon: FiUsers,
          roles: ["admin", "sales-manager", "rates-dept", "view only"],
        },
        {
          path: "/vendor-rates",
          label: "Vendor Rates",
          icon: FiShoppingBag,
          roles: ["admin", "sales-manager", "rates-dept", "view only"],
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
      path: "/account-exposure",
      label: "Account Exposure",
      icon: FiUser,
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
      label: "Users",
      icon: FiUser,
      roles: ["admin"],
    },
    {
      path: "/admin-cdr-download",
      label: "Download CDR",
      icon: FiDownload,
      roles: ["admin"],
    },
  ];

  const filteredNavItems = navItems
    .filter((item) => item.roles.includes(userRole))
    .map((item) => {
      if (item.isDropdown && item.subItems) {
        return {
          ...item,
          subItems: item.subItems.filter((sub) => sub.roles.includes(userRole)),
        };
      }
      return item;
    })
    .filter((item) => !item.isDropdown || item.subItems?.length > 0);

  React.useEffect(() => {
    filteredNavItems.forEach((item) => {
      if (item.isDropdown) {
        const isActive = item.subItems.some(
          (sub) => sub.path === location.pathname,
        );
        if (isActive) setOpenDropdown(item.label);
      }
    });
  }, [location.pathname]);

  const onLogoutConfirm = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/");
    } finally {
      setIsLoggingOut(false);
      onLogoutClose();
    }
  };

  const renderNavItem = (item) => {
    if (item.isDropdown) {
      const isActive = item.subItems.some(
        (sub) => sub.path === location.pathname,
      );
      const isOpen = openDropdown === item.label;

      return (
        <Box key={item.label}>
          <Flex
            p={3}
            borderRadius="md"
            color={isActive ? "blue.500" : "gray.500"}
            fontWeight={isActive ? "600" : "500"}
            _hover={{ textDecoration: "none" }}
            alignItems="center"
            justifyContent="space-between"
            cursor="pointer"
            transition="all 0.2s"
            onClick={() => setOpenDropdown(isOpen ? null : item.label)}
          >
            <Flex alignItems="center">
              <Icon as={item.icon} mr={3} />
              {item.label}
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
                  color={
                    location.pathname === subItem.path ? "blue.500" : "gray.500"
                  }
                  fontWeight={
                    location.pathname === subItem.path ? "600" : "500"
                  }
                  _hover={{ textDecoration: "none" }}
                  display="flex"
                  alignItems="center"
                  fontSize="sm"
                  transition="all 0.2s"
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
        color={location.pathname === item.path ? "blue.500" : "gray.500"}
        fontWeight={location.pathname === item.path ? "600" : "500"}
        _hover={{ textDecoration: "none" }}
        display="flex"
        alignItems="center"
        transition="all 0.2s"
        onClick={() => setOpenDropdown(null)}
      >
        <Icon as={item.icon} mr={3} />
        {item.label}
      </ChakraLink>
    );
  };

  return (
    <Box
      bg="white"
      borderRight="1px"
      borderColor={useColorModeValue("gray.200", "gray.700")}
      w="250px"
      pos="fixed"
      zIndex="sticky"
      h="100vh"
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      <ConfirmDialog
        isOpen={isLogoutOpen}
        onClose={onLogoutClose}
        onConfirm={onLogoutConfirm}
        title="Logout Confirmation"
        message="Are you sure you want to log out of your account?"
        confirmText="Logout"
        type="danger"
        isLoading={isLoggingOut}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={onChangePasswordClose}
      />

      {/* Header */}
      <Flex direction="column" align="center" mb={6} pt={4}>
        <Image
            src="/Cyvora.png"
          alt="Cyvora logo"
          boxSize="70px"
          objectFit="contain"
        />
        <Text fontSize="xs" color="gray.500" textAlign="center">
         Billing System
        </Text>
      </Flex>

      {/* Navigation */}
      <VStack
        p={2}
        pl={4}
        spacing={1}
        align="stretch"
        flex={1}
        minH={0}
        overflowY="auto"
        sx={{
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {filteredNavItems.map((item) => renderNavItem(item))}
      </VStack>

      {/* Footer - pinned to bottom */}
      <Box
        mt={2}
        borderTop="2px solid"
        borderColor="gray.300"
        flexShrink={0}
        bg="gray.200"
        px={2}
      >
        <HStack spacing={3} p={2} borderRadius="md" transition="all 0.2s">
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
                  size="xs"
                  name={user?.email || "Admin User"}
                  color="white"
                  bg="green.700"
                />
                <Box flex={2} minW={0}>
                  <Text fontWeight="medium" fontSize="sm" noOfLines={1}>
                    {user?.email || "Admin User"}
                  </Text>
                  <Text
                    fontSize="xs"
                    color="gray.600"
                    textTransform="capitalize"
                  >
                    {user?.role || "Administrator"}
                  </Text>
                </Box>
              </HStack>
            </MenuButton>

            <MenuList bg="gray.200" shadow="md" minW="150px" zIndex="popover">
              <MenuItem
                icon={<Icon as={FiLock} />}
                bg="gray.200"
                fontSize="sm"
                _hover={{ bg: "gray.300" }}
                onClick={onChangePasswordOpen}
              >
                Change Password
              </MenuItem>
            </MenuList>
          </Menu>

          <Flex gap={5} alignItems="center">
            <Menu placement="right-end" closeOnSelect={false} strategy="fixed">
              <MenuButton as={Box} cursor="pointer" position="relative">
                <Box position="relative">
                  <Icon
                    boxSize={5}
                    as={FiBell}
                    color="blue.600"
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
              </MenuButton>

              <Portal>
                <MenuList
                  bg="white"
                  color="gray.800"
                  minW="380px"
                  maxW="380px"
                  boxShadow="2xl"
                  p={0}
                  zIndex="tooltip"
                  overflow="hidden"
                  borderRadius="xl"
                >
                  <Flex
                    align="center"
                    justify="space-between"
                    px={4}
                    py={2}
                    // bg="rgb(237, 242, 247)"
                  >
                    <Text fontWeight={600} color={"gray.600"} fontSize="md">
                      Notifications
                    </Text>
                    <Button
                      leftIcon={<FiCheckCircle />}
                      size="sm"
                      variant="outline"
                      colorScheme="green"
                      fontSize="xs"
                      onClick={async () => {
                        await markAllNotificationsRead();
                        await loadNotifications();
                      }}
                      _hover={{ bg: "whiteAlpha.200" }}
                    >
                      Mark all as read
                    </Button>
                  </Flex>

                  <Box
                   minH={"300px"}
                    maxH="300px"
                    overflowY="auto"
                    ssx={{
                      scrollbarWidth: "thin",
                      scrollbarColor: "#CBD5E0 transparent",
                      "&::-webkit-scrollbar": { width: "4px" },
                      "&::-webkit-scrollbar-thumb": {
                        background: "#CBD5E0",
                        borderRadius: "4px",
                      },
                      "&::-webkit-scrollbar-thumb:hover": {
                        background: "#A0AEC0",
                      },
                    }}
                  >
                    {loadingNotifications && (
                      <Flex justify="center" align="center" py={10}>
                        <Spinner size="sm" color="blue.500" thickness="2px" />
                      </Flex>
                    )}

                    {!loadingNotifications && notifications.length === 0 && (
                      <VStack py={10} spacing={2}>
                        <Icon as={FiBellOff} fontSize="xl" color="gray.300" />
                        <Text fontSize="sm" color="gray.400">
                          You're all caught up
                        </Text>
                      </VStack>
                    )}

                    {!loadingNotifications &&
                      notifications.map((item) => (
                        <Box
                          key={item.id}
                          display="flex"
                          alignItems="flex-start"
                          gap={3}
                          px={4}
                          py={3}
                          borderBottom="0.5px solid"
                          borderColor="gray.100"
                          bg={item.isRead ? "white" : "gray.100"}
                          cursor="pointer"
                          transition="background 0.15s"
                          _hover={{ bg: item.isRead ? "gray.50" : "gray.200" }}
                          _last={{ borderBottom: "none" }}
                          onClick={async () => {
                            if (!item.isRead) {
                              await markNotificationRead(item.id);
                              await loadNotifications();
                            }
                          }}
                        >
                          {/* Unread dot */}
                          <Box
                            mt="6px"
                            minW="7px"
                            h="7px"
                            borderRadius="full"
                            bg={item.isRead ? "transparent" : "blue.500"}
                            flexShrink={0}
                          />

                          {/* Icon */}
                          <Flex
                            w="34px"
                            h="34px"
                            borderRadius="full"
                            bg={
                              item.type === "payment"
                                ? "green.50"
                                : item.type === "alert"
                                  ? "red.50"
                                  : item.type === "invoice"
                                    ? "orange.50"
                                    : "blue.50"
                            }
                            align="center"
                            justify="center"
                            flexShrink={0}
                          >
                            <Icon
                              as={
                                item.type === "payment"
                                  ? FiCreditCard
                                  : item.type === "alert"
                                    ? FiAlertTriangle
                                    : item.type === "invoice"
                                      ? FiFileText
                                      : FiBell
                              }
                              boxSize={4}
                              color={
                                item.type === "payment"
                                  ? "green.600"
                                  : item.type === "alert"
                                    ? "red.600"
                                    : item.type === "invoice"
                                      ? "orange.500"
                                      : "blue.600"
                              }
                            />
                          </Flex>

                          {/* Content */}
                          <Box flex={1} minW={0}>
                            <Text
                              fontSize="13px"
                              fontWeight={item.isRead ? "400" : "500"}
                              color="gray.800"
                              noOfLines={1}
                            >
                              {item.title}
                            </Text>
                            <Text
                              fontSize="12px"
                              color="gray.600"
                              noOfLines={2}
                              mt="2px"
                              lineHeight="1.5"
                            >
                              {item.message}
                            </Text>
                            <Text fontSize="11px" color="gray.500" mt="4px">
                              {formatNotificationTime(item.createdAt)}
                            </Text>
                          </Box>
                        </Box>
                      ))}
                  </Box>
                </MenuList>
              </Portal>
            </Menu>

            <Icon
              as={FiLogOut}
              color="red.600"
              cursor="pointer"
              _hover={{ color: "red.400" }}
              onClick={onLogoutOpen}
            />
          </Flex>
        </HStack>
      </Box>
    </Box>
  );
};

const Layout = ({ children }) => {
  return (
    <Box minH="100%" bg="white" maxW="100%" overflowX="clip"
    >
      <SidebarContent />

      {/* Main Content */}
      <Box ml="250px" p={4} pt={2} maxW="100%" minW={0} overflowX="clip">
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
