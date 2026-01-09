// import React, { useState, useCallback, useRef } from 'react';
// import {
//   Box,
//   Container,
//   Heading,
//   Text,
//   VStack,
//   HStack,
//   Card,
//   CardBody,
//   Button,
//   Progress,
//   Alert,
//   AlertIcon,
//   AlertTitle,
//   AlertDescription,
//   SimpleGrid,
//   Stat,
//   StatLabel,
//   StatNumber,
//   StatHelpText,
//   Badge,
//   Icon,
//   useToast,
// } from '@chakra-ui/react';
// import { FiUpload, FiFile, FiCheck, FiAlertCircle, FiDatabase } from 'react-icons/fi';
// import Papa from 'papaparse';
// import { useDropzone } from 'react-dropzone';
// // import CDRProcessor from '../utils/cdrProcessor';

// const CDRUpload = () => {
//   const [file, setFile] = useState(null);
//   const [processing, setProcessing] = useState(false);
//   const [progress, setProgress] = useState(0);
//   const [results, setResults] = useState(null);
//   const [cdrs, setCdrs] = useState([]);
//   const toast = useToast();

//   const onDrop = useCallback((acceptedFiles) => {
//     const csvFile = acceptedFiles[0];
//     if (csvFile && csvFile.type === 'text/csv') {
//       setFile(csvFile);
//       parseCSV(csvFile);
//     } else {
//       toast({
//         title: 'Invalid file',
//         description: 'Please upload a CSV file',
//         status: 'error',
//         duration: 3000,
//         isClosable: true,
//       });
//     }
//   }, [toast]);

//   const { getRootProps, getInputProps, isDragActive } = useDropzone({
//     onDrop,
//     accept: {
//       'text/csv': ['.csv']
//     },
//     maxFiles: 1,
//   });

//   const parseCSV = (file) => {
//     setProcessing(true);
//     setProgress(10);

//     Papa.parse(file, {
//       header: true,
//       skipEmptyLines: true,
//       complete: (results) => {
//         setProgress(60);
        
//         if (results.data.length === 0) {
//           toast({
//             title: 'Empty file',
//             description: 'The CSV file contains no data',
//             status: 'warning',
//             duration: 3000,
//             isClosable: true,
//           });
//           setProcessing(false);
//           return;
//         }

//         // Process the CDRs
//         setTimeout(() => {
//           const processedResults = CDRProcessor.processRawCDRs(results.data);
//           setCdrs(processedResults.processedCDRs);
//           setResults(processedResults);
//           setProgress(100);
//           setProcessing(false);
//            console.log("Processed CDRs:", processedResults.processedCDRs);
//           toast({
//             title: 'File processed successfully',
//             description: `Processed ${processedResults.processedCDRs.length} CDRs`,
//             status: 'success',
//             duration: 3000,
//             isClosable: true,
//           });
//         }, 1000);
//       },
//       error: (error) => {
//         setProcessing(false);
//         toast({
//           title: 'Error parsing CSV',
//           description: error.message,
//           status: 'error',
//           duration: 3000,
//           isClosable: true,
//         });
//       }
//     });
//   };

//   const hasSavedRef = useRef(false);

// const handleUpload = () => {
//   if (!results) return;

//   setProcessing(true);
//   setProgress(0);
//   hasSavedRef.current = false;

//   const interval = setInterval(() => {
//     setProgress((prev) => {
//       if (prev >= 100) {
//         clearInterval(interval);

//         if (!hasSavedRef.current) {
//           hasSavedRef.current = true;

//           const existingCDRs = JSON.parse(localStorage.getItem('cdrs') || '[]');
//           const allCDRs = [...existingCDRs, ...cdrs];
//           localStorage.setItem('cdrs', JSON.stringify(allCDRs));

//           const customers = CDRProcessor.extractCustomers(cdrs);
//           const existingCustomers = JSON.parse(localStorage.getItem('customers') || '[]');
//           const updatedCustomers = [...existingCustomers, ...customers];
//           localStorage.setItem('customers', JSON.stringify(updatedCustomers));

//           setProcessing(false);

//           toast({
//             title: 'CDRs uploaded successfully',
//             description: `${cdrs.length} CDRs have been saved to the system`,
//             status: 'success',
//             duration: 4000,
//             isClosable: true,
//           });

