import { useState, useRef, useEffect } from "react";
import { Box, useColorModeValue } from "@chakra-ui/react";

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
  const s = Math.min(start.getTime(), end.getTime());
  const e = Math.max(start.getTime(), end.getTime());
  return d > s && d < e;
}
function formatDisplay(date) {
  if (!date) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function formatShort(date) {
  if (!date) return "";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

const PRESETS = [
  {
    label: "Today",
    range: () => {
      const d = new Date();
      return { startDate: d, endDate: d };
    },
  },
  {
    label: "Yesterday",
    range: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return { startDate: d, endDate: d };
    },
  },
  {
    label: "Last 7 days",
    range: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return { startDate: start, endDate: end };
    },
  },
  {
    label: "Last 30 days",
    range: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      return { startDate: start, endDate: end };
    },
  },
  {
    label: "This month",
    range: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { startDate: start, endDate: end };
    },
  },
  {
    label: "Last month",
    range: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: start, endDate: end };
    },
  },
];

function CalendarGrid({ year, month, startDate, endDate, hoverDate, selecting, onDayClick, onDayHover }) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();
  const effectiveEnd = selecting && hoverDate ? hoverDate : endDate;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div style={{ minWidth: 224 }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        marginBottom: 4,
      }}>
        {DAYS.map((d) => (
          <div key={d} style={{
            textAlign: "center",
            padding: "4px 0",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            color: "#94a3b8",
            textTransform: "uppercase",
          }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px" }}>
        {cells.map((date, idx) => {
          if (!date) return <div key={`e-${idx}`} />;

          const isStart = isSameDay(date, startDate);
          const isEnd = isSameDay(date, endDate);
          const isActive = isStart || isEnd;
          const inRange = isInRange(date, startDate, effectiveEnd);
          const isToday = isSameDay(date, today);
          const isHover = isSameDay(date, hoverDate) && selecting;

          let bg = "transparent";
          let color = "inherit";
          let fontWeight = 400;
          let borderRadius = "6px";

          if (isActive) {
            bg = "#3b82f6";
            color = "#ffffff";
            fontWeight = 600;
            borderRadius = "6px";
          } else if (inRange) {
            bg = "#eff6ff";
            color = "#1d4ed8";
            borderRadius = "0";
          } else if (isHover) {
            bg = "#dbeafe";
            color = "#1d4ed8";
            borderRadius = "6px";
          }

          const isRangeStart = inRange && isInRange(date, startDate, effectiveEnd) &&
            date.toDateString() === (startDate ? new Date(startDate.getTime() + 86400000).toDateString() : null);
          const isRangeEnd = inRange && isInRange(date, startDate, effectiveEnd) &&
            date.toDateString() === (effectiveEnd ? new Date(effectiveEnd.getTime() - 86400000).toDateString() : null);

          if (inRange) {
            const dateMs = date.getTime();
            const startMs = startDate ? Math.min(startDate.getTime(), effectiveEnd?.getTime() || Infinity) : Infinity;
            const endMs = effectiveEnd ? Math.max(startDate?.getTime() || 0, effectiveEnd.getTime()) : 0;
            const nextDay = new Date(dateMs + 86400000);
            const prevDay = new Date(dateMs - 86400000);
            const nextIsInRange = isInRange(nextDay, startDate, effectiveEnd);
            const prevIsInRange = isInRange(prevDay, startDate, effectiveEnd);
            if (!prevIsInRange) borderRadius = "6px 0 0 6px";
            else if (!nextIsInRange) borderRadius = "0 6px 6px 0";
          }

          return (
            <div
              key={date.toISOString()}
              style={{ textAlign: "center", padding: "1px" }}
            >
              <button
                onClick={() => onDayClick(date)}
                onMouseEnter={() => onDayHover(date)}
                style={{
                  width: "100%",
                  padding: "6px 2px",
                  fontSize: 13,
                  fontWeight,
                  background: bg,
                  color,
                  border: isToday && !isActive ? "1.5px solid #93c5fd" : "1.5px solid transparent",
                  borderRadius,
                  cursor: "pointer",
                  transition: "all 0.12s ease",
                  outline: "none",
                  lineHeight: 1,
                  position: "relative",
                }}
                onMouseLeave={(e) => {
                  if (!isActive && !inRange && !isHover) {
                    e.currentTarget.style.background = bg;
                  }
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = "0 0 0 2px #bfdbfe";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  inputProps = {},
}) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(value?.startDate || null);
  const [endDate, setEndDate] = useState(value?.endDate || null);
  const [hoverDate, setHoverDate] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const ref = useRef(null);

  const today = new Date();
  const [leftMonth, setLeftMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth() === 0 ? 11 : today.getMonth() - 1,
  });

  const rightMonth = {
    year: leftMonth.month === 11 ? leftMonth.year + 1 : leftMonth.year,
    month: leftMonth.month === 11 ? 0 : leftMonth.month + 1,
  };

  useEffect(() => {
    if (value?.startDate !== undefined) setStartDate(value.startDate);
    if (value?.endDate !== undefined) setEndDate(value.endDate);
  }, [value]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        if (selecting) {
          setSelecting(false);
          setHoverDate(null);
        }
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [selecting]);

  const handleDayClick = (date) => {
    if (!selecting || !startDate) {
      setStartDate(date);
      setEndDate(null);
      setSelecting(true);
    } else {
      const [s, e] = date < startDate ? [date, startDate] : [startDate, date];
      setEndDate(e);
      setStartDate(s);
      setSelecting(false);
      setHoverDate(null);
      onChange?.({ startDate: s, endDate: e });
      setOpen(false);
    }
  };

  const handlePreset = (preset) => {
    const { startDate: s, endDate: e } = preset.range();
    setStartDate(s);
    setEndDate(e);
    setSelecting(false);
    onChange?.({ startDate: s, endDate: e });
    setOpen(false);
  };

  const handleClear = (ev) => {
    ev.stopPropagation();
    setStartDate(null);
    setEndDate(null);
    setSelecting(false);
    onChange?.({ startDate: null, endDate: null });
  };

  const prevMonth = () =>
    setLeftMonth((p) => ({
      year: p.month === 0 ? p.year - 1 : p.year,
      month: p.month === 0 ? 11 : p.month - 1,
    }));

  const nextMonth = () =>
    setLeftMonth((p) => ({
      year: p.month === 11 ? p.year + 1 : p.year,
      month: p.month === 11 ? 0 : p.month + 1,
    }));

  const displayValue = startDate && endDate
    ? `${formatShort(startDate)}  →  ${formatShort(endDate)}`
    : startDate
    ? `${formatShort(startDate)}  →  ...`
    : "";

  const { minW, maxW, size, ...restInputProps } = inputProps;

  return (
    <Box
      ref={ref}
      position="relative"
      display="inline-block"
      minW={minW || "220px"}
      maxW={maxW || "320px"}
      flex="1"
      {...restInputProps}
    >
      {/* ── Trigger Input ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          height: 34,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 10px",
          background: "#f8fafc",
          border: open ? "1px solid #93c5fd" : "0.5px solid #e2e8f0",
          borderRadius: 8,
          cursor: "pointer",
          transition: "border-color 0.15s, box-shadow 0.15s",
          boxShadow: open ? "0 0 0 3px #dbeafe" : "none",
          outline: "none",
        }}
      >
        {/* Calendar icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={startDate ? "#3b82f6" : "#94a3b8"}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>

        <span style={{
          flex: 1,
          textAlign: "left",
          fontSize: 13,
          color: displayValue ? "#1e293b" : "#94a3b8",
          fontFamily: "inherit",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          letterSpacing: displayValue ? "0.01em" : 0,
        }}>
          {displayValue || placeholder}
        </span>

        {startDate ? (
          <span
            onClick={handleClear}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#e2e8f0",
              color: "#64748b",
              cursor: "pointer",
              flexShrink: 0,
              fontSize: 14,
              lineHeight: 1,
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "#dc2626"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
          >
            ×
          </span>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {/* ── Dropdown Panel ── */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1000,
            background: "#ffffff",
            border: "0.5px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 8px 30px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
            display: "flex",
            overflow: "hidden",
            minWidth: 560,
          }}
        >
          {/* Left: Presets */}
          <div style={{
            width: 140,
            borderRight: "0.5px solid #f1f5f9",
            padding: "12px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            background: "#f8fafc",
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "#94a3b8",
              textTransform: "uppercase",
              padding: "4px 8px 8px",
            }}>
              Quick select
            </div>
            {PRESETS.map((p) => {
              const { startDate: ps, endDate: pe } = p.range();
              const isActive = isSameDay(ps, startDate) && isSameDay(pe, endDate);
              return (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "7px 10px",
                    fontSize: 13,
                    fontWeight: isActive ? 500 : 400,
                    background: isActive ? "#eff6ff" : "transparent",
                    color: isActive ? "#2563eb" : "#475569",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    transition: "all 0.1s",
                    outline: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "#f1f5f9";
                      e.currentTarget.style.color = "#1e293b";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#475569";
                    }
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Right: Calendars */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Month nav header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px 8px",
              borderBottom: "0.5px solid #f1f5f9",
            }}>
              <button
                onClick={prevMonth}
                style={{
                  width: 28, height: 28,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "transparent",
                  border: "0.5px solid #e2e8f0",
                  borderRadius: 6,
                  cursor: "pointer",
                  color: "#64748b",
                  transition: "all 0.1s",
                  outline: "none",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#1e293b"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>

              <div style={{ display: "flex", gap: 40 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#1e293b", minWidth: 130, textAlign: "center" }}>
                  {MONTHS[leftMonth.month]} {leftMonth.year}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#1e293b", minWidth: 130, textAlign: "center" }}>
                  {MONTHS[rightMonth.month]} {rightMonth.year}
                </span>
              </div>

              <button
                onClick={nextMonth}
                style={{
                  width: 28, height: 28,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "transparent",
                  border: "0.5px solid #e2e8f0",
                  borderRadius: 6,
                  cursor: "pointer",
                  color: "#64748b",
                  transition: "all 0.1s",
                  outline: "none",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#1e293b"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Two calendars side by side */}
            <div
              style={{ display: "flex", gap: 0, padding: "12px 16px 8px" }}
              onMouseLeave={() => setHoverDate(null)}
            >
              <CalendarGrid
                year={leftMonth.year}
                month={leftMonth.month}
                startDate={startDate}
                endDate={endDate}
                hoverDate={hoverDate}
                selecting={selecting}
                onDayClick={handleDayClick}
                onDayHover={(d) => selecting && setHoverDate(d)}
              />
              <div style={{ width: 1, background: "#f1f5f9", margin: "0 12px", alignSelf: "stretch" }} />
              <CalendarGrid
                year={rightMonth.year}
                month={rightMonth.month}
                startDate={startDate}
                endDate={endDate}
                hoverDate={hoverDate}
                selecting={selecting}
                onDayClick={handleDayClick}
                onDayHover={(d) => selecting && setHoverDate(d)}
              />
            </div>

            {/* Footer */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 16px 12px",
              borderTop: "0.5px solid #f1f5f9",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {selecting && (
                  <span style={{ fontSize: 12, color: "#3b82f6", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{
                      display: "inline-block",
                      width: 6, height: 6,
                      borderRadius: "50%",
                      background: "#3b82f6",
                      animation: "pulse 1.2s ease-in-out infinite",
                    }} />
                    Pick end date
                  </span>
                )}
                {startDate && endDate && !selecting && (
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    {formatDisplay(startDate)} — {formatDisplay(endDate)}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                {(startDate || endDate) && (
                  <button
                    onClick={handleClear}
                    style={{
                      padding: "5px 12px",
                      fontSize: 12,
                      fontWeight: 500,
                      background: "transparent",
                      color: "#64748b",
                      border: "0.5px solid #e2e8f0",
                      borderRadius: 6,
                      cursor: "pointer",
                      transition: "all 0.1s",
                      outline: "none",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.borderColor = "#fca5a5"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    padding: "5px 14px",
                    fontSize: 12,
                    fontWeight: 500,
                    background: startDate && endDate ? "#3b82f6" : "#f1f5f9",
                    color: startDate && endDate ? "#ffffff" : "#94a3b8",
                    border: "none",
                    borderRadius: 6,
                    cursor: startDate && endDate ? "pointer" : "default",
                    transition: "all 0.1s",
                    outline: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (startDate && endDate) e.currentTarget.style.background = "#2563eb";
                  }}
                  onMouseLeave={(e) => {
                    if (startDate && endDate) e.currentTarget.style.background = "#3b82f6";
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </Box>
  );
}