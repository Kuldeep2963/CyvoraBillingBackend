import * as Sentry from '@sentry/react';

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const initializeSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: true,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: toNumber(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0.1),
    replaysSessionSampleRate: toNumber(import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE, 0.0),
    replaysOnErrorSampleRate: toNumber(import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE, 1.0),
  });
};
