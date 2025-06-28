# Swarm Sizing Guide for Software Development Tasks

## Overview

This guide provides optimal agent counts for different types of software development tasks based on research into coordination overhead, resource efficiency, and diminishing returns.

## Key Principle

Communication overhead grows as **n(n-1)/2** where n is the number of agents. Start with the minimum viable number of agents and scale only when bottlenecks emerge.

## Optimal Agent Counts by Task Type

### 1. Simple CRUD Operations (2-3 agents)
- **Optimal**: 2 agents
- **Maximum**: 3 agents
- **Rationale**: Minimal coordination overhead needed
- **Task Distribution**:
  - Agent 1: Create/Update operations
  - Agent 2: Read/Delete operations  
  - Agent 3 (if needed): Testing and validation

### 2. Complex System Design (5-7 agents)
- **Optimal**: 5 agents
- **Maximum**: 7 agents
- **Rationale**: Balance between diverse expertise and communication complexity
- **Task Distribution**:
  - Agent 1: Architecture overview
  - Agent 2: Data modeling
  - Agent 3: API design
  - Agent 4: Security considerations
  - Agent 5: Performance planning
  - Agents 6-7: Integration patterns, scaling strategies

### 3. Testing & QA (4-6 agents)
- **Optimal**: 4 agents
- **Maximum**: 6 agents
- **Rationale**: Highly parallelizable with clear boundaries
- **Task Distribution**:
  - Agent 1: Unit tests
  - Agent 2: Integration tests
  - Agent 3: E2E tests
  - Agent 4: Performance tests
  - Agents 5-6: Security tests, edge cases

### 4. Security Implementation (3-4 agents)
- **Optimal**: 3 agents
- **Maximum**: 4 agents
- **Rationale**: Tight coordination critical for security consistency
- **Task Distribution**:
  - Agent 1: Authentication/Authorization
  - Agent 2: Input validation/sanitization
  - Agent 3: Security headers/CORS
  - Agent 4: Audit logging/monitoring

### 5. Performance Optimization (3-5 agents)
- **Optimal**: 3 agents
- **Maximum**: 5 agents
- **Rationale**: Avoid conflicting optimizations
- **Task Distribution**:
  - Agent 1: Database optimization
  - Agent 2: Application code optimization
  - Agent 3: Caching strategies
  - Agents 4-5: Frontend optimization, CDN setup

## Scaling Guidelines

### When to Use Minimum Agents
- Time-sensitive tasks
- Well-defined scope
- Low interdependency
- Clear interfaces

### When to Scale Up
- Multiple independent subtasks
- Need for diverse expertise
- Complex integration requirements
- Parallel processing opportunities

### Warning Signs of Over-Scaling
- Agents waiting on each other
- Conflicting implementations
- Communication overhead > 30% of time
- Duplicate work occurring

## Task Modularity Factors

### High Modularity (Can use more agents)
- Clear API boundaries
- Independent data domains
- Separate test suites
- Microservice architecture

### Low Modularity (Use fewer agents)
- Shared state management
- Complex data dependencies
- Monolithic architecture
- Real-time coordination needs

## Practical Application

### Phase 0 Authentication System Example
Based on our breakdown:
- **JWT Service**: 1 agent (focused task)
- **Auth Endpoints**: 2 agents (login/register, logout/refresh)
- **Middleware**: 1 agent (focused task)
- **Total**: 4 agents working with clear boundaries

### Coordination Strategies

#### For 2-3 Agent Teams
- Direct communication
- Shared memory updates
- Simple task queue

#### For 4-6 Agent Teams
- Designated coordinator
- Structured checkpoints
- Clear interface definitions

#### For 7+ Agent Teams
- Hierarchical coordination
- Sub-team structure
- Formal integration points

## Memory Bank Integration

When using these guidelines:
1. Store task type in memory
2. Record actual agents used
3. Note any bottlenecks encountered
4. Update recommendations based on results

Example memory entry:
```
Key: task_jwt_service_implementation
Value: {
  "task_type": "security_implementation",
  "agents_recommended": 3,
  "agents_used": 1,
  "duration": "2 hours",
  "bottlenecks": "none",
  "outcome": "successful"
}
```

## Continuous Improvement

After each task:
1. Compare recommended vs actual agent count
2. Identify coordination overhead
3. Document lessons learned
4. Adjust guidelines if patterns emerge

---

*Last Updated: December 2024*
*Based on: SPARC Research Session on Swarm Optimization*