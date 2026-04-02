import { useState, useRef, useEffect } from "react";
import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Text,
  VStack,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isInRange(date, start, end) {
  if (!start || !end || !date) return false;
  const d = date.getTime();
  const s = start.getTime();
  const e = end.getTime();
  return d > Math.min(s, e) && d < Math.max(s, e);
}

function formatDate(date) {
  if (!date) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function CalendarMonth({ year, month, startDate, endDate, hoverDate, onDayClick, onDayHover }) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const today = new Date();

  const activeBg = useColorModeValue("blue.500", "blue.400");
  const activeColor = "white";
  const inRangeBg = useColorModeValue("blue.50", "blue.900");
  const inRangeColor = useColorModeValue("blue.700", "blue.100");
  const hoverBg = useColorModeValue("gray.100", "gray.700");
  const dayColor = useColorModeValue("gray.800", "gray.100");
  const todayBorderColor = useColorModeValue("blue.400", "blue.300");

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const effectiveEnd = endDate || hoverDate;

  return (
    <Box minW="220px">
      <Text
        textAlign="center"
        fontWeight="600"
        fontSize="sm"
        mb={3}
        color={useColorModeValue("gray.700", "gray.200")}
      >
        {MONTHS[month]} {year}
      </Text>

      <Grid templateColumns="repeat(7, 1fr)" gap={0} mb={1}>
        {DAYS.map((d) => (
          <GridItem key={d} textAlign="center" py={1}>
            <Text fontSize="xs" fontWeight="600" color={useColorModeValue("gray.400", "gray.500")}>
              {d}
            </Text>
          </GridItem>
        ))}
      </Grid>

      <Grid templateColumns="repeat(7, 1fr)" gap={0}>
        {cells.map((date, idx) => {
          if (!date) return <GridItem key={`empty-${idx}`} />;

          const isStart = isSameDay(date, startDate);
          const isEnd = isSameDay(date, endDate);
          const isActive = isStart || isEnd;
          const inRange = isInRange(date, startDate, effectiveEnd);
          const isToday = isSameDay(date, today);

          let bg = "transparent";
          let color = dayColor;
          let borderRadius = "md";

          if (isActive) {
            bg = activeBg;
            color = activeColor;
            borderRadius = "full";
          } else if (inRange) {
            bg = inRangeBg;
            color = inRangeColor;
            borderRadius = "none";
          }

          if (isStart && effectiveEnd && startDate < effectiveEnd) {
            borderRadius = "full";
          }
          if (isEnd) {
            borderRadius = "full";
          }

          return (
            <GridItem key={date.toISOString()} textAlign="center" py="2px" px="1px">
              <Box
                as="button"
                w="100%"
                py={1}
                fontSize="sm"
                bg={bg}
                color={color}
                borderRadius={borderRadius}
                border={isToday && !isActive ? `1.5px solid` : "none"}
                borderColor={todayBorderColor}
                cursor="pointer"
                _hover={{ bg: isActive ? activeBg : hoverBg }}
                transition="background 0.15s"
                onClick={() => onDayClick(date)}
                onMouseEnter={() => onDayHover(date)}
              >
                {date.getDate()}
              </Box>
            </GridItem>
          );
        })}
      </Grid>
    </Box>
  );
}

/**
 * DateRangePicker — reusable Chakra UI component
 *
 * Props:
 *   value       : { startDate: Date|null, endDate: Date|null }
 *   onChange    : (range: { startDate, endDate }) => void
 *   placeholder : string (default: "Select date range")
 *   inputProps  : Chakra InputGroup props
 */
