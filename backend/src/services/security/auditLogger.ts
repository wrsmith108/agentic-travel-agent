import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err } from '../../utils/result';
import { AppError, ErrorCodes } from '../../middleware/errorHandler';
import logger from '../../utils/logger';

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type LogCategory = 'auth' | 'data' | 'security' | 'admin' | 'system';

interface BaseAuditLog {
  id: string;
  timestamp: number;
  category: LogCategory;
  action: string;
  success?: boolean;
  userId?: string;
  ip?: string;
  userAgent?: string;
  riskLevel: RiskLevel;
  metadata?: any;
}

interface AuthEvent {
  userId?: string;
  email?: string;
  action: string;
  success: boolean;
  ip?: string;
  userAgent?: string;
  reason?: string;
  sessionId?: string;
}

interface DataAccessEvent {
  userId: string;
  resource: string;
  action: string;
  resourceId?: string;
  changes?: any;
  success: boolean;
  reason?: string;
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
}

interface SecurityEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source?: string;
  payload?: string;
  ip?: string;
  blocked?: boolean;
  endpoint?: string;
  requestCount?: number;
  timeWindow?: number;
}

interface AdminEvent {
  adminId: string;
  action: string;
  targetUserId?: string;
  reason?: string;
  success: boolean;
  configKey?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: any;
}

interface AlertThreshold {
  riskLevel: RiskLevel;
  threshold: number;
  timeWindow: number;
  callback: (alert: AlertData) => void;
}

interface AlertData {
  riskLevel: RiskLevel;
  count: number;
  threshold: number;
  recentLogs: BaseAuditLog[];
}

interface ComplianceReport {
  totalLogs: number;
  timeRange: { start: number; end: number };
  logsByCategory: { [category: string]: number };
  riskDistribution: { [risk: string]: number };
  topUsers: Array<{ userId: string; logCount: number }>;
  topActions: Array<{ action: string; count: number }>;
  securityEvents: number;
  failureRate: number;
  generatedAt: number;
}

export class AuditLogger {
  private logs: BaseAuditLog[] = [];
  private alertThresholds: AlertThreshold[] = [];
  private archiveCallback?: (logs: BaseAuditLog[]) => void;
  private maxLogs: number = 100000;
  private checkInterval?: NodeJS.Timeout;

  constructor() {
    this.startPeriodicChecks();
  }

  logAuthEvent(event: AuthEvent): Result<void, AppError> {
    try {
      const riskLevel = this.calculateAuthRiskLevel(event);
      
      const auditLog: BaseAuditLog = {
        id: uuidv4(),
        timestamp: Date.now(),
        category: 'auth',
        action: event.action,
        success: event.success,
        userId: event.userId,
        ip: event.ip,
        userAgent: event.userAgent,
        riskLevel,
        metadata: {
          email: event.email,
          reason: event.reason,
          sessionId: event.sessionId
        }
      };

      this.addLog(auditLog);
      this.checkAlerts();

      // Log to application logger as well
      const logLevel = riskLevel === 'critical' || riskLevel === 'high' ? 'warn' : 'info';
      logger[logLevel]('Authentication event', {
        action: event.action,
        success: event.success,
        userId: event.userId,
        ip: event.ip,
        riskLevel
      });

      return ok(undefined);
    } catch (error) {
      logger.error('Failed to log auth event', { error, event });
      return err(new AppError(500, 'Failed to log audit event', ErrorCodes.INTERNAL_SERVER_ERROR));
    }
  }

  logDataAccess(event: DataAccessEvent): Result<void, AppError> {
    try {
      const riskLevel = this.calculateDataAccessRiskLevel(event);
      
      const auditLog: BaseAuditLog = {
        id: uuidv4(),
        timestamp: Date.now(),
        category: 'data',
        action: event.action,
        success: event.success,
        userId: event.userId,
        riskLevel,
        metadata: {
          resource: event.resource,
          resourceId: event.resourceId,
          changes: event.changes,
          reason: event.reason,
          sensitivity: event.sensitivity
        }
      };

      this.addLog(auditLog);
      this.checkAlerts();

      return ok(undefined);
    } catch (error) {
      logger.error('Failed to log data access event', { error, event });
      return err(new AppError(500, 'Failed to log audit event', ErrorCodes.INTERNAL_SERVER_ERROR));
    }
  }