//           setFile(null);
//           setResults(null);
//           setCdrs([]);
//         }

//         return 100;
//       }
//       return prev + 10;
//     });
//   }, 200);
// };

//   const calculateStats = () => {
//     if (!results) return null;

//     const totalCalls = results.processedCDRs.length;
//     const answeredCalls = results.processedCDRs.filter(c => c.status === 'ANSWERED').length;
//     const totalDuration = results.processedCDRs.reduce((sum, c) => sum + (c.duration || 0), 0);
//     const totalRevenue = results.processedCDRs.reduce((sum, c) => sum + (c.fee || 0), 0);
//     const uniqueCustomers = new Set(results.processedCDRs.map(c => c.customer_id)).size;

//     return {
//       totalCalls,
//       answeredCalls,
//       totalDuration,
//       totalRevenue,
//       uniqueCustomers,
//       successRate: totalCalls > 0 ? (answeredCalls / totalCalls * 100).toFixed(1) : 0,
//     };
//   };

//   const stats = calculateStats();

//   return (
//     <Container maxW="container.xl" py={2}>
//       <VStack spacing={8} align="stretch">
//         <Box>
//           <Heading size="lg" mb={2}>Upload CDR CSV</Heading>
//           <Text color="gray.600">
//             Upload your raw CDR CSV file to process and generate billing information
//           </Text>
//         </Box>

//         {/* Upload Zone */}
//         <Card>
//           <CardBody>
//             <Box
//               {...getRootProps()}
//               border="2px dashed"
//               borderColor={isDragActive ? 'brand.500' : 'gray.300'}
//               borderRadius="lg"
//               p={8}
//               textAlign="center"
//               cursor="pointer"
//               transition="all 0.2s"
//               _hover={{ borderColor: 'brand.500', bg: 'brand.50' }}
//             >
//               <input {...getInputProps()} />
//               <VStack spacing={4}>
//                 <Icon as={FiUpload} w={12} h={12} color="gray.400" />
//                 {isDragActive ? (
//                   <Text fontSize="lg" color="brand.500">
//                     Drop the CSV file here...
//                   </Text>
//                 ) : (
//                   <>
//                     <Text fontSize="lg" fontWeight="medium">
//                       Drag & drop your CDR CSV file here
//                     </Text>
//                     <Text color="gray.500">or click to browse</Text>
//                     <Text fontSize="sm" color="gray.400">
//                       Supports CSV files with the exact header structure
//                     </Text>
//                   </>
//                 )}
//               </VStack>
//             </Box>

//             {file && (
//               <Box mt={6} p={4} bg="gray.50" borderRadius="md">
//                 <HStack>
//                   <Icon as={FiFile} color="brand.500" />
//                   <Box flex="1">
//                     <Text fontWeight="medium">{file.name}</Text>
//                     <Text fontSize="sm" color="gray.600">
//                       {(file.size/1024/1024).toFixed(4)} MB
//                     </Text>
//                   </Box>
//                   <Button
//                     size="sm"
//                     variant="ghost"
//                     colorScheme="red"
//                     onClick={() => {
//                       setFile(null);
//                       setResults(null);
//                       setCdrs([]);
//                     }}
//                   >
//                     Remove
//                   </Button>
//                 </HStack>
//               </Box>
//             )}

//             {processing && (
//               <Box mt={6}>
//                 <Text mb={2}>Processing file...</Text>
//                 <Progress value={progress} size="sm" colorScheme="brand" borderRadius="full" />
//               </Box>
//             )}
//           </CardBody>
//         </Card>

//         {/* Results */}
//         {results && (
//           <>
//             <Card>
//               <CardBody>
//                 <Heading size="md" mb={6}>Processing Results</Heading>
                
//                 {results.errors.length > 0 && (
//                   <Alert status="warning" mb={6} borderRadius="md">
//                     <AlertIcon />
//                     <Box>
//                       <AlertTitle>{results.errors.length} errors found</AlertTitle>
//                       <AlertDescription>
//                         Some CDRs could not be processed. Check the error log for details.
//                       </AlertDescription>
//                     </Box>
//                   </Alert>
//                 )}

