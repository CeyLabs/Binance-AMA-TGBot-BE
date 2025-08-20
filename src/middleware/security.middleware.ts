/**
 * @fileoverview Security middleware configuration for the application
 * @module security.middleware
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import * as compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { createHash } from 'crypto';

/**
 * Security middleware class that configures various security measures
 * @class SecurityMiddleware
 * @description Implements comprehensive security middleware including headers, rate limiting, and compression
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    next();
  }
}

/**
 * Helmet security headers configuration
 * @function createHelmetMiddleware
 * @returns {Function} Configured helmet middleware
 */
export function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.telegram.org", "https://api.openai.com"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });
}

/**
 * Rate limiting configuration for API protection
 * @function createRateLimitMiddleware
 * @returns {Function} Configured rate limit middleware
 */
export function createRateLimitMiddleware() {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // Limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for webhook endpoints
      return req.path === '/webhook';
    },
    keyGenerator: (req) => {
      // Let Express handle proxy trust logic via req.ip
      return req.ip || 'unknown';
    },
  });
}

/**
 * Compression middleware configuration
 * @function createCompressionMiddleware
 * @returns {Function} Configured compression middleware
 */
export function createCompressionMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Don't compress responses for webhook requests to avoid issues with Telegram
    if (req.path === '/webhook') {
      return next();
    }
    
    // Apply compression for all other requests
    const compressionHandler = compression({
      level: 6,
      threshold: 1024,
    });
    
    return compressionHandler(req, res, next);
  };
}

/**
 * Hash IP address for GDPR compliance
 * @function hashIP
 * @param ip - IP address to hash
 * @returns Hashed IP address
 */
function hashIP(ip: string): string {
  const salt = process.env.IP_HASH_SALT || 'default-salt-change-in-production';
  return createHash('sha256').update(ip + salt).digest('hex').substring(0, 16);
}

/**
 * Sanitize URL to remove sensitive parameters
 * @function sanitizeURL  
 * @param url - URL to sanitize
 * @returns Sanitized URL
 */
function sanitizeURL(url: string): string {
  try {
    const urlObj = new URL(url, 'http://localhost');
    // Remove common sensitive parameters
    const sensitiveParams = ['token', 'secret', 'key', 'password', 'api_key', 'access_token'];
    sensitiveParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[REDACTED]');
      }
    });
    return urlObj.pathname + (urlObj.search ? urlObj.search : '');
  } catch {
    // If URL parsing fails, just return path without query params
    return url.split('?')[0];
  }
}

/**
 * GDPR-compliant security logging middleware
 * @function createSecurityLoggingMiddleware
 * @returns {Function} GDPR-compliant security logging middleware
 */
export function createSecurityLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const clientIP = req.ip || 'unknown';
      
      const logData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: sanitizeURL(req.url),
        ipHash: process.env.GDPR_COMPLIANT_LOGGING === 'true' ? hashIP(clientIP) : clientIP,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('content-length') || '0',
        // Only log User-Agent prefix for bot detection, not full string for GDPR
        userAgentPrefix: req.headers['user-agent']?.substring(0, 20) || '',
      };

      // Log suspicious activities (security events)
      if (res.statusCode >= 400 || duration > 5000) {
        console.warn('[SECURITY] Suspicious request:', JSON.stringify(logData));
      } else if (process.env.SECURITY_VERBOSE_LOGGING === 'true') {
        console.log('[SECURITY] Request:', JSON.stringify(logData));
      }
    });

    next();
  };
}

/**
 * Check if IP is in CIDR range
 * @function isIPInCIDR
 * @param ip - IP address to check
 * @param cidr - CIDR range (e.g., "192.168.1.0/24")
 * @returns boolean
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  const [range, prefixLength] = cidr.split('/');
  const rangeBuffer = ipToBuffer(range);
  const ipBuffer = ipToBuffer(ip);
  
  if (!rangeBuffer || !ipBuffer) return false;
  
  const prefixBytes = Math.floor(parseInt(prefixLength) / 8);
  const prefixBits = parseInt(prefixLength) % 8;
  
  // Check full bytes
  for (let i = 0; i < prefixBytes; i++) {
    if (rangeBuffer[i] !== ipBuffer[i]) return false;
  }
  
  // Check partial byte if needed
  if (prefixBits > 0 && prefixBytes < 4) {
    const mask = 0xFF << (8 - prefixBits);
    if ((rangeBuffer[prefixBytes] & mask) !== (ipBuffer[prefixBytes] & mask)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Convert IP address to buffer
 * @function ipToBuffer
 * @param ip - IP address string
 * @returns Buffer or null
 */
