import { AuditLogger } from '../auditLogger';
import { AppError, ErrorCodes } from '../../../middleware/errorHandler';
import { isOk, isErr } from '../../../utils/result';

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    auditLogger = new AuditLogger();
  });

  afterEach(() => {
    auditLogger.shutdown();
  });

  describe('Authentication Events', () => {
    it('should log successful login', () => {
      const event = {
        userId: 'user123',
        action: 'login',
        success: true,
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };

      const result = auditLogger.logAuthEvent(event);
      
      expect(isOk(result)).toBe(true);
      
      const logs = auditLogger.getAuditLogs('auth');
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('login');
      expect(logs[0].success).toBe(true);
    });

    it('should log failed login attempt', () => {
      const event = {
        email: 'user@example.com',
        action: 'login',
        success: false,
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        reason: 'Invalid credentials'
      };

      const result = auditLogger.logAuthEvent(event);
      
      expect(isOk(result)).toBe(true);
      
      const logs = auditLogger.getAuditLogs('auth');
      expect(logs[0].metadata.reason).toBe('Invalid credentials');
      expect(logs[0].riskLevel).toBe('medium');
    });

    it('should log password changes', () => {
      const event = {
        userId: 'user123',
        action: 'password_change',
        success: true,
        ip: '192.168.1.1'
      };

      auditLogger.logAuthEvent(event);
      
      const logs = auditLogger.getAuditLogs('auth');
      expect(logs[0].action).toBe('password_change');
      expect(logs[0].riskLevel).toBe('high');
    });
  });

  describe('Data Access Events', () => {
    it('should log data read operations', () => {
      const event = {
        userId: 'user123',
        resource: 'user_profiles',
        action: 'read',
        resourceId: 'profile456',
        success: true
      };

      const result = auditLogger.logDataAccess(event);
      
      expect(isOk(result)).toBe(true);
      
      const logs = auditLogger.getAuditLogs('data');
      expect(logs[0].metadata.resource).toBe('user_profiles');
      expect(logs[0].action).toBe('read');
    });

    it('should log data modification operations', () => {
      const event = {
        userId: 'user123',
        resource: 'user_profiles',
        action: 'update',
        resourceId: 'profile456',
        changes: {
          email: { old: 'old@example.com', new: 'new@example.com' }
        },
        success: true
      };

      auditLogger.logDataAccess(event);
      
      const logs = auditLogger.getAuditLogs('data');
      expect(logs[0].metadata.changes).toBeDefined();
      expect(logs[0].riskLevel).toBe('medium');
    });

    it('should log unauthorized access attempts', () => {
      const event = {
        userId: 'user123',
        resource: 'admin_panel',
        action: 'read',
        success: false,
        reason: 'Insufficient permissions'
      };

      auditLogger.logDataAccess(event);
      
      const logs = auditLogger.getAuditLogs('data');
      expect(logs[0].riskLevel).toBe('high');
      expect(logs[0].metadata.reason).toBe('Insufficient permissions');
    });
  });

  describe('Security Events', () => {
    it('should log security violations', () => {
      const event = {
        type: 'xss_attempt',
        severity: 'high',
        source: 'form_input',
        payload: '<script>alert("xss")</script>',
        ip: '192.168.1.100',
        blocked: true
      };

      const result = auditLogger.logSecurityEvent(event);
      
      expect(isOk(result)).toBe(true);
      
      const logs = auditLogger.getAuditLogs('security');
      expect(logs[0].metadata.type).toBe('xss_attempt');
      expect(logs[0].metadata.severity).toBe('high');
      expect(logs[0].metadata.blocked).toBe(true);
    });

    it('should log rate limiting events', () => {
      const event = {
        type: 'rate_limit_exceeded',
        severity: 'medium',
        ip: '192.168.1.100',
        endpoint: '/api/login',
        requestCount: 50,
        timeWindow: 60000
      };

      auditLogger.logSecurityEvent(event);
      
      const logs = auditLogger.getAuditLogs('security');
      expect(logs[0].metadata.requestCount).toBe(50);
      expect(logs[0].metadata.endpoint).toBe('/api/login');
    });
  });

  describe('Administrative Events', () => {
    it('should log admin operations', () => {
      const event = {
        adminId: 'admin123',
        action: 'user_deletion',
        targetUserId: 'user456',
        reason: 'User requested account deletion',
        success: true
      };

      const result = auditLogger.logAdminEvent(event);
      
      expect(isOk(result)).toBe(true);
      
      const logs = auditLogger.getAuditLogs('admin');
      expect(logs[0].action).toBe('user_deletion');
      expect(logs[0].riskLevel).toBe('critical');
    });

    it('should log configuration changes', () => {
      const event = {
        adminId: 'admin123',
        action: 'config_change',
        configKey: 'rate_limit_threshold',
        oldValue: '100',
        newValue: '200',
        success: true
      };

      auditLogger.logAdminEvent(event);
      
      const logs = auditLogger.getAuditLogs('admin');
      expect(logs[0].metadata.configKey).toBe('rate_limit_threshold');
      expect(logs[0].metadata.oldValue).toBe('100');
      expect(logs[0].metadata.newValue).toBe('200');
    });
  });

  describe('Query and Filtering', () => {
    beforeEach(() => {
      // Add sample logs
      auditLogger.logAuthEvent({
        userId: 'user1',
        action: 'login',
        success: true,
        ip: '192.168.1.1'
      });

      auditLogger.logDataAccess({
        userId: 'user1',
        resource: 'profiles',
        action: 'read',
        success: true
      });

      auditLogger.logSecurityEvent({
        type: 'sql_injection',
        severity: 'high',
        ip: '192.168.1.100',
        blocked: true
      });
    });

    it('should filter logs by user ID', () => {
      const logs = auditLogger.getLogsByUser('user1');
      
      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.userId === 'user1')).toBe(true);
    });

    it('should filter logs by time range', () => {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      
      const logs = auditLogger.getLogsByTimeRange(oneHourAgo, now);
      
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every(log => log.timestamp >= oneHourAgo && log.timestamp <= now)).toBe(true);
    });

    it('should filter logs by risk level', () => {
      const highRiskLogs = auditLogger.getLogsByRiskLevel('high');
      
      expect(highRiskLogs.length).toBeGreaterThan(0);
      expect(highRiskLogs.every(log => log.riskLevel === 'high')).toBe(true);
    });

    it('should search logs by content', () => {
      const logs = auditLogger.searchLogs('login');
      
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(log => log.action === 'login')).toBe(true);
    });
  });

  describe('Export and Compliance', () => {
    beforeEach(() => {
      // Add sample logs for export
      auditLogger.logAuthEvent({
        userId: 'user1',
        action: 'login',
        success: true,
        ip: '192.168.1.1'
      });

      auditLogger.logDataAccess({
        userId: 'user1',
        resource: 'profiles',
        action: 'read',
        success: true
      });
    });

    it('should export logs in JSON format', () => {
      const exportData = auditLogger.exportLogs('json');
      
      expect(exportData).toBeDefined();
      expect(typeof exportData).toBe('string');
      
      const parsed = JSON.parse(exportData);
      expect(Array.isArray(parsed.logs)).toBe(true);
      expect(parsed.metadata).toBeDefined();
    });

    it('should export logs in CSV format', () => {
      const exportData = auditLogger.exportLogs('csv');
      
      expect(exportData).toBeDefined();
      expect(exportData).toContain('timestamp,category,action,userId');
      expect(exportData.split('\n').length).toBeGreaterThan(1);
    });

    it('should generate compliance report', () => {
      const report = auditLogger.generateComplianceReport();
      
      expect(report.totalLogs).toBeGreaterThan(0);
      expect(report.logsByCategory).toBeDefined();
      expect(report.riskDistribution).toBeDefined();
      expect(report.timeRange).toBeDefined();
    });
  });

  describe('Alerting', () => {
    it('should trigger alert for critical events', () => {
      const mockCallback = jest.fn();
      
      auditLogger.setAlertThreshold({
        riskLevel: 'critical',
        threshold: 1,
        timeWindow: 300000, // 5 minutes
        callback: mockCallback
      });

      auditLogger.logSecurityEvent({
        type: 'data_breach_attempt',
        severity: 'critical',
        ip: '192.168.1.100'
      });

      // Check if alert was triggered
      expect(mockCallback).toHaveBeenCalledWith({
        riskLevel: 'critical',
        count: 1,
        threshold: 1,
        recentLogs: expect.any(Array)
      });
    });

    it('should aggregate multiple events for alerting', () => {
      const mockCallback = jest.fn();
      
      auditLogger.setAlertThreshold({
        riskLevel: 'medium',
        threshold: 3,
        timeWindow: 300000,
        callback: mockCallback
      });

      // Generate multiple medium risk events
      for (let i = 0; i < 4; i++) {
        auditLogger.logAuthEvent({
          email: 'user@example.com',
          action: 'login',
          success: false,
          ip: '192.168.1.100'
        });
      }

      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('Retention and Cleanup', () => {
    it('should respect retention policies', () => {
      // Add old logs
      const oldTimestamp = Date.now() - (400 * 24 * 60 * 60 * 1000); // 400 days ago
      
      (auditLogger as any).logs.push({
        id: 'old-log',
        timestamp: oldTimestamp,
        category: 'auth',
        action: 'login',
        riskLevel: 'low'
      });

      auditLogger.cleanupOldLogs(365); // Keep 1 year
      
      const logs = auditLogger.getAllLogs();
      expect(logs.every(log => log.id !== 'old-log')).toBe(true);
    });

    it('should archive logs before deletion', () => {
      const archiveCallback = jest.fn();
      auditLogger.setArchiveCallback(archiveCallback);

      // Add old log
      const oldTimestamp = Date.now() - (400 * 24 * 60 * 60 * 1000);
      (auditLogger as any).logs.push({
        id: 'archive-log',
        timestamp: oldTimestamp,
        category: 'auth',
        action: 'login',
        riskLevel: 'low'
      });

      auditLogger.cleanupOldLogs(365);
      
      expect(archiveCallback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'archive-log' })
        ])
      );
    });
  });

  describe('Performance', () => {
    it('should handle high volume logging', () => {
      const startTime = Date.now();
      
      // Log 1000 events
      for (let i = 0; i < 1000; i++) {
        auditLogger.logAuthEvent({
          userId: `user${i}`,
          action: 'login',
          success: true,
          ip: '192.168.1.1'
        });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(1000); // Less than 1 second
      
      const logs = auditLogger.getAllLogs();
      expect(logs).toHaveLength(1000);
    });

    it('should limit memory usage', () => {
      const maxLogs = (auditLogger as any).maxLogs || 100000;
      
      // Add more logs than the limit
      for (let i = 0; i < maxLogs + 100; i++) {
        auditLogger.logAuthEvent({
          userId: `user${i}`,
          action: 'login',
          success: true,
          ip: '192.168.1.1'
        });
      }
      
      const logs = auditLogger.getAllLogs();
      expect(logs.length).toBeLessThanOrEqual(maxLogs);
    });
  });
});