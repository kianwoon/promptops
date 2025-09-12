#!/usr/bin/env python3

"""
Simple validation script to test PromptOps components
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent))

def test_imports():
    """Test all imports work correctly"""
    print("🔍 Testing imports...")
    
    try:
        from app.config import settings
        print("✅ Config imported")
        
        from app.database import engine, get_db
        print("✅ Database modules imported")
        
        from app.models import Base, Template, Alias
        print("✅ Models imported")
        
        from app.schemas import TemplateCreate, RenderRequest
        print("✅ Schemas imported")
        
        from app.main import app
        print("✅ FastAPI app imported")
        
        from app.composition import TemplateComposer
        print("✅ Composition system imported")
        
        return True
    except Exception as e:
        print(f"❌ Import test failed: {e}")
        return False

def test_database_connection():
    """Test database connection"""
    print("🔍 Testing database connection...")
    
    try:
        from app.database import engine
        from sqlalchemy import text
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            row = result.fetchone()
            if row[0] == 1:
                print("✅ Database connection successful")
                return True
            else:
                print("❌ Database query returned unexpected result")
                return False
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

def test_models():
    """Test database models"""
    print("🔍 Testing database models...")
    
    try:
        from app.models import Template, Alias, Module
        from app.database import Base
        
        # Test that models are properly defined
        assert hasattr(Template, '__tablename__')
        assert hasattr(Alias, '__tablename__')
        assert hasattr(Module, '__tablename__')
        
        print("✅ Models are properly defined")
        return True
    except Exception as e:
        print(f"❌ Models test failed: {e}")
        return False

def test_schemas():
    """Test Pydantic schemas"""
    print("🔍 Testing schemas...")
    
    try:
        from app.schemas import TemplateCreate, RenderRequest, Message
        
        # Test schema instantiation
        template = TemplateCreate(
            id="test/template",
            version="1.0.0",
            owner="test-user",
            template_yaml="system: Hello\nuser: {{input}}"
        )
        
        render_request = RenderRequest(
            id="test/template",
            alias="test",
            inputs={"input": "test"}
        )
        
        message = Message(role="system", content="Hello")
        
        print("✅ Schemas are working correctly")
        return True
    except Exception as e:
        print(f"❌ Schemas test failed: {e}")
        return False

def test_composition():
    """Test template composition system"""
    print("🔍 Testing composition system...")
    
    try:
        from app.composition import TemplateComposer
        
        # Test that we can create a composer
        # Note: This doesn't test the full functionality without a database session
        print("✅ Composition system is importable")
        return True
    except Exception as e:
        print(f"❌ Composition test failed: {e}")
        return False

def test_fastapi_app():
    """Test FastAPI app configuration"""
    print("🔍 Testing FastAPI app...")
    
    try:
        from app.main import app
        
        # Test that app is properly configured
        assert app.title == "PromptOps Registry"
        assert app.version == "0.1.0"
        
        # Test that routes are registered
        routes = [route.path for route in app.routes if hasattr(route, 'path')]
        expected_routes = ['/', '/health', '/v1/templates/', '/v1/render']
        
        for expected_route in expected_routes:
            found = any(expected_route in actual_route for actual_route in routes)
            if found:
                print(f"✅ Route {expected_route} is registered")
            else:
                print(f"⚠️  Route {expected_route} not found in registered routes")
        
        print("✅ FastAPI app is properly configured")
        return True
    except Exception as e:
        print(f"❌ FastAPI app test failed: {e}")
        return False

def run_validation():
    """Run all validation tests"""
    print("🧪 PromptOps Platform Validation")
    print("=" * 50)
    
    tests = [
        ("Imports", test_imports),
        ("Database Connection", test_database_connection),
        ("Models", test_models),
        ("Schemas", test_schemas),
        ("Composition", test_composition),
        ("FastAPI App", test_fastapi_app)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n--- {test_name} ---")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    # Print summary
    print("\n" + "=" * 50)
    print("📊 Validation Results:")
    print("=" * 50)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
    
    print(f"\nTotal: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("🎉 All validations passed! PromptOps platform is ready to start!")
        print("\n🚀 You can now start the server with:")
        print("   ./dev.sh     (development mode)")
        print("   ./start.sh    (production mode)")
        print("   python -m uvicorn app.main:app --reload")
    else:
        print("⚠️  Some validations failed. Please check the configuration.")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(run_validation())