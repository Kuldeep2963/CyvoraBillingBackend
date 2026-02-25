import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  FormErrorMessage,
  FormHelperText,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Select,
  Switch,
  Tag,
  TagLabel,
  TagCloseButton,
  Text,
  Textarea,
  VStack,
  Divider,
  Badge,
  Avatar,
  IconButton,
  useColorModeValue,
  useToast,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Tooltip,
  Card,
  CardBody,
  CardHeader,
  SimpleGrid,
  Checkbox,
  CheckboxGroup,
  Stack,
} from "@chakra-ui/react";
import { useState } from "react";
import { createUser } from "../utils/api";

// Icons as SVG components (no external icon lib needed)
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-10 7L2 7"/>
  </svg>
);
const IconPhone = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8 9a16 16 0 0 0 6.29 6.29l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconEyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const IconBuilding = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);
const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IconUpload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const IconInfo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

const ROLES = ["Admin", "Sales-Manager", "Rates-Dept", "NOC-Dept", "View Only"];
const DEPARTMENTS = ["Finance", "Operations", "IT", "Sales", "Customer Support", "Management"];
const RATE_PLANS = ["Standard", "Premium", "Enterprise", "Wholesale", "Reseller", "Custom"];
const PERMISSIONS = [
  "View CDR Reports",
  "Export CDR Data",
  "Manage Invoices",
  "View Rate Plans",
  "Edit Rate Plans",
  "Manage Customers",
  "API Access",
  "System Settings",
];

