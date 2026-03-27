import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import {
  Box, Text, Flex, Grid,
  Spinner, Select, Badge, HStack, IconButton, Tooltip,
} from "@chakra-ui/react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const METRICS = [
  { key: "totalCalls",       label: "Total Calls",     format: (v) => v?.toLocaleString() ?? "—" },
  { key: "completedCalls",   label: "Compt. Calls", format: (v) => v?.toLocaleString() ?? "—" },
  { key: "ASR",              label: "ASR",             format: (v) => v != null ? `${v.toFixed(2)}%` : "—" },
  { key: "ACD",              label: "ACD (min)",       format: (v) => v != null ? `${v.toFixed(4)}` : "—" },
  { key: "minutes",          label: "Minutes",         format: (v) => v != null ? v.toFixed(2) : "—" },
  { key: "revenue",          label: "Revenue",         format: (v) => v != null ? `$${v.toFixed(4)}` : "—" },
  { key: "cost",             label: "Cost",            format: (v) => v != null ? `$${v.toFixed(4)}` : "—" },
  { key: "margin",           label: "Margin",          format: (v) => v != null ? `$${v.toFixed(4)}` : "—" },
  { key: "marginPercentage", label: "Margin %",        format: (v) => v != null ? `${v.toFixed(2)}%` : "—" },
];

const NAME_OVERRIDES = {
  "United States":   "United States of America",
  "UK":              "United Kingdom",
  "UAE":             "United Arab Emirates",
  "USA":             "United States of America",
  "The Netherlands": "Netherlands",
  "Brunei":          "Brunei Darussalam",
  "Macedonia":       "North Macedonia",
  "South Korea":     "Republic of Korea",
  "North Korea":     "Dem. Rep. Korea",
  "Czech Republic":  "Czechia",
  "Russia":          "Russia",
  "Moldova":         "Republic of Moldova",
  "Bolivia":         "Bolivia",
  "Venezuela":       "Venezuela",
  "Tanzania":        "United Republic of Tanzania",
  "Syria":           "Syrian Arab Republic",
  "Iran":            "Iran",
  "Vietnam":         "Viet Nam",
  "Ivory Coast":     "Côte d'Ivoire",
  "Congo":           "Congo",
  "DR Congo":        "Democratic Republic of the Congo",
  "Laos":            "Lao PDR",
  "Palestine":       "West Bank and Gaza",
  "Taiwan":          "Taiwan",
};

