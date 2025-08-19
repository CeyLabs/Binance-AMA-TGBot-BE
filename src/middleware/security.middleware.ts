/**
 * @fileoverview Security middleware configuration for the application
 * @module security.middleware
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import * as compression from 'compression';
import { rateLimit } from 'express-rate-limit';

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
      // Use X-Forwarded-For header if behind a proxy (ALB/CloudFlare)
      const forwarded = req.headers['x-forwarded-for'] as string;
      if (forwarded) {
        return forwarded.split(',')[0].trim();
      }
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
  return compression({
    level: 6,
    threshold: 1024,
    filter: (req: Request) => {
      // Don't compress responses for webhook requests to avoid issues with Telegram
      if (req.path === '/webhook') {
        return false;
      }
      // Use default compression filter for other requests
      return true;
    },
  }) as (req: Request, res: Response, next: NextFunction) => void;
}

/**
 * Security logging middleware for monitoring and auditing
 * @function createSecurityLoggingMiddleware
 * @returns {Function} Security logging middleware
 */
export function createSecurityLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        ip: req.headers['x-forwarded-for'] || req.ip,
        userAgent: req.headers['user-agent'],
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('content-length') || '0',
      };

      // Log suspicious activities
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
 * IP filtering middleware for whitelist/blacklist functionality
 * @function createIPFilterMiddleware
 * @returns {Function} IP filtering middleware
 */
export function createIPFilterMiddleware() {
  const whitelist = process.env.IP_WHITELIST?.split(',').map(ip => ip.trim()) || [];
  const blacklist = process.env.IP_BLACKLIST?.split(',').map(ip => ip.trim()) || [];

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || 'unknown';

    // Check blacklist first
    if (blacklist.length > 0 && blacklist.includes(clientIP)) {
      console.warn(`[SECURITY] Blocked IP: ${clientIP}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check whitelist if configured
    if (whitelist.length > 0 && !whitelist.includes(clientIP)) {
      console.warn(`[SECURITY] IP not in whitelist: ${clientIP}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
}