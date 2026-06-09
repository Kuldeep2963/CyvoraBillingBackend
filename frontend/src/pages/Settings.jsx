import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  InputGroup,
  InputRightElement,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberInput,
  NumberInputField,
  Spinner,
  Switch,
  Text,
  VStack,
  Checkbox,
} from "@chakra-ui/react";
import useNotify from "../utils/notify";
import {
  MemoizedInput as Input,
  MemoizedSelect as Select,
} from "../components/memoizedinput/memoizedinput";
import {
  FiBell,
  FiDatabase,
  FiFileText,
  FiKey,
  FiEye,
  FiEyeOff,
  FiRefreshCw,
  FiSave,
  FiSettings,
  FiServer,
  FiUpload,
  FiMail,
  FiPlus,
  FiGlobe,
} from "react-icons/fi";
import {
  createTestNotification,
  fetchCDRCount,
  fetchBillingClassProfiles,
  getGlobalSettings,
  getSettingsSections,
  updateSettingsSections,
  markAllNotificationsRead,
  markNotificationRead,
  runRetentionCleanup,
  addCountryCode,
  deleteCountryCode,
  fetchCountryCodes,
  uploadCountryCodes,
  updateGlobalSettings,
  updateBillingClassProfile,
  deleteBillingClassProfile,
  sendTestEmail,
} from "../utils/api";
import { useNotifications } from "../context/NotificationsContext";
import { formatNotificationTime } from "../utils/notificationTime";
import PageNavBar from "../components/PageNavBar";
import DataTable from "../components/DataTable";
import ConfirmDialog from "../components/modals/ConfirmDialog";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  systemName: "CDR Billing System",
  currency: "USD",
  timezone: "UTC",
  dataRetentionDays: 60,
  notificationPollingSeconds: 10,
  lastProcessedCdrFilename: "",
  lastProcessedCdrTimestampUtc: "",
  emailNotifications: true,
  notifyInvoiceGenerated: true,
  notifyPaymentDue: true,
  notifyDisputes: true,
  notifyErrors: true,
  notifyPaymentReceived: true,
  notificationEmail: "",
  syncEmailProfiles: false,
  billingSmtpEmail: "",
  billingSmtpPassword: "",
  billingSmtpHost: "",
  billingSmtpPort: "",
  billingSmtpSecure: false,
  billingSmtpCertificateCheck: false,
  reportsSmtpEmail: "",
  reportsSmtpPassword: "",
  reportsSmtpHost: "",
  reportsSmtpPort: "",
  reportsSmtpSecure: false,
  reportsSmtpCertificateCheck: false,
  ratesSmtpEmail: "",
  ratesSmtpPassword: "",
  ratesSmtpHost: "",
  ratesSmtpPort: "",
  ratesSmtpSecure: false,
  ratesSmtpCertificateCheck: false,
  managementSmtpEmail: "",
  managementSmtpPassword: "",
  managementSmtpHost: "",
  managementSmtpPort: "",
  managementSmtpSecure: false,
  managementSmtpCertificateCheck: false,
};

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS);
const RETENTION_MIN = 2;
const RETENTION_MAX = 90;
const POLLING_MIN = 5;
const POLLING_MAX = 3600;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const normalizeSettingsShape = (raw = {}) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const mapped = {
    ...source,
    dataRetentionDays: source.dataRetentionDays ?? source.dataretentiondays,
    notificationPollingSeconds:
      source.notificationPollingSeconds ?? source.notificationpollingseconds,
  };
  return SETTINGS_KEYS.reduce((acc, key) => {
    if (mapped[key] !== undefined) acc[key] = mapped[key];
    return acc;
  }, {});
};

const validateNumericInput = (rawValue, label, min, max) => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed))
    return { valid: false, value: null, message: `${label} must be a number.` };
  if (parsed < min || parsed > max)
    return {
      valid: false,
      value: null,
      message: `${label} must be between ${min} and ${max}.`,
    };
  return { valid: true, value: parsed, message: "" };
};

// ─── Shared design tokens (applied via sx / style props) ─────────────────────

const CARD_PROPS = {
  bg: "white",
  borderWidth: "0.5px",
  borderColor: "gray.200",
  borderRadius: "10px",
  boxShadow: "none",
};

const SECTION_LABEL = {
  fontSize: "10px",
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: "gray.400",
};

const INPUT_PROPS = {
  borderWidth: "0.5px",
  borderColor: "gray.200",
  bg: "gray.50",
  fontSize: "13px",
  height: "34px",
  borderRadius: "8px",
  _hover: { borderColor: "gray.300" },
  _focus: { borderColor: "gray.400", boxShadow: "none" },
};

const FORM_LABEL_PROPS = {
  fontSize: "12px",
  fontWeight: "500",
  color: "gray.600",
  mb: 1,
};

// ─── SectionHeader ───────────────────────────────────────────────────────────

const SectionHeader = ({ children }) => (
  <Text {...SECTION_LABEL} mb={3}>
    {children}
  </Text>
);

// ─── ToggleRow ────────────────────────────────────────────────────────────────

const ToggleRow = ({ label, isChecked, onChange }) => (
  <HStack
    justify="space-between"
    py={3}
    borderBottomWidth="0.5px"
    borderColor="gray.100"
  >
    <Text fontSize="13px" color="gray.700">
      {label}
    </Text>
    <Switch
      size="sm"
      colorScheme="gray"
      isChecked={isChecked}
      onChange={onChange}
      sx={{
        "& .chakra-switch__track[data-checked]": { bg: "gray.800" },
      }}
    />
  </HStack>
);

const EMAIL_PROFILE_CARDS = [
  {
    key: "billing",
    title: "Billing Mail",
    description:
      "Used for invoice delivery, disputes and payment confirmations.",
  },
  {
    key: "reports",
    title: "Reports Mail",
    description: "Used for statements of account and report emails.",
  },
  {
    key: "rates",
    title: "Rates Mail",
    description: "Reserved for rate-related notifications and exports.",
  },
  {
    key: "management",
    title: "Management Mail",
    description: "Used for system notifications, and admin mail.",
  },
];

const EMAIL_PROFILE_KEYS = EMAIL_PROFILE_CARDS.map((profile) => profile.key);

const getProfileSnapshot = (settings, profileKey) => {
  const baseKey = `${profileKey}Smtp`;
  return {
    email: settings[`${baseKey}Email`] || "",
    password: settings[`${baseKey}Password`] || "",
    host: settings[`${baseKey}Host`] || "",
    port: settings[`${baseKey}Port`] || "",
    secure: Boolean(settings[`${baseKey}Secure`]),
    certificateCheck: Boolean(settings[`${baseKey}CertificateCheck`]),
  };
};

const applyProfileSnapshot = (updateSetting, profileKey, snapshot) => {
  const baseKey = `${profileKey}Smtp`;
  updateSetting(`${baseKey}Email`, snapshot.email);
  updateSetting(`${baseKey}Password`, snapshot.password);
  updateSetting(`${baseKey}Host`, snapshot.host);
  updateSetting(`${baseKey}Port`, snapshot.port);
  updateSetting(`${baseKey}Secure`, Boolean(snapshot.secure));
  updateSetting(
    `${baseKey}CertificateCheck`,
    Boolean(snapshot.certificateCheck),
  );
};

