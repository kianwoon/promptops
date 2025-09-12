import yaml
import json
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models import Template, Module, Variant

class TemplateComposer:
    """Handles template composition with modules, slots, and overrides"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def compose(
        self,
        template_id: str,
        version: str,
        inputs: Dict[str, Any],
        overrides: Optional[Dict[str, Any]] = None,
        tenant_overlay: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Compose template by resolving imports, slots, and applying overrides"""
        
        # Get base template
        template = self.db.query(Template).filter(
            Template.id == template_id,
            Template.version == version
        ).first()
        
        if not template:
            raise ValueError(f"Template {template_id}@{version} not found")
        
        # Parse template YAML
        try:
            template_content = yaml.safe_load(template.metadata_json.get('template_yaml', ''))
        except yaml.YAMLError as e:
            raise ValueError(f"Invalid template YAML: {str(e)}")
        
        # Resolve imported modules
        composed_content = await self._resolve_imports(template_content)
        
        # Apply slot overrides
        if overrides:
            composed_content = self._apply_slot_overrides(composed_content, overrides)
        
        # Apply tenant overlay
        if tenant_overlay:
            composed_content = self._apply_tenant_overlay(composed_content, tenant_overlay)
        
        # Render template with inputs
        rendered_messages = self._render_template(composed_content, inputs)
        
        return {
            "messages": rendered_messages,
            "template_metadata": template.metadata_json,
            "inputs_used": inputs
        }
    
    async def _resolve_imports(self, template_content: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve module imports and slot assignments"""
        
        if 'imports' not in template_content:
            return template_content
        
        resolved_content = template_content.copy()
        resolved_slots = {}
        
        # Process each import
        for import_spec in template_content['imports']:
            module_id = import_spec['module']
            version = import_spec.get('version', 'latest')
            slot = import_spec.get('slot')
            
            # Get module from database
            module = self.db.query(Module).filter(
                Module.id == module_id,
                Module.version == version
            ).first()
            
            if not module:
                # Try to find latest version if 'latest' specified
                if version == 'latest':
                    module = self.db.query(Module).filter(
                        Module.id == module_id
                    ).order_by(Module.version.desc()).first()
                
                if not module:
                    raise ValueError(f"Module {module_id}@{version} not found")
            
            # Parse module render body
            try:
                module_content = yaml.safe_load(module.render_body)
            except yaml.YAMLError as e:
                raise ValueError(f"Invalid module YAML: {str(e)}")
            
            # Assign to slot
            if slot:
                resolved_slots[slot] = module_content.get('content', '')
            else:
                # Merge into template content
                resolved_content.update(module_content)
        
        # Replace slot references with actual content
        if 'slots' in resolved_content:
            for slot_name, slot_template in resolved_content['slots'].items():
                if slot_name in resolved_slots:
                    # Replace slot variable with actual content
                    slot_content = resolved_slots[slot_name]
                    resolved_content['slots'][slot_name] = slot_content
        
        return resolved_content
    
    def _apply_slot_overrides(self, content: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
        """Apply slot-level overrides"""
        
        if 'slots' in content:
            for slot_name, override_value in overrides.items():
                if slot_name in content['slots']:
                    content['slots'][slot_name] = override_value
        
        return content
    
    def _apply_tenant_overlay(self, content: Dict[str, Any], overlay: Dict[str, Any]) -> Dict[str, Any]:
        """Apply tenant-specific overlay"""
        
        # Deep merge overlay with content
        def deep_merge(base: Dict, overlay: Dict) -> Dict:
            result = base.copy()
            for key, value in overlay.items():
                if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                    result[key] = deep_merge(result[key], value)
                else:
                    result[key] = value
            return result
        
        return deep_merge(content, overlay)
    
    def _render_template(self, content: Dict[str, Any], inputs: Dict[str, Any]) -> List[Dict[str, str]]:
        """Render template with input variables"""
        
        messages = []
        
        # Render system message
        if 'system' in content:
            system_content = self._render_string(content['system'], inputs)
            if 'slots' in content:
                # Merge slot content into system message
                slots_content = '\n\n'.join(
                    f"{slot_name}: {slot_content}"
                    for slot_name, slot_content in content['slots'].items()
                )
                system_content = f"{system_content}\n\n{slots_content}"
            
            messages.append({"role": "system", "content": system_content})
        
        # Render user message
        if 'user' in content:
            user_content = self._render_string(content['user'], inputs)
            messages.append({"role": "user", "content": user_content})
        
        # Render tool messages if present
        if 'tools' in content:
            for tool in content['tools']:
                tool_content = self._render_string(tool.get('content', ''), inputs)
                messages.append({
                    "role": "tool",
                    "content": tool_content,
                    "tool_call_id": tool.get('tool_call_id', '')
                })
        
        return messages
    
    def _render_string(self, template: str, inputs: Dict[str, Any]) -> str:
        """Simple template string rendering"""
        
        # Basic variable substitution
        result = template
        for key, value in inputs.items():
            result = result.replace(f"{{{key}}}", str(value))
        
        return result