  logSecurityEvent(event: SecurityEvent): Result<void, AppError> {
    try {
      const riskLevel = this.mapSeverityToRiskLevel(event.severity);
      
      const auditLog: BaseAuditLog = {
        id: uuidv4(),
        timestamp: Date.now(),
        category: 'security',
        action: event.type,
        success: event.blocked,
        ip: event.ip,
        riskLevel,
        metadata: {
          type: event.type,
          severity: event.severity,
          source: event.source,
          payload: event.payload?.substring(0, 1000), // Limit payload size
          blocked: event.blocked,
          endpoint: event.endpoint,
          requestCount: event.requestCount,
          timeWindow: event.timeWindow
        }
      };

      this.addLog(auditLog);
      this.checkAlerts();

      // Always log security events to application logger
      logger.warn('Security event', {
        type: event.type,
        severity: event.severity,
        ip: event.ip,
        blocked: event.blocked
      });

      return ok(undefined);
    } catch (error) {
      logger.error('Failed to log security event', { error, event });
      return err(new AppError(500, 'Failed to log audit event', ErrorCodes.INTERNAL_SERVER_ERROR));
    }
  }

  logAdminEvent(event: AdminEvent): Result<void, AppError> {
    try {
      const riskLevel = this.calculateAdminRiskLevel(event);
      
      const auditLog: BaseAuditLog = {
        id: uuidv4(),
        timestamp: Date.now(),
        category: 'admin',
        action: event.action,
        success: event.success,
        userId: event.adminId,
        riskLevel,
        metadata: {
          adminId: event.adminId,
          targetUserId: event.targetUserId,
          reason: event.reason,
          configKey: event.configKey,
          oldValue: event.oldValue,
          newValue: event.newValue,
          ...event.metadata
        }
      };

      this.addLog(auditLog);
      this.checkAlerts();

      // Admin events are always logged at warn level
      logger.warn('Administrative action', {
        action: event.action,
        adminId: event.adminId,
        success: event.success,
        riskLevel
      });

      return ok(undefined);
    } catch (error) {
      logger.error('Failed to log admin event', { error, event });
      return err(new AppError(500, 'Failed to log audit event', ErrorCodes.INTERNAL_SERVER_ERROR));
    }
  }

  getAuditLogs(category?: LogCategory): BaseAuditLog[] {
    if (category) {
      return this.logs.filter(log => log.category === category);
    }
    return [...this.logs];
  }

  getLogsByUser(userId: string): BaseAuditLog[] {
    return this.logs.filter(log => log.userId === userId);
  }

  getLogsByTimeRange(start: number, end: number): BaseAuditLog[] {
    return this.logs.filter(log => log.timestamp >= start && log.timestamp <= end);
  }

  getLogsByRiskLevel(riskLevel: RiskLevel): BaseAuditLog[] {
    return this.logs.filter(log => log.riskLevel === riskLevel);
  }

  searchLogs(query: string): BaseAuditLog[] {
    const lowerQuery = query.toLowerCase();
    return this.logs.filter(log => {
      return log.action.toLowerCase().includes(lowerQuery) ||
             log.userId?.toLowerCase().includes(lowerQuery) ||
             JSON.stringify(log.metadata).toLowerCase().includes(lowerQuery);
    });
  }

  getAllLogs(): BaseAuditLog[] {
    return [...this.logs];
  }