const EmailProfileCard = ({
  profileKey,
  title,
  description,
  settings,
  updateSetting,
  syncAllProfiles,
  linkedSnapshot,
}) => {
  const baseKey = `${profileKey}Smtp`;
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const displaySnapshot =
    syncAllProfiles && linkedSnapshot
      ? linkedSnapshot
      : getProfileSnapshot(settings, profileKey);
  const [draft, setDraft] = useState(() => displaySnapshot);

  useEffect(() => {
    if (isEditing) return;
    setDraft(displaySnapshot);
    setShowPassword(false);
  }, [displaySnapshot, isEditing]);

  const handleDone = () => {
    if (syncAllProfiles) {
      EMAIL_PROFILE_KEYS.forEach((key) =>
        applyProfileSnapshot(updateSetting, key, draft),
      );
    } else {
      applyProfileSnapshot(updateSetting, profileKey, draft);
    }
    setIsEditing(false);
    setShowPassword(false);
  };

  const handleCancel = () => {
    setDraft(getProfileSnapshot(settings, profileKey));
    setIsEditing(false);
    setShowPassword(false);
  };

  return (
    <Card {...CARD_PROPS}>
      <CardBody px={5} py={5}>
        <HStack justify="space-between" align="start" mb={4} gap={3}>
          <Box>
            <Text fontSize="15px" fontWeight="600" color="gray.800">
              {title}
            </Text>
            <Text fontSize="12px" color="gray.500" mt={1}>
              {description}
            </Text>
          </Box>
          <Badge
            colorScheme="gray"
            borderRadius={"full"}
            variant="subtle"
            px={2}
          >
            SMTP
          </Badge>
        </HStack>

        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
          <FormControl>
            <FormLabel
              {...FORM_LABEL_PROPS}
              display="flex"
              alignItems="center"
              gap={2}
            >
              <FiMail size={12} /> Email
            </FormLabel>
            <Input
              {...INPUT_PROPS}
              type="email"
              isDisabled={!isEditing}
              value={isEditing ? draft.email : displaySnapshot.email}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="smtp@example.com"
            />
          </FormControl>

          <FormControl>
            <FormLabel
              {...FORM_LABEL_PROPS}
              display="flex"
              alignItems="center"
              gap={2}
            >
              <FiKey size={12} /> Password
            </FormLabel>
            <InputGroup>
              <Input
                {...INPUT_PROPS}
                type={showPassword ? "text" : "password"}
                isDisabled={!isEditing}
                value={isEditing ? draft.password : displaySnapshot.password}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="SMTP password"
              />
              <InputRightElement height="34px" width="2.5rem">
                <IconButton
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  icon={showPassword ? <FiEyeOff /> : <FiEye />}
                  size="xs"
                  variant="ghost"
                  isDisabled={!isEditing}
                  onClick={() => setShowPassword((prev) => !prev)}
                />
              </InputRightElement>
            </InputGroup>
          </FormControl>

          <FormControl>
            <FormLabel
              {...FORM_LABEL_PROPS}
              display="flex"
              alignItems="center"
              gap={2}
            >
              <FiServer size={12} /> Host
            </FormLabel>
            <Input
              {...INPUT_PROPS}
              isDisabled={!isEditing}
              value={isEditing ? draft.host : displaySnapshot.host}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, host: e.target.value }))
              }
              placeholder="smtp.mailhost.com"
            />
          </FormControl>

          <FormControl>
            <FormLabel
              {...FORM_LABEL_PROPS}
              display="flex"
              alignItems="center"
              gap={2}
            >
              <FiRefreshCw size={12} /> Port
            </FormLabel>
            <NumberInput
              isDisabled={!isEditing}
              value={isEditing ? draft.port : displaySnapshot.port}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, port: value }))
              }
              min={1}
              max={65535}
              keepWithinRange
              clampValueOnBlur={false}
            >
              <NumberInputField {...INPUT_PROPS} px={3} />
            </NumberInput>
          </FormControl>
          <FormControl>
            <HStack align="start" spacing={8} pt={1}>
              <Checkbox
                size="md"
                isDisabled={!isEditing}
                isChecked={
                  isEditing
                    ? Boolean(draft.secure)
                    : Boolean(displaySnapshot.secure)
                }
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, secure: e.target.checked }))
                }
                sx={{
                  "& .chakra-checkbox__control": {
                    borderRadius: "8px",
                  },
                  "& .chakra-checkbox__control[data-checked]": {
                    bg: "green.600",
                    borderColor: "green.600",
                    _hover: { bg: "green.700", borderColor: "green.700" },
                  },
                  "& .chakra-checkbox__label": {
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "green.600",
                  },
                }}
              >
                Secure?
              </Checkbox>
              <Checkbox
                size="md"
                isDisabled={!isEditing}
                isChecked={
                  isEditing
                    ? Boolean(draft.certificateCheck)
                    : Boolean(displaySnapshot.certificateCheck)
                }
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    certificateCheck: e.target.checked,
                  }))
                }
                sx={{
                  "& .chakra-checkbox__control": {
                    borderRadius: "8px",
                  },
                  "& .chakra-checkbox__control[data-checked]": {
                    bg: "red.600",
                    borderColor: "red.600",
                    _hover: { bg: "red.700", borderColor: "red.700" },
                  },
                  "& .chakra-checkbox__label": {
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "red.600",
                  },
                }}
              >
                Check certificate
              </Checkbox>
            </HStack>
          </FormControl>
        </Grid>

        <HStack mt={4} spacing={2} justify="flex-end">
          <Button
            size="sm"
            height="34px"
            px={3}
            fontSize="12px"
            fontWeight="500"
            borderRadius="8px"
            borderWidth="0.5px"
            boxShadow="none"
            bg={isEditing ? "green.50" : "gray.50"}
            color={isEditing ? "green.600" : "gray.500"}
            borderColor={isEditing ? "green.200" : "gray.200"}
            _hover={{ bg: isEditing ? "green.100" : "gray.100" }}
            onClick={() => {
              if (isEditing) {
                handleDone();
                return;
              }
              setIsEditing(true);
            }}
          >
            {isEditing ? "Done" : "Edit"}
          </Button>
          {isEditing && (
            <Button
              size="sm"
              height="34px"
              px={3}
              fontSize="12px"
              fontWeight="500"
              borderRadius="8px"
              borderWidth="0.5px"
              boxShadow="none"
              bg="red.50"
              color="red.500"
              borderColor="red.100"
              _hover={{ bg: "red.100" }}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          )}
        </HStack>
      </CardBody>
    </Card>
  );
};

// ─── Tab navigation ───────────────────────────────────────────────────────────

const DEFAULT_TABS = [
  { id: "general", label: "General", icon: FiSettings },
  { id: "retention", label: "Data Retention", icon: FiDatabase },
  { id: "billing", label: "Billing Settings", icon: FiFileText },
  { id: "codes", label: "Country Codes", icon: FiGlobe },
  { id: "notifs", label: "Notifications", icon: FiBell },
  { id: "email", label: "System Emails", icon: FiMail },
];

const buildTabsFromSections = (sections) => {
  if (!sections) return DEFAULT_TABS;
  const tabs = [];
  // General
  if (sections.generalSettings) tabs.push({ id: 'general', label: 'General', icon: FiSettings });
  // Data fetch / retention
  if (sections.dataFetchSettings) tabs.push({ id: 'retention', label: 'Data Retention', icon: FiDatabase });
  // Billing settings is independent and always available.
  tabs.push({ id: 'billing', label: 'Billing Settings', icon: FiServer });
  // Country codes is an independent tool-style tab (keep always)
  tabs.push({ id: 'codes', label: 'Country Codes', icon: FiUpload });
  // Notifications
  if (sections.notificationSettings) tabs.push({ id: 'notifs', label: 'Notifications', icon: FiBell });
  // Email settings
  if (sections.emailSettings) tabs.push({ id: 'email', label: 'System Emails', icon: FiMail });
  return tabs;
};

const TabNav = ({ active, onChange, tabs = DEFAULT_TABS }) => (
  <HStack
    spacing={0}
    borderBottomWidth="0.5px"
    borderColor="gray.200"
    mb={5}
    overflowX="auto"
  >
    {tabs.map(({ id, label, icon: Icon }) => {
      const isActive = active === id;
      return (
        <Box
          key={id}
          as="button"
          onClick={() => onChange(id)}
          px={5}
          py={3}
          display="flex"
          alignItems="center"
          gap={2}
          fontSize="13px"
          fontWeight={isActive ? "600" : "500"}
          color={isActive ? "gray.800" : "gray.500"}
          borderBottomWidth="2px"
          borderBottomColor={isActive ? "gray.800" : "transparent"}
          bg="transparent"
          cursor="pointer"
          whiteSpace="nowrap"
          transition="all 0.15s"
          _hover={{ color: "gray.700" }}
          mb="-0.5px"
        >
          <Icon size={13} />
          {label}
        </Box>
      );
    })}
  </HStack>
);

// ─── GeneralTab ───────────────────────────────────────────────────────────────

const GeneralTab = ({ settings, updateSetting }) => {
  const [canEditCompany, setCanEditCompany] = useState(false);

  return (
    <VStack spacing={5} align="stretch">
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={5}>
          <SectionHeader>System</SectionHeader>
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr 1fr" }} gap={4}>
            <FormControl>
              <FormLabel {...FORM_LABEL_PROPS}>Company Name</FormLabel>
              <Box position="relative">
                <Input
                  {...INPUT_PROPS}
                  pr="5.5rem"
                  isDisabled={!canEditCompany}
                  value={settings.systemName || ""}
                  onChange={(e) => updateSetting("systemName", e.target.value)}
                />
                <Button
                  size="xs"
                  position="absolute"
                  right="0.5rem"
                  top="50%"
                  transform="translateY(-50%)"
                  height="26px"
                  px={3}
                  fontSize="11px"
                  fontWeight="500"
                  borderRadius="7px"
                  borderWidth="0.5px"
                  boxShadow="none"
                  bg={canEditCompany ? "green.50" : "gray.50"}
                  color={canEditCompany ? "green.600" : "gray.500"}
                  borderColor={canEditCompany ? "green.200" : "gray.200"}
                  _hover={{ bg: canEditCompany ? "green.100" : "gray.100" }}
                  onClick={() => setCanEditCompany((prev) => !prev)}
                >
                  {canEditCompany ? "Done" : "Edit"}
                </Button>
              </Box>
            </FormControl>
            {/* <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>Notification Email</FormLabel>
            <Input
              {...INPUT_PROPS}
              type="email"
              value={settings.notificationEmail || ''}
              onChange={(e) => updateSetting('notificationEmail', e.target.value)}
            />
          </FormControl> */}
            <FormControl>
              <FormLabel {...FORM_LABEL_PROPS}>Currency</FormLabel>
              <Select
                isDisabled={true}
                {...INPUT_PROPS}
                value={settings.currency || "USD"}
                onChange={(e) => updateSetting("currency", e.target.value)}
              >
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="INR">INR — Indian Rupee</option>
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel {...FORM_LABEL_PROPS}>Timezone</FormLabel>
              <Select
                isDisabled={true}
                {...INPUT_PROPS}
                value={settings.timezone || "UTC"}
                onChange={(e) => updateSetting("timezone", e.target.value)}
              >
                <option value="UTC">UTC</option>
                <option value="EST">EST — Eastern</option>
                <option value="PST">PST — Pacific</option>
                <option value="IST">IST — India</option>
              </Select>
            </FormControl>
          </Grid>
        </CardBody>
      </Card>

      <Card {...CARD_PROPS}>
        <CardBody px={5} py={5}>
          <SectionHeader>Email Preferences</SectionHeader>
          <Box>
            <ToggleRow
              label="Email notifications enabled"
              isChecked={settings.emailNotifications !== false}
              onChange={(e) =>
                updateSetting("emailNotifications", e.target.checked)
              }
            />
          </Box>
        </CardBody>
      </Card>
    </VStack>
  );
};

