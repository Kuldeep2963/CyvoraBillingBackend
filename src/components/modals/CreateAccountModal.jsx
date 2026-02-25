import React, { useState, useEffect } from "react";
import {
  Box,
  Heading,
  VStack,
  Text,
  Button,
  useToast,
  HStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  useColorModeValue,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Tab,
  FormHelperText,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  SimpleGrid,
  Divider,
  Flex,
} from "@chakra-ui/react";
import {
  FiUser,
} from "react-icons/fi";
import {
  createCustomer,
  updateCustomer,
} from "../../utils/api";

const CreateAccountModal = ({ isOpen, onClose, selectedCustomer, cdrStats, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const initialFormData = {
    // Account Role & Type
    accountRole: "customer",
    accountType: "prepaid",
    accountStatus: "active",
    accountId: "",
    customerauthenticationType: 'ip',
    customerauthenticationValue: '',
    vendorauthenticationType: 'ip',
    vendorauthenticationValue: '',
    


    // CDR Mapping Fields
    customerCode: "",
    vendorCode: "",
    gatewayId: "",
    productId: "",

    // Basic Information
    accountName: "",
    accountOwner: "",
    ownership: "None",

    // Contact Information
    phone: "",
    vendorFax: "",
    email: "",
    billingEmail: "",

    // Account Details
    active: true,
    vatNumber: "",
    verificationStatus: "pending",
    resellerAccount: false,
    reseller: "",

    // Financial
    currency: "USD",
    nominalCode: "",
    creditLimit: 1000.0,
    balance: 0.0,
    outstandingAmount: 0.0,

    // Localization
    timezone: "UTC",
    languages: "en",

    // Address
    addressLine1: "",
    addressLine2: "",
    addressLine3: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    countryCode: "US",

    // Billing
    billingClass: "paiusa",
    billingType: "prepaid",
    billingTimezone: "UTC",
    billingStartDate: new Date().toISOString().split("T")[0],
    billingCycle: "monthly",
    lastbillingdate: null,
    nextbillingdate: null,

    // Payment Settings
    sendInvoiceEmail: true,
    lateFeeEnabled: true,
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (selectedCustomer) {
      setFormData(selectedCustomer);
    } else {
      setFormData({
        ...initialFormData,
        customerCode: `C_${Math.floor(10000 + Math.random() * 90000)}`,
      });
    }
  }, [selectedCustomer, isOpen]);

  const accountRoleOptions = [
    { value: "customer", label: "Customer", color: "blue" },
    { value: "vendor", label: "Vendor", color: "purple" },
    { value: "both", label: "Customer & Vendor", color: "green" },
  ];

  const statusOptions = [
    { value: "active", label: "Active", color: "green" },
    { value: "inactive", label: "Inactive", color: "gray" },
    { value: "suspended", label: "Suspended", color: "red" },
    { value: "pending", label: "Pending", color: "yellow" },
  ];

  const carrierTypeOptions = [
    { value: "tier1", label: "Tier 1 Carrier" },
    { value: "tier2", label: "Tier 2 Carrier" },
    { value: "tier3", label: "Tier 3 Carrier" },
    { value: "mobile", label: "Mobile Operator" },
    { value: "voip", label: "VoIP Provider" },
    { value: "other", label: "Other" },
  ];

  const authTypeOptions = [
    { value: 'ip', label: 'IP Address', description: 'Match by source IP' },
    { value: 'custom', label: 'Custom Field', description: 'Match by custom field' },
  ];

  const validateForm = () => {
    const errors = [];

    if (!formData.accountName?.trim()) errors.push("Account name is required");
    if (!formData.email?.trim()) errors.push("Email is required");

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      errors.push("Invalid email format");
    }

    if (!formData.phone?.trim()) errors.push("Phone is required");
    if (!formData.addressLine1?.trim())
      errors.push("Address Line 1 is required");
    if (!formData.city?.trim()) errors.push("City is required");
    if (!formData.postalCode?.trim()) errors.push("Postal Code is required");
    if (!formData.billingStartDate) errors.push("Billing Start Date is required");

    // Validate customer/vendor codes based on role
    if (
      (formData.accountRole === "customer" ||
        formData.accountRole === "both") &&
      !formData.customerCode
    ) {
      errors.push("Customer code is required for customer accounts");
    }

    if (
      (formData.accountRole === "vendor" || formData.accountRole === "both") &&
      !formData.vendorCode
    ) {
      errors.push("Vendor code is required for vendor accounts");
    }

    return errors;
  };

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      toast({
        title: "Validation Error",
        description: validationErrors.join(", "),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);
    try {
      // Sanitize date fields
      const sanitizedData = {
        ...formData,
        lastbillingdate: formData.lastbillingdate || null,
        nextbillingdate: formData.nextbillingdate || null,
        billingClass: formData.billingClass || "paiusa"
      };

      if (selectedCustomer) {
        await updateCustomer(selectedCustomer.id, sanitizedData);
      } else {
        await createCustomer(sanitizedData);
      }

      toast({
        title: selectedCustomer ? "Account updated" : "Account created",
        description: `Account ${formData.accountName} has been ${selectedCustomer ? "updated" : "created"} successfully`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      toast({
        title: "Error saving account",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAccountRoleChange = (role) => {
    setFormData({
      ...formData,
      accountRole: role,
      // Auto-generate codes if not set
      customerCode:
        (role === "customer" || role === "both") && !formData.customerCode
          ? `C_${Math.floor(10000 + Math.random() * 90000)}`
          : role === "vendor"
            ? ""
            : formData.customerCode,
      vendorCode:
        (role === "vendor" || role === "both") && !formData.vendorCode
          ? `P_${Math.floor(10000 + Math.random() * 90000)}`
          : role === "customer"
            ? ""
            : formData.vendorCode,
    });
  };

  const stickyTabListBg = useColorModeValue("white", "gray.800");

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !loading && onClose()}
      size={{ base: "sm", md: "2xl", lg: "3xl" }}
      closeOnOverlayClick={!loading}
    >
      <ModalOverlay />
      <ModalContent borderRadius={"8px"} maxH="90vh">
        <ModalHeader
          borderTopRadius={"8px"}
          bgColor="blue.500"
          color="white"
          position="sticky"
          top={0}
          zIndex={1}
          borderBottom="1px"
          borderColor="gray.200"
        >
          <VStack align="start" spacing={1}>
            <Heading size="md" fontWeight={"semibold"} color={"white"}>
              {selectedCustomer ? "Edit Account" : "Add New Account"}
            </Heading>
            {selectedCustomer && (
              <Text fontSize="sm" color="white">
                Account ID: {selectedCustomer.accountId}
              </Text>
            )}
          </VStack>
          <ModalCloseButton
            color={"white"}
            top={4}
            right={4}
            isDisabled={loading}
          />
        </ModalHeader>

        <ModalBody overflowY="auto" maxH="calc(90vh - 200px)">
          <VStack spacing={6} align="stretch" pb={4}>
            <Tabs variant="line" colorScheme="blue" isFitted>
              <TabList
                position={"sticky"}
                zIndex={1}
                top={0}
                bg={stickyTabListBg}
                borderBottom="1px"
                borderColor="gray.200"
              >
                <Tab>Account Type</Tab>
                <Tab>Basic Info</Tab>
                <Tab>Contact & Address</Tab>
                <Tab>Billing & Payment</Tab>
                {/* <Tab>Telecom Settings</Tab> */}
                {selectedCustomer && <Tab>Usage Statistics</Tab>}
              </TabList>

              <TabPanels>
                {/* Tab 1: Account Type */}
                <TabPanel>
                  <VStack spacing={6} align="stretch">
                    <Box>
                      <Heading size="sm" mb={4}>
                        Account Role & Type
                      </Heading>
                      <SimpleGrid columns={2} spacing={4}>
                        <FormControl isRequired>
                          <FormLabel>Account Role</FormLabel>
                          <Select
                            value={formData.accountRole}
                            onChange={(e) =>
                              handleAccountRoleChange(e.target.value)
                            }
                            isDisabled={!!selectedCustomer}
                          >
                            {accountRoleOptions.map((option) => (
                              <option
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </option>
                            ))}
                          </Select>
                          <FormHelperText>
                            Determines billing and CDR mapping
                          </FormHelperText>
                        </FormControl>

                        <FormControl isRequired>
                          <FormLabel>Account Status</FormLabel>
                          <Select
                            value={formData.accountStatus}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                accountStatus: e.target.value,
                                active: e.target.value === "active",
                              })
                            }
                          >
                            {statusOptions.map((option) => (
                              <option
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </FormControl>

                        <FormControl>
                          <FormLabel>Carrier Type</FormLabel>
                          <Select
                            value={formData.carrierType}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                carrierType: e.target.value,
                              })
                            }
                          >
                            {carrierTypeOptions.map((option) => (
                              <option
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </FormControl>
                      </SimpleGrid>
                    </Box>

                    <Divider />

                    <Box>
                      <Heading size="sm" mb={4}>
                        CDR Mapping Configuration
                      </Heading>
                      <SimpleGrid columns={2} spacing={4}>
                        {(formData.accountRole === "customer" ||
                          formData.accountRole === "both") && (
                            <FormControl isRequired>
                              <FormLabel>Customer Code</FormLabel>
                              <Input
                                value={formData.customerCode}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    customerCode: e.target.value,
                                  })
                                }
                                placeholder="C_XXXXX"
                              />
                              <FormHelperText>
                                Maps to customeraccount in CDRs
                              </FormHelperText>
                            </FormControl>
                          )}

                        {(formData.accountRole === "vendor" ||
                          formData.accountRole === "both") && (
                            <FormControl isRequired>
                              <FormLabel>Vendor Code</FormLabel>
                              <Input
                                value={formData.vendorCode}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    vendorCode: e.target.value,
                                  })
                                }
                                placeholder="P_XXXXX"
                              />
                              <FormHelperText>
                                Maps to agentaccount in CDRs
                              </FormHelperText>
                            </FormControl>
                          )}
                        
                        {(formData.accountRole === "customer" ||
                          formData.accountRole === "both") && (
                            <Flex gap={4} flexDirection={"column"}>
                        <FormControl>
                          <FormLabel> Customer Authentication Type</FormLabel>
                          <Select
                            value={formData.customerauthenticationType}
                            onChange={(e) => setFormData({ ...formData, customerauthenticationType: e.target.value })}
                          >
                            {authTypeOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </Select>
                          <FormHelperText>{authTypeOptions.find(o => o.value === formData.customerauthenticationType)?.description}</FormHelperText>
                        </FormControl>

                        <FormControl>
                          <FormLabel> customer Authentication Value</FormLabel>
                          <Input
                            value={formData.customerauthenticationValue}
                            onChange={(e) => setFormData({ ...formData, customerauthenticationValue: e.target.value })}
                            placeholder={
                              formData.customerauthenticationType === 'ip' ? '192.168.1.100' :
                                formData.customerauthenticationType === 'gateway' ? 'GW-12345' :
                                  formData.customerauthenticationType === 'prefix' ? '91' :
                                    'Enter value'
                            }
                          />
                        </FormControl>
                       </Flex>)}


                       {(formData.accountRole === "vendor" ||
                          formData.accountRole === "both") && (
                            <Flex gap={4} flexDirection={"column"}>
                         <FormControl>
                          <FormLabel> Vendor Authentication Type</FormLabel>
                          <Select
                            value={formData.vendorauthenticationType}
                            onChange={(e) => setFormData({ ...formData, vendorauthenticationType: e.target.value })}
                          >
                            {authTypeOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </Select>
                          <FormHelperText>{authTypeOptions.find(o => o.value === formData.vendorauthenticationType)?.description}</FormHelperText>
                        </FormControl>

                        <FormControl>
                          <FormLabel>Vendor Authentication Value</FormLabel>
                          <Input
                            value={formData.vendorauthenticationValue}
                            onChange={(e) => setFormData({ ...formData, vendorauthenticationValue: e.target.value })}
                            placeholder={
                              formData.vendorauthenticationType === 'ip' ? '192.168.1.100' :
                                formData.vendorauthenticationType === 'gateway' ? 'GW-12345' :
                                  formData.vendorauthenticationType === 'prefix' ? '91' :
                                    'Enter value'
                            }
                          />
                        </FormControl>
                        </Flex>)}


                        {/* <FormControl>
                          <FormLabel>Product ID</FormLabel>
                          <Input
                            value={formData.productId}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                productId: e.target.value,
                              })
                            }
                            placeholder="Product identifier"
                          />
                        </FormControl> */}
                      </SimpleGrid>
                    </Box>

                    <Divider />
                  </VStack>
                </TabPanel>

                {/* Tab 2: Basic Information */}
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <Heading size="sm" mb={2}>
                      Account Information
                    </Heading>
                    <SimpleGrid columns={2} spacing={4}>
                      <FormControl isRequired>
                        <FormLabel>Account Name</FormLabel>
                        <Input
                          value={formData.accountName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accountName: e.target.value,
                            })
                          }
                          placeholder="Company Name"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Account Owner</FormLabel>
                        <Input
                          value={formData.accountOwner}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accountOwner: e.target.value,
                            })
                          }
                          placeholder="Sales Rep Name"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Ownership</FormLabel>
                        <Select
                          value={formData.ownership}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              ownership: e.target.value,
                            })
                          }
                        >
                          <option value="None">None</option>
                          <option value="private">Private</option>
                          <option value="public">Public</option>
                          <option value="subsidiary">Subsidiary</option>
                          <option value="others">Others</option>
                        </Select>
                      </FormControl>
                    </SimpleGrid>

                    <Heading size="sm" mb={2} mt={4}>
                      Financial Information
                    </Heading>
                    <SimpleGrid columns={2} spacing={4}>
                      <FormControl>
                        <FormLabel>Currency</FormLabel>
                        <Select
                          value={formData.currency}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              currency: e.target.value,
                            })
                          }
                        >
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="INR">INR</option>
                          <option value="AUD">AUD</option>
                          <option value="CAD">CAD</option>
                        </Select>
                      </FormControl>
                      <FormControl>
                        <FormLabel>VAT Number</FormLabel>
                        <Input
                          value={formData.vatNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              vatNumber: e.target.value,
                            })
                          }
                          placeholder="VAT/Tax ID"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Nominal Code</FormLabel>
                        <Input
                          value={formData.nominalCode}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              nominalCode: e.target.value,
                            })
                          }
                          placeholder="Accounting code"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Verification Status</FormLabel>
                        <Select
                          value={formData.verificationStatus}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              verificationStatus: e.target.value,
                            })
                          }
                        >
                          <option value="pending">Pending</option>
                          <option value="verified">Verified</option>
                          <option value="unverified">Not Verified</option>
                        </Select>
                      </FormControl>
                    </SimpleGrid>
                  </VStack>
                </TabPanel>

                {/* Tab 3: Contact & Address */}
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <Heading size="sm" mb={2}>
                      Contact Information
                    </Heading>
                    <SimpleGrid columns={2} spacing={4}>
                      <FormControl isRequired>
                        <FormLabel>Email</FormLabel>
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              email: e.target.value,
                            })
                          }
                          placeholder="account@example.com"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Billing Email</FormLabel>
                        <Input
                          type="email"
                          value={formData.billingEmail}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              billingEmail: e.target.value,
                            })
                          }
                          placeholder="billing@example.com"
                        />
                      </FormControl>
                      <FormControl isRequired>
                        <FormLabel>Phone</FormLabel>
                        <Input
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              phone: e.target.value,
                            })
                          }
                          placeholder="+1234567890"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Vendor Fax</FormLabel>
                        <Input
                          value={formData.vendorFax}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              vendorFax: e.target.value,
                            })
                          }
                          placeholder="+1234567891"
                        />
                      </FormControl>
                    </SimpleGrid>

                    <Heading size="sm" mb={2} mt={4}>
                      Reseller Information
                    </Heading>
                    <SimpleGrid columns={2} spacing={4}>
                      <FormControl>
                        <FormLabel>Reseller Account</FormLabel>
                        <Select
                          value={formData.resellerAccount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              resellerAccount: e.target.value === "true",
                            })
                          }
                        >
                          <option value="false">No</option>
                          <option value="true">Yes</option>
                        </Select>
                      </FormControl>
                      {formData.resellerAccount && (
                        <FormControl>
                          <FormLabel>Reseller Name</FormLabel>
                          <Input
                            value={formData.reseller}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                reseller: e.target.value,
                              })
                            }
                            placeholder="Reseller company name"
                          />
                        </FormControl>
                      )}
                    </SimpleGrid>

                    <Heading size="sm" mb={2} mt={4}>
                      Address Information
                    </Heading>
                    <SimpleGrid columns={1} spacing={3}>
                      <FormControl isRequired>
                        <FormLabel>Address Line 1</FormLabel>
                        <Input
                          value={formData.addressLine1}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              addressLine1: e.target.value,
                            })
                          }
                          placeholder="Street address"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Address Line 2</FormLabel>
                        <Input
                          value={formData.addressLine2}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              addressLine2: e.target.value,
                            })
                          }
                          placeholder="Apartment, suite, etc."
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Address Line 3</FormLabel>
                        <Input
                          value={formData.addressLine3}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              addressLine3: e.target.value,
                            })
                          }
                          placeholder="Additional address"
                        />
                      </FormControl>
                      <SimpleGrid columns={2} spacing={4}>
                        <FormControl isRequired>
                          <FormLabel>City</FormLabel>
                          <Input
                            value={formData.city}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                city: e.target.value,
                              })
                            }
                            placeholder="City"
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>State/Province</FormLabel>
                          <Input
                            value={formData.state}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                state: e.target.value,
                              })
                            }
                            placeholder="State"
                          />
                        </FormControl>
                        <FormControl isRequired>
                          <FormLabel>Postal Code</FormLabel>
                          <Input
                            value={formData.postalCode}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                postalCode: e.target.value,
                              })
                            }
                            placeholder="ZIP/Postal code"
                          />
                        </FormControl>
                        <FormControl isRequired>
                          <FormLabel>Country</FormLabel>
                          <Select
                            value={formData.country}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                country: e.target.value,
                                countryCode: e.target.value,
                              })
                            }
                          >
                            <option value="US">United States</option>
                            <option value="IN">India</option>
                            <option value="GB">United Kingdom</option>
                            <option value="CA">Canada</option>
                            <option value="AU">Australia</option>
                            <option value="DE">Germany</option>
                            <option value="FR">France</option>
                            <option value="JP">Japan</option>
                            <option value="SG">Singapore</option>
                            <option value="AE">UAE</option>
                          </Select>
                        </FormControl>
                      </SimpleGrid>
                    </SimpleGrid>
                  </VStack>
                </TabPanel>

                {/* Tab 4: Billing & Payment */}
                <TabPanel>
                  <VStack spacing={4} align="stretch">
                    <Heading size="sm" mb={2}>
                      Billing Settings
                    </Heading>
                    <SimpleGrid columns={2} spacing={4}>
                      <FormControl>
                        <FormLabel>Billing Class</FormLabel>
                        <Select
                          placeholder="Select class"
                          value={formData.billingClass}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              billingClass: e.target.value,
                            })
                          }
                        >
                          <option value="paihk">pai HK</option>
                          <option value="paiusa">pai USA</option>
                        </Select>
                      </FormControl>
                      <FormControl>
                        <FormLabel>Billing Type</FormLabel>
                        <Select
                          value={formData.billingType}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              billingType: e.target.value,
                            })
                          }
                        >
                          <option value="prepaid">Prepaid</option>
                          <option value="postpaid">Postpaid</option>
                        </Select>
                      </FormControl>
                      <FormControl>
                        <FormLabel>Billing Timezone</FormLabel>
                        <Select
                          value={formData.billingTimezone}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              billingTimezone: e.target.value,
                            })
                          }
                        >
                          <option value="UTC">UTC</option>
                          <option value="EST">EST</option>
                          <option value="PST">PST</option>
                          <option value="IST">IST</option>
                          <option value="GMT">GMT</option>
                        </Select>
                      </FormControl>
                      <FormControl isRequired>
                        <FormLabel>Billing Start Date</FormLabel>
                        <Input
                          type="date"
                          value={formData.billingStartDate}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              billingStartDate: e.target.value,
                            })
                          }
                        />
                      </FormControl>
                      <FormControl isRequired>
                        <FormLabel>Billing Cycle</FormLabel>
                        <Select
                          value={formData.billingCycle}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              billingCycle: e.target.value,
                            })
                          }
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="annually">Annually</option>
                        </Select>
                      </FormControl>
                      <FormControl>
                        <FormLabel>Last Billing Date</FormLabel>
                        <Input
                          type="date"
                          value={formData.lastbillingdate || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              lastbillingdate: e.target.value,
                            })
                          }
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Next Billing Date</FormLabel>
                        <Input
                          type="date"
                          value={formData.nextbillingdate || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              nextbillingdate: e.target.value,
                            })
                          }
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel>Credit Limit ($)</FormLabel>
                        <NumberInput
                          value={formData.creditLimit}
                          onChange={(value) =>
                            setFormData({
                              ...formData,
                              creditLimit: parseFloat(value),
                            })
                          }
                          min={0}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      </FormControl>
                    </SimpleGrid>

                    <Heading size="sm" mb={2} mt={4}>
                      Payment Settings
                    </Heading>
                    <SimpleGrid columns={2} spacing={4}>
                      <FormControl>
                        <FormLabel>Send Invoice Email</FormLabel>
                        <Select
                          value={formData.sendInvoiceEmail}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              sendInvoiceEmail: e.target.value === "true",
                            })
                          }
                        >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </Select>
                      </FormControl>
                    </SimpleGrid>
                  </VStack>
                </TabPanel>

                {/* Tab 6: Usage Statistics (only for editing) */}
                {selectedCustomer && cdrStats && (
                  <TabPanel>
                    <VStack spacing={4} align="stretch">
                      <Heading size="sm" mb={2}>
                        Account Usage Statistics
                      </Heading>
                      <SimpleGrid columns={3} spacing={4}>
                        <Box
                          p={4}
                          bg="blue.50"
                          borderRadius="md"
                          textAlign="center"
                        >
                          <Text
                            fontSize="sm"
                            color="blue.600"
                            fontWeight="medium"
                          >
                            Total Calls
                          </Text>
                          <Text fontSize="2xl" fontWeight="bold">
                            {cdrStats.totalCalls}
                          </Text>
                          <Text fontSize="xs" color="gray.600">
                            All time
                          </Text>
                        </Box>
                        <Box
                          p={4}
                          bg="green.50"
                          borderRadius="md"
                          textAlign="center"
                        >
                          <Text
                            fontSize="sm"
                            color="green.600"
                            fontWeight="medium"
                          >
                            Total Revenue
                          </Text>
                          <Text fontSize="2xl" fontWeight="bold">
                            ${(cdrStats.totalRevenue || 0).toFixed(2)}
                          </Text>
                          <Text fontSize="xs" color="gray.600">
                            Generated
                          </Text>
                        </Box>
                        <Box
                          p={4}
                          bg="purple.50"
                          borderRadius="md"
                          textAlign="center"
                        >
                          <Text
                            fontSize="sm"
                            color="purple.600"
                            fontWeight="medium"
                          >
                            Success Rate
                          </Text>
                          <Text fontSize="2xl" fontWeight="bold">
                            {cdrStats.totalCalls > 0
                              ? (
                                (cdrStats.answeredCalls /
                                  cdrStats.totalCalls) *
                                100
                              ).toFixed(1)
                              : "0.0"}
                            %
                          </Text>
                          <Text fontSize="xs" color="gray.600">
                            Answered calls
                          </Text>
                        </Box>
                        <Box
                          p={4}
                          bg="orange.50"
                          borderRadius="md"
                          textAlign="center"
                        >
                          <Text
                            fontSize="sm"
                            color="orange.600"
                            fontWeight="medium"
                          >
                            Total Duration
                          </Text>
                          <Text fontSize="2xl" fontWeight="bold">
                            {Math.floor(
                              (cdrStats.totalDuration || 0) / 3600,
                            )}
                            h{" "}
                            {Math.floor(
                              ((cdrStats.totalDuration || 0) % 3600) / 60,
                            )}
                            m
                          </Text>
                          <Text fontSize="xs" color="gray.600">
                            Call time
                          </Text>
                        </Box>
                        <Box
                          p={4}
                          bg="red.50"
                          borderRadius="md"
                          textAlign="center"
                        >
                          <Text
                            fontSize="sm"
                            color="red.600"
                            fontWeight="medium"
                          >
                            Total Tax
                          </Text>
                          <Text fontSize="2xl" fontWeight="bold">
                            ${(cdrStats.totalTax || 0).toFixed(2)}
                          </Text>
                          <Text fontSize="xs" color="gray.600">
                            Collected
                          </Text>
                        </Box>
                        <Box
                          p={4}
                          bg="teal.50"
                          borderRadius="md"
                          textAlign="center"
                        >
                          <Text
                            fontSize="sm"
                            color="teal.600"
                            fontWeight="medium"
                          >
                            Avg Call Duration
                          </Text>
                          <Text fontSize="2xl" fontWeight="bold">
                            {cdrStats.totalCalls > 0
                              ? Math.floor(
                                cdrStats.totalDuration /
                                cdrStats.totalCalls,
                              )
                              : 0}
                            s
                          </Text>
                          <Text fontSize="xs" color="gray.600">
                            Per call
                          </Text>
                        </Box>
                      </SimpleGrid>
                    </VStack>
                  </TabPanel>
                )}
              </TabPanels>
            </Tabs>
          </VStack>
        </ModalBody>

        {/* Sticky Footer */}
        <ModalFooter
          borderBottomRadius={"8px"}
          position="sticky"
          bottom={0}
          bg="white"
          borderTop="1px"
          borderColor="gray.200"
          py={4}
        >
          <HStack spacing={3} width="100%" justify="space-between">
            <Box>
              {selectedCustomer && (
                <Text fontSize="sm" color="gray.600">
                  Last updated:{" "}
                  {new Date(
                    selectedCustomer.updatedAt,
                  ).toLocaleDateString()}
                </Text>
              )}
            </Box>
            <HStack>
              <Button
                variant="outline"
                onClick={onClose}
                isDisabled={loading}
              >
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleSave}
                isLoading={loading}
                leftIcon={<FiUser />}
              >
                {selectedCustomer ? "Update Account" : "Create Account"}
              </Button>
            </HStack>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CreateAccountModal;