// Approximate centroids for countries (lon, lat) used for markers
// This covers the most common destinations; extend as needed
const COUNTRY_CENTROIDS = {
  "United States of America": [-98.58, 39.83],
  "United Kingdom":           [-3.44, 55.38],
  "United Arab Emirates":     [53.85, 23.42],
  "Germany":                  [10.45, 51.17],
  "France":                   [2.21, 46.23],
  "India":                    [78.96, 20.59],
  "China":                    [104.19, 35.86],
  "Australia":                [133.78, -25.27],
  "Brazil":                   [-51.93, -14.24],
  "Canada":                   [-96.80, 56.13],
  "Russia":                   [105.32, 61.52],
  "Japan":                    [138.25, 36.20],
  "South Africa":             [25.08, -29.00],
  "Nigeria":                  [8.68, 9.08],
  "Mexico":                   [-102.55, 23.63],
  "Argentina":                [-63.62, -38.42],
  "Indonesia":                [113.92, -0.79],
  "Pakistan":                 [69.35, 30.38],
  "Bangladesh":               [90.36, 23.68],
  "Egypt":                    [30.80, 26.82],
  "Saudi Arabia":             [45.08, 23.89],
  "Turkey":                   [35.24, 38.96],
  "Italy":                    [12.57, 41.87],
  "Spain":                    [-3.75, 40.46],
  "Netherlands":              [5.29, 52.13],
  "Sweden":                   [18.64, 60.13],
  "Norway":                   [8.47, 60.47],
  "Poland":                   [19.14, 51.92],
  "Ukraine":                  [31.17, 48.38],
  "Kenya":                    [37.91, -0.02],
  "Ghana":                    [-1.02, 7.95],
  "Ethiopia":                 [40.49, 9.15],
  "Tanzania (United Republic)": [34.89, -6.37],
  "United Republic of Tanzania": [34.89, -6.37],
  "Philippines":              [121.77, 12.88],
  "Vietnam":                  [108.28, 14.06],
  "Viet Nam":                 [108.28, 14.06],
  "Thailand":                 [100.99, 15.87],
  "Malaysia":                 [109.70, 4.21],
  "Singapore":                [103.82, 1.35],
  "New Zealand":              [172.84, -40.90],
  "Czechia":                  [15.47, 49.82],
  "Romania":                  [24.97, 45.94],
  "Hungary":                  [19.50, 47.16],
  "Portugal":                 [-8.22, 39.40],
  "Greece":                   [21.82, 39.07],
  "Belgium":                  [4.47, 50.50],
  "Switzerland":              [8.23, 46.82],
  "Austria":                  [14.55, 47.52],
  "Denmark":                  [10.00, 56.26],
  "Finland":                  [25.75, 61.92],
  "Israel":                   [34.85, 31.05],
  "Jordan":                   [36.24, 30.59],
  "Lebanon":                  [35.86, 33.87],
  "Iraq":                     [43.68, 33.22],
  "Iran":                     [53.69, 32.43],
  "Afghanistan":              [67.71, 33.94],
  "Kazakhstan":               [66.92, 48.02],
  "Colombia":                 [-74.30, 4.57],
  "Peru":                     [-75.02, -9.19],
  "Chile":                    [-71.54, -35.67],
  "Venezuela":                [-66.59, 6.42],
  "Morocco":                  [-7.09, 31.79],
  "Algeria":                  [1.66, 28.03],
  "Tunisia":                  [9.54, 33.89],
  "Cameroon":                 [12.35, 3.85],
  "Senegal":                  [-14.45, 14.50],
  "Côte d'Ivoire":            [-5.55, 7.54],
  "Angola":                   [17.87, -11.20],
  "Mozambique":               [35.53, -18.67],
  "Zimbabwe":                 [29.15, -20.00],
  "Zambia":                   [27.85, -13.13],
  "Uganda":                   [32.29, 1.37],
};

const normalizeDestName = (name) => NAME_OVERRIDES[name] || name;

const normalizeKey = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const DEFAULT_CENTER = [0, 20];
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_EPSILON = 0.001;
const TRANSLATE_EXTENT = [[0, 0], [800, 600]];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getBoundedCenter = (nextCenter, nextZoom) => {
  const safeZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);

  if (safeZoom <= MIN_ZOOM + ZOOM_EPSILON) {
    return DEFAULT_CENTER;
  }

  // Allow more panning as zoom increases, but keep the map anchored around default center.
  const maxLonShift = 180 * (1 - 1 / safeZoom);
  const maxLatShift = 70 * (1 - 1 / safeZoom);

  const [lon = DEFAULT_CENTER[0], lat = DEFAULT_CENTER[1]] = nextCenter || DEFAULT_CENTER;

  return [
    clamp(lon, DEFAULT_CENTER[0] - maxLonShift, DEFAULT_CENTER[0] + maxLonShift),
    clamp(lat, DEFAULT_CENTER[1] - maxLatShift, DEFAULT_CENTER[1] + maxLatShift),
  ];
};

// ── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, highlight }) => (
  <Box
    bg={highlight ? "blue.50" : "gray.50"}
    borderRadius="md"
    px={3}
    py={2}
    border="0.5px solid"
    borderColor={highlight ? "blue.100" : "gray.200"}
    onClick={highlight = !highlight}
  >
    <Text fontSize="10px" color="gray.600" mb="2px" textTransform="uppercase" letterSpacing="wider">
      {label}
    </Text>
    <Text fontSize="13px" fontWeight="500" color={highlight ? "blue.700" : "gray.800"}>
      {value}
    </Text>
  </Box>
);