  exportLogs(format: 'json' | 'csv'): string {
    if (format === 'json') {
      return JSON.stringify({
        metadata: {
          exportedAt: Date.now(),
          totalLogs: this.logs.length,
          version: '1.0'
        },
        logs: this.logs
      }, null, 2);
    } else if (format === 'csv') {
      const headers = [
        'timestamp', 'category', 'action', 'userId', 'success', 
        'riskLevel', 'ip', 'userAgent', 'metadata'
      ];
      
      const csvLines = [headers.join(',')];
      
      this.logs.forEach(log => {
        const row = [
          new Date(log.timestamp).toISOString(),
          log.category,
          log.action,
          log.userId || '',
          log.success?.toString() || '',
          log.riskLevel,
          log.ip || '',
          log.userAgent || '',
          JSON.stringify(log.metadata || {}).replace(/"/g, '""')
        ];
        csvLines.push(row.map(field => `"${field}"`).join(','));
      });
      
      return csvLines.join('\n');
    }
    
    throw new Error(`Unsupported export format: ${format}`);
  }

  generateComplianceReport(): ComplianceReport {
    const now = Date.now();
    const logsByCategory: { [category: string]: number } = {};
    const riskDistribution: { [risk: string]: number } = {};
    const userCounts: { [userId: string]: number } = {};
    const actionCounts: { [action: string]: number } = {};
    
    let securityEvents = 0;
    let failedOperations = 0;
    let totalOperations = 0;

    this.logs.forEach(log => {
      // Category distribution
      logsByCategory[log.category] = (logsByCategory[log.category] || 0) + 1;
      
      // Risk distribution
      riskDistribution[log.riskLevel] = (riskDistribution[log.riskLevel] || 0) + 1;
      
      // User activity
      if (log.userId) {
        userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
      }
      
      // Action counts
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      
      // Security metrics
      if (log.category === 'security') {
        securityEvents++;
      }
      
      if (log.success !== undefined) {
        totalOperations++;
        if (!log.success) {
          failedOperations++;
        }
      }
    });

    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, logCount: count }))
      .sort((a, b) => b.logCount - a.logCount)
      .slice(0, 10);

    const topActions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const timeRange = {
      start: this.logs.length > 0 ? Math.min(...this.logs.map(l => l.timestamp)) : now,
      end: this.logs.length > 0 ? Math.max(...this.logs.map(l => l.timestamp)) : now
    };

    return {
      totalLogs: this.logs.length,
      timeRange,
      logsByCategory,
      riskDistribution,
      topUsers,
      topActions,
      securityEvents,
      failureRate: totalOperations > 0 ? failedOperations / totalOperations : 0,
      generatedAt: now
    };
  }

  setAlertThreshold(threshold: AlertThreshold): void {
    this.alertThresholds.push(threshold);
  }

  setArchiveCallback(callback: (logs: BaseAuditLog[]) => void): void {
    this.archiveCallback = callback;
  }

  cleanupOldLogs(retentionDays: number): void {
    const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    const oldLogs = this.logs.filter(log => log.timestamp < cutoff);
    
    if (oldLogs.length > 0) {
      // Archive old logs if callback is set
      if (this.archiveCallback) {
        this.archiveCallback(oldLogs);
      }
      
      // Remove old logs
      this.logs = this.logs.filter(log => log.timestamp >= cutoff);
      
      logger.info('Cleaned up old audit logs', {
        removedCount: oldLogs.length,
        retentionDays,
        remainingCount: this.logs.length
      });
    }
  }

  shutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  private addLog(log: BaseAuditLog): void {
    this.logs.push(log);
    
    // Limit memory usage
    if (this.logs.length > this.maxLogs) {
      const excessLogs = this.logs.slice(0, this.logs.length - this.maxLogs);
      
      // Archive excess logs if callback is set
      if (this.archiveCallback) {
        this.archiveCallback(excessLogs);
      }
      
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  private calculateAuthRiskLevel(event: AuthEvent): RiskLevel {
    if (!event.success) {
      return 'medium';
    }
    
    switch (event.action) {
      case 'password_change':
      case 'password_reset':
      case 'email_change':
        return 'high';
      case 'login':
      case 'logout':
        return 'low';
      case 'mfa_setup':
      case 'mfa_disable':
        return 'high';
      default:
        return 'medium';
    }
  }

  private calculateDataAccessRiskLevel(event: DataAccessEvent): RiskLevel {
    if (!event.success) {
      return 'high'; // Failed data access is suspicious
    }

    // Consider data sensitivity
    if (event.sensitivity === 'restricted') {
      return 'critical';
    } else if (event.sensitivity === 'confidential') {
      return 'high';
    }

    // Consider action type
    switch (event.action) {
      case 'delete':
        return 'high';
      case 'update':
      case 'create':
        return 'medium';
      case 'read':
        return 'low';
      default:
        return 'medium';
    }
  }

  private calculateAdminRiskLevel(event: AdminEvent): RiskLevel {
    switch (event.action) {
      case 'user_deletion':
      case 'system_shutdown':
      case 'config_change':
        return 'critical';
      case 'user_suspension':
      case 'role_change':
        return 'high';
      case 'user_creation':
      case 'password_reset':
        return 'medium';
      default:
        return 'medium';
    }
  }

  private mapSeverityToRiskLevel(severity: SecurityEvent['severity']): RiskLevel {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
    }
  }

  private checkAlerts(): void {
    const now = Date.now();
    
    this.alertThresholds.forEach(threshold => {
      const cutoff = now - threshold.timeWindow;
      const recentLogs = this.logs.filter(
        log => log.timestamp >= cutoff && log.riskLevel === threshold.riskLevel
      );
      
      if (recentLogs.length >= threshold.threshold) {
        threshold.callback({
          riskLevel: threshold.riskLevel,
          count: recentLogs.length,
          threshold: threshold.threshold,
          recentLogs
        });
      }
    });
  }

  private startPeriodicChecks(): void {
    // Check alerts and cleanup every 5 minutes
    this.checkInterval = setInterval(() => {
      this.checkAlerts();
      
      // Occasional cleanup (1% chance each check)
      if (Math.random() < 0.01) {
        this.cleanupOldLogs(365); // Keep 1 year by default
      }
    }, 5 * 60 * 1000);
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Also export for testing
export default AuditLogger;