//                 <SimpleGrid columns={{ base: 1, md: 3, lg: 5 }} spacing={6} mb={6}>
//                   <StatCard
//                     title="Total CDRs"
//                     value={stats.totalCalls}
//                     helpText="CDRs processed"
//                     color="blue"
//                   />
//                   <StatCard
//                     title="Answered Calls"
//                     value={stats.answeredCalls}
//                     helpText={`${stats.successRate}% success rate`}
//                     color="green"
//                   />
//                   <StatCard
//                     title="Total Duration"
//                     value={`${Math.floor(stats.totalDuration / 60)}m`}
//                     helpText="Call minutes"
//                     color="purple"
//                   />
//                   <StatCard
//                     title="Total Revenue"
//                     value={`$${stats.totalRevenue.toFixed(2)}`}
//                     helpText="Estimated revenue"
//                     color="orange"
//                   />
//                   <StatCard
//                     title="Unique Customers"
//                     value={stats.uniqueCustomers}
//                     helpText="Customers found"
//                     color="teal"
//                   />
//                 </SimpleGrid>

//                 <HStack justify="space-between">
//                   <VStack align="start" spacing={2}>
//                     <Text fontWeight="medium">Processing Summary</Text>
//                     <HStack spacing={4}>
//                       <Badge colorScheme="green" px={2} borderRadius={"5px"} py={1}>
//                         <HStack spacing={1}>
//                           <Icon as={FiCheck} />
//                           <Text>{results.processedCDRs.length} Processed</Text>
//                         </HStack>
//                       </Badge>
//                       {results.errors.length > 0 && (
//                         <Badge colorScheme="red" px={2} borderRadius={"5px"} py={1}>
//                           <HStack spacing={1}>
//                             <Icon as={FiAlertCircle} />
//                             <Text>{results.errors.length} Errors</Text>
//                           </HStack>
//                         </Badge>
//                       )}
//                     </HStack>
//                   </VStack>

//                   <Button
//                     colorScheme="brand"
//                     size="md"
//                     leftIcon={<FiDatabase/>}
//                     onClick={handleUpload}
//                     isLoading={processing}
//                     loadingText="Uploading..."
//                   >
//                     Save to Database
//                   </Button>
//                 </HStack>
//               </CardBody>
//             </Card>

//             {/* Sample Data Preview */}
//             {cdrs.length > 0 && (
//               <Card>
//                 <CardBody>
//                   <Heading size="md" mb={4}>Preview Processed Data</Heading>
//                   <Box overflowX="auto">
//                     <table style={{ width: '100%', borderCollapse: 'collapse' }}>
//                       <thead>
//                         <tr style={{ backgroundColor: '#f7fafc' }}>
//                           <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Flow No</th>
//                           <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Caller</th>
//                           <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Callee</th>
//                           <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Start Time</th>
//                           <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>End Time</th>
//                           <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Duration</th>
//                           <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Type</th>
//                           <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Status</th>
//                           <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Amount</th>
//                         </tr>
//                       </thead>
//                       <tbody>
//                         {cdrs.slice(0, 10).map((cdr, index) => (
//                           <tr key={index} style={{ borderBottom: '1px solid #edf2f7' }}>
//                             <td style={{ padding: '12px' }}>{cdr.flowno.substring(0, 12)}...</td>
//                             <td style={{ padding: '12px' }}>{cdr.callere164}</td>
//                             <td style={{ padding: '12px' }}>{cdr.calleee164}</td>
//                             <td style={{ padding: '12px' }}>
//                               {new Date(cdr.starttime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
//                             </td>
//                             <td style={{ padding: '12px' }}>
//                               {new Date(cdr.stoptime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
//                             </td>
//                             <td style={{ padding: '12px' }}>{cdr.duration}s</td>
//                             <td style={{ padding: '12px' }}>
//                               <Badge colorScheme={cdr.call_type === 'INTERNATIONAL' ? 'orange' : 'blue'}>
//                                 {cdr.call_type}
//                               </Badge>
//                             </td>
//                             <td style={{ padding: '12px' }}>
//                               <Badge colorScheme={cdr.status === 'ANSWERED' ? 'green' : 'red'}>
//                                 {cdr.status}
//                               </Badge>
//                             </td>
//                             <td style={{ padding: '12px', fontWeight: 'bold', color: '#38a169' }}>
//                               ${cdr.fee ? parseFloat(cdr.fee).toFixed(4) : '0.0000'}
//                             </td>
//                           </tr>
//                         ))}
//                       </tbody>
//                     </table>
//                     {cdrs.length > 10 && (
//                       <Text mt={4} color="gray.500" textAlign="center">
//                         Showing 10 of {cdrs.length} records
//                       </Text>
//                     )}
//                   </Box>
//                 </CardBody>
//               </Card>
//             )}
//           </>
//         )}
//       </VStack>
//     </Container>
//   );
// };