// ── Circular Destination Marker ──────────────────────────────────────────────
const DestMarker = ({ value, isSelected, isHovered, metricLabel, formattedValue, zoom, onEnter, onLeave, onClick }) => {
  // Size tiers based on call volume / metric magnitude
  const size = isSelected ? 18 : isHovered ? 15 : 12;
  const pulse = isSelected || isHovered;
  const inverseZoom = 1 / Math.max(zoom || MIN_ZOOM, MIN_ZOOM);

  return (
    <g
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      transform={`scale(${inverseZoom})`}
      style={{ cursor: "pointer" }}
    >
      {/* Pulse ring (selected / hovered) */}
      {pulse && (
        <circle
          r={size + 6}
          fill="none"
          stroke={isSelected ? "#1D4ED8" : "#60A5FA"}
          strokeWidth={1.5}
          opacity={0.5}
        />
      )}
      {/* Outer glow */}
      <circle
        r={size + 2}
        fill={isSelected ? "#1D4ED8" : "#3B82F6"}
        opacity={0.18}
      />
      {/* Main circle */}
      <circle
        r={size}
        fill={isSelected ? "#1D4ED8" : "#3B82F6"}
        stroke="#FFFFFF"
        strokeWidth={2}
        opacity={isHovered ? 1 : 0.88}
      />
      {/* Inner dot */}
      <circle r={size * 0.3} fill="#FFFFFF" opacity={0.9} />
    </g>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const DestinationMap = ({ destinations = [], loading = false }) => {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [hoveredGeo, setHoveredGeo]           = useState(null);
  const [hoveredMarker, setHoveredMarker]     = useState(null);
  const [tooltipInfo, setTooltipInfo]         = useState(null);
  const [tooltipPos, setTooltipPos]           = useState({ x: 0, y: 0 });
  const [activeMetric, setActiveMetric]       = useState("totalCalls");
  const [zoom, setZoom]                       = useState(1);
  const [center, setCenter]                   = useState(DEFAULT_CENTER);
  const containerRef                          = useRef(null);

  // ── Data indexing (unchanged logic) ─────────────────────────────────────
  const mapData = useMemo(() => {
    const indexed = {};
    (Array.isArray(destinations) ? destinations : []).forEach((row) => {
      const key = normalizeDestName(row.destination);
      if (!key) return;
      if (indexed[key]) {
        indexed[key].totalCalls    += Number(row.totalCalls    || 0);
        indexed[key].completedCalls+= Number(row.completedCalls|| 0);
        indexed[key].minutes       += Number(row.minutes       || 0);
        indexed[key].revenue       += Number(row.revenue       || 0);
        indexed[key].cost          += Number(row.cost          || 0);
        indexed[key].margin        += Number(row.margin        || 0);
        indexed[key].marginPercentage = indexed[key].revenue > 0
          ? (indexed[key].margin / indexed[key].revenue) * 100 : 0;
        indexed[key].ASR = indexed[key].totalCalls > 0
          ? (indexed[key].completedCalls / indexed[key].totalCalls) * 100 : 0;
        indexed[key].ACD = indexed[key].completedCalls > 0
          ? indexed[key].minutes / indexed[key].completedCalls : 0;
      } else {
        indexed[key] = {
          ...row,
          destination:      key,
          totalCalls:       Number(row.totalCalls       || 0),
          completedCalls:   Number(row.completedCalls   || 0),
          minutes:          Number(row.minutes          || 0),
          revenue:          Number(row.revenue          || 0),
          cost:             Number(row.cost             || 0),
          margin:           Number(row.margin           || 0),
          marginPercentage: Number(row.marginPercentage || 0),
          ASR:              Number(row.ASR              || 0),
          ACD:              Number(row.ACD              || 0),
        };
      }
    });
    return indexed;
  }, [destinations]);

  const normalizedMapData = useMemo(() => {
    const keyed = {};
    Object.entries(mapData).forEach(([name, row]) => {
      keyed[normalizeKey(name)] = row;
    });
    return keyed;
  }, [mapData]);

  const getRowForGeo = useCallback((geoName) => {
    if (mapData[geoName]) return mapData[geoName];
    return normalizedMapData[normalizeKey(geoName)] || null;
  }, [mapData, normalizedMapData]);

  // Sync selected country data when mapData refreshes
  useEffect(() => {
    if (!selectedCountry?.name) return;
    const nextData = getRowForGeo(selectedCountry.name);
    if (!nextData) { setSelectedCountry(null); return; }
    setSelectedCountry((prev) =>
      !prev || prev.data === nextData ? prev : { ...prev, data: nextData }
    );
  }, [mapData, normalizedMapData, selectedCountry?.name, getRowForGeo]);

  // ── Color scale ───────────────────────────────────────────────────────────
  const metric = METRICS.find((m) => m.key === activeMetric);
  const values = Object.values(mapData).map((d) => d[activeMetric] ?? 0).filter((v) => v > 0);
  const minVal = values.length ? Math.min(...values) : 0;
  const maxVal = values.length ? Math.max(...values) : 1;

  const colorScale = scaleLinear()
    .domain([minVal, maxVal])
    .range(["#DBEAFE", "#1D4ED8"]);

  const getColor = (geoName) => {
    const row = getRowForGeo(geoName);
    if (!row || row[activeMetric] == null) return "#F1F5F9";
    return colorScale(row[activeMetric]);
  };

  // ── Markers: resolve coordinates for all data countries ──────────────────
  const markers = useMemo(() => {
    return Object.entries(mapData).reduce((acc, [name, row]) => {
      const coords = COUNTRY_CENTROIDS[name];
      if (coords) {
        acc.push({ name, row, coords });
      } else {
        // Try normalised lookup
        const normName = Object.keys(COUNTRY_CENTROIDS).find(
          (k) => normalizeKey(k) === normalizeKey(name)
        );
        if (normName) acc.push({ name, row, coords: COUNTRY_CENTROIDS[normName] });
      }
      return acc;
    }, []);
  }, [mapData]);

  // ── Zoom controls ─────────────────────────────────────────────────────────
  const handleZoomIn  = () => setZoom((z) => clamp(z * 1.5, MIN_ZOOM, MAX_ZOOM));
  const handleZoomOut = () => {
    setZoom((z) => {
      const nextZoom = clamp(z / 1.5, MIN_ZOOM, MAX_ZOOM);
      if (nextZoom <= MIN_ZOOM + ZOOM_EPSILON) {
        setCenter(DEFAULT_CENTER);
      }
      return nextZoom;
    });
  };
  const handleReset   = () => { setZoom(MIN_ZOOM); setCenter(DEFAULT_CENTER); };

  const filterZoomEvent = useCallback((event) => {
    if (event.type !== "wheel") return true;

    const isZoomingOut = event.deltaY > 0;
    if (isZoomingOut && zoom <= MIN_ZOOM + ZOOM_EPSILON) {
      return false;
    }

    return true;
  }, [zoom]);

  // ── Tooltip helpers ───────────────────────────────────────────────────────
  const showTooltip = (name, row, e) => {
    setTooltipInfo({ name, row });
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };
  const hideTooltip = () => setTooltipInfo(null);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box
      bg="white"
      borderRadius="xl"
      border="0.5px solid"
      borderColor="gray.200"
      overflow="hidden"
    >
      {/* ── Header ── */}
      <Flex
        align="center"
        justify="space-between"
        px={4}
        py={2}
        bg="rgb(237, 242, 247)"
        borderBottom="0.5px solid"
        borderColor="gray.100"
        flexWrap="wrap"
        gap={2}
      >
        <Box>
          <Text fontWeight="600" size={"lg"} color="gray.500">
            Destination Traffic Map
          </Text>
          <Text fontSize={"12px"} color="gray.500">
            {Object.keys(mapData).length} active destinations · click a country for full breakdown
          </Text>
        </Box>
        <Select
          size="sm"
          bg={"white"}
          color={"gray.600"}
          value={activeMetric}
          onChange={(e) => setActiveMetric(e.target.value)}
          borderRadius="md"
          fontSize="13px"
          w="170px"
          borderColor="gray.200"
        >
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </Select>
      </Flex>

      {loading ? (
        <Flex justify="center" align="center" h="420px">
          <Spinner color="blue.500" size="md" thickness="2px" />
        </Flex>
      ) : (
        <Flex direction={{ base: "column", lg: "row" }}>

          {/* ── Map area ── */}
          <Box flex={1} position="relative" bg="#EFF6FF" ref={containerRef}>

            {/* Zoom controls */}
            <Flex
              position="absolute"
              top={3}
              right={3}
              zIndex={10}
              direction="column"
              gap={1}
            >
              {[
                { label: "+", title: "Zoom in",  onClick: handleZoomIn  },
                { label: "−", title: "Zoom out", onClick: handleZoomOut },
                { label: "⊙", title: "Reset",    onClick: handleReset   },
              ].map(({ label, title, onClick }) => (
                <Tooltip key={title} label={title} placement="left" hasArrow>
                  <IconButton
                    aria-label={title}
                    onClick={onClick}
                    size="sm"
                    variant="solid"
                    bg="white"
                    color="gray.700"
                    border="0.5px solid"
                    borderColor="gray.200"
                    borderRadius="md"
                    boxShadow="sm"
                    fontSize="16px"
                    fontWeight="400"
                    _hover={{ bg: "blue.50", color: "blue.700" }}
                    icon={<Text lineHeight="1">{label}</Text>}
                    minW="28px"
                    h="28px"
                  />
                </Tooltip>
              ))}
            </Flex>

            <ComposableMap
              projectionConfig={{ scale: 147, center: [0, 20] }}
              style={{ width: "100%", height: "440px" }}
            >
              <ZoomableGroup
                zoom={zoom}
                center={center}
                disablePanning={zoom <= MIN_ZOOM + ZOOM_EPSILON}
                filterZoomEvent={filterZoomEvent}
                onMove={({ zoom: z, coordinates }) => {
                  const boundedZoom = clamp(z, MIN_ZOOM, MAX_ZOOM);
                  const boundedCenter = getBoundedCenter(coordinates, boundedZoom);
                  setZoom(boundedZoom);
                  setCenter(boundedCenter);
                }}
                onMoveEnd={({ zoom: z, coordinates }) => {
                  const boundedZoom = clamp(z, MIN_ZOOM, MAX_ZOOM);
                  const boundedCenter = getBoundedCenter(coordinates, boundedZoom);
                  setZoom(boundedZoom);
                  setCenter(boundedCenter);
                }}
                // Only allow panning when zoomed in; smooth scroll-to-zoom
                minZoom={MIN_ZOOM}
                maxZoom={MAX_ZOOM}
                translateExtent={TRANSLATE_EXTENT}
              >
                {/* ── Country fills ── */}
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const geoName =
                        geo.properties?.NAME ||
                        geo.properties?.name  ||
                        geo.properties?.ADMIN || "";
                      const rowData   = getRowForGeo(geoName);
                      const hasData   = !!rowData;
                      const isSelected = selectedCountry?.name === geoName;

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={
                            isSelected
                              ? "#1E40AF"
                              : hasData
                              ? getColor(geoName)
                              : "#568fd4"
                          }
                          stroke="#FFFFFF"
                          strokeWidth={0.4}
                          style={{
                            default: { outline: "none" },
                            hover: {
                              outline: "none",
                              fill: hasData
                                ? isSelected ? "#1E40AF" : "#93C5FD"
                                : "#D1DCF0",
                              cursor: hasData ? "pointer" : "default",
                              transition: "fill 0.15s ease",
                            },
                            pressed: { outline: "none" },
                          }}
                          onMouseEnter={(e) => {
                            if (hasData) {
                              setHoveredGeo(geoName);
                              showTooltip(geoName, rowData, e);
                            }
                          }}
                          onMouseMove={(e) => {
                            if (hasData) setTooltipPos({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseLeave={() => {
                            setHoveredGeo(null);
                            hideTooltip();
                          }}
                          onClick={() => {
                            if (hasData) {
                              setSelectedCountry(
                                selectedCountry?.name === geoName
                                  ? null
                                  : { name: geoName, data: rowData }
                              );
                            }
                          }}
                        />
                      );
                    })
                  }
                </Geographies>

                {/* ── Circular Markers ── */}
                {markers.map(({ name, row, coords }) => {
                  const isSelected = selectedCountry?.name === name;
                  const isHovered  = hoveredMarker === name;
                  return (
                    <Marker
                      key={name}
                      coordinates={coords}
                    >
                      <DestMarker
                        isSelected={isSelected}
                        isHovered={isHovered}
                        zoom={zoom}
                        metricLabel={metric.label}
                        formattedValue={metric.format(row[activeMetric])}
                        onEnter={(e) => {
                          setHoveredMarker(name);
                          showTooltip(name, row, e);
                        }}
                        onLeave={() => {
                          setHoveredMarker(null);
                          hideTooltip();
                        }}
                        onClick={() =>
                          setSelectedCountry(
                            isSelected ? null : { name, data: row }
                          )
                        }
                      />
                    </Marker>
                  );
                })}
              </ZoomableGroup>
            </ComposableMap>

            {/* ── Hover Tooltip ── */}
            {tooltipInfo && (
              <Box
                position="fixed"
                left={tooltipPos.x + 14}
                top={tooltipPos.y - 14}
                bg="gray.900"
                color="white"
                px={3}
                py="8px"
                borderRadius="lg"
                fontSize="12px"
                zIndex={9999}
                pointerEvents="none"
                boxShadow="xl"
                minW="160px"
              >
                {/* Destination header */}
                <HStack spacing={2} mb="4px">
                  <Box
                    w="8px" h="8px"
                    borderRadius="full"
                    bg="#60A5FA"
                    flexShrink={0}
                  />
                  <Text fontWeight="600" fontSize="12px">{tooltipInfo.name}</Text>
                </HStack>

                {/* Primary metric */}
                <Text color="#93C5FD" fontSize="11px" mb="2px">
                  {metric.label}: {metric.format(tooltipInfo.row[activeMetric])}
                </Text>

                {/* Quick stats */}
                <Box
                  borderTop="0.5px solid"
                  borderColor="gray.600"
                  mt="5px"
                  pt="5px"
                >
                  <Flex justify="space-between" gap={3}>
                    <Text color="gray.400" fontSize="10px">
                      Calls: <Text as="span" color="gray.200">{tooltipInfo.row.totalCalls?.toLocaleString()}</Text>
                    </Text>
                    <Text color="gray.400" fontSize="10px">
                      ASR: <Text as="span" color="gray.200">{tooltipInfo.row.ASR?.toFixed(1)}%</Text>
                    </Text>
                    <Text color="gray.400" fontSize="10px">
                      ACD: <Text as="span" color="gray.200">{tooltipInfo.row.ACD?.toFixed(2)}</Text>
                    </Text>
                  </Flex>
                </Box>
              </Box>
            )}

            {/* ── Colour legend ── */}
            <Box
              position="absolute"
              bottom={4}
              left={4}
              bg="white"
              borderRadius="md"
              px={3}
              py={2}
              border="0.5px solid"
              borderColor="gray.200"
              boxShadow="sm"
            >
              <Text
                fontSize="10px"
                color="gray.400"
                mb="5px"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                {metric.label}
              </Text>
              <Flex align="center" gap={2}>
                <Text fontSize="10px" color="gray.400">{metric.format(minVal)}</Text>
                <Box
                  h="7px"
                  w="90px"
                  borderRadius="full"
                  style={{ background: "linear-gradient(to right, #DBEAFE, #1D4ED8)" }}
                />
                <Text fontSize="10px" color="gray.400">{metric.format(maxVal)}</Text>
              </Flex>
            </Box>

            {/* ── Marker legend ── */}
            <Box
              position="absolute"
              bottom={4}
              right={4}
              bg="white"
              borderRadius="md"
              px={3}
              py={2}
              border="0.5px solid"
              borderColor="gray.200"
              boxShadow="sm"
            >
              <Text fontSize="10px" color="gray.400" mb="5px" textTransform="uppercase" letterSpacing="wider">
                Markers
              </Text>
              <HStack spacing={3}>
                <HStack spacing={1}>
                  <svg width="14" height="14" viewBox="-7 -7 14 14">
                    <circle r="5" fill="#3B82F6" stroke="#fff" strokeWidth="1.5" />
                    <circle r="1.5" fill="#fff" />
                  </svg>
                  <Text fontSize="10px" color="gray.500">Destination</Text>
                </HStack>
                <HStack spacing={1}>
                  <svg width="14" height="14" viewBox="-7 -7 14 14">
                    <circle r="5" fill="#1D4ED8" stroke="#fff" strokeWidth="1.5" />
                    <circle r="1.5" fill="#fff" />
                  </svg>
                  <Text fontSize="10px" color="gray.500">Selected</Text>
                </HStack>
                <HStack spacing={1}>
                  <Box w="10px" h="10px" borderRadius="sm" bg="#E2EAF4" border="0.5px solid" borderColor="gray.200" />
                  <Text fontSize="10px" color="gray.400">No data</Text>
                </HStack>
              </HStack>
            </Box>
          </Box>

          {/* ── Side Panel ── */}
          <Box
            w={{ base: "full", lg: "290px" }}
            borderTop={{ base: "0.5px solid", lg: "none" }}
            borderColor="gray.100"
            bg="white"
            display="flex"
            flexDirection="column"
          >
            {selectedCountry ? (
              <Box p={4}>
                {/* Country header */}
                <Flex align="flex-start" justify="space-between" mb={3}>
                  <Box>
                    <HStack spacing={2} mb={1}>
                      {/* Destination marker icon */}
                      <svg width="14" height="14" viewBox="-7 -7 14 14">
                        <circle r="5" fill="#1D4ED8" stroke="#fff" strokeWidth="1.5" />
                        <circle r="1.5" fill="#fff" />
                      </svg>
                      <Text fontWeight="600" fontSize="14px" color="gray.800">
                        {selectedCountry.name}
                      </Text>
                    </HStack>
                    {selectedCountry.data.trunk && (
                      <Badge colorScheme="blue" fontSize="10px">
                        Trunk: {selectedCountry.data.trunk}
                      </Badge>
                    )}
                  </Box>
                  <Text
                    fontSize="14px"
                    color="gray.500"
                    cursor="pointer"
                    _hover={{ color: "gray.600" }}
                    onClick={() => setSelectedCountry(null)}
                    title="Close"
                  >
                    ✕
                  </Text>
                </Flex>

                <Box h="0.5px" bg="gray.100" mb={3} />

                <Grid templateColumns="1fr 1fr" gap={2}>
                  {METRICS.map((m) => (
                    <StatCard
                      key={m.key}
                      label={m.label}
                      value={m.format(selectedCountry.data[m.key])}
                      highlight={m.key === activeMetric}
                    />
                  ))}
                </Grid>
              </Box>
            ) : (
              <Flex
                align="center"
                justify="center"
                direction="column"
                flex={1}
                py={12}
                px={6}
                gap={3}
              >
                {/* Animated marker preview */}
                <svg width="40" height="40" viewBox="-20 -20 40 40">
                  <circle r="14" fill="#DBEAFE" />
                  <circle r="10" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2" />
                  <circle r="3" fill="#FFFFFF" />
                </svg>
                <Text fontSize="13px" color="gray.400" textAlign="center" lineHeight="1.6">
                  Click any highlighted country or marker to see its full traffic breakdown
                </Text>
              </Flex>
            )}
          </Box>

        </Flex>
      )}
    </Box>
  );
};

export default DestinationMap;