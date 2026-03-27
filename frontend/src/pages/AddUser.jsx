import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Grid,
  Heading,
  HStack,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Switch,
  Text,
  VStack,
  Badge,
  Avatar,
  useColorModeValue,
  useToast,
  Card,
  CardBody,
  CardHeader,
  SimpleGrid,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Skeleton,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Tooltip,
} from "@chakra-ui/react";
import { MemoizedInput as Input, MemoizedSelect as Select } from "../components/memoizedinput/memoizedinput";
import { useState, useEffect, useCallback } from "react";
import { createUser, fetchUsers, deleteUser } from "../utils/api";
import ConfirmDialog from "../components/ConfirmDialog";
import PageNavBar from "../components/PageNavBar";
import { FiMail } from "react-icons/fi";
import { FiRotateCcw, FiUser, FiPlus, FiSearch, FiRefreshCw, FiMoreVertical, FiUsers, FiAlertTriangle } from "react-icons/fi";
import { Icon } from "lucide-react";

// ── Inline SVG Icons ──────────────────────────────────────────
const IconUser  = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
const IconMail  = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>);
const IconPhone = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8 9a16 16 0 0 0 6.29 6.29l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>);
const IconLock  = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);
const IconEye   = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>);
const IconEyeOff= () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>);

const ROLES = ["Admin", "Sales-Manager", "Rates-Dept", "NOC-Dept", "View Only"];

// ── Role color map ────────────────────────────────────────────
const roleColor = (role) => {
  const map = {
    admin:          "red",
    "sales-manager":"blue",
    "rates-dept":   "purple",
    "noc-dept":     "teal",
    "view only":    "gray",
  };
  return map[role?.toLowerCase()] || "gray";
};