// const StatCard = ({ title, value, helpText, color }) => {
//   const colorMap = {
//     blue: 'brand.500',
//     green: 'green.500',
//     purple: 'purple.500',
//     orange: 'orange.500',
//     teal: 'teal.500'
//   };

//   return (
//     <Stat
//       px={4}
//       py={5}
//       bg="white"
//       border="1px"
//       borderColor="gray.200"
//       borderRadius="lg"
//       boxShadow="sm"
//     >
//       <StatLabel fontSize="sm" color="gray.600">{title}</StatLabel>
//       <StatNumber fontSize="2xl" color={colorMap[color]}>{value}</StatNumber>
//       <StatHelpText fontSize="xs">{helpText}</StatHelpText>
//     </Stat>
//   );
// };

// export default CDRUpload;



import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Heading,
  VStack,
  Text,
  Button,
  useToast,
  Card,
  CardBody,
  Progress,
  Icon,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  HStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
} from '@chakra-ui/react';
import { FiUpload, FiFileText, FiCheck, FiX, FiAlertTriangle } from 'react-icons/fi';
import { useDropzone } from 'react-dropzone';
import { parseCDRFile, validateCDRs, calculateCDRCharges } from '../utils/cdrParser';
import { fetchCustomers, bulkCreateCDRs } from '../utils/api';

const CDRUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsedData, setParsedData] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const toast = useToast();

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // Parse CSV file
      const data = await parseCDRFile(file);
      clearInterval(progressInterval);
      setUploadProgress(100);

      // Validate data
      const customers = await fetchCustomers();
      const validatedData = validateCDRs(data);
      
      // Calculate charges for each CDR
      const processedData = validatedData.map(cdr => {
        const customer = customers.find(c => c.id === cdr.customer_id);
        return calculateCDRCharges(cdr, customer);
      });

      // Analyze validation results
      const validRecords = processedData.filter(r => !r.errors);
      const invalidRecords = processedData.filter(r => r.errors);
      
      setParsedData(processedData);
      setValidationResults({
        total: processedData.length,
        valid: validRecords.length,
        invalid: invalidRecords.length,
        errors: invalidRecords.slice(0, 10), // Show first 10 errors
        estimatedRevenue: validRecords.reduce((sum, r) => sum + (r.fee || 0), 0),
        estimatedTax: validRecords.reduce((sum, r) => sum + (r.tax || 0), 0),
      });

      toast({
        title: 'File parsed successfully',
        description: `Found ${processedData.length} records`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

    } catch (error) {
      toast({
        title: 'Error parsing file',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv']
    },
    multiple: false,
  });

  const handleSaveToDatabase = async () => {
    if (!parsedData || parsedData.length === 0) return;

    setUploading(true);
    try {
      const validRecords = parsedData.filter(r => !r.errors);
      
      console.log('Sending CDRs to database:', validRecords.length);
      console.log('First record:', validRecords[0]);
      
      const result = await bulkCreateCDRs(validRecords);
      
      console.log('Upload result:', result);

      toast({
        title: 'CDRs saved successfully',
        description: `${validRecords.length} records added to database`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setParsedData(null);
      setValidationResults(null);

    } catch (error) {
      console.error('Error saving CDRs:', error);
      
      toast({
        title: 'Error saving CDRs',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClearData = () => {
    setParsedData(null);
    setValidationResults(null);
  };

  return (
    <Container maxW="container.xl" py={2}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Upload CDR File</Heading>
          <Text color="gray.600">
            Upload CSV files containing Call Detail Records for processing and billing
          </Text>
        </Box>

        {/* Upload Area */}
        <Card>
          <CardBody>
            <Box
              {...getRootProps()}
              border="2px dashed"
              borderColor={isDragActive ? 'blue.500' : 'gray.300'}
              borderRadius="lg"
              p={10}
              textAlign="center"
              cursor="pointer"
              transition="all 0.2s"
              _hover={{ borderColor: 'blue.400', bg: 'blue.50' }}
              bg={isDragActive ? 'blue.50' : 'transparent'}
            >
              <input {...getInputProps()} />
              <Icon as={FiUpload} w={12} h={12} color="blue.500" mb={4} />
              <Heading size="md" mb={2}>
                {isDragActive ? 'Drop the file here' : 'Drag & drop CDR file here'}
              </Heading>
              <Text color="gray.600" mb={4}>
                or click to select a CSV file
              </Text>
              <Text fontSize="sm" color="gray.500">
                Supports .csv files only
              </Text>
            </Box>

            {uploading && (
              <Box mt={6}>
                <Text mb={2}>Processing file...</Text>
                <Progress value={uploadProgress} size="sm" colorScheme="blue" borderRadius="full" />
              </Box>
            )}
          </CardBody>
        </Card>

        {/* Validation Results */}
        {validationResults && (
          <Card>
            <CardBody>
              <Heading size="md" mb={6}>Validation Results</Heading>
              
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
                <Card variant="outline">
                  <CardBody>
                    <Stat>
                      <StatLabel>Total Records</StatLabel>
                      <StatNumber>{validationResults.total}</StatNumber>
                      <StatHelpText>
                        <Icon as={FiFileText} mr={1} />
                        CDR records found
                      </StatHelpText>
                    </Stat>
                  </CardBody>
                </Card>

                <Card variant="outline">
                  <CardBody>
                    <Stat>
                      <StatLabel>Valid Records</StatLabel>
                      <StatNumber color="green.600">{validationResults.valid}</StatNumber>
                      <StatHelpText>
                        <Icon as={FiCheck} mr={1} />
                        Ready for import
                      </StatHelpText>
                    </Stat>
                  </CardBody>
                </Card>

                <Card variant="outline">
                  <CardBody>
                    <Stat>
                      <StatLabel>Invalid Records</StatLabel>
                      <StatNumber color="red.600">{validationResults.invalid}</StatNumber>
                      <StatHelpText>
                        <Icon as={FiX} mr={1} />
                        Require attention
                      </StatHelpText>
                    </Stat>
                  </CardBody>
                </Card>
              </SimpleGrid>

              {/* Revenue Estimation */}
              {validationResults.valid > 0 && (
                <Alert status="info" variant="subtle" mb={6}>
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Estimated Revenue</AlertTitle>
                    <AlertDescription>
                      This upload will generate approximately ${validationResults.estimatedRevenue.toFixed(2)} 
                      in fees and ${validationResults.estimatedTax.toFixed(2)} in taxes.
                    </AlertDescription>
                  </Box>
                </Alert>
              )}

              {/* Error Details */}
              {validationResults.invalid > 0 && (
                <Box mb={6}>
                  <Heading size="sm" mb={4} color="red.600">
                    <Icon as={FiAlertTriangle} mr={2} />
                    Validation Errors ({validationResults.errors.length} shown)
                  </Heading>
                  <Box overflowX="auto">
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Row</Th>
                          <Th>Caller</Th>
                          <Th>Callee</Th>
                          <Th>Errors</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {validationResults.errors.map((record, index) => (
                          <Tr key={index}>
                            <Td>Row {index + 1}</Td>
                            <Td>{record.callere164}</Td>
                            <Td>{record.calleee164}</Td>
                            <Td>
                              <VStack align="start" spacing={1}>
                                {record.errors?.map((error, i) => (
                                  <Badge key={i} colorScheme="red" variant="solid" size="sm">
                                    {error}
                                  </Badge>
                                ))}
                              </VStack>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                </Box>
              )}

              {/* Action Buttons */}
              <HStack spacing={4} justify="flex-end">
                <Button
                  variant="outline"
                  onClick={handleClearData}
                  isDisabled={uploading}
                >
                  Clear Data
                </Button>
                <Button
                  colorScheme="blue"
                  onClick={handleSaveToDatabase}
                  isDisabled={validationResults.valid === 0 || uploading}
                  leftIcon={<FiCheck />}
                >
                  Import {validationResults.valid} Valid Records
                </Button>
              </HStack>
            </CardBody>
          </Card>
        )}


      </VStack>
    </Container>
  );
};

export default CDRUpload;