function ipToBuffer(ip: string): Buffer | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => part < 0 || part > 255)) {
    return null;
  }
  return Buffer.from(parts);
}

/**
 * Telegram webhook IP filtering middleware
 * @function createWebhookIPFilterMiddleware
 * @returns {Function} Webhook IP filtering middleware
 */
export function createWebhookIPFilterMiddleware() {
  // Official Telegram IP ranges for webhook requests
  const telegramIPRanges = [
    '149.154.160.0/20',  // 149.154.160.0 to 149.154.175.255
    '91.108.4.0/22'      // 91.108.4.0 to 91.108.7.255
  ];

  return (req: Request, res: Response, next: NextFunction) => {
    // Only apply to webhook endpoint
    if (!req.path.startsWith('/webhook')) {
      return next();
    }

    const clientIP = req.ip || 'unknown';

    // Skip IP filtering if disabled or in development
    if (process.env.WEBHOOK_IP_FILTERING === 'false' || process.env.NODE_ENV === 'development') {
      return next();
    }

    // Check if IP is from Telegram's official ranges
    const isValidTelegramIP = telegramIPRanges.some(range => isIPInCIDR(clientIP, range));

    if (!isValidTelegramIP) {
      console.warn(`[SECURITY] Webhook request from unauthorized IP: ${process.env.GDPR_COMPLIANT_LOGGING === 'true' ? hashIP(clientIP) : clientIP}`);
      return res.status(403).json({ error: 'Unauthorized webhook source' });
    }

    next();
  };
}

/**
 * Telegram secret token validation middleware
 * @function createTelegramSecretValidationMiddleware
 * @returns {Function} Secret token validation middleware
 */
export function createTelegramSecretValidationMiddleware() {
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;

  return (req: Request, res: Response, next: NextFunction) => {
    // Only apply to webhook endpoint
    if (!req.path.startsWith('/webhook')) {
      return next();
    }

    // Skip validation if secret token is not configured
    if (!secretToken) {
      console.warn('[SECURITY] Telegram webhook secret token not configured');
      return next();
    }

    const receivedToken = req.headers['x-telegram-bot-api-secret-token'];

    if (!receivedToken || receivedToken !== secretToken) {
      console.warn('[SECURITY] Invalid or missing Telegram secret token');
      return res.status(403).json({ error: 'Invalid webhook token' });
    }

    next();
  };
}

/**
 * CORS middleware that properly enforces origin restrictions
 * @function createCORSMiddleware
 * @returns {Function} CORS enforcement middleware
 */
export function createCORSMiddleware() {
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()).filter(origin => origin) || [];
  
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    
    // If no CORS origins are configured, allow all origins (development mode)
    if (allowedOrigins.length === 0) {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      return next();
    }
    
    // Check if origin is allowed
    const isAllowedOrigin = allowedOrigins.includes(origin || '');
    
    if (!isAllowedOrigin && origin) {
      console.warn(`[SECURITY] Blocked CORS request from unauthorized origin: ${origin}`);
      return res.status(403).json({ error: 'CORS policy violation: Origin not allowed' });
    }
    
    // Set CORS headers for allowed origins
    if (isAllowedOrigin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    next();
  };
}

/**
 * IP filtering middleware for general whitelist/blacklist functionality
 * @function createIPFilterMiddleware
 * @returns {Function} IP filtering middleware
 */
export function createIPFilterMiddleware() {
  const whitelist = process.env.IP_WHITELIST?.split(',').map(ip => ip.trim()).filter(ip => ip) || [];
  const blacklist = process.env.IP_BLACKLIST?.split(',').map(ip => ip.trim()).filter(ip => ip) || [];

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || 'unknown';

    // Check blacklist first
    if (blacklist.length > 0 && blacklist.includes(clientIP)) {
      console.warn(`[SECURITY] Blocked IP: ${process.env.GDPR_COMPLIANT_LOGGING === 'true' ? hashIP(clientIP) : clientIP}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check whitelist if configured
    if (whitelist.length > 0 && !whitelist.includes(clientIP)) {
      console.warn(`[SECURITY] IP not in whitelist: ${process.env.GDPR_COMPLIANT_LOGGING === 'true' ? hashIP(clientIP) : clientIP}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
}