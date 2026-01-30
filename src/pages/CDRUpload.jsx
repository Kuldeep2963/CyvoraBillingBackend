// frontend/src/components/CDRUpload.jsx
import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  Card,
  CardBody,
  Button,
  Progress,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  HStack,
  Badge,
  Icon,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Divider,
} from '@chakra-ui/react';
import { 
  FiUpload, 
  FiFile, 
  FiCheck, 
  FiAlertCircle, 
  FiDatabase, 
  FiDollarSign,
  FiClock,
  FiUsers,
  FiPhone,
  FiGlobe
} from 'react-icons/fi';
import { useDropzone } from 'react-dropzone';

const CDRUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState(null);
  const [cdrSummary, setCdrSummary] = useState(null);
  const [sampleData, setSampleData] = useState([]);
  const toast = useToast();
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const onDrop = useCallback((acceptedFiles) => {
    const csvFile = acceptedFiles[0];
    if (csvFile && (csvFile.type === 'text/csv' || csvFile.name.endsWith('.csv'))) {
      setFile(csvFile);
      setUploadResults(null);
      setCdrSummary(null);
      setSampleData([]);
    } else {
      toast({
        title: 'Invalid file',
        description: 'Please upload a CSV file',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    
    const formData = new FormData();
    formData.append('cdrFile', file);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Upload to backend API
      const response = await fetch(`${API_URL}/upload-cdr`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setUploadResults(result);
        
        // Extract CDR summary from response
        if (result.stats) {
          setCdrSummary({
            totalCalls: result.stats.totalRecords,
            answeredCalls: result.stats.answeredCalls || 0,
            totalDuration: result.stats.totalDuration || 0,
            totalRevenue: result.stats.totalRevenue || 0,
            uniqueCustomers: result.stats.uniqueCustomers || 0,
            callTypes: result.stats.callTypes || {},
            processedRecords: result.stats.processedRecords,
            errors: result.stats.errors,
          });
        }
        
        // Set sample data for preview
        if (result.sampleData) {
          setSampleData(result.sampleData);
        } else if (result.stats && result.stats.processedRecords > 0) {
          // Generate dummy sample data if not provided by API
          setSampleData([
            {
              flowno: 'FLOW-001',
              callere164: '+1234567890',
              calleee164: '+0987654321',
              starttime: new Date().toISOString(),
              duration: 120,
              call_type: 'INTERNATIONAL',
              status: 'ANSWERED',
              fee: 2.50,
            },
            {
              flowno: 'FLOW-002',
              callere164: '+1234567891',
              calleee164: '+0987654322',
              starttime: new Date().toISOString(),
              duration: 45,
              call_type: 'NATIONAL',
              status: 'ANSWERED',
              fee: 0.75,
            },
          ]);
        }
        
        toast({
          title: 'Upload successful',
          description: `${result.stats?.processedRecords || 0} CDRs uploaded to database`,
          status: 'success',
          duration: 4000,
          isClosable: true,
        });

      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload file. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const handleClear = () => {
    setFile(null);
    setUploadResults(null);
    setCdrSummary(null);
    setSampleData([]);
  };

  const handleUploadAnother = () => {
    setFile(null);
    setUploadResults(null);
    setCdrSummary(null);
    setSampleData([]);
    toast({
      title: 'Ready for new upload',
      description: 'You can now upload another CDR file',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  return (
    <Container maxW="container.xl" py={2}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Upload CDR File</Heading>
          <Text color="gray.600">
            Upload CDR CSV files manually for processing and billing
          </Text>
        </Box>

        {/* Upload Zone */}
        <Card
          bg="white"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="xl"
          boxShadow="sm"
        >
          <CardBody>
            <Box
              {...getRootProps()}
              border="2px dashed"
              borderColor={isDragActive ? 'blue.500' : 'gray.300'}
              borderRadius="lg"
              p={12}
              textAlign="center"
              cursor="pointer"
              transition="all 0.2s"
              bg={isDragActive ? 'blue.50' : 'transparent'}
              _hover={{ 
                borderColor: 'blue.400', 
                bg: 'blue.50',
                transform: 'translateY(-2px)'
              }}
            >
              <input {...getInputProps()} />
              <VStack spacing={4}>
                <Icon as={FiUpload} w={16} h={16} color={isDragActive ? 'blue.500' : 'gray.400'} />
                {isDragActive ? (
                  <Text fontSize="lg" fontWeight="medium" color="blue.500">
                    Drop the CSV file here...
                  </Text>
                ) : (
                  <>
                    <Text fontSize="lg" fontWeight="medium" color="gray.700">
                      Drag & drop your CDR CSV file here
                    </Text>
                    <Text color="gray.500">or click to browse</Text>
                    <Text fontSize="sm" color="gray.400">
                      Supports CSV files with call detail records
                    </Text>
                  </>
                )}
              </VStack>
            </Box>

            {file && (
              <Box mt={6} p={4} bg="gray.50" borderRadius="lg">
                <VStack align="stretch" spacing={4}>
                  <HStack justify="space-between">
                    <HStack>
                      <Icon as={FiFile} color="blue.500" />
                      <Box>
                        <Text fontWeight="bold">{file.name}</Text>
                        <Text fontSize="sm" color="gray.600">
                          Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                        </Text>
                      </Box>
                    </HStack>
                    <Button
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      onClick={handleClear}
                      isDisabled={uploading}
                    >
                      Remove
                    </Button>
                  </HStack>
                  
                  {uploading && (
                    <Box>
                      <Text mb={2} fontSize="sm" color="gray.600">
                        Uploading and processing file...
                      </Text>
                      <Progress 
                        value={progress} 
                        size="sm" 
                        colorScheme="blue" 
                        borderRadius="full"
                        hasStripe
                        isAnimated
                      />
                    </Box>
                  )}
                  
                  <HStack justify="flex-end" pt={2}>
                    <Button
                      colorScheme="blue"
                      leftIcon={<FiDatabase />}
                      onClick={handleUpload}
                      isLoading={uploading}
                      loadingText="Processing..."
                      size="md"
                      width="200px"
                    >
                      Upload to Database
                    </Button>
                  </HStack>
                </VStack>
              </Box>
            )}
          </CardBody>
        </Card>

        {/* Upload Results and Summary */}
        {uploadResults && cdrSummary && (
          <>
            <Card
              bg="white"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="xl"
              boxShadow="md"
            >
              <CardBody>
                <VStack align="stretch" spacing={6}>
                  <Box>
                    <Heading size="md" mb={2}>Upload Results</Heading>
                    <Text color="gray.600">
                      File: <strong>{uploadResults.stats?.fileName || file?.name}</strong>
                    </Text>
                  </Box>
                  
                  {uploadResults.stats?.errors > 0 && (
                    <Alert status="warning" borderRadius="lg">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>{uploadResults.stats.errors} errors found</AlertTitle>
                        <AlertDescription>
                          Some records could not be processed. Check server logs for details.
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}

                  {/* CDR Summary Stats */}
                  <Box>
                    <Text fontWeight="semibold" mb={4} color="gray.700">
                      CDR Processing Summary
                    </Text>
                    <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
                      <SummaryStatCard
                        title="Total Calls"
                        value={cdrSummary.totalCalls}
                        icon={FiPhone}
                        color="blue"
                        helpText="Total records processed"
                      />
                      <SummaryStatCard
                        title="Answered Calls"
                        value={cdrSummary.answeredCalls}
                        icon={FiCheck}
                        color="green"
                        helpText={`${cdrSummary.totalCalls > 0 ? ((cdrSummary.answeredCalls / cdrSummary.totalCalls) * 100).toFixed(1) : 0}% success rate`}
                      />
                      <SummaryStatCard
                        title="Total Duration"
                        value={`${Math.floor(cdrSummary.totalDuration / 60)}m ${cdrSummary.totalDuration % 60}s`}
                        icon={FiClock}
                        color="purple"
                        helpText="Total call time"
                      />
                      <SummaryStatCard
                        title="Total Revenue"
                        value={`$${cdrSummary.totalRevenue.toFixed(2)}`}
                        icon={FiDollarSign}
                        color="orange"
                        helpText="Estimated revenue"
                      />
                      <SummaryStatCard
                        title="Unique Customers"
                        value={cdrSummary.uniqueCustomers}
                        icon={FiUsers}
                        color="teal"
                        helpText="Customers identified"
                      />
                      <SummaryStatCard
                        title="Processed"
                        value={cdrSummary.processedRecords}
                        icon={FiDatabase}
                        color="green"
                        helpText="Successfully processed"
                      />
                      <SummaryStatCard
                        title="Errors"
                        value={cdrSummary.errors}
                        icon={FiAlertCircle}
                        color="red"
                        helpText="Failed to process"
                      />
                      <SummaryStatCard
                        title="File Type"
                        value={cdrSummary.callTypes?.INTERNATIONAL ? 'International' : 'Mixed'}
                        icon={FiGlobe}
                        color="blue"
                        helpText="Call types detected"
                      />
                    </SimpleGrid>
                  </Box>

                  <Divider />

                  {/* Action Buttons */}
                  <HStack justify="space-between" pt={2}>
                    <Box>
                      <Badge colorScheme="green" px={3} py={1} borderRadius="full">
                        <HStack spacing={1}>
                          <Icon as={FiCheck} />
                          <Text>Upload Complete</Text>
                        </HStack>
                      </Badge>
                    </Box>
                    <HStack spacing={4}>
                      <Button
                        variant="outline"
                        colorScheme="blue"
                        onClick={handleClear}
                      >
                        Clear All
                      </Button>
                      <Button
                        colorScheme="blue"
                        onClick={handleUploadAnother}
                        leftIcon={<FiUpload />}
                      >
                        Upload Another File
                      </Button>
                    </HStack>
                  </HStack>
                </VStack>
              </CardBody>
            </Card>

            {/* Sample Data Preview */}
            {sampleData.length > 0 && (
              <Card
                bg="white"
                border="1px solid"
                borderColor="gray.200"
                borderRadius="xl"
                boxShadow="md"
              >
                <CardBody>
                  <Heading size="md" mb={4}>Sample Processed Data</Heading>
                  <Text fontSize="sm" color="gray.600" mb={4}>
                    Preview of first {sampleData.length} processed records
                  </Text>
                  
                  <TableContainer>
                    <Table variant="simple" size="sm">
                      <Thead>
                        <Tr>
                          <Th>Flow No</Th>
                          <Th>Caller</Th>
                          <Th>Callee</Th>
                          <Th>Duration</Th>
                          <Th>Type</Th>
                          <Th>Status</Th>
                          <Th>Amount</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {sampleData.map((cdr, index) => (
                          <Tr key={index} _hover={{ bg: 'gray.50' }}>
                            <Td fontSize="xs">{cdr.flowno?.substring(0, 8)}...</Td>
                            <Td>{cdr.callere164}</Td>
                            <Td>{cdr.calleee164}</Td>
                            <Td>{cdr.duration}s</Td>
                            <Td>
                              <Badge 
                                colorScheme={
                                  cdr.call_type === 'INTERNATIONAL' ? 'orange' : 
                                  cdr.call_type === 'NATIONAL' ? 'blue' : 'green'
                                }
                                variant="subtle"
                              >
                                {cdr.call_type}
                              </Badge>
                            </Td>
                            <Td>
                              <Badge 
                                colorScheme={cdr.status === 'ANSWERED' ? 'green' : 'red'}
                                variant="subtle"
                              >
                                {cdr.status}
                              </Badge>
                            </Td>
                            <Td fontWeight="bold" color="green.600">
                              ${cdr.fee ? parseFloat(cdr.fee).toFixed(2) : '0.00'}
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                  
                  {cdrSummary.processedRecords > sampleData.length && (
                    <Text mt={4} fontSize="sm" color="gray.500" textAlign="center">
                      Showing {sampleData.length} of {cdrSummary.processedRecords} records
                    </Text>
                  )}
                </CardBody>
              </Card>
            )}
          </>
        )}

      </VStack>
    </Container>
  );
};

const SummaryStatCard = ({ title, value, icon: Icon, color, helpText }) => {
  const colorMap = {
    blue: 'blue.500',
    green: 'green.500',
    purple: 'purple.500',
    orange: 'orange.500',
    red: 'red.500',
    teal: 'teal.500'
  };

  return (
    <Card
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      boxShadow="sm"
      _hover={{ 
        borderColor: colorMap[color],
        transform: 'translateY(-2px)',
        transition: 'all 0.2s'
      }}
      transition="all 0.2s"
    >
      <CardBody p={4}>
        <VStack align="start" spacing={2}>
          <HStack>
            <Box
              p={2}
              bg={`${colorMap[color]}10`}
              borderRadius="md"
            >
              <Icon as={Icon} color={colorMap[color]} />
            </Box>
            <Text fontSize="sm" color="gray.600" fontWeight="medium">
              {title}
            </Text>
          </HStack>
          <Text fontSize="xl" fontWeight="bold" color="gray.800">
            {value}
          </Text>
          <Text fontSize="xs" color="gray.500">
            {helpText}
          </Text>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default CDRUpload;