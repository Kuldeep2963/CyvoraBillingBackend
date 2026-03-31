export const formatNotificationTime = (value) => {
  if (!value) {
    return 'Just now';
  }

  let date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      date = new Date(numeric < 1e12 ? numeric * 1000 : numeric);
    }
  }

  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  const now = Date.now();
  const diffMs = now - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const clockTime = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (diffMs < minute) {
    return `Just now • ${clockTime}`;
  }
  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)}m ago • ${clockTime}`;
  }
  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}h ago • ${clockTime}`;
  }
  if (diffMs < 7 * day) {
    return `${Math.floor(diffMs / day)}d ago • ${clockTime}`;
  }

  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};
