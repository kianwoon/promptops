# 400 Bad Request Error - Root Cause and Solution

## Issue Summary
The 400 Bad Request error when approving approval requests was caused by database constraint violations during the auto-activation of prompts.

## Root Cause
The error occurs because:

1. **Database Constraints**: The `prompts` table has NOT NULL constraints on several fields:
   - `target_models` (JSON)
   - `model_specific_prompts` (JSON)
   - `mas_intent` (VARCHAR)
   - `mas_fairness_notes` (VARCHAR)
   - `mas_risk_level` (VARCHAR)

2. **Auto-activation Logic**: When an approval request is approved, the system automatically activates the associated prompt by updating the `is_active` flag and other activation-related fields.

3. **Missing Fields**: Some prompts in the system have NULL values in these required fields, causing database constraint violations when the auto-activation logic tries to update the prompt.

## Error Flow
```
1. Frontend sends PUT /v1/approval-requests/{id}
2. Request body validation passes ✅
3. Permission checks pass ✅
4. Approval request gets updated ✅
5. Auto-activation triggers ❌
6. Prompt update fails due to NOT NULL constraints ❌
7. Database transaction rolls back ❌
8. 400 Bad Request returned ❌
```

## Specific Error Location
The error occurs in `/app/routers/approval_requests.py` in the `update_approval_request` function around lines 635-697, specifically when trying to execute:

```python
# Activate the prompt
prompt.is_active = True
prompt.activated_at = datetime.now(timezone.utc)
prompt.activated_by = request_obj.approver or approval_user["user_id"]
prompt.activation_reason = "Auto-activated upon approval"
prompt.updated_at = datetime.now(timezone.utc)
```

## Solution Implemented

### Immediate Fix
Added validation before auto-activation to check for missing required fields:

```python
# Validate that prompt has all required fields before activation
missing_fields = []
if not prompt.target_models:
    missing_fields.append("target_models")
if not prompt.model_specific_prompts:
    missing_fields.append("model_specific_prompts")
if not prompt.mas_intent:
    missing_fields.append("mas_intent")
if not prompt.mas_fairness_notes:
    missing_fields.append("mas_fairness_notes")
if not prompt.mas_risk_level:
    missing_fields.append("mas_risk_level")

if missing_fields:
    raise HTTPException(
        status_code=400,
        detail=f"Cannot approve request: Prompt is missing required fields for activation: {', '.join(missing_fields)}. Please ensure the prompt has all required fields populated before approving."
    )
```

### Improved Error Handling
Added try-catch around the auto-activation logic to provide better error messages:

```python
try:
    # Auto-activation logic
    # ...
except Exception as e:
    logger.error(f"Failed to auto-activate prompt {prompt.id}: {str(e)}")
    raise HTTPException(
        status_code=400,
        detail=f"Failed to activate prompt: {str(e)}"
    )
```

## Files Modified
- `/app/routers/approval_requests.py` - Added validation and improved error handling

## Benefits
1. **Clear Error Messages**: Users now get specific feedback about which fields are missing
2. **Prevents Data Corruption**: Stops approval requests from partially completing
3. **Better Debugging**: Logs the exact error for troubleshooting
4. **Consistent Behavior**: All approval requests now follow the same validation rules

## Testing
The fix was validated by:
1. Creating a test prompt with missing required fields
2. Confirming that the database enforces NOT NULL constraints
3. Verifying that the validation logic correctly identifies missing fields
4. Testing that proper error messages are returned

## Next Steps (Optional Improvements)
1. **Frontend Validation**: Add validation in the UI to check prompt completeness before approval
2. **Prompt Creation Enhancement**: Ensure all prompts have required fields during creation
3. **Default Values**: Consider providing sensible defaults for NOT NULL fields
4. **Migration Script**: Create a script to populate missing fields for existing prompts

## Impact
- **Current**: Approval requests will fail with clear error messages if prompts are missing required fields
- **User Experience**: Users get actionable feedback about what needs to be fixed
- **Data Integrity**: Prevents partial approval operations that could corrupt data