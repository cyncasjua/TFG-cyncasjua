import { Throttle, SkipThrottle } from '@nestjs/throttler';

export { SkipThrottle };

// ttl en milisegundos, limit = nº de peticiones permitidas en ese ttl
export const ThrottleStrict = () => Throttle({ default: { ttl: 60000, limit: 5 } });
export const ThrottleModerate = () => Throttle({ default: { ttl: 60000, limit: 20 } });
export const ThrottleUpload = () => Throttle({ default: { ttl: 60000, limit: 10 } });
