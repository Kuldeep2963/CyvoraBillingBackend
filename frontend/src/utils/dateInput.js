export const toDateInput = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const toDateTimeLocalInput = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

export const toDateTimeUtcInput = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  );
};

export const fromDateTimeUtcInput = (value) => {
  if (!value) return NaN;
  return new Date(`${value}:00Z`).getTime();
};
