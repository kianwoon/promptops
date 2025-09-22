# 🔴 IMMEDIATE STARTUP BEHAVIOR
**FIRST ACTION REQUIRED**: Acknowledge these guidelines are active before any task execution.

**MANDATORY BEFORE EVERY Task**:
1. ✅ **Understand --> Think --> Plan --> Do**: Follow the critical thinking approach.
2 ✅ **DO NOT TREAT THIS project and system as mock or development**.

## 🚨 Common Failures to Avoid
### 1. Superficial Pattern Matching
### 2. Guessing Instead of Searching
**NEVER** proceed with <95% confidence - use Web Search instead

## 🔍 When to Use WebSearch
### Web Search Confidence Threshold:
- Use WebSearch when < 90% confident about ANY technical detail
- When in doubt, search - better to be thorough than wrong
- Search for: current API docs, library versions, error messages
- NEVER guess at technical specifications

## 🔴 Core Rules - NO EXCEPTIONS
1. **NO DIRECT EXECUTION + VALIDATION**: ALL modifications via Task tool with MANDATORY input validation
2. **READ BEFORE ACTING**: Always analyze codebase first
3. **FOLLOW PATTERNS**: If 5+ files do it one way, that's the standard
4. **NO HARDCODING and CODE FOR SPECIFIC CASE TO WORK ONLY**
5. **EXPLICIT WINS**: User's explicit instructions override patterns
6. **WEB SEARCH WHEN UNCERTAIN**: If not 90% confident, use WebSearch for current info
7. **EMPTY STRING PROTECTION**: NEVER pass empty/null values to subagent_type parameter
8. **GENERAL SOLUTIONS**: Solutions should serve general cases, not specific hardcoded scenarios
9. **FORBIDDEN REGEX**: Forbidden to use REGEX to create pattern for case route
10. **SERVER STABILITY**: DO NOT start and stop the web and app server
11. **NO MOCKING**: NO MOCK DATA AND NO MOCK FUNCTION
12. **NO ALEMBIC**: NEVER USE ALEMBIC

## 🛡️ MANDATORY VALIDATION BEFORE ANY CODE CHANGE
- ✅ Verify file exists and is accessible
- ✅ Check syntax/compilation before modifying
- ✅ Validate imports and dependencies
- ✅ Test changes don't break existing functionality
- ✅ Follow existing code patterns and style

## 🔴 PRIORITY HIERARCHY
1. User explicit instructions (highest)
2. CLAUDE.md rules
3. Existing codebase patterns
4. General best practices (lowest)

## 🎯 TASK SUCCESS CRITERIA
- Code must compile without errors
- All existing tests must pass
- New functionality must be tested
- Documentation must be updated
- Must follow existing patterns

## ⚠️ ERROR HANDLING STANDARDS
- ALL async operations must have try/catch
- User inputs must be validated
- API responses must be checked for errors
- Graceful degradation required

## 🔄 MANDATORY COMMUNICATION PROTOCOL
### YOU MUST update on progress, findings, solutions, task assigned!
1. Take only the **first 400 characters** of your reply text (skip any code blocks or fenced code).
2. Escape double quotes in that text.
3. Pass that text into this Bash command to speak it aloud on the host machine:

Bash(echo "{{first 400 characters of your reply without code blocks, with double quotes escaped}}" | /Users/kianwoonwong/Downloads/promptops/claude-say.sh)

Do not wrap or escape this command in additional formatting. Just print your reply, then the Bash block exactly as shown.

## 🏗️ CODE QUALITY REQUIREMENTS
- Follow existing naming conventions
- Use TypeScript types strictly
- Implement proper error boundaries
- Add comments for complex logic
- No dead code or commented out blocks

## 🔧 DECISION FRAMEWORK WHEN UNCERTAIN
1. Stop and think
2. Search for documentation
3. Analyze existing patterns
4. Ask for clarification if still unsure

# 🔴 MUST YOU DO
## Before each task
- Read the ./claude.md file before start anything
- Validate task requirements and scope

## After each task:
- Check app and web server to confirm no new issues and fixes are good
- Report: "✅ Completed: [task]"
- Show: "📋 Progress: [X/Y complete]"
- Next: "🔄 Starting: [next task]"

## 🔍 ABSOLUTE NO HARDCODING
- Use environment variables for ALL configuration
- Use database settings for dynamic values
- Never hardcode URLs, ports, credentials, or magic numbers
- Create reusable constants for repeated values

## 📊 KEY SYSTEM COMPONENTS
# Database Configuration
DATABASE_URL=postgresql://promptops:promptops@localhost:5432/promptops
# Redis Configuration
REDIS_URL=redis://localhost:6379

## STORAGE ARCHITECTURE
- PostgreSQL is the main storage within the app
- LocalStorage is just temporary cache
- Redis for session management and caching 

### Database Configuration
DATABASE_URL=postgresql://promptops:promptops@localhost:5432/promptops

### Redis Configuration
REDIS_URL=redis://localhost:6379