// ── Users Table Tab ───────────────────────────────────────────
const UsersTab = ({ onAddNew, refreshSignal }) => {
  const border  = useColorModeValue("gray.200", "gray.700");
  const cardBg  = useColorModeValue("white", "gray.800");
  const hoverBg = useColorModeValue("gray.50", "gray.750");
  const toast   = useToast();

  const [users, setUsers]       = useState([]);
  const [search, setSearch]     = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]       = useState(null);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message || "Failed to load users");
      toast({ title: "Failed to load users", description: err.message, status: "error", duration: 4000, isClosable: true });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Load on mount + whenever a new user is created
  useEffect(() => { loadUsers(); }, [loadUsers, refreshSignal]);

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    
    setIsDeleting(true);
    try {
      await deleteUser(deleteUserId);
      toast({
        title: "User Deleted Successfully",
        description: "The user has been removed from the system.",
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      setDeleteUserId(null);
      loadUsers(); // Refresh the user list
    } catch (err) {
      toast({
        title: "Error Deleting User",
        description: err.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = users.filter(u =>
    (u.first_name?.toLowerCase().includes(search.toLowerCase()) ||
     u.last_name?.toLowerCase().includes(search.toLowerCase()) ||
     u.email?.toLowerCase().includes(search.toLowerCase()) ||
     u.role?.toLowerCase().includes(search.toLowerCase()))
  );

  const adminCount  = users.filter(u => u.role?.toLowerCase() === "admin").length;
  const activeCount = users.length; // extend if API returns isActive

  return (
    <VStack spacing={4} align="stretch">
      {/* Stat cards */}
      <SimpleGrid columns={{ base: 2, md: 3 }} spacing={3}>
        {[
          { label: "Total Users",  value: users.length, color: "blue"  },
          { label: "Admins",       value: adminCount,   color: "red"   },
          { label: "Active",       value: activeCount,  color: "green" },
        ].map(({ label, value, color }) => (
          <Card key={label} bg={cardBg} border="1px" borderColor={border} shadow="sm" borderRadius="10px">
            <CardBody py={3} px={4}>
              <Text fontSize="xs" color="gray.500" fontWeight="600" textTransform="uppercase" letterSpacing="0.06em" mb={1}>{label}</Text>
              <Text fontSize="xl" fontWeight="700" color={`${color}.500`}>{isLoading ? "—" : value}</Text>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      {/* Table */}
      <Card bg={cardBg} border="1px" borderColor={border} shadow="sm" borderRadius="12px">
        <CardHeader pb={3}>
          <Flex align="center" justify="space-between" flexWrap="wrap" gap={3}>
            <HStack>
              <Box w={1} h={5} bg="blue.500" borderRadius="full" />
              <Heading size="sm" color="gray.800">System Users</Heading>
              <Badge colorScheme="blue" variant="subtle" fontSize="xs">{filtered.length} records</Badge>
            </HStack>
            <HStack spacing={3}>
              <InputGroup size="sm" maxW="220px">
                <InputLeftElement pointerEvents="none" color="gray.400"><FiSearch /></InputLeftElement>
                <Input
                  pl={8} placeholder="Search users..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  borderRadius="8px" borderColor={border} fontSize="13px"
                  _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
                />
              </InputGroup>
              <Tooltip label="Refresh" placement="top">
                <IconButton icon={<FiRefreshCw />} size="sm" variant="outline" borderRadius="8px"
                  borderColor={border} color="gray.500" aria-label="Refresh" isLoading={isLoading}
                  onClick={loadUsers} _hover={{ borderColor: "blue.400", color: "blue.500" }} />
              </Tooltip>
              <Button size="sm" leftIcon={<FiPlus />} colorScheme="blue" borderRadius="8px"
                fontSize="13px" fontWeight="600" boxShadow="0 2px 8px rgba(49,130,206,0.25)" onClick={onAddNew}>
                Add User
              </Button>
            </HStack>
          </Flex>
        </CardHeader>

        <CardBody pt={0}>
          <TableContainer>
            <Table variant="simple" size="sm">
              <Thead bg={"gray.200"}>
                <Tr>
                  {[ "ID", "Name", "Email", "Phone", "Role", "Actions"].map(h => (
                    <Th key={h} fontSize="11px" color="gray.700" fontWeight="700" letterSpacing="0.06em"
                      textTransform="uppercase" borderColor={border} py={3}>{h}</Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Tr key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Td key={j} borderColor={border} py={3}><Skeleton height="14px" borderRadius="4px" /></Td>
                      ))}
                    </Tr>
                  ))
                ) : error ? (
                  <Tr>
                    <Td colSpan={5} borderColor={border}>
                      <Flex direction="column" align="center" py={10} color="red.400">
                        <FiAlertTriangle size={28} style={{ marginBottom: "8px", opacity: 0.6 }} />
                        <Text fontSize="sm" fontWeight="600">Failed to load users</Text>
                        <Text fontSize="xs" color="gray.400" mt={1} mb={4}>{error}</Text>
                        <Button size="sm" leftIcon={<FiRefreshCw />} colorScheme="blue" variant="outline"
                          borderRadius="8px" onClick={loadUsers}>Try Again</Button>
                      </Flex>
                    </Td>
                  </Tr>
                ) : filtered.length === 0 ? (
                  <Tr>
                    <Td colSpan={5} borderColor={border}>
                      <Flex direction="column" align="center" py={10} color="gray.400">
                        <FiUsers size={28} style={{ marginBottom: "8px", opacity: 0.4 }} />
                        <Text fontSize="sm">No users found</Text>
                        <Text fontSize="xs" mt={1}>Try adjusting your search or add a new user</Text>
                      </Flex>
                    </Td>
                  </Tr>
                ) : (
                  filtered.map((u) => (
                    <Tr key={u.id} _hover={{ bg: hoverBg }} transition="background 0.15s">
                      <Td borderColor={border} py={3}>
                        <Text fontSize="15px" color="gray.600">{u.id}</Text>
                      </Td>
                      {/* User avatar + name */}
                      <Td borderColor={border} py={3}>
                        <HStack spacing={3}>
                          <Avatar size="sm" name={`${u.first_name} ${u.last_name}`} bg={`${roleColor(u.role)}.500`} color="white" />
                          <Text fontSize="13px" fontWeight="500" color="gray.700" textTransform="capitalize">
                            {u.first_name} {u.last_name}
                          </Text>
                        </HStack>
                      </Td>
                      <Td borderColor={border} py={3}>
                       
                        <Text fontSize="13px" color="gray.500">{u.email}</Text>
                      </Td>
                       <Td borderColor={border} py={3}>
                       
                        <Text fontSize="13px" color="gray.500">{u.phone}</Text>
                      </Td>
                      
                      <Td borderColor={border} py={3}>
                        <Badge colorScheme={roleColor(u.role)} variant="subtle" fontSize="xs"
                          px={2} py={0.5} borderRadius="full" textTransform="capitalize">
                          {u.role}
                        </Badge>
                      </Td>
                      
                      <Td borderColor={border} py={3}>
                        <Menu>
                          <MenuButton as={IconButton} icon={<FiMoreVertical />} variant="ghost" size="xs"
                            color="gray.600" _hover={{ color: "gray.700", bg: "gray.100" }} borderRadius="6px" />
                          <MenuList fontSize="sm" minW="130px" shadow="lg" borderColor={border}>
                            <MenuItem fontSize="13px" color="red.500" onClick={() => setDeleteUserId(u.id)}>Delete</MenuItem>
                          </MenuList>
                        </Menu>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </TableContainer>
        </CardBody>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteUserId !== null}
        onClose={() => setDeleteUserId(null)}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        isLoading={isDeleting}
      />
    </VStack>
  );
};

// ── Add User Form Tab ─────────────────────────────────────────
const AddUserTab = ({ onSuccess }) => {
  const toast        = useToast();
  const cardBg       = useColorModeValue("white", "gray.800");
  const borderColor  = useColorModeValue("gray.200", "gray.700");
  const labelColor   = useColorModeValue("gray.600", "gray.400");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "",
    role: "", isActive: true, sendWelcome: true, mfaRequired: false,
  });
  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.firstName)  e.firstName  = "First name is required";
    if (!form.lastName)   e.lastName   = "Last name is required";
    if (!form.email)      e.email      = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email address";
    if (!form.password)   e.password   = "Password is required";
    else if (form.password.length < 8) e.password = "Minimum 8 characters";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match";
    if (!form.role)       e.role       = "Role is required";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      toast({ title: "Please fix the errors", status: "error", duration: 3000, isClosable: true });
      return;
    }
    setIsSubmitting(true);
    try {
      await createUser({ 
        email: form.email, 
        password: form.password,
        first_name: form.firstName, 
        last_name: form.lastName,
        phone: form.phone,  
        role: form.role.toLowerCase(),
      });
      toast({
        title: "User Created Successfully",
        description: `${form.firstName} ${form.lastName} has been added.`,
        status: "success", duration: 4000, isClosable: true,
      });
      handleReset();
      if (onSuccess) onSuccess(); // switch tab + refresh
    } catch (err) {
      toast({ title: "Error Creating User", description: err.message, status: "error", duration: 4000, isClosable: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm({ firstName: "", lastName: "", email: "", phone: "",
      password: "", confirmPassword: "", role: "", isActive: true, sendWelcome: true, mfaRequired: false });
    setErrors({});
  };

  return (
    <Box>
      <Grid templateColumns={{ base: "1fr", lg: "1fr 300px" }} gap={3}>
        {/* LEFT */}
        <VStack spacing={3} align="stretch">

          {/* Personal Info */}
          <Card bg={cardBg} border="1px" borderColor={borderColor} shadow="sm">
            <CardHeader pb={2}>
              <HStack><Box w={1} h={5} bg="blue.500" borderRadius="full" /><Heading size="sm" color="gray.800">Personal Information</Heading></HStack>
            </CardHeader>
            <CardBody pt={2}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isInvalid={!!errors.firstName} isRequired>
                  <FormLabel fontSize="sm" color={labelColor} fontWeight="500">First Name</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none" color="gray.400"><IconUser /></InputLeftElement>
                    <Input pl={10} placeholder="First name" value={form.firstName}
                      onChange={e => handleChange("firstName", e.target.value)}
                      borderColor={borderColor} fontSize="sm"
                      _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                  </InputGroup>
                  <FormErrorMessage fontSize="xs">{errors.firstName}</FormErrorMessage>
                </FormControl>

                <FormControl isInvalid={!!errors.lastName} isRequired>
                  <FormLabel fontSize="sm" color={labelColor} fontWeight="500">Last Name</FormLabel>
                  <Input placeholder="Last name" value={form.lastName}
                    onChange={e => handleChange("lastName", e.target.value)}
                    borderColor={borderColor} fontSize="sm"
                    _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                  <FormErrorMessage fontSize="xs">{errors.lastName}</FormErrorMessage>
                </FormControl>

                <FormControl isInvalid={!!errors.email} isRequired>
                  <FormLabel fontSize="sm" color={labelColor} fontWeight="500">Email Address</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none" color="gray.400"><IconMail /></InputLeftElement>
                    <Input pl={10} type="email" placeholder="user@example.com" value={form.email}
                      onChange={e => handleChange("email", e.target.value)}
                      borderColor={borderColor} fontSize="sm"
                      _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                  </InputGroup>
                  <FormErrorMessage fontSize="xs">{errors.email}</FormErrorMessage>
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm" color={labelColor} fontWeight="500">Phone Number</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none" color="gray.400"><IconPhone /></InputLeftElement>
                    <Input pl={10} type="tel" placeholder="+91 0000000000" value={form.phone}
                      onChange={e => handleChange("phone", e.target.value)}
                      borderColor={borderColor} fontSize="sm"
                      _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                  </InputGroup>
                </FormControl>
              </SimpleGrid>
            </CardBody>
          </Card>

          {/* Credentials */}
          <Card bg={cardBg} border="1px" borderColor={borderColor} shadow="sm">
            <CardHeader pb={2}>
              <HStack><Box w={1} h={5} bg="purple.500" borderRadius="full" /><Heading size="sm" color="gray.800">Account Credentials</Heading></HStack>
            </CardHeader>
            <CardBody pt={2}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                


                <FormControl isInvalid={!!errors.password} isRequired>
                  <FormLabel fontSize="sm" color={labelColor} fontWeight="500">Password</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none" color="gray.400"><IconLock /></InputLeftElement>
                    <Input pl={10} type={showPassword ? "text" : "password"} placeholder="Min. 8 characters"
                      value={form.password} onChange={e => handleChange("password", e.target.value)}
                      borderColor={borderColor} fontSize="sm"
                      _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                    <InputRightElement cursor="pointer" color="gray.400" onClick={() => setShowPassword(p => !p)}>
                      {showPassword ? <IconEyeOff /> : <IconEye />}
                    </InputRightElement>
                  </InputGroup>
                  {form.password && (
                    <Box mt={1.5} h={1} bg="gray.100" borderRadius="full" overflow="hidden">
                      <Box h="full" borderRadius="full" transition="all 0.3s"
                        w={form.password.length < 6 ? "25%" : form.password.length < 10 ? "60%" : "100%"}
                        bg={form.password.length < 6 ? "red.400" : form.password.length < 10 ? "orange.400" : "green.400"} />
                    </Box>
                  )}
                  <FormErrorMessage fontSize="xs">{errors.password}</FormErrorMessage>
                </FormControl>

                <FormControl isInvalid={!!errors.confirmPassword} isRequired>
                  <FormLabel fontSize="sm" color={labelColor} fontWeight="500">Confirm Password</FormLabel>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none" color="gray.400"><IconLock /></InputLeftElement>
                    <Input pl={10} type={showConfirm ? "text" : "password"} placeholder="Repeat password"
                      value={form.confirmPassword} onChange={e => handleChange("confirmPassword", e.target.value)}
                      borderColor={borderColor} fontSize="sm"
                      _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }} />
                    <InputRightElement cursor="pointer" color="gray.400" onClick={() => setShowConfirm(p => !p)}>
                      {showConfirm ? <IconEyeOff /> : <IconEye />}
                    </InputRightElement>
                  </InputGroup>
                  <FormErrorMessage fontSize="xs">{errors.confirmPassword}</FormErrorMessage>
                </FormControl>
              </SimpleGrid>
            </CardBody>
          </Card>

          {/* Role */}
          <Card bg={cardBg} border="1px" borderColor={borderColor} shadow="sm">
            <CardHeader pb={2}>
              <HStack><Box w={1} h={5} bg="green.500" borderRadius="full" /><Heading size="sm" color="gray.800">Role & Billing Access</Heading></HStack>
            </CardHeader>
            <CardBody pt={2}>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isInvalid={!!errors.role} isRequired>
                  <FormLabel fontSize="sm" color={labelColor} fontWeight="500">User Role</FormLabel>
                  <Select placeholder="Select role..." value={form.role}
                    onChange={e => handleChange("role", e.target.value)}
                    borderColor={borderColor} fontSize="sm"
                    _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </Select>
                  <FormErrorMessage fontSize="xs">{errors.role}</FormErrorMessage>
                </FormControl>
              </SimpleGrid>
            </CardBody>
          </Card>
        </VStack>

        {/* RIGHT */}
        <VStack spacing={3} align="stretch">
          {/* Settings */}
          <Card bg={cardBg} border="1px" borderColor={borderColor} shadow="sm">
            <CardHeader pb={2}><Heading size="sm" color="gray.800">Account Settings</Heading></CardHeader>
            <CardBody pt={0}>
              <VStack spacing={4} align="stretch">
                {[
                  { label: "Active Account",      sub: "Allow login immediately",    field: "isActive",     scheme: "green"  },
                  { label: "Send Welcome Email",  sub: "With login credentials",      field: "sendWelcome",  scheme: "blue"   },
                  { label: "Require MFA",         sub: "2-factor authentication",     field: "mfaRequired",  scheme: "purple" },
                ].map(({ label, sub, field, scheme }, idx, arr) => (
                  <Flex key={field} justify="space-between" align="center" py={2}
                    borderBottom={idx < arr.length - 1 ? "1px" : "none"} borderColor={borderColor}>
                    <Box>
                      <Text fontSize="sm" fontWeight="500" color="gray.700">{label}</Text>
                      <Text fontSize="xs" color="gray.400">{sub}</Text>
                    </Box>
                    <Switch colorScheme={scheme} isChecked={form[field]}
                      onChange={e => handleChange(field, e.target.checked)} />
                  </Flex>
                ))}
              </VStack>
            </CardBody>
          </Card>

          {/* Preview */}
          <Card bg={cardBg} border="1px" borderColor={borderColor} shadow="sm">
            <CardHeader pb={2}><Heading size="sm" color="gray.800">User Preview</Heading></CardHeader>
            <CardBody pt={0}>
              <Flex direction="column" align="center" py={4} borderBottom="1px" borderColor={borderColor} mb={4}>
                <Avatar size="lg"
                  name={form.firstName || form.lastName ? `${form.firstName} ${form.lastName}` : undefined}
                  bg="blue.500" color="white" mb={3} />
                <Text fontWeight="600" fontSize="sm" color="gray.800">
                  {form.firstName || form.lastName ? `${form.firstName} ${form.lastName}`.trim() : "Full Name"}
                </Text>
                <Text fontSize="xs" color="gray.400" mt={0.5}>{form.email || "email@company.com"}</Text>
                {form.role && <Badge colorScheme="blue" mt={2} fontSize="xs">{form.role}</Badge>}
                <Badge colorScheme={form.isActive ? "green" : "gray"} variant="subtle" mt={1} fontSize="xs">
                  ● {form.isActive ? "Active" : "Inactive"}
                </Badge>
              </Flex>
              <VStack spacing={2} align="stretch">
                {[
                  { label: "Name",     value: form.firstName || form.lastName ? `${form.firstName} ${form.lastName}`.trim() : "Not set" },
                  { label: "Email",    value: form.email || "Not set" },
                  { label: "Phone",    value: form.phone || "Not set" },
                  { label: "MFA",      value: form.mfaRequired ? "Required" : "Optional" },
                ].map(({ label, value }) => (
                  <Flex key={label} justify="space-between" fontSize="xs">
                    <Text color="gray.400">{label}</Text>
                    <Text color="gray.700" fontWeight="500" textAlign="right" maxW="55%" isTruncated>{value}</Text>
                  </Flex>
                ))}
              </VStack>
            </CardBody>
          </Card>

          <VStack spacing={2}>
            <Button w="full" colorScheme="blue" onClick={handleSubmit}
              isLoading={isSubmitting} loadingText="Creating User..." size="sm" fontWeight="600">
              Create User
            </Button>
            <Button leftIcon={<FiRotateCcw />} w="full" variant="ghost" size="sm" color="gray.600" onClick={handleReset}>
              Reset Form
            </Button>
          </VStack>
        </VStack>
      </Grid>
    </Box>
  );
};

// ── Main Page ─────────────────────────────────────────────────
export default function AddUser() {
  const [activeTab, setActiveTab]       = useState(0); // 0 = Users, 1 = Add User
  const [refreshSignal, setRefreshSignal] = useState(0);
  const border  = useColorModeValue("gray.200", "gray.700");
  const cardBg  = useColorModeValue("white", "gray.800");

  const tabs = [
    { label: "Users",    icon: FiUsers, index: 0 },
    { label: "Add User", icon: FiUser,  index: 1 },
  ];

  const handleUserCreated = () => {
    setRefreshSignal(s => s + 1); // triggers UsersTab to re-fetch
    setActiveTab(0);              // switch back to Users tab
  };

  return (
    <Box>
      <PageNavBar
        title="User Management"
        description="Manage system users and access permissions"
        mb={4}
      />

      {/* Tab bar */}
      <Box bg={cardBg} border="1px" borderColor={border} borderRadius="12px"
        p={1} display="inline-flex" mb={3} boxShadow="0 1px 4px rgba(0,0,0,0.05)">
        {tabs.map(tab => {
          const isActive = activeTab === tab.index;
          return (
            <Flex key={tab.index} align="center" gap={2} px={5} py={2} borderRadius="9px"
              cursor="pointer" fontWeight={isActive ? "600" : "500"} fontSize="14px"
              color={isActive ? "white" : "gray.500"}
              bg={isActive ? "blue.300" : "transparent"}
              boxShadow={isActive ? "0 2px 8px rgba(149, 174, 228, 0.35)" : "none"}
              transition="all 0.2s" onClick={() => setActiveTab(tab.index)}
              _hover={!isActive ? { bg: "gray.100", color: "gray.700" } : {}}
              userSelect="none">
              <Box as={tab.icon} boxSize="15px" />
              {tab.label}
            </Flex>
          );
        })}
      </Box>

      {/* Tab content */}
      {activeTab === 0 && (
        <UsersTab onAddNew={() => setActiveTab(1)} refreshSignal={refreshSignal} />
      )}
      {activeTab === 1 && (
        <AddUserTab onSuccess={handleUserCreated} />
      )}
    </Box>
  );
}