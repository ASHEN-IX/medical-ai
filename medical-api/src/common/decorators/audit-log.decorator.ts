import { SetMetadata } from '@nestjs/common';

export interface AuditLogOptions {
  resource: string;
  action: string;
  targetIdSource?: 'params' | 'body' | 'query';
  targetIdKey?: string;
}

export const AUDIT_LOG_KEY = 'audit_log';
export const AuditLog = (options: AuditLogOptions) => SetMetadata(AUDIT_LOG_KEY, options);