// ─── DataRetentionTab ────────────────────────────────────────────────────────

const DataRetentionTab = ({
  settings,
  retentionDisplay,
  setRetentionDisplay,
  retentionError,
  setRetentionError,
  pollingDisplay,
  setPollingDisplay,
  pollingError,
  setPollingError,
  updateSetting,
  setIsDirty,
  loadNotifications,
}) => {
  const notify = useNotify();
  const isMounted = useRef(true);

  const [retentionRunning, setRetentionRunning] = useState(false);
  const [systemInfo, setSystemInfo] = useState({ cdrs: 0 });
  const [caneditretention, setCaneditretention] = useState(false);
  const [caneditpoll, setCaneditpoll] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadSystemInfo = useCallback(async () => {
    try {
      const cdrCount = await fetchCDRCount();
      if (!isMounted.current) return;
      setSystemInfo({ cdrs: Number(cdrCount || 0) });
    } catch (error) {
      console.error("Failed to load system counts", error);
    }
  }, []);

  useEffect(() => {
    loadSystemInfo();
  }, [loadSystemInfo]);

  const handleRunRetention = async () => {
    setRetentionRunning(true);
    try {
      const result = await runRetentionCleanup();
      if (!isMounted.current) return;
      await loadNotifications(true);
      await loadSystemInfo();
      notify({
        title: "Retention cleanup completed",
        description: `${result.deletedCount} CDRs removed (policy: ${result.retentionDays} days).`,
        status: "success",
        duration: 3500,
        isClosable: true,
      });
    } catch (error) {
      if (!isMounted.current) return;
      notify({
        title: "Retention cleanup failed",
        description: error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      if (isMounted.current) setRetentionRunning(false);
    }
  };

  return (
    <VStack spacing={5} align="stretch">
      {/* CDR count stat */}
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={4}>
          <HStack justify="space-between" align="center">
            <Box>
              <Text {...SECTION_LABEL} mb={1}>
                Total CDR Records
              </Text>
              <Text
                fontSize="22px"
                fontWeight="500"
                color="gray.800"
                fontVariantNumeric="tabular-nums"
              >
                {systemInfo.cdrs.toLocaleString()}
              </Text>
            </Box>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<FiRefreshCw size={12} />}
              onClick={loadSystemInfo}
              color="gray.400"
              fontSize="12px"
              fontWeight="400"
              _hover={{ color: "gray.700", bg: "gray.50" }}
            >
              Refresh
            </Button>
          </HStack>
        </CardBody>
      </Card>

      {/* Settings fields */}
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={5}>
          <SectionHeader>Retention Policy</SectionHeader>
          <HStack spacing={5} align="stretch">
            {/* Retention field */}
            <FormControl isInvalid={Boolean(retentionError)}>
              <FormLabel {...FORM_LABEL_PROPS}>
                CDR Data Retention (days)
              </FormLabel>
              <HStack spacing={2}>
                <NumberInput
                  isDisabled={!caneditretention}
                  flex={1}
                  min={RETENTION_MIN}
                  max={RETENTION_MAX}
                  value={retentionDisplay}
                  keepWithinRange={false}
                  clampValueOnBlur={false}
                  onChange={(valueString) => {
                    setRetentionDisplay(valueString);
                    setRetentionError("");
                    setIsDirty(true);
                    const parsed = Number(valueString);
                    if (Number.isFinite(parsed))
                      updateSetting("dataRetentionDays", parsed);
                  }}
                  onBlur={() => {
                    const result = validateNumericInput(
                      retentionDisplay,
                      "CDR data retention (days)",
                      RETENTION_MIN,
                      RETENTION_MAX,
                    );
                    setRetentionError(result.message);
                    if (result.valid)
                      updateSetting("dataRetentionDays", result.value);
                  }}
                >
                  <NumberInputField {...INPUT_PROPS} />
                </NumberInput>
                <Button
                  size="sm"
                  height="34px"
                  px={3}
                  fontSize="12px"
                  fontWeight="500"
                  borderRadius="8px"
                  borderWidth="0.5px"
                  boxShadow="none"
                  bg={caneditretention ? "green.50" : "gray.50"}
                  color={caneditretention ? "green.600" : "gray.500"}
                  borderColor={caneditretention ? "green.200" : "gray.200"}
                  _hover={{
                    bg: caneditretention ? "green.100" : "gray.100",
                  }}
                  onClick={() => {
                    if (caneditretention) {
                      // Confirm/lock: validate and apply
                      const result = validateNumericInput(
                        retentionDisplay,
                        "CDR data retention (days)",
                        RETENTION_MIN,
                        RETENTION_MAX,
                      );
                      setRetentionError(result.message);
                      if (!result.valid) return; // keep edit mode open on invalid
                      updateSetting("dataRetentionDays", result.value);
                    }
                    setCaneditretention((prev) => !prev);
                  }}
                >
                  {caneditretention ? "Done" : "Edit"}
                </Button>
                {caneditretention && (
                  <Button
                    size="sm"
                    height="34px"
                    px={3}
                    fontSize="12px"
                    fontWeight="500"
                    borderRadius="8px"
                    borderWidth="0.5px"
                    boxShadow="none"
                    bg="red.50"
                    color="red.500"
                    borderColor="red.100"
                    _hover={{ bg: "red.100" }}
                    onClick={() => {
                      // Discard: reset to last committed setting value
                      setRetentionDisplay(String(settings.dataRetentionDays));
                      setRetentionError("");
                      setCaneditretention(false);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </HStack>
              <FormErrorMessage fontSize="11px">
                {retentionError}
              </FormErrorMessage>
              <Text fontSize="11px" color="gray.400" mt={1}>
                Min {RETENTION_MIN} days · Max {RETENTION_MAX} days · Default 60
                for 2-month retention
              </Text>
            </FormControl>

            {/* Poll interval field */}
            <FormControl isInvalid={Boolean(pollingError)}>
              <FormLabel {...FORM_LABEL_PROPS}>
                Notification Poll Interval (seconds)
              </FormLabel>
              <HStack spacing={2}>
                <NumberInput
                  isDisabled={!caneditpoll}
                  flex={1}
                  min={POLLING_MIN}
                  max={POLLING_MAX}
                  value={pollingDisplay}
                  keepWithinRange={false}
                  clampValueOnBlur={false}
                  onChange={(valueString) => {
                    setPollingDisplay(valueString);
                    setPollingError("");
                    setIsDirty(true);
                    const parsed = Number(valueString);
                    if (Number.isFinite(parsed))
                      updateSetting("notificationPollingSeconds", parsed);
                  }}
                  onBlur={() => {
                    const result = validateNumericInput(
                      pollingDisplay,
                      "Notification refresh (seconds)",
                      POLLING_MIN,
                      POLLING_MAX,
                    );
                    setPollingError(result.message);
                    if (result.valid)
                      updateSetting("notificationPollingSeconds", result.value);
                  }}
                >
                  <NumberInputField {...INPUT_PROPS} />
                </NumberInput>
                <Button
                  size="sm"
                  height="34px"
                  px={3}
                  fontSize="12px"
                  fontWeight="500"
                  borderRadius="8px"
                  borderWidth="0.5px"
                  boxShadow="none"
                  bg={caneditpoll ? "green.50" : "gray.50"}
                  color={caneditpoll ? "green.600" : "gray.500"}
                  borderColor={caneditpoll ? "green.200" : "gray.200"}
                  _hover={{
                    bg: caneditpoll ? "green.100" : "gray.100",
                  }}
                  onClick={() => {
                    if (caneditpoll) {
                      const result = validateNumericInput(
                        pollingDisplay,
                        "Notification refresh (seconds)",
                        POLLING_MIN,
                        POLLING_MAX,
                      );
                      setPollingError(result.message);
                      if (!result.valid) return;
                      updateSetting("notificationPollingSeconds", result.value);
                    }
                    setCaneditpoll((prev) => !prev);
                  }}
                >
                  {caneditpoll ? "Done" : "Edit"}
                </Button>
                {caneditpoll && (
                  <Button
                    size="sm"
                    height="34px"
                    px={3}
                    fontSize="12px"
                    fontWeight="500"
                    borderRadius="8px"
                    borderWidth="0.5px"
                    boxShadow="none"
                    bg="red.50"
                    color="red.500"
                    borderColor="red.100"
                    _hover={{ bg: "red.100" }}
                    onClick={() => {
                      setPollingDisplay(
                        String(settings.notificationPollingSeconds),
                      );
                      setPollingError("");
                      setCaneditpoll(false);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </HStack>
              <FormErrorMessage fontSize="11px">
                {pollingError}
              </FormErrorMessage>
              <Text fontSize="11px" color="gray.400" mt={1}>
                Min {POLLING_MIN}s · Max {POLLING_MAX}s · Changes apply on next
                poll tick
              </Text>
            </FormControl>
          </HStack>
        </CardBody>
      </Card>

      {/* Danger zone */}
      <Card {...CARD_PROPS} borderColor="red.100">
        <CardBody px={5} py={4}>
          <HStack
            justify="space-between"
            align="center"
            flexWrap="wrap"
            gap={3}
          >
            <Box>
              <Text fontSize="13px" fontWeight="500" color="gray.700" mb="2px">
                Run Retention Cleanup
              </Text>
              <Text fontSize="11px" color="gray.400">
                Immediately deletes CDRs older than the configured retention
                window.
              </Text>
            </Box>
            <Button
              size="sm"
              leftIcon={<FiRefreshCw size={12} />}
              onClick={handleRunRetention}
              isLoading={retentionRunning}
              isDisabled={retentionRunning}
              bg="red.50"
              color="red.600"
              borderWidth="0.5px"
              borderColor="red.200"
              fontWeight="500"
              fontSize="12px"
              borderRadius="8px"
              _hover={{ bg: "red.100" }}
              boxShadow="none"
            >
              Run Now
            </Button>
          </HStack>
        </CardBody>
      </Card>
    </VStack>
  );
};

// ─── CountryCodesTab ──────────────────────────────────────────────────────────

const CountryCodesTab = ({ loadNotifications }) => {
  const notify = useNotify();
  const isMounted = useRef(true);

  const [countryCodeFile, setCountryCodeFile] = useState(null);
  const [replaceCountryCodes, setReplaceCountryCodes] = useState(false);
  const [uploadingCountryCodes, setUploadingCountryCodes] = useState(false);
  const [countryCodeInputKey, setCountryCodeInputKey] = useState(0);
  const [countryCodes, setCountryCodes] = useState([]);
  const [loadingCountryCodes, setLoadingCountryCodes] = useState(false);
  const [countryCodesLoaded, setCountryCodesLoaded] = useState(false);
  const [countryCodeSearch, setCountryCodeSearch] = useState("");
  const [debouncedCountryCodeSearch, setDebouncedCountryCodeSearch] =
    useState("");
  const [countryCodesPage, setCountryCodesPage] = useState(1);
  const [countryCodesPageSize, setCountryCodesPageSize] = useState(25);
  const [countryCodesTotal, setCountryCodesTotal] = useState(0);
  const [singleCountryCode, setSingleCountryCode] = useState("");
  const [singleCountryName, setSingleCountryName] = useState("");
  const [editingCountryCode, setEditingCountryCode] = useState(null);
  const [addingCountryCode, setAddingCountryCode] = useState(false);
  const [deletingCountryCode, setDeletingCountryCode] = useState("");

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCountryCodeSearch(countryCodeSearch.trim());
      setCountryCodesPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [countryCodeSearch]);

  const handleFetchCountryCodes = useCallback(async () => {
    setLoadingCountryCodes(true);
    try {
      const response = await fetchCountryCodes({
        search: debouncedCountryCodeSearch,
        page: countryCodesPage,
        limit: countryCodesPageSize,
      });
      if (!isMounted.current) return;
      const nextCountryCodes = Array.isArray(response?.countryCodes)
        ? response.countryCodes
        : [];
      const nextTotal = Number(response?.total || 0);
      const nextTotalPages = Math.max(1, Number(response?.totalPages || 1));
      const requestedPage = Number(response?.page || countryCodesPage);
      const nextPage = Math.min(Math.max(1, requestedPage), nextTotalPages);
      setCountryCodes(nextCountryCodes);
      setCountryCodesTotal(nextTotal);
      setCountryCodesLoaded(true);
      setCountryCodesPage(nextPage);
    } catch (error) {
      if (!isMounted.current) return;
      notify({
        title: "Failed to load country codes",
        description: error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      if (isMounted.current) setLoadingCountryCodes(false);
    }
  }, [
    countryCodesPage,
    countryCodesPageSize,
    debouncedCountryCodeSearch,
    notify,
  ]);

  useEffect(() => {
    if (!countryCodesLoaded) return;
    handleFetchCountryCodes();
  }, [countryCodesLoaded, handleFetchCountryCodes]);

  const handleUploadCountryCodes = async () => {
    if (!countryCodeFile) {
      notify({
        title: "CSV file required",
        description: "Please choose a country code CSV file first.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    setUploadingCountryCodes(true);
    try {
      const formData = new FormData();
      formData.append("file", countryCodeFile);
      formData.append("replaceExisting", String(replaceCountryCodes));
      const result = await uploadCountryCodes(formData);
      if (!isMounted.current) return;
      setCountryCodeFile(null);
      setCountryCodeInputKey((prev) => prev + 1);
      notify({
        title: "Country codes uploaded",
        description: `Uploaded ${result.uploadedCount} record(s).${result.replaceExisting ? ` Replaced ${result.deletedCount} existing record(s).` : ""}`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      await loadNotifications(true);
      if (countryCodesLoaded) await handleFetchCountryCodes();
    } catch (error) {
      if (!isMounted.current) return;
      notify({
        title: "Upload failed",
        description: error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      if (isMounted.current) setUploadingCountryCodes(false);
    }
  };

  const handleAddCountryCode = async () => {
    const code = singleCountryCode.trim();
    const country_name = singleCountryName.trim();
    if (!code || !country_name) {
      notify({
        title: "Fields required",
        description: "Please enter both code and country name.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    setAddingCountryCode(true);
    try {
      const originalCode = String(editingCountryCode?.code || "").trim();
      let result;

      if (originalCode && originalCode !== code) {
        // Rename flow: create/update new code first, then remove old code.
        await addCountryCode({ code, country_name });
        await deleteCountryCode(originalCode);
        result = {
          updated: true,
          renamed: true,
          countryCode: { code, country_name },
        };
      } else {
        result = await addCountryCode({ code, country_name });
      }

      if (!isMounted.current) return;
      setSingleCountryCode("");
      setSingleCountryName("");
      setEditingCountryCode(null);
      notify({
        title: result.renamed
          ? "Country code updated"
          : result.updated
            ? "Country code updated"
            : "Country code added",
        description: `${result.countryCode.code} - ${result.countryCode.country_name}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      await loadNotifications(true);
      if (countryCodesLoaded) await handleFetchCountryCodes();
    } catch (error) {
      if (!isMounted.current) return;
      notify({
        title: "Failed to save country code",
        description: error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      if (isMounted.current) setAddingCountryCode(false);
    }
  };

  const handleEditCountryCode = (item) => {
    const code = String(item?.code || "").trim();
    const country_name = String(item?.country_name || "").trim();
    if (!code || !country_name) return;
    setSingleCountryCode(code);
    setSingleCountryName(country_name);
    setEditingCountryCode({ code });
  };

  const handleDeleteCountryCode = async (item) => {
    const code = String(item?.code || "").trim();
    if (!code) return;
    const confirmed = window.confirm(
      `Delete country code ${code} (${item?.country_name || ""})?`,
    );
    if (!confirmed) return;
    setDeletingCountryCode(code);
    try {
      await deleteCountryCode(code);
      if (!isMounted.current) return;
      notify({
        title: "Country code deleted",
        description: `${code} removed successfully.`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      await loadNotifications(true);
      if (countryCodesLoaded) await handleFetchCountryCodes();
    } catch (error) {
      if (!isMounted.current) return;
      notify({
        title: "Failed to delete country code",
        description: error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      if (isMounted.current) setDeletingCountryCode("");
    }
  };

  const countryCodeColumns = [
    {
      key: "code",
      header: "Code",
      width: "120px",
      render: (value) => (
        <Text
          fontSize="13px"
          fontWeight="500"
          color="gray.700"
          fontVariantNumeric="tabular-nums"
        >
          {value}
        </Text>
      ),
    },
    {
      key: "country_name",
      header: "Country Name",
      minWidth: "240px",
      render: (value) => (
        <Text fontSize="13px" color="gray.600">
          {value}
        </Text>
      ),
    },
    {
      key: "action",
      header: "",
      width: "150px",
      render: (_value, item) => (
        <HStack spacing={2} justify="flex-end">
          <Button
            size="xs"
            bg="gray.50"
            color="gray.600"
            borderWidth="0.5px"
            borderColor="gray.200"
            fontWeight="400"
            fontSize="11px"
            borderRadius="6px"
            boxShadow="none"
            _hover={{ bg: "gray.100" }}
            onClick={() => handleEditCountryCode(item)}
            isDisabled={Boolean(deletingCountryCode)}
          >
            Edit
          </Button>
          <Button
            size="xs"
            bg="red.50"
            color="red.500"
            borderWidth="0.5px"
            borderColor="red.100"
            fontWeight="400"
            fontSize="11px"
            borderRadius="6px"
            boxShadow="none"
            _hover={{ bg: "red.100" }}
            onClick={() => handleDeleteCountryCode(item)}
            isLoading={deletingCountryCode === String(item.code)}
            isDisabled={
              Boolean(deletingCountryCode) &&
              deletingCountryCode !== String(item.code)
            }
          >
            Delete
          </Button>
        </HStack>
      ),
    },
  ];

  return (
    <VStack spacing={5} align="stretch">
      {/* Add single */}
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={5}>
          <SectionHeader>Add Single Entry</SectionHeader>
          {editingCountryCode && (
            <Text fontSize="11px" color="blue.600" mb={2}>
              Editing country code {editingCountryCode.code}
            </Text>
          )}
          <Grid
            templateColumns={{ base: "1fr", md: "1fr 2fr auto" }}
            gap={3}
            alignItems="end"
          >
            <FormControl>
              <FormLabel {...FORM_LABEL_PROPS}>Code</FormLabel>
              <Input
                {...INPUT_PROPS}
                placeholder="e.g. 91"
                value={singleCountryCode}
                onChange={(e) => setSingleCountryCode(e.target.value)}
              />
            </FormControl>
            <FormControl>
              <FormLabel {...FORM_LABEL_PROPS}>Country Name</FormLabel>
              <Input
                {...INPUT_PROPS}
                placeholder="e.g. India"
                value={singleCountryName}
                onChange={(e) => setSingleCountryName(e.target.value)}
              />
            </FormControl>
            <HStack spacing={2}>
              <Button
                size="sm"
                leftIcon={<FiSave size={12} />}
                onClick={handleAddCountryCode}
                isLoading={addingCountryCode}
                isDisabled={addingCountryCode || !singleCountryCode.trim() || !singleCountryName.trim()}
                bg="blue.600"
                color="white"
                borderRadius="8px"
                fontWeight="500"
                fontSize="12px"
                height="34px"
                px={4}
                _hover={{ bg: "blue.700" }}
                boxShadow="none"
              >
                {editingCountryCode ? "Update" : "Save"}
              </Button>
              {editingCountryCode && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSingleCountryCode("");
                    setSingleCountryName("");
                    setEditingCountryCode(null);
                  }}
                  isDisabled={addingCountryCode}
                  fontSize="12px"
                  height="34px"
                >
                  Cancel
                </Button>
              )}
            </HStack>
          </Grid>
        </CardBody>
      </Card>

      {/* CSV upload */}
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={5}>
          <SectionHeader>Bulk Upload via CSV</SectionHeader>
          <Text fontSize="11px" color="gray.400" mb={4}>
            Accepted formats: with header <code>code,country_name</code> or
            headerless (col 1 = code, col 2 = name).
          </Text>
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel {...FORM_LABEL_PROPS}>CSV File</FormLabel>
              <Input
                {...INPUT_PROPS}
                key={countryCodeInputKey}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) =>
                  setCountryCodeFile(e.target.files?.[0] || null)
                }
                height="auto"
                py={1}
              />
              {countryCodeFile && (
                <Text fontSize="11px" color="gray.400" mt={1}>
                  Selected: {countryCodeFile.name}
                </Text>
              )}
            </FormControl>

            <HStack
              justify="space-between"
              align="center"
              flexWrap="wrap"
              gap={3}
            >
              <HStack spacing={3}>
                <Switch
                  size="sm"
                  colorScheme="gray"
                  isChecked={replaceCountryCodes}
                  onChange={(e) => setReplaceCountryCodes(e.target.checked)}
                  sx={{
                    "& .chakra-switch__track[data-checked]": { bg: "gray.800" },
                  }}
                />
                <Text fontSize="12px" color="gray.600">
                  Replace existing entries
                </Text>
              </HStack>
              <Button
                size="sm"
                leftIcon={<FiUpload size={12} />}
                onClick={handleUploadCountryCodes}
                isLoading={uploadingCountryCodes}
                isDisabled={uploadingCountryCodes || !countryCodeFile}
                bg="blue.600"
                color="white"
                borderRadius="8px"
                fontWeight="500"
                fontSize="12px"
                height="34px"
                px={4}
                _hover={{ bg: "blue.700" }}
                boxShadow="none"
              >
                Upload
              </Button>
            </HStack>
          </VStack>
        </CardBody>
      </Card>

      {/* Table */}
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={5}>
          <HStack justify="space-between" align="center" mb={3}>
            <SectionHeader>Country Code Table</SectionHeader>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<FiRefreshCw size={12} />}
              onClick={handleFetchCountryCodes}
              isLoading={loadingCountryCodes}
              isDisabled={loadingCountryCodes}
              fontSize="14px"
              color="gray.400"
              fontWeight="600"
              _hover={{ color: "gray.700", bg: "gray.50" }}
            >
              {countryCodesLoaded ? "Refresh" : "Load"}
            </Button>
          </HStack>

          {countryCodesLoaded ? (
            <>
              <Input
                {...INPUT_PROPS}
                mb={3}
                placeholder="Search by code or country name..."
                value={countryCodeSearch}
                onChange={(e) => setCountryCodeSearch(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                mb={3}
                ml={2}
                onClick={() => {
                  setCountryCodeSearch("");
                  setDebouncedCountryCodeSearch("");
                  setCountryCodesPage(1);
                }}
                isDisabled={!countryCodeSearch}
              >
                Clear Filters
              </Button>
              <Text fontSize="11px" color="gray.400" mb={3}>
                {countryCodes.length} of {countryCodesTotal} records
              </Text>
              <DataTable
                columns={countryCodeColumns}
                data={countryCodes}
                actions={false}
                compact
                serverPagination
                page={countryCodesPage}
                pageSize={countryCodesPageSize}
                total={countryCodesTotal}
                onPageChange={(p) => setCountryCodesPage(p)}
                onPageSizeChange={(s) => {
                  setCountryCodesPageSize(s);
                  setCountryCodesPage(1);
                }}
                isPaginationDisabled={loadingCountryCodes}
                height="320px"
              />
            </>
          ) : (
            <Box py={8} textAlign="center">
              <Text fontSize="13px" color="gray.400">
                Click Load to fetch country code records.
              </Text>
            </Box>
          )}
        </CardBody>
      </Card>
    </VStack>
  );
};

// ─── NotificationsTab ─────────────────────────────────────────────────────────

const NotificationsTab = ({ settings, updateSetting }) => {
  const notify = useNotify();
  const isMounted = useRef(true);

  const { notifications, unreadCount, loading: loadingNotifications, refresh: refreshNotifications } = useNotifications();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Notifications are provided centrally by the Layout-level NotificationsProvider.
  // Use `refreshNotifications()` to request a silent refresh when needed.

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      if (!isMounted.current) return;
      await refreshNotifications();
    } catch (error) {
      notify({
        title: "Failed to update notification",
        description: error.message,
        status: "error",
      });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      if (!isMounted.current) return;
      await refreshNotifications();
    } catch (error) {
      notify({
        title: "Failed to mark all read",
        description: error.message,
        status: "error",
      });
    }
  };

  const handleCreateTestNotification = async () => {
    try {
      await createTestNotification({
        title: "Realtime notification check",
        message:
          "If you see this in the sidebar bell immediately, realtime polling is working.",
        type: "info",
      });
      if (!isMounted.current) return;
      await refreshNotifications();
      notify({
        title: "Test notification sent",
        status: "success",
        duration: 2000,
      });
    } catch (error) {
      notify({
        title: "Failed to create test notification",
        description: error.message,
        status: "error",
      });
    }
  };

  const NOTIFY_TOGGLES = [
    { key: "notifyInvoiceGenerated", label: "Invoice Generated" },
    { key: "notifyPaymentDue", label: "Payment Due" },
    { key: "notifyPaymentReceived", label: "Payment Received" },
    { key: "notifyDisputes", label: "Dispute Alerts" },
    { key: "notifyErrors", label: "System Errors" },
  ];

  return (
    <VStack spacing={5} align="stretch">
      {/* Notification event toggles */}
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={5}>
          <SectionHeader>Event Triggers</SectionHeader>
          <Box>
            {NOTIFY_TOGGLES.map(({ key, label }) => (
              <ToggleRow
                key={key}
                label={label}
                isChecked={settings[key] !== false}
                onChange={(e) => updateSetting(key, e.target.checked)}
              />
            ))}
          </Box>
        </CardBody>
      </Card>

      {/* Live inbox */}
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={5}>
          <HStack
            justify="space-between"
            align="center"
            mb={4}
            flexWrap="wrap"
            gap={3}
          >
            <Box>
              <SectionHeader>Live Inbox</SectionHeader>
              {unreadCount > 0 && (
                <Text fontSize="11px" color="gray.400" mt={1}>
                  {unreadCount} unread
                </Text>
              )}
            </Box>
            <HStack spacing={2}>
              <Button
                size="sm"
                onClick={handleCreateTestNotification}
                fontSize="12px"
                fontWeight="400"
                color="gray.500"
                borderWidth="0.5px"
                borderColor="gray.200"
                bg="white"
                borderRadius="8px"
                height="30px"
                px={3}
                _hover={{ bg: "gray.50" }}
                boxShadow="none"
              >
                Send test
              </Button>
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  onClick={handleMarkAllRead}
                  fontSize="12px"
                  fontWeight="400"
                  color="gray.500"
                  variant="ghost"
                  height="30px"
                  px={3}
                  _hover={{ bg: "gray.50" }}
                >
                  Mark all read
                </Button>
              )}
            </HStack>
          </HStack>

          {loadingNotifications ? (
            <Box py={8} textAlign="center">
              <Spinner size="sm" color="gray.300" />
            </Box>
          ) : (
            <VStack align="stretch" spacing={2} maxH="360px" overflowY="auto">
              {notifications.length === 0 && (
                <Box py={8} textAlign="center">
                  <Text fontSize="13px" color="gray.400">
                    No notifications yet.
                  </Text>
                </Box>
              )}
              {notifications.map((item) => (
                <Box
                  key={item.id}
                  px={4}
                  py={3}
                  borderWidth="0.5px"
                  borderRadius="8px"
                  bg={item.isRead ? "white" : "gray.50"}
                  borderColor={item.isRead ? "gray.100" : "gray.200"}
                >
                  <HStack justify="space-between" align="start" gap={3}>
                    <Box flex={1} minW={0}>
                      <HStack spacing={2} mb={1}>
                        {!item.isRead && (
                          <Box
                            w="5px"
                            h="5px"
                            borderRadius="full"
                            bg="gray.700"
                            flexShrink={0}
                            mt="1px"
                          />
                        )}
                        <Text
                          fontSize="13px"
                          fontWeight="500"
                          color="gray.800"
                          noOfLines={1}
                        >
                          {item.title}
                        </Text>
                      </HStack>
                      <Text
                        fontSize="12px"
                        color="gray.500"
                        pl={!item.isRead ? "13px" : "0"}
                      >
                        {item.message}
                      </Text>
                      <Text
                        fontSize="11px"
                        color="gray.400"
                        mt={1}
                        pl={!item.isRead ? "13px" : "0"}
                      >
                        {formatNotificationTime(item.createdAt)}
                      </Text>
                    </Box>
                    {!item.isRead && (
                      <Button
                        size="xs"
                        flexShrink={0}
                        onClick={() => handleMarkRead(item.id)}
                        fontSize="11px"
                        fontWeight="400"
                        color="gray.400"
                        variant="ghost"
                        height="24px"
                        px={2}
                        _hover={{ color: "gray.700", bg: "gray.100" }}
                      >
                        Read
                      </Button>
                    )}
                  </HStack>
                </Box>
              ))}
            </VStack>
          )}
        </CardBody>
      </Card>
    </VStack>
  );
};
const EmailSettingsTab = ({ settings, updateSetting }) => {
  const syncEmailProfiles = Boolean(settings.syncEmailProfiles);
  const billingSnapshot = getProfileSnapshot(settings, "billing");
  const notify = useNotify();
  const [testTo, setTestTo] = useState(settings.notificationEmail || "");
  const [testProfile, setTestProfile] = useState('management');
  const [sendingTest, setSendingTest] = useState(false);

  const handleToggleSync = (enabled) => {
    updateSetting("syncEmailProfiles", enabled);
    if (enabled) {
      const sourceSnapshot = getProfileSnapshot(settings, "billing");
      EMAIL_PROFILE_KEYS.forEach((key) =>
        applyProfileSnapshot(updateSetting, key, sourceSnapshot),
      );
    }
  };

  return (
    <VStack spacing={5} align="stretch">
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={4}>
          <HStack
            justify="space-between"
            align="center"
            flexWrap="wrap"
            gap={3}
          >
            <Box>
              <Text fontSize="13px" fontWeight="500" color="gray.700" mb="2px">
                Use same SMTP settings for all profiles
              </Text>
              <Text fontSize="11px" color="gray.400">
                When enabled, saving any email card copies that SMTP
                configuration to billing, reports, rates, and management.
              </Text>
            </Box>
            <HStack spacing={3}>
              <Badge
                colorScheme={syncEmailProfiles ? "green" : "gray"}
                variant="subtle"
                borderRadius="full"
                px={2}
              >
                {syncEmailProfiles ? "Linked" : "Independent"}
              </Badge>
              <Switch
                size="sm"
                colorScheme="gray"
                isChecked={syncEmailProfiles}
                onChange={(e) => handleToggleSync(e.target.checked)}
                sx={{
                  "& .chakra-switch__track[data-checked]": { bg: "gray.800" },
                }}
              />
            </HStack>
          </HStack>
        </CardBody>
      </Card>
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={4}>
          <SectionHeader>Test SMTP Configuration</SectionHeader>
          <Grid
            templateColumns={{ base: "1fr", md: "220px minmax(0, 1fr) auto" }}
            gap={3}
            alignItems="center"
          >
            <Select
              {...INPUT_PROPS}
              w="full"
              minW={0}
              value={testProfile}
              onChange={(e) => setTestProfile(e.target.value)}
            >
              {EMAIL_PROFILE_CARDS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.title}
                </option>
              ))}
            </Select>
            <Input
              {...INPUT_PROPS}
              w="full"
              minW={0}
              placeholder="recipient@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
            <Button
              size="sm"
              leftIcon={<FiMail size={12} />}
              onClick={async () => {
                if (!testTo) {
                  notify({ title: 'Recipient required', status: 'warning' });
                  return;
                }
                setSendingTest(true);
                try {
                  await sendTestEmail({ profile: testProfile, to: testTo });
                  notify({ title: 'Test email sent', status: 'success', duration: 3000 });
                } catch (error) {
                  notify({ title: 'Failed to send test email', description: error.message, status: 'error', duration: 5000 });
                } finally {
                  setSendingTest(false);
                }
              }}
              isLoading={sendingTest}
              bg="blue.600"
              color="white"
              borderRadius="8px"
              fontWeight="500"
              whiteSpace="nowrap"
              w={{ base: "full", md: "auto" }}
            >
              Send test email
            </Button>
          </Grid>
        </CardBody>
      </Card>
      <Grid templateColumns={{ base: "1fr", xl: "repeat(2, 1fr)" }} gap={4}>
        {EMAIL_PROFILE_CARDS.map((profile) => (
          <EmailProfileCard
            key={profile.key}
            profileKey={profile.key}
            title={profile.title}
            description={profile.description}
            settings={settings}
            updateSetting={updateSetting}
            syncAllProfiles={syncEmailProfiles}
            linkedSnapshot={billingSnapshot}
          />
        ))}
      </Grid>
    </VStack>
  );
};

const normalizeBillingProfile = (raw = {}) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const paymentInfo = source.paymentInfo && typeof source.paymentInfo === "object"
    ? source.paymentInfo
    : {};

  return {
    tag: String(source.tag || "").trim().toLowerCase(),
    displayName: String(source.displayName || "").trim(),
    companyName: String(source.companyName || "").trim(),
    email: String(source.email || "").trim(),
    phone: String(source.phone || "").trim(),
    footerText: String(source.footerText || "").trim(),
    addressLines: Array.isArray(source.addressLines)
      ? source.addressLines.map((line) => String(line || "").trim()).filter(Boolean)
      : [],
    paymentInfo: {
      beneficiaryName: String(paymentInfo.beneficiaryName || "").trim(),
      bankName: String(paymentInfo.bankName || "").trim(),
      swiftCode: String(paymentInfo.swiftCode || "").trim(),
      accountNo: String(paymentInfo.accountNo || "").trim(),
      iban: String(paymentInfo.iban || "").trim(),
      bankAddress: String(paymentInfo.bankAddress || "").trim(),
      accountCurrency: String(paymentInfo.accountCurrency || "").trim(),
    },
  };
};

const BillingProfileCard = ({ profile, onSaved, profiles = [] }) => {
  const notify = useNotify();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  const [reassignAccountCount, setReassignAccountCount] = useState(0);
  const [local, setLocal] = useState(() => normalizeBillingProfile(profile));
  useEffect(() => {
    if (isEditing) return;
    setLocal(normalizeBillingProfile(profile));
  }, [profile, isEditing]);

  const handleDone = async () => {
    const payload = {
      ...local,
      addressLines: Array.isArray(local.addressLines)
        ? local.addressLines
        : String(local.addressLines || "").split("\n").map((l) => l.trim()).filter(Boolean),
    };
    // Do not send footerText from the UI; footer is hardcoded server-side
    if (payload.footerText !== undefined) delete payload.footerText;
    try {
      await updateBillingClassProfile(local.tag, payload);
      notify({ title: "Billing settings saved", status: "success", duration: 2500 });
      setIsEditing(false);
      if (typeof onSaved === "function") onSaved();
    } catch (err) {
      notify({ title: "Failed to save", description: err.message, status: "error" });
    }
  };

  const handleCancel = () => {
    setLocal(normalizeBillingProfile(profile));
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (isEditing) return;
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    setIsDeleting(true);
    try {
      await deleteBillingClassProfile(local.tag);
      notify({
        title: "Billing class deleted",
        status: "success",
        duration: 2500,
      });
      setIsDeleteDialogOpen(false);
      if (typeof onSaved === "function") onSaved();
      return;
    } catch (error) {
      if (error?.status === 409) {
        const accountCount = Number(error?.payload?.accountCount || 0);
        setReassignAccountCount(accountCount);
        setIsDeleteDialogOpen(false);
        setReassignTo("");
        setIsReassignDialogOpen(true);
        return;
      }

      notify({
        title: "Failed to delete billing class",
        description: error.message,
        status: "error",
        duration: 4000,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const availableReassignOptions = profiles
    .map((item) => item.tag)
    .filter((tag) => tag && tag !== local.tag)
    .sort((a, b) => a.localeCompare(b));

  const handleReassignDeleteConfirmed = async () => {
    const targetTag = String(reassignTo || "").trim().toLowerCase();
    if (!targetTag || targetTag === local.tag) {
      notify({
        title: "Select a replacement billing class",
        status: "warning",
        duration: 2500,
      });
      return;
    }

    setIsDeleting(true);
    try {
      await deleteBillingClassProfile(local.tag, targetTag);
      notify({
        title: "Billing class deleted",
        description: reassignAccountCount > 0
          ? `Accounts were reassigned to ${targetTag}.`
          : undefined,
        status: "success",
        duration: 3000,
      });
      setIsReassignDialogOpen(false);
      if (typeof onSaved === "function") onSaved();
    } catch (error) {
      notify({
        title: "Failed to delete billing class",
        description: error.message,
        status: "error",
        duration: 4000,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card {...CARD_PROPS}>
      <CardBody px={5} py={5}>
        <HStack justify="space-between" align="start" mb={3}>
          <Box>
            <Text fontSize="15px" fontWeight="600" color="gray.800">
              {local.displayName || local.tag}
            </Text>
            <Text fontSize="12px" color="gray.500" mt={1}>
              Tag: {local.tag}
            </Text>
          </Box>
          <HStack spacing={2}>
            <Button
              size="sm"
              height="34px"
              px={3}
              fontSize="12px"
              fontWeight="500"
              borderRadius="8px"
              borderWidth="0.5px"
              boxShadow="none"
              bg={isEditing ? "green.50" : "gray.50"}
              color={isEditing ? "green.600" : "gray.500"}
              borderColor={isEditing ? "green.200" : "gray.200"}
              _hover={{ bg: isEditing ? "green.100" : "gray.100" }}
              onClick={() => {
                if (isEditing) return handleDone();
                setIsEditing(true);
              }}
            >
              {isEditing ? "Done" : "Edit"}
            </Button>
            {!isEditing && (
              <Button
                size="sm"
                height="34px"
                px={3}
                fontSize="12px"
                fontWeight="500"
                borderRadius="8px"
                borderWidth="0.5px"
                boxShadow="none"
                bg="red.50"
                color="red.600"
                borderColor="red.100"
                _hover={{ bg: "red.100" }}
                onClick={handleDelete}
              >
                Delete
              </Button>
            )}
            {isEditing && (
              <Button
                size="sm"
                height="34px"
                px={3}
                fontSize="12px"
                fontWeight="500"
                borderRadius="8px"
                borderWidth="0.5px"
                boxShadow="none"
                bg="red.50"
                color="red.500"
                borderColor="red.100"
                _hover={{ bg: "red.100" }}
                onClick={handleCancel}
              >
                Cancel
              </Button>
            )}
          </HStack>
        </HStack>

        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={3}>
          
          <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>Billing Class Name</FormLabel>
            <Input {...INPUT_PROPS} value={local.displayName || ""} onChange={(e) => setLocal((p) => ({ ...p, displayName: e.target.value }))} isDisabled={!isEditing} />
          </FormControl>
            <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>Company Name</FormLabel>
            <Input {...INPUT_PROPS} value={local.companyName || ""} onChange={(e) => setLocal((p) => ({ ...p, companyName: e.target.value }))} isDisabled={!isEditing} />
          </FormControl>
          <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>Email</FormLabel>
            <Input {...INPUT_PROPS} value={local.email || ""} onChange={(e) => setLocal((p) => ({ ...p, email: e.target.value }))} isDisabled={!isEditing} />
          </FormControl>
          <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>Phone</FormLabel>
            <Input {...INPUT_PROPS} value={local.phone || ""} onChange={(e) => setLocal((p) => ({ ...p, phone: e.target.value }))} isDisabled={!isEditing} />
          </FormControl>

          <FormControl gridColumn={{ base: "span 1", md: "span 2" }}>
            <FormLabel {...FORM_LABEL_PROPS}>Company Address</FormLabel>
            <Input
              as="textarea"
              {...INPUT_PROPS}
              minH="72px"
              value={Array.isArray(local.addressLines)
                ? local.addressLines.join("\n")
                : String(local.addressLines || "")}
              onChange={(e) =>
                setLocal((p) => ({ ...p, addressLines: e.target.value }))
              }
              isDisabled={!isEditing}
            />
          </FormControl>

          {/* footerText removed: footer will be hardcoded server-side and use billing email from system settings */}

          <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>Bank Name</FormLabel>
            <Input {...INPUT_PROPS} value={local.paymentInfo?.bankName || ""} onChange={(e) => setLocal((p) => ({ ...p, paymentInfo: { ...p.paymentInfo, bankName: e.target.value } }))} isDisabled={!isEditing} />
          </FormControl>
          <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>Beneficiary Name</FormLabel>
            <Input {...INPUT_PROPS} value={local.paymentInfo?.beneficiaryName || ""} onChange={(e) => setLocal((p) => ({ ...p, paymentInfo: { ...p.paymentInfo, beneficiaryName: e.target.value } }))} isDisabled={!isEditing} />
          </FormControl>

          <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>Account No</FormLabel>
            <Input {...INPUT_PROPS} value={local.paymentInfo?.accountNo || ""} onChange={(e) => setLocal((p) => ({ ...p, paymentInfo: { ...p.paymentInfo, accountNo: e.target.value } }))} isDisabled={!isEditing} />
          </FormControl>
          <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>SWIFT Code</FormLabel>
            <Input {...INPUT_PROPS} value={local.paymentInfo?.swiftCode || ""} onChange={(e) => setLocal((p) => ({ ...p, paymentInfo: { ...p.paymentInfo, swiftCode: e.target.value } }))} isDisabled={!isEditing} />
          </FormControl>
          <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>IBAN</FormLabel>
            <Input {...INPUT_PROPS} value={local.paymentInfo?.iban || ""} onChange={(e) => setLocal((p) => ({ ...p, paymentInfo: { ...p.paymentInfo, iban: e.target.value } }))} isDisabled={!isEditing} />
          </FormControl>
          
          <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>Account Currency</FormLabel>
            <Input {...INPUT_PROPS} value={local.paymentInfo?.accountCurrency || ""} onChange={(e) => setLocal((p) => ({ ...p, paymentInfo: { ...p.paymentInfo, accountCurrency: e.target.value } }))} isDisabled={!isEditing} />
          </FormControl>
          <FormControl>
            <FormLabel {...FORM_LABEL_PROPS}>Bank Address</FormLabel>
            <Input as="textarea" {...INPUT_PROPS} minH="72px" value={local.paymentInfo?.bankAddress || ""} onChange={(e) => setLocal((p) => ({ ...p, paymentInfo: { ...p.paymentInfo, bankAddress: e.target.value } }))} isDisabled={!isEditing} />
          </FormControl>
        </Grid>
        <ConfirmDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={handleDeleteConfirmed}
          title="Delete billing class"
          message={`Delete billing class ${local.tag}?`}
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          isLoading={isDeleting}
          warningNote="This will remove the billing class profile. If accounts still use it, you will be prompted to reassign them."
        />

        <Modal
          isOpen={isReassignDialogOpen}
          onClose={() => setIsReassignDialogOpen(false)}
          isCentered
          size="sm"
        >
          <ModalOverlay />
          <ModalContent borderRadius="xl">
            <ModalHeader fontSize="md" fontWeight="semibold">
              Reassign Billing Class
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={4}>
              <Text fontSize="sm" color="gray.600" mb={3}>
                Billing class {local.tag} is assigned to {reassignAccountCount} account(s). Select a replacement billing class.
              </Text>
              <FormControl>
                <FormLabel fontSize="sm">Replace with</FormLabel>
                <Select
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  placeholder={availableReassignOptions.length > 0 ? "Select billing class" : "No replacement available"}
                  isDisabled={availableReassignOptions.length === 0}
                >
                  {availableReassignOptions.map((tag) => {
                    const option = profiles.find((item) => item.tag === tag);
                    return (
                      <option key={tag} value={tag}>
                        {option?.displayName || tag}
                      </option>
                    );
                  })}
                </Select>
              </FormControl>
              {availableReassignOptions.length === 0 && (
                <Text mt={3} fontSize="sm" color="orange.500">
                  Create another billing class first, then re-run delete.
                </Text>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={() => setIsReassignDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleReassignDeleteConfirmed}
                isLoading={isDeleting}
                isDisabled={!reassignTo || availableReassignOptions.length === 0}
              >
                Reassign & Delete
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </CardBody>
    </Card>
  );
};

const BillingSettingsTab = () => {
  const notify = useNotify();
  const [profiles, setProfiles] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const loadProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const list = await fetchBillingClassProfiles();
      const normalized = Array.isArray(list)
        ? list.map((item) => normalizeBillingProfile(item)).filter((item) => item.tag)
        : [];
      setProfiles(normalized);

      if (normalized.length === 0) return;
    } catch (error) {
      notify({
        title: "Failed to load billing settings",
        description: error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setLoadingProfiles(false);
    }
  }, [notify]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    // no-op: profiles loaded
  }, [profiles]);

  const handleCreateTag = async () => {
    const tag = String(newTag || "").trim().toLowerCase();
    if (!tag) {
      notify({ title: "Tag required", status: "warning", duration: 2500 });
      return;
    }
    if (profiles.some((item) => item.tag === tag)) {
      notify({ title: "Tag already exists", status: "warning", duration: 2500 });
      return;
    }

    setSavingProfile(true);
    try {
      await updateBillingClassProfile(tag, {
        tag,
        displayName: tag,
        companyName: "",
        addressLines: [],
        email: "",
        phone: "",
        footerText: "",
        paymentInfo: {
          beneficiaryName: "",
          bankName: "",
          swiftCode: "",
          accountNo: "",
          iban: "",
          bankAddress: "",
          accountCurrency: "",
        },
      });
      setNewTag("");
      await loadProfiles();
      notify({ title: "Billing class created", status: "success", duration: 2500 });
    } catch (error) {
      notify({
        title: "Failed to create billing class",
        description: error.message,
        status: "error",
        duration: 4000,
      });
    } finally {
      setSavingProfile(false);
    }
  };

  

  return (
    <VStack spacing={5} align="stretch">
      <Card {...CARD_PROPS}>
        <CardBody px={5} py={5}>
          <SectionHeader>Billing Class Profiles</SectionHeader>
          <Grid templateColumns={{ base: "1fr", md: "minmax(0, 1fr) auto" }} gap={3} alignItems="center">
            <Input
              {...INPUT_PROPS}
              placeholder="New billing class tag (e.g. cyvoraeu)"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
            />
            <Button
              leftIcon={<FiPlus/>}
              size="sm"
              onClick={handleCreateTag}
              isLoading={savingProfile}
              isDisabled={savingProfile}
              bg="blue.600"
              color="white"
              borderRadius="8px"
              _hover={{ bg: "blue.700" }}
            >
              Add Tag
            </Button>
          </Grid>
        </CardBody>
      </Card>

      
       {profiles.length === 0 ? (
  <Text textAlign="center" fontSize="13px" color="gray.500">
    No billing classes defined yet.
  </Text>
) : (
  <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
    {profiles.map((p) => (
      <Box key={p.tag}>
        <BillingProfileCard profile={p} profiles={profiles} onSaved={loadProfiles} />
      </Box>
    ))}
  </Grid>
)}
    </VStack>
  );
};

// ─── Settings (root) ──────────────────────────────────────────────────────────

const Settings = () => {
  const notify = useNotify();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  // Track which tabs have been visited (for lazy mounting)
  const [visitedTabs, setVisitedTabs] = useState(new Set(["general"]));

  const [retentionDisplay, setRetentionDisplay] = useState(
    String(DEFAULT_SETTINGS.dataRetentionDays),
  );
  const [pollingDisplay, setPollingDisplay] = useState(
    String(DEFAULT_SETTINGS.notificationPollingSeconds),
  );
  const [retentionError, setRetentionError] = useState("");
  const [pollingError, setPollingError] = useState("");

  const isMounted = useRef(true);

  const { refresh: refreshNotifications } = useNotifications();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const applySettings = useCallback((merged) => {
    setSettings(merged);
    setIsDirty(false);
    setRetentionDisplay(
      String(merged.dataRetentionDays ?? DEFAULT_SETTINGS.dataRetentionDays),
    );
    setPollingDisplay(
      String(
        merged.notificationPollingSeconds ??
          DEFAULT_SETTINGS.notificationPollingSeconds,
      ),
    );
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [serverSettings, serverSections] = await Promise.all([
        getGlobalSettings(),
        getSettingsSections().catch(() => null),
      ]);
      if (!isMounted.current) return;
      const merged = {
        ...DEFAULT_SETTINGS,
        ...normalizeSettingsShape(serverSettings),
      };
      applySettings(merged);
      setSections(serverSections);
    } catch (error) {
      if (!isMounted.current) return;
      notify({
        title: "Failed to load settings",
        description: error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [notify, applySettings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const handleTabChange = (id) => {
    setActiveTab(id);
    setVisitedTabs((prev) => new Set([...prev, id]));
  };

  const handleSave = async () => {
    const retentionValidation = validateNumericInput(
      retentionDisplay,
      "CDR data retention (days)",
      RETENTION_MIN,
      RETENTION_MAX,
    );
    const pollingValidation = validateNumericInput(
      pollingDisplay,
      "Notification refresh (seconds)",
      POLLING_MIN,
      POLLING_MAX,
    );
    setRetentionError(retentionValidation.message);
    setPollingError(pollingValidation.message);
    if (!retentionValidation.valid || !pollingValidation.valid) {
      notify({
        title: "Fix validation errors before saving",
        status: "warning",
        duration: 3500,
        isClosable: true,
      });
      return;
    }
    const settingsToSave = {
      ...settings,
      dataRetentionDays: retentionValidation.value,
      notificationPollingSeconds: pollingValidation.value,
    };
    setSaving(true);
    try {
      // If server supports sections, send grouped payload
      if (sections) {
        const nextSections = {
          generalSettings: {
            systemName: settingsToSave.systemName,
            currency: settingsToSave.currency,
            timezone: settingsToSave.timezone,
          },
          emailSettings: {
            syncEmailProfiles: settingsToSave.syncEmailProfiles,
            billing: {
              email: settingsToSave.billingSmtpEmail,
              password: settingsToSave.billingSmtpPassword,
              host: settingsToSave.billingSmtpHost,
              port: settingsToSave.billingSmtpPort,
              secure: settingsToSave.billingSmtpSecure,
              certificateCheck: settingsToSave.billingSmtpCertificateCheck,
            },
            reports: {
              email: settingsToSave.reportsSmtpEmail,
              password: settingsToSave.reportsSmtpPassword,
              host: settingsToSave.reportsSmtpHost,
              port: settingsToSave.reportsSmtpPort,
              secure: settingsToSave.reportsSmtpSecure,
              certificateCheck: settingsToSave.reportsSmtpCertificateCheck,
            },
            rates: {
              email: settingsToSave.ratesSmtpEmail,
              password: settingsToSave.ratesSmtpPassword,
              host: settingsToSave.ratesSmtpHost,
              port: settingsToSave.ratesSmtpPort,
              secure: settingsToSave.ratesSmtpSecure,
              certificateCheck: settingsToSave.ratesSmtpCertificateCheck,
            },
            management: {
              email: settingsToSave.managementSmtpEmail,
              password: settingsToSave.managementSmtpPassword,
              host: settingsToSave.managementSmtpHost,
              port: settingsToSave.managementSmtpPort,
              secure: settingsToSave.managementSmtpSecure,
              certificateCheck: settingsToSave.managementSmtpCertificateCheck,
            },
          },
          notificationSettings: {
            emailNotifications: settingsToSave.emailNotifications,
            notifyInvoiceGenerated: settingsToSave.notifyInvoiceGenerated,
            notifyPaymentDue: settingsToSave.notifyPaymentDue,
            notifyDisputes: settingsToSave.notifyDisputes,
            notifyErrors: settingsToSave.notifyErrors,
            notifyPaymentReceived: settingsToSave.notifyPaymentReceived,
            notificationEmail: settingsToSave.notificationEmail,
            notificationPollingSeconds: settingsToSave.notificationPollingSeconds,
          },
          dataFetchSettings: {
            dataRetentionDays: settingsToSave.dataRetentionDays,
            dataRetentionMinDays: settingsToSave.dataRetentionMinDays,
            dataRetentionMaxDays: settingsToSave.dataRetentionMaxDays,
          },
        };

        const resp = await updateSettingsSections(nextSections);
        if (!isMounted.current) return;
        // resp may include { settings, sections }
        const savedFlat = resp?.settings || resp || {};
        const merged = { ...DEFAULT_SETTINGS, ...normalizeSettingsShape(savedFlat) };
        applySettings(merged);
        setSections(resp?.sections || nextSections);
        window.dispatchEvent(new CustomEvent('settings-updated', { detail: savedFlat }));
      } else {
        const payload = {
          ...DEFAULT_SETTINGS,
          ...normalizeSettingsShape(settingsToSave),
        };
        const saved = await updateGlobalSettings(payload);
        if (!isMounted.current) return;
        const merged = { ...DEFAULT_SETTINGS, ...normalizeSettingsShape(saved) };
        applySettings(merged);
        // refresh sections if server returned grouped payload
        try {
          const refreshedSections = await getSettingsSections();
          setSections(refreshedSections);
        } catch (e) {
          // ignore section refresh failures
        }
        window.dispatchEvent(
          new CustomEvent("settings-updated", { detail: saved }),
        );
      }
      notify({
        title: "Settings saved",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      if (!isMounted.current) return;
      notify({
        title: "Save failed",
        description: error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  const noopLoadNotifications = useCallback(async () => {}, []);

  if (loading) {
    return (
      <Box py={20} textAlign="center">
        <Spinner size="md" color="gray.300" thickness="2px" />
        <Text mt={3} fontSize="13px" color="gray.400">
          Loading settings…
        </Text>
      </Box>
    );
  }

  return (
    <VStack spacing={0} align="stretch">
      <PageNavBar
        title="Settings"
        description="Project-wide controls for CDR retention, notifications, and system defaults."
        mb={5}
        rightContent={
          <HStack spacing={3}>
            {isDirty && (
              <Button
                size="sm"
                leftIcon={<FiSave size={12} />}
                onClick={handleSave}
                isLoading={saving}
                isDisabled={saving}
                bg="blue.500"
                color="white"
                borderRadius="8px"
                fontWeight="500"
                fontSize="13px"
                height="34px"
                px={4}
                _hover={{ bg: "blue.700" }}
                boxShadow="none"
              >
                Save Settings
              </Button>
            )}
          </HStack>
        }
      />
      
      <TabNav active={activeTab} onChange={handleTabChange} tabs={buildTabsFromSections(sections)} />

      <Box>
        {/* General — always mounted */}
        <Box display={activeTab === "general" ? "block" : "none"}>
          <GeneralTab settings={settings} updateSetting={updateSetting} />
        </Box>

        {/* Data Retention — lazy mount on first visit */}
        {visitedTabs.has("retention") && (
          <Box display={activeTab === "retention" ? "block" : "none"}>
            <DataRetentionTab
              settings={settings}
              retentionDisplay={retentionDisplay}
              setRetentionDisplay={setRetentionDisplay}
              retentionError={retentionError}
              setRetentionError={setRetentionError}
              pollingDisplay={pollingDisplay}
              setPollingDisplay={setPollingDisplay}
              pollingError={pollingError}
              setPollingError={setPollingError}
              updateSetting={updateSetting}
              setIsDirty={setIsDirty}
              loadNotifications={refreshNotifications}
            />
          </Box>
        )}

        {/* Country Codes — lazy mount on first visit */}
        {visitedTabs.has("billing") && (
          <Box display={activeTab === "billing" ? "block" : "none"}>
            <BillingSettingsTab />
          </Box>
        )}

        {/* Country Codes — lazy mount on first visit */}
        {visitedTabs.has("codes") && (
          <Box display={activeTab === "codes" ? "block" : "none"}>
            <CountryCodesTab loadNotifications={refreshNotifications} />
          </Box>
        )}

        {/* Notifications — lazy mount on first visit */}
        {visitedTabs.has("notifs") && (
          <Box display={activeTab === "notifs" ? "block" : "none"}>
            <NotificationsTab
              settings={settings}
              updateSetting={updateSetting}
            />
          </Box>
        )}
        {visitedTabs.has("email") && (
          <Box display={activeTab === "email" ? "block" : "none"}>
            <EmailSettingsTab
              settings={settings}
              updateSetting={updateSetting}
            />
          </Box>
        )}
      </Box>
    </VStack>
  );
};

export default Settings;
