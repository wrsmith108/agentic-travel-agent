# 📋 Decision Log
## Agentic Travel Agent MVP

**Purpose**: Track all architectural decisions with context and trade-offs  
**Format**: Chronological with decision rationale  

---

## June 23, 2025 - Day 1 Implementation

### DEC-001: Added Twilio Alongside SendGrid
**Context**: User provided Twilio credentials during setup  
**Decision**: Support both email (SendGrid) and SMS/WhatsApp (Twilio)  
**Rationale**: More notification options for users  
**Trade-offs**: 
- ✅ Flexibility in notification channels
- ❌ Increased complexity
- ❌ Higher monthly costs
- ❌ Diverged from original requirements
**Status**: Implemented but needs review  

### DEC-002: TypeScript Strict Mode Despite Complexity
**Context**: Multiple TypeScript errors during initial setup  
**Decision**: Keep strict mode and fix all errors  
**Rationale**: Long-term code quality worth short-term pain  
**Trade-offs**:
- ✅ Catches bugs at compile time
- ✅ Better IDE support
- ❌ Slower initial development
- ❌ Required workarounds (tsconfig.node.json)
**Status**: Implemented with workarounds  

### DEC-003: Demo Mode with Feature Toggle
**Context**: Need to test without consuming API credits  
**Decision**: Implement demo mode toggle in UI header  
**Rationale**: Easy testing and development  
**Trade-offs**:
- ✅ Saves API costs during development
- ✅ Good user experience for testing
- ❌ Additional code complexity
- ❌ Must maintain demo data
**Status**: Successfully implemented  

### DEC-004: Comprehensive Monitoring on Day 1
**Context**: Best practices suggest monitoring from start  
**Decision**: Implement Winston logging + Prometheus metrics  
**Rationale**: Production-ready from beginning  
**Trade-offs**:
- ✅ Great observability
- ✅ Easy to debug issues
- ❌ Over-engineered for MVP
- ❌ Added complexity before core features
**Status**: Implemented but questionable for MVP  

### DEC-005: File-Based Storage with "Atomic" Writes
**Context**: Keep MVP simple, avoid database setup  
**Decision**: Use temp file + rename for atomicity  
**Rationale**: Simpler than database for MVP  
**Trade-offs**:
- ✅ No database dependencies
- ✅ Easy to understand
- ❌ No true ACID compliance
- ❌ Race conditions possible
- ❌ No built-in queries
**Status**: Design complete, not yet implemented  

### DEC-006: Node-cron Despite Known Issues
**Context**: Need scheduled tasks, aware of memory leak  
**Decision**: Use node-cron with monitoring  
**Rationale**: Simplest solution for MVP  
**Trade-offs**:
- ✅ Simple to implement
- ✅ No external dependencies
- ❌ Known memory leak issue
- ❌ Not production-ready
- ❌ Can't scale horizontally
**Status**: Planned with concerns  

---

## Decisions Needing Revisit

### REVISIT-001: Notification Strategy
**Issue**: Using both SendGrid and Twilio unclear  
**Options**:
1. Email only (SendGrid) - matches original spec
2. SMS only (Twilio) - simpler, modern
3. Both with user preference - complex but flexible
**Recommendation**: Pick one for MVP, add other later  

### REVISIT-002: Session Storage
**Issue**: In-memory sessions lose data on restart  
**Options**:
1. Keep in-memory for MVP
2. Add Redis now
3. Use JWT tokens instead
**Recommendation**: JWT tokens for stateless auth  

### REVISIT-003: Testing Strategy  
**Issue**: 100% coverage unrealistic for MVP pace  
**Options**:
1. Keep 100% target (slow)
2. 80% coverage for MVP
3. Critical paths only (~60%)
**Recommendation**: Critical paths only for MVP  

### REVISIT-004: Monitoring Scope
**Issue**: Over-engineered monitoring for MVP  
**Options**:
1. Keep full monitoring
2. Logging only for MVP
3. Basic health check + logs
**Recommendation**: Basic health check + logs  

---

## Lessons Learned

### What Went Well
1. **TypeScript strict mode** caught real bugs
2. **Demo mode** implementation clean and useful
3. **Project structure** well-organized
4. **Error handling** properly structured

### What Went Wrong  
1. **Scope creep**: Added features not in requirements
2. **No decision documentation**: Made changes without ADRs
3. **Security oversight**: Committed API keys
4. **Over-engineering**: Too much infrastructure

### Process Improvements
1. Document decisions BEFORE implementation
2. Stick to requirements unless explicitly changed  
3. Security review before ANY commit
4. MVP means MINIMUM - resist adding "nice to haves"

---

## Future Decision Framework

### Before Making Architectural Decisions:
1. **Document the context** - Why is this decision needed?
2. **List all options** - What are the alternatives?
3. **Analyze trade-offs** - What do we gain/lose?
4. **Consider MVP scope** - Is this essential now?
5. **Get approval** - For significant changes
6. **Update ADRs** - Keep architecture docs current

### Red Flags to Avoid:
- ❌ "While we're at it" additions
- ❌ "It's a best practice" without context
- ❌ "We'll need it later" features
- ❌ Undocumented pivots
- ❌ Security as afterthought

---

## Immediate Decisions Needed

### DEC-007: API Key Security [URGENT]
**Context**: Keys exposed in repository  
**Options**:
1. Rotate keys and use env.example only
2. Implement secret management now
3. Use GitHub secrets for CI/CD
**Recommendation**: Rotate immediately, env.example only  

### DEC-008: Continue with Current Stack?
**Context**: CTO review identified issues  
**Options**:
1. Continue as-is and fix incrementally
2. Pause and address critical issues
3. Simplify stack for true MVP
**Recommendation**: Pause and fix critical issues  

### DEC-009: Notification Service Final Decision
**Context**: Have both SendGrid and Twilio  
**Options**:
1. SendGrid only (email)
2. Twilio only (SMS)
3. User choice of either
**Recommendation**: Email only for MVP simplicity  

---

**Next Steps**:
1. Get stakeholder approval on decisions
2. Update ADRs with decisions made
3. Create implementation plan for fixes
4. Document final architecture