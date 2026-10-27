const ONE_MINUTE_MS = 60_000;
const FIFTEEN_MINUTES_MS = 900_000;

export const THROTTLE_DEFAULT = { ttl: ONE_MINUTE_MS, limit: 60 };

export const THROTTLE_AUTH = { default: { ttl: FIFTEEN_MINUTES_MS, limit: 5 } };
export const THROTTLE_REGISTER = { default: { ttl: FIFTEEN_MINUTES_MS, limit: 5 } };
export const THROTTLE_CHECKOUT = { default: { ttl: ONE_MINUTE_MS, limit: 10 } };
