from enum import Enum


class AIAssistantProviderType(str, Enum):
    """AI Assistant Provider Types"""
    openai = "openai"
    anthropic = "anthropic"
    gemini = "gemini"
    qwen = "qwen"
    openrouter = "openrouter"
    ollama = "ollama"


class AIAssistantProviderStatus(str, Enum):
    """AI Assistant Provider Status"""
    active = "active"
    inactive = "inactive"
    error = "error"


class AIAssistantSystemPromptType(str, Enum):
    """AI Assistant System Prompt Types"""
    create_prompt = "create_prompt"
    edit_prompt = "edit_prompt"


class AIAssistantConversationStatus(str, Enum):
    """AI Assistant Conversation Status"""
    active = "active"
    archived = "archived"
    deleted = "deleted"


class AIAssistantMessageRole(str, Enum):
    """AI Assistant Message Roles"""
    user = "user"
    assistant = "assistant"
    system = "system"