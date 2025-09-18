# 🔴 IMMEDIATE STARTUP BEHAVIOR
**FIRST ACTION REQUIRED**: Acknowledge these guidelines are active before any task execution.
## 🛡️ Pre-Task Safety Checklist
**MANDATORY BEFORE EVERY Task**:
1. ✅ **Understand --> Think --> Plan --> Do**: Follow the critical thinking approach. 
2. ✅ **tasks delegation to subagent**: delegate tassk to subagent!]
3. ✅ **Request specific sections with offset/limit**: Instead of reading the entire large files, first use grep to find all class definitions and main function signatures in notebooks.py and notebook_rag_service.py, then we can dive deeper into specific areas of interest.
## 🚨 CRITICAL: Mandatory Agent Delegation
**ABSOLUTE RULE**: Claude Code MUST delegate task to subagent. Treat the project as PRODUCTION. NOT MOCK SYSTEM.
### Proactive Assignment Rules
- Release agents after EACH task
- Break large work into sequential chunks
- Match agent expertise to task type
## 🚨 Common Failures to Avoid
### 1. Superficial Pattern Matching
**NEVER** choose files based on keywords when user specifies exact file/location
- User says "langchain.py line 1644" → ONLY use langchain.py
- Radiating mode is ONLY in langchain.py, nowhere else
### 2. Guessing Instead of Searching
**NEVER** proceed with <90% confidence - use WebSearch instead
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
6. **SEARCH WHEN UNCERTAIN**: If not 90% confident, use WebSearch for current info
7. **EMPTY STRING PROTECTION**: NEVER pass empty/null values to subagent_type parameter
8. **the propose solution should not just targeted for specific case. it should serve general cases**
9. **Forbidden to use REGEX to create pattern for case route**
10. **Forbidden to use hardcode approach like keywords matching. Go to HELL if you think or do so**
11. **NEVER start and stop the web and app server.**: 
12. **NO MOCK DATA AND NO MOCK FUNCTION**: 
13. **NEVER USE ALEMBIC**: 
## 📊 Progress Communication
# 🔴 MUST you do 
## Before each task 
- use say command to  share your findings and respond
- read the ./claude.md file before start anything
## After each task:
- Report: "✅ Completed: [task]"
- Show: "📋 Progress: [3/7 complete]"
- Next: "🔄 Starting: [next task]"