export default function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  inputProps = {},
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [startDate, setStartDate] = useState(value?.startDate || null);
  const [endDate, setEndDate] = useState(value?.endDate || null);
  const [hoverDate, setHoverDate] = useState(null);
  const [selecting, setSelecting] = useState(false);

  const today = new Date();
  const [leftMonth, setLeftMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const rightMonth = {
    year: leftMonth.month === 11 ? leftMonth.year + 1 : leftMonth.year,
    month: leftMonth.month === 11 ? 0 : leftMonth.month + 1,
  };

  const borderColor = useColorModeValue("gray.200", "gray.600");
  const popoverBg = useColorModeValue("white", "gray.800");
  const dividerColor = useColorModeValue("gray.100", "gray.700");

  const displayValue = () => {
    if (startDate && endDate) return `${formatDate(startDate)} – ${formatDate(endDate)}`;
    if (startDate) return `${formatDate(startDate)} – ...`;
    return "";
  };

  const handleDayClick = (date) => {
    if (!selecting || !startDate) {
      setStartDate(date);
      setEndDate(null);
      setSelecting(true);
    } else {
      if (date < startDate) {
        setEndDate(startDate);
        setStartDate(date);
      } else {
        setEndDate(date);
      }
      setSelecting(false);
      onChange?.({ startDate: date < startDate ? date : startDate, endDate: date < startDate ? startDate : date });
      onClose();
    }
  };

  const handleDayHover = (date) => {
    if (selecting) setHoverDate(date);
  };

  const prevMonth = () => {
    setLeftMonth((prev) => ({
      year: prev.month === 0 ? prev.year - 1 : prev.year,
      month: prev.month === 0 ? 11 : prev.month - 1,
    }));
  };

  const nextMonth = () => {
    setLeftMonth((prev) => ({
      year: prev.month === 11 ? prev.year + 1 : prev.year,
      month: prev.month === 11 ? 0 : prev.month + 1,
    }));
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setStartDate(null);
    setEndDate(null);
    setSelecting(false);
    onChange?.({ startDate: null, endDate: null });
  };

  useEffect(() => {
    if (value?.startDate !== undefined) setStartDate(value.startDate);
    if (value?.endDate !== undefined) setEndDate(value.endDate);
  }, [value]);

  return (
    <Popover isOpen={isOpen} onClose={onClose} placement="bottom-start" isLazy>
      <PopoverTrigger>
        <InputGroup onClick={onOpen} cursor="pointer" {...inputProps}>
          <InputLeftElement pointerEvents="none">
            <CalendarIcon color="gray.400" boxSize={4} />
          </InputLeftElement>
          <Input
            readOnly
            placeholder={placeholder}
            value={displayValue()}
            cursor="pointer"
            borderColor={borderColor}
            _hover={{ borderColor: "blue.400" }}
            _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)" }}
            pr={startDate ? "2.5rem" : "1rem"}
          />
          {startDate && (
            <Box
              as="button"
              position="absolute"
              right="10px"
              top="50%"
              transform="translateY(-50%)"
              zIndex={2}
              onClick={handleClear}
              color="gray.400"
              _hover={{ color: "gray.600" }}
              fontSize="lg"
              lineHeight={1}
            >
              ×
            </Box>
          )}
        </InputGroup>
      </PopoverTrigger>

      <PopoverContent
        w="auto"
        maxW="none"
        border="1px solid"
        borderColor={borderColor}
        borderRadius="xl"
        boxShadow="lg"
        bg={popoverBg}
        p={0}
        _focus={{ outline: "none" }}
      >
        <PopoverBody p={0}>
          <VStack spacing={0} align="stretch">
            <Flex align="center" justify="space-between" px={4} pt={3} pb={2}>
              <IconButton
                icon={<ChevronLeftIcon />}
                size="sm"
                variant="ghost"
                onClick={prevMonth}
                aria-label="Previous month"
              />
              <Box flex={1} />
              <IconButton
                icon={<ChevronRightIcon />}
                size="sm"
                variant="ghost"
                onClick={nextMonth}
                aria-label="Next month"
              />
            </Flex>

            <Flex gap={4} px={4} pb={3} onMouseLeave={() => setHoverDate(null)}>
              <CalendarMonth
                year={leftMonth.year}
                month={leftMonth.month}
                startDate={startDate}
                endDate={endDate}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={handleDayHover}
              />
              <Box w="1px" bg={dividerColor} alignSelf="stretch" />
              <CalendarMonth
                year={rightMonth.year}
                month={rightMonth.month}
                startDate={startDate}
                endDate={endDate}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={handleDayHover}
              />
            </Flex>

            {(startDate || endDate) && (
              <Flex
                borderTop="1px solid"
                borderColor={dividerColor}
                px={4}
                py={2}
                align="center"
                justify="space-between"
              >
                <Text fontSize="xs" color="gray.500">
                  {startDate && endDate
                    ? `${formatDate(startDate)} – ${formatDate(endDate)}`
                    : "Select end date"}
                </Text>
                <Button size="xs" variant="ghost" colorScheme="blue" onClick={handleClear}>
                  Clear
                </Button>
              </Flex>
            )}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}