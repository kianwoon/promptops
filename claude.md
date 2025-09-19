# 🔴 IMMEDIATE STARTUP BEHAVIOR
**FIRST ACTION REQUIRED**: Acknowledge these guidelines are active before any task execution.

**MANDATORY BEFORE EVERY Task**:
1. ✅ **Understand --> Think --> Plan --> Do**: Follow the critical thinking approach. 
2 ✅ **DO NOT TREAT THIS AS MOCK PROJECT**.

## 🚨 Common Failures to Avoid
### 1. Superficial Pattern Matching
### 2. Guessing Instead of Searching
**NEVER** proceed with <90% confidence - use Web Search instead
## 🔍 When to Use WebSearch
### Required for:
- Current API documentation (FastAPI, React, PostgreSQL versions
- Recent library syntax changes or deprecations
- Latest best practices for libraries/frameworks
- Error messages not in knowledge base
- Performance optimization techniques
- Security vulnerability fixes

## 🔴 Core Rules - NO EXCEPTIONS
1. **NO DIRECT EXECUTION + VALIDATION**: ALL modifications via Task tool with MANDATORY input validation
2. **READ BEFORE ACTING**: Always analyze codebase first
3. **FOLLOW PATTERNS**: If 5+ files do it one way, that's the standard
4. **NO HARDCODING and CODE FOR SPECIFIC CASE TO WORK ONLY**
5. **EXPLICIT WINS**: User's explicit instructions override patterns
6. **WEB SEARCH WHEN UNCERTAIN**: If not 90% confident, use WebSearch for current info
7. **EMPTY STRING PROTECTION**: NEVER pass empty/null values to subagent_type parameter
8. **the propose solution should not just targeted for specific case. it should serve general cases**
9. **Forbidden to use REGEX to create pattern for case route**
10. **NEVER start and stop the web and app server.**: 
11. **NO MOCK DATA AND NO MOCK FUNCTION**: 
12. **NEVER USE ALEMBIC**: 

# 🔴 MUST you do 
## Before each task 
- use say command to  share your findings and respond
- read the ./claude.md file before start anything

## After each task:
- check app and web server to confirm no new issue. and fixes are good.
- Report: "✅ Completed: [task]"
- Show: "📋 Progress: [3/7 complete]"
- Next: "🔄 Starting: [next task]"

## below are the key system components 
# Database Configuration
DATABASE_URL=postgresql://promptops:promptops@localhost:5432/promptops
# Redis Configuration
REDIS_URL=redis://localhost:6379

## we are using postgres as the main storage within the app. LocalStorage is just temporary. 