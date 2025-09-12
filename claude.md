# 🔴 IMMEDIATE STARTUP BEHAVIOR
**FIRST ACTION REQUIRED**: Acknowledge these guidelines are active before any task execution.

## 🛡️ Pre-Task Safety Checklist

**MANDATORY BEFORE EVERY Task**:

1. ✅ **Understand --> Think --> Plan --> Do**: Follow the critical thinking approach. 
2. ✅ **tasks delegation to subagent**: delegate tassk to subagent!]
3. ✅ **Request specific sections with offset/limit**: Instead of reading the entire large files, first use grep to find all class definitions and main function signatures in notebooks.py and notebook_rag_service.py, then we can dive deeper into specific areas of interest.


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