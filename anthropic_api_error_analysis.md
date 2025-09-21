# Anthropic API Error 400 "Unknown Model" - Analysis Report

## Issue Summary
The system is experiencing an Anthropic API error 400 "Unknown Model" when attempting to use AI assistant functionality. The root cause has been identified as hardcoded fallback model names that are incompatible with the custom API endpoint being used.

## Root Cause Analysis

### 1. Current Database Configuration
The database contains AI assistant providers with the following configuration:

**Provider 1:**
- ID: `e297567b-2c1c-45f9-aee6-4bc71d1d0da8`
- Name: GLM
- Type: `anthropic`
- Model Name: `GLM-4.5`
- API Base URL: `https://api.z.ai/api/anthropic`
- Status: active

**Provider 2:**
- ID: `48871618-d635-406b-9a54-de0ba5ebc7b5`
- Name: GLM Air
- Type: `anthropic`
- Model Name: `GLM-4.5 Air`
- API Base URL: `https://api.z.ai/api/anthropic`
- Status: active

### 2. Hardcoded Fallback Model Problem
The issue occurs in the following files where hardcoded fallback model names are used:

#### `/Users/kianwoonwong/Downloads/promptops/app/services/ai_assistant_service_proper.py`

**Line 776:** (in `_test_anthropic_provider` method)
```python
model = provider.model_name or "claude-3-5-haiku-20241022"
```

**Line 1493:** (in `_generate_with_anthropic` method)
```python
"model": provider.model_name or "claude-3-5-haiku-20241022",
```

#### `/Users/kianwoonwong/Downloads/promptops/app/services/model_service.py`

**Lines 97, 114, 132:** (in `AnthropicProvider` class)
```python
"claude-3-5-haiku-20241022",
```

### 3. API Endpoint Incompatibility
The system is using a custom API endpoint `https://api.z.ai/api/anthropic` which appears to be a proxy or compatible service that supports GLM models (GLM-4.5, GLM-4.5 Air) but does not support the official Anthropic model names like "claude-3-5-haiku-20241022".

### 4. When the Error Occurs
The error happens when:
1. A provider record has `model_name` set to NULL, empty string, or not properly configured
2. The code falls back to the hardcoded model name "claude-3-5-haiku-20241022"
3. The API call is made to `https://api.z.ai/api/anthropic` with this invalid model name
4. The API returns a 400 "Unknown Model" error

## Specific Model Names Found

### Valid Models (from database):
- `GLM-4.5`
- `GLM-4.5 Air`

### Invalid Fallback Models (in code):
- `claude-3-5-haiku-20241022`
- `claude-3-haiku-20240307`
- `claude-3-7-sonnet-20250219`
- `claude-sonnet-4-20250514`
- `claude-opus-4-20250514`
- `claude-opus-4-1-20250805`

## Files Requiring Updates

### 1. `/Users/kianwoonwong/Downloads/promptops/app/services/ai_assistant_service_proper.py`
- **Line 776**: Replace fallback model in `_test_anthropic_provider`
- **Line 1493**: Replace fallback model in `_generate_with_anthropic`

### 2. `/Users/kianwoonwong/Downloads/promptops/app/services/model_service.py`
- **Line 97**: Update model list in `AnthropicProvider`
- **Line 114**: Update model used in test
- **Line 132**: Update pricing information

## Recommended Solution

### Option 1: Use Database-Driven Default Models
Update the code to use provider-specific default models or read from configuration:

```python
# Instead of hardcoded fallbacks, use:
default_models = {
    "https://api.z.ai/api/anthropic": "GLM-4.5",
    "https://api.anthropic.com": "claude-3-5-haiku-20241022"
}

model = provider.model_name or default_models.get(provider.api_base_url, "GLM-4.5")
```

### Option 2: Update Fallback to GLM Models
Replace hardcoded Anthropic model names with GLM model names:

```python
model = provider.model_name or "GLM-4.5"
```

### Option 3: Environment Variable Configuration
Add environment variables for default models:

```python
DEFAULT_ANTHROPIC_MODEL = os.getenv("DEFAULT_ANTHROPIC_MODEL", "GLM-4.5")
```

## Testing Results

The current provider configuration works correctly when the proper model names are used:
- Test API call to `/v1/ai-assistant/providers/e297567b-2c1c-45f9-aee6-4bc71d1d0da8/test` with model "GLM-4.5" returned success
- Response time: 693ms
- Token usage: 18 input, 34 output tokens

## Immediate Action Items

1. **High Priority**: Update hardcoded fallback models in `ai_assistant_service_proper.py`
2. **Medium Priority**: Update model lists in `model_service.py`
3. **Low Priority**: Implement more robust configuration management
4. **Testing**: Verify all AI assistant functionality works after changes

## Impact Assessment

### Current Impact:
- AI assistant features may fail when provider model names are not properly configured
- Users may see "Unknown Model" errors when trying to use AI features
- System reliability is compromised due to hardcoded fallbacks

### After Fix:
- Improved reliability with proper fallback handling
- Better support for different Anthropic-compatible APIs
- Reduced maintenance overhead with configurable defaults

## Files to Monitor

After implementing the fix, monitor these log files for any recurring issues:
- Application logs for AI assistant errors
- Database logs for provider configuration issues
- API response logs for model validation errors

## Conclusion

The "Unknown Model" error is caused by hardcoded fallback model names that are incompatible with the custom API endpoint being used. The fix involves updating these fallbacks to use appropriate model names for the target API endpoint or implementing a more robust configuration system.