export default function AddUser() {
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarInitials, setAvatarInitials] = useState("?");
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const labelColor = useColorModeValue("gray.600", "gray.400");
  const accentBlue = "blue.500";

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    confirmPassword: "",
    role: "",
    department: "",
    ratePlan: "",
    creditLimit: "",
    notes: "",
    isActive: true,
    sendWelcome: true,
    mfaRequired: false,
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));

    if (field === "firstName" || field === "lastName") {
      const fn = field === "firstName" ? value : form.firstName;
      const ln = field === "lastName" ? value : form.lastName;
      setAvatarInitials(`${fn?.[0] || ""}${ln?.[0] || ""}`.toUpperCase() || "?");
    }
  };

  const validate = () => {
    const e = {};
    if (!form.firstName) e.firstName = "First name is required";
    if (!form.lastName) e.lastName = "Last name is required";
    if (!form.email) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email address";
    if (!form.username) e.username = "Username is required";
    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 8) e.password = "Minimum 8 characters";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match";
    if (!form.role) e.role = "Role is required";
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
        username: form.username,
        password: form.password,
        role: form.role.toLowerCase()
      });
      setIsSubmitting(false);
      toast({
        title: "User Created Successfully",
        description: `${form.firstName} ${form.lastName} has been added to the platform.`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      handleReset();
    } catch (error) {
      setIsSubmitting(false);
      toast({
        title: "Error Creating User",
        description: error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const handleReset = () => {
    setForm({
      firstName: "", lastName: "", email: "", phone: "", username: "",
      password: "", confirmPassword: "", role: "", department: "", ratePlan: "",
      creditLimit: "", notes: "", isActive: true, sendWelcome: true, mfaRequired: false,
    });
    setErrors({});
    setAvatarInitials("?");
    setSelectedPermissions([]);
  };

  return (
    <Box>
      <Box mx="auto" px={0} py={4}>
        {/* Page Header */}
        <Flex align="center" justify="space-between" mb={8}>
          <Box>
            <Heading size="lg" color="gray.900" letterSpacing="-0.5px" fontWeight="700">
              Add New User
            </Heading>
            <Text color="gray.500" mt={1} fontSize="sm">
              Create a new user account and assign CDR billing access permissions.
            </Text>
          </Box>
          <HStack>
            <Button variant="outline" size="sm" onClick={handleReset} borderColor={borderColor}>
              Reset
            </Button>
            <Button
              colorScheme="blue"
              size="sm"
              onClick={handleSubmit}
              isLoading={isSubmitting}
              loadingText="Creating..."
              px={6}
            >
              Create User
            </Button>
          </HStack>
        </Flex>

        <Grid templateColumns={{ base: "1fr", lg: "1fr 300px" }} gap={6}>
          {/* LEFT COLUMN - Main Form */}
          <VStack spacing={6} align="stretch">

            {/* Section: Personal Info */}
            <Card bg={cardBg} border="1px" borderColor={borderColor} shadow="sm">
              <CardHeader pb={2}>
                <HStack>
                  <Box w={1} h={5} bg="blue.500" borderRadius="full" />
                  <Heading size="sm" color="gray.800">Personal Information</Heading>
                </HStack>
              </CardHeader>
              <CardBody pt={2}>
                {/* Avatar Upload */}
                {/* <Flex align="center" gap={5} mb={6} p={4} bg={useColorModeValue("gray.50","gray.750")} borderRadius="xl" border="1px dashed" borderColor={borderColor}>
                  <Avatar size="xl" name={avatarInitials !== "?" ? `${form.firstName} ${form.lastName}` : ""} bg="blue.500" color="white" fontSize="xl" fontWeight="700">
                  </Avatar>
                  <Box>
                    <Text fontWeight="600" fontSize="sm" color="gray.700" mb={1}>Profile Photo</Text>
                    <Text fontSize="xs" color="gray.400" mb={3}>JPG, PNG up to 2MB. Initials used if no photo uploaded.</Text>
                    <Button size="xs" variant="outline" leftIcon={<IconUpload />} borderColor="blue.300" color="blue.600">
                      Upload Photo
                    </Button>
                  </Box>
                </Flex> */}

                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isInvalid={!!errors.firstName} isRequired>
                    <FormLabel fontSize="sm" color={labelColor} fontWeight="500">First Name</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none" color="gray.400">
                        <IconUser />
                      </InputLeftElement>
                      <Input
                        pl={10}
                        placeholder="John"
                        value={form.firstName}
                        onChange={(e) => handleChange("firstName", e.target.value)}
                        borderColor={borderColor}
                        _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
                        fontSize="sm"
                      />
                    </InputGroup>
                    <FormErrorMessage fontSize="xs">{errors.firstName}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.lastName} isRequired>
                    <FormLabel fontSize="sm" color={labelColor} fontWeight="500">Last Name</FormLabel>
                    <Input
                      placeholder="Doe"
                      value={form.lastName}
                      onChange={(e) => handleChange("lastName", e.target.value)}
                      borderColor={borderColor}
                      _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
                      fontSize="sm"
                    />
                    <FormErrorMessage fontSize="xs">{errors.lastName}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.email} isRequired>
                    <FormLabel fontSize="sm" color={labelColor} fontWeight="500">Email Address</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none" color="gray.400">
                        <IconMail />
                      </InputLeftElement>
                      <Input
                        pl={10}
                        type="email"
                        placeholder="john.doe@company.com"
                        value={form.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        borderColor={borderColor}
                        _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
                        fontSize="sm"
                      />
                    </InputGroup>
                    <FormErrorMessage fontSize="xs">{errors.email}</FormErrorMessage>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="sm" color={labelColor} fontWeight="500">Phone Number</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none" color="gray.400">
                        <IconPhone />
                      </InputLeftElement>
                      <Input
                        pl={10}
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        value={form.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        borderColor={borderColor}
                        _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
                        fontSize="sm"
                      />
                    </InputGroup>
                  </FormControl>
                </SimpleGrid>
              </CardBody>
            </Card>

            {/* Section: Account Credentials */}
            <Card bg={cardBg} border="1px" borderColor={borderColor} shadow="sm">
              <CardHeader pb={2}>
                <HStack>
                  <Box w={1} h={5} bg="purple.500" borderRadius="full" />
                  <Heading size="sm" color="gray.800">Account Credentials</Heading>
                </HStack>
              </CardHeader>
              <CardBody pt={2}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isInvalid={!!errors.username} isRequired>
                    <FormLabel fontSize="sm" color={labelColor} fontWeight="500">Username</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none" color="gray.400" fontSize="sm" fontWeight="600">@</InputLeftElement>
                      <Input
                        pl={10}
                        placeholder="john.doe"
                        value={form.username}
                        onChange={(e) => handleChange("username", e.target.value.toLowerCase().replace(/\s/g, ""))}
                        borderColor={borderColor}
                        _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
                        fontSize="sm"
                      />
                    </InputGroup>
                    <FormErrorMessage fontSize="xs">{errors.username}</FormErrorMessage>
                  </FormControl>

                  <Box /> {/* spacer */}

                  <FormControl isInvalid={!!errors.password} isRequired>
                    <FormLabel fontSize="sm" color={labelColor} fontWeight="500">Password</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none" color="gray.400">
                        <IconLock />
                      </InputLeftElement>
                      <Input
                        pl={10}
                        type={showPassword ? "text" : "password"}
                        placeholder="Min. 8 characters"
                        value={form.password}
                        onChange={(e) => handleChange("password", e.target.value)}
                        borderColor={borderColor}
                        _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
                        fontSize="sm"
                      />
                      <InputRightElement cursor="pointer" color="gray.400" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <IconEyeOff /> : <IconEye />}
                      </InputRightElement>
                    </InputGroup>
                    {form.password && (
                      <Box mt={1.5} h={1} bg="gray.100" borderRadius="full" overflow="hidden">
                        <Box
                          h="full"
                          w={form.password.length < 6 ? "25%" : form.password.length < 10 ? "60%" : "100%"}
                          bg={form.password.length < 6 ? "red.400" : form.password.length < 10 ? "orange.400" : "green.400"}
                          transition="all 0.3s"
                          borderRadius="full"
                        />
                      </Box>
                    )}
                    <FormErrorMessage fontSize="xs">{errors.password}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.confirmPassword} isRequired>
                    <FormLabel fontSize="sm" color={labelColor} fontWeight="500">Confirm Password</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none" color="gray.400">
                        <IconLock />
                      </InputLeftElement>
                      <Input
                        pl={10}
                        type={showConfirm ? "text" : "password"}
                        placeholder="Repeat password"
                        value={form.confirmPassword}
                        onChange={(e) => handleChange("confirmPassword", e.target.value)}
                        borderColor={borderColor}
                        _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
                        fontSize="sm"
                      />
                      <InputRightElement cursor="pointer" color="gray.400" onClick={() => setShowConfirm(!showConfirm)}>
                        {showConfirm ? <IconEyeOff /> : <IconEye />}
                      </InputRightElement>
                    </InputGroup>
                    <FormErrorMessage fontSize="xs">{errors.confirmPassword}</FormErrorMessage>
                  </FormControl>
                </SimpleGrid>
              </CardBody>
            </Card>

            {/* Section: Role & Billing */}
            <Card bg={cardBg} border="1px" borderColor={borderColor} shadow="sm">
              <CardHeader pb={2}>
                <HStack>
                  <Box w={1} h={5} bg="green.500" borderRadius="full" />
                  <Heading size="sm" color="gray.800">Role & Billing Access</Heading>
                </HStack>
              </CardHeader>
              <CardBody pt={2}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
                  <FormControl isInvalid={!!errors.role} isRequired>
                    <FormLabel fontSize="sm" color={labelColor} fontWeight="500">User Role</FormLabel>
                    <Select
                      placeholder="Select role..."
                      value={form.role}
                      onChange={(e) => handleChange("role", e.target.value)}
                      borderColor={borderColor}
                      _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
                      fontSize="sm"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </Select>
                    <FormErrorMessage fontSize="xs">{errors.role}</FormErrorMessage>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="sm" color={labelColor} fontWeight="500">Department</FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none" color="gray.400">
                        <IconBuilding />
                      </InputLeftElement>
                      <Select
                        pl={10}
                        placeholder="Select department..."
                        value={form.department}
                        onChange={(e) => handleChange("department", e.target.value)}
                        borderColor={borderColor}
                        fontSize="sm"
                      >
                        {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </Select>
                    </InputGroup>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="sm" color={labelColor} fontWeight="500">
                      Default Rate Plan
                      <Tooltip label="The CDR rate plan this user's calls will be billed under" placement="top">
                        <Box as="span" ml={1.5} color="gray.400" display="inline-flex" verticalAlign="middle">
                          <IconInfo />
                        </Box>
                      </Tooltip>
                    </FormLabel>
                    <Select
                      placeholder="Select rate plan..."
                      value={form.ratePlan}
                      onChange={(e) => handleChange("ratePlan", e.target.value)}
                      borderColor={borderColor}
                      fontSize="sm"
                    >
                      {RATE_PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="sm" color={labelColor} fontWeight="500">
                      Credit Limit (USD)
                      <Tooltip label="Maximum billing credit before account is suspended" placement="top">
                        <Box as="span" ml={1.5} color="gray.400" display="inline-flex" verticalAlign="middle">
                          <IconInfo />
                        </Box>
                      </Tooltip>
                    </FormLabel>
                    <InputGroup>
                      <InputLeftElement pointerEvents="none" color="gray.400" fontWeight="600" fontSize="sm">$</InputLeftElement>
                      <Input
                        pl={8}
                        type="number"
                        placeholder="0.00"
                        value={form.creditLimit}
                        onChange={(e) => handleChange("creditLimit", e.target.value)}
                        borderColor={borderColor}
                        fontSize="sm"
                      />
                    </InputGroup>
                  </FormControl>
                </SimpleGrid>

                {/* Permissions */}
                <Box mt={2}>
                  <FormLabel fontSize="sm" color={labelColor} fontWeight="500" mb={3}>
                    Feature Permissions
                  </FormLabel>
                  <CheckboxGroup value={selectedPermissions} onChange={setSelectedPermissions}>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
                      {PERMISSIONS.map((perm) => (
                        <Checkbox
                          key={perm}
                          value={perm}
                          colorScheme="blue"
                          size="sm"
                          fontSize="sm"
                        >
                          <Text fontSize="sm" color="gray.700">{perm}</Text>
                        </Checkbox>
                      ))}
                    </SimpleGrid>
                  </CheckboxGroup>
                </Box>
              </CardBody>
            </Card>

            {/* Section: Notes */}
            <Card bg={cardBg} border="1px" borderColor={borderColor} shadow="sm">
              <CardHeader pb={2}>
                <HStack>
                  <Box w={1} h={5} bg="orange.400" borderRadius="full" />                   <Heading size="sm" color="gray.800">Notes</Heading>
                </HStack>
              </CardHeader>
              <CardBody pt={2}>
                <FormControl>
                  <FormLabel fontSize="sm" color={labelColor} fontWeight="500">Internal Notes (Optional)</FormLabel>
                  <Textarea
                    placeholder="Add any internal notes about this user, special billing arrangements, etc."
                    value={form.notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    borderColor={borderColor}
                    fontSize="sm"
                    rows={3}
                    resize="vertical"
                    _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px var(--chakra-colors-blue-400)" }}
                  />
                </FormControl>
              </CardBody>
            </Card>
          </VStack>

          {/* RIGHT COLUMN - Settings & Summary */}
          <VStack spacing={6} align="stretch">
            {/* Account Settings */}
            <Card bg={cardBg} border="1px" borderColor={borderColor} shadow="sm">
              <CardHeader pb={2}>
                <Heading size="sm" color="gray.800">Account Settings</Heading>
              </CardHeader>
              <CardBody pt={0}>
                <VStack spacing={4} align="stretch">
                  <Flex justify="space-between" align="center" py={2} borderBottom="1px" borderColor={borderColor}>
                    <Box>
                      <Text fontSize="sm" fontWeight="500" color="gray.700">Active Account</Text>
                      <Text fontSize="xs" color="gray.400">Allow login immediately</Text>
                    </Box>
                    <Switch
                      colorScheme="green"
                      isChecked={form.isActive}
                      onChange={(e) => handleChange("isActive", e.target.checked)}
                    />
                  </Flex>
                  <Flex justify="space-between" align="center" py={2} borderBottom="1px" borderColor={borderColor}>
                    <Box>
                      <Text fontSize="sm" fontWeight="500" color="gray.700">Send Welcome Email</Text>
                      <Text fontSize="xs" color="gray.400">With login credentials</Text>
                    </Box>
                    <Switch
                      colorScheme="blue"
                      isChecked={form.sendWelcome}
                      onChange={(e) => handleChange("sendWelcome", e.target.checked)}
                    />
                  </Flex>
                  <Flex justify="space-between" align="center" py={2}>
                    <Box>
                      <Text fontSize="sm" fontWeight="500" color="gray.700">Require MFA</Text>
                      <Text fontSize="xs" color="gray.400">2-factor authentication</Text>
                    </Box>
                    <Switch
                      colorScheme="purple"
                      isChecked={form.mfaRequired}
                      onChange={(e) => handleChange("mfaRequired", e.target.checked)}
                    />
                  </Flex>
                </VStack>
              </CardBody>
            </Card>

            {/* Summary Preview */}
            <Card bg={cardBg} border="1px" borderColor={borderColor} shadow="sm">
              <CardHeader pb={2}>
                <Heading size="sm" color="gray.800">User Preview</Heading>
              </CardHeader>
              <CardBody pt={0}>
                <Flex direction="column" align="center" py={4} borderBottom="1px" borderColor={borderColor} mb={4}>
                  <Avatar
                    size="lg"
                    name={form.firstName || form.lastName ? `${form.firstName} ${form.lastName}` : undefined}
                    bg="blue.500"
                    color="white"
                    mb={3}
                  />
                  <Text fontWeight="600" fontSize="sm" color="gray.800">
                    {form.firstName || form.lastName
                      ? `${form.firstName} ${form.lastName}`.trim()
                      : "Full Name"}
                  </Text>
                  <Text fontSize="xs" color="gray.400" mt={0.5}>
                    {form.email || "email@company.com"}
                  </Text>
                  {form.role && (
                    <Badge colorScheme="blue" mt={2} fontSize="xs">{form.role}</Badge>
                  )}
                  {form.isActive ? (
                    <Badge colorScheme="green" variant="subtle" mt={1} fontSize="xs">● Active</Badge>
                  ) : (
                    <Badge colorScheme="gray" variant="subtle" mt={1} fontSize="xs">● Inactive</Badge>
                  )}
                </Flex>
                <VStack spacing={2} align="stretch">
                  {[
                    { label: "Username", value: form.username ? `@${form.username}` : "—" },
                    { label: "Department", value: form.department || "—" },
                    { label: "Rate Plan", value: form.ratePlan || "—" },
                    { label: "Credit Limit", value: form.creditLimit ? `$${form.creditLimit}` : "—" },
                    { label: "MFA", value: form.mfaRequired ? "Required" : "Optional" },
                    { label: "Permissions", value: selectedPermissions.length ? `${selectedPermissions.length} selected` : "None" },
                  ].map(({ label, value }) => (
                    <Flex key={label} justify="space-between" fontSize="xs">
                      <Text color="gray.400">{label}</Text>
                      <Text color="gray.700" fontWeight="500" textAlign="right" maxW="55%" isTruncated>{value}</Text>
                    </Flex>
                  ))}
                </VStack>
              </CardBody>
            </Card>

            {/* Actions */}
            <VStack spacing={3}>
              <Button
                w="full"
                colorScheme="blue"
                onClick={handleSubmit}
                isLoading={isSubmitting}
                loadingText="Creating User..."
                size="md"
                fontWeight="600"
              >
                Create User
              </Button>
              <Button w="full" variant="ghost" size="md" color="gray.500" onClick={handleReset}>
                Reset Form
              </Button>
            </VStack>

          </VStack>
        </Grid>
      </Box>
    </Box>
  );
}