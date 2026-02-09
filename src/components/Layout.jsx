import React from 'react';
import {
  Box,
  Flex,
  Heading,
  Link as ChakraLink,
  VStack,
  Icon,
  useColorModeValue,
  Avatar,
  Text,
  HStack,
  Badge,
} from '@chakra-ui/react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  FiHome,
  FiUpload,
  FiList,
  FiUsers,
  FiFileText,
  FiSettings,
  FiDollarSign,
  FiBell,
} from 'react-icons/fi';

const Layout = ({ children }) => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: FiHome },
    { path: '/accounts', label: 'Accounts', icon: FiUsers },
    { path: '/invoices', label: 'Invoices', icon: FiFileText },
    { path: '/reports', label: 'Reports', icon: FiFileText },
    { path: '/settings', label: 'Settings', icon: FiSettings },
  ];

  return (
    <Flex h="100vh">
      {/* Sidebar */}
      <Box
        w="250px"
        bg={useColorModeValue('white', 'gray.800')}
        p={4}
        borderRight="1px"
        borderColor={useColorModeValue('gray.200', 'gray.700')}
        display="flex"
        flexDirection="column"
      >
        <HStack mb={8} spacing={3}>
          <Icon as={FiDollarSign} w={8} h={8} color="blue.500" />
          <Box>
            <Heading size="md" color="blue.600">
              CDR Billing
            </Heading>
            <Text fontSize="xs" color="gray.500">
              Telecom Billing System
            </Text>
          </Box>
        </HStack>

        <VStack spacing={1} align="stretch" flex={1}>
          {navItems.map((item) => (
            <ChakraLink
              as={RouterLink}
              to={item.path}
              key={item.path}
              p={3}
              borderRadius="md"
              bg={location.pathname === item.path ? 'blue.50' : 'transparent'}
              color={location.pathname === item.path ? 'blue.600' : 'gray.600'}
              fontWeight={location.pathname === item.path ? '600' : '500'}
              _hover={{
                bg: location.pathname === item.path ? 'blue.50' : 'gray.50',
                textDecoration: 'none',
              }}
              display="flex"
              alignItems="center"
              transition="all 0.2s"
            >
              <Icon as={item.icon} mr={3} />
              {item.label}
              {item.path === '/invoices' && (
                <Badge ml="auto" colorScheme="red"  variant="subtle" size="sm" borderRadius={"full"}>
                  3  
                </Badge>      //will be replaced by the actual number of pending invoices
              )}
            </ChakraLink>
          ))}
        </VStack>

        {/* User Profile */}
        <Box
          mt="auto"
          p={3}
          borderRadius="md"
          bg={useColorModeValue('gray.50', 'gray.700')}
        >
          <HStack spacing={3}>
            <Avatar size="sm" name="Admin User" bg="blue.500" />
            <Box flex={1}>
              <Text fontWeight="medium" fontSize="sm">
                Admin User
              </Text>
              <Text fontSize="xs" color="gray.500">
                Administrator
              </Text>
            </Box>
            <Icon as={FiBell} color="gray.500" cursor="pointer" />
          </HStack>
        </Box>
      </Box>

      {/* Main Content */}
      <Box flex={1} overflow="auto" bg={useColorModeValue('gray.50', 'gray.900')}>
        {children}
      </Box>
    </Flex>
  );
};

export default Layout;