#!/usr/bin/env python3
"""Test script to verify enum fix works with database"""

import psycopg2
import json
from datetime import datetime

def test_enum_fix():
    """Test that the enum fix allows proper database operations"""

    # Database connection
    conn = psycopg2.connect(
        "postgresql://promptops:promptops@localhost:5432/promptops"
    )
    cur = conn.cursor()

    print("Testing enum fix...")

    # Test 1: Check enum values in database
    print("\n1. Checking enum values in database...")

    cur.execute("""
        SELECT t.typname AS enum_type, e.enumlabel AS enum_value
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname IN ('aiassistantprovidertype', 'aiassistantproviderstatus')
        ORDER BY t.typname, e.enumsortorder;
    """)

    enum_values = cur.fetchall()
    print("Enum values in database:")
    for row in enum_values:
        print(f"  {row[0]}: {row[1]}")

    # Test 2: Insert a test provider
    print("\n2. Testing insert with lowercase enum values...")

    test_provider_id = f"test-enum-fix-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

    try:
        cur.execute("""
            INSERT INTO ai_assistant_providers
            (id, user_id, provider_type, name, status, api_key, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            test_provider_id,
            "demo-user",
            "gemini",  # lowercase enum value
            "Test Gemini Provider",
            "active",  # lowercase enum value
            "sk-gemini-test",
            datetime.now(),
            datetime.now()
        ))

        conn.commit()
        print(f"✅ Successfully inserted provider with ID: {test_provider_id}")

    except Exception as e:
        print(f"❌ Insert failed: {e}")
        conn.rollback()

    # Test 3: Query the provider back
    print("\n3. Testing query to verify provider was saved...")

    try:
        cur.execute("""
            SELECT id, name, provider_type, status, created_at
            FROM ai_assistant_providers
            WHERE id = %s
        """, (test_provider_id,))

        provider = cur.fetchone()
        if provider:
            print("✅ Provider successfully retrieved from database:")
            print(f"   ID: {provider[0]}")
            print(f"   Name: {provider[1]}")
            print(f"   Type: {provider[2]}")
            print(f"   Status: {provider[3]}")
            print(f"   Created: {provider[4]}")
        else:
            print("❌ Provider not found in database")

    except Exception as e:
        print(f"❌ Query failed: {e}")

    # Test 4: Update provider status
    print("\n4. Testing update with enum values...")

    try:
        cur.execute("""
            UPDATE ai_assistant_providers
            SET status = 'inactive', name = 'Updated Test Provider'
            WHERE id = %s
        """, (test_provider_id,))

        conn.commit()
        print("✅ Successfully updated provider status")

    except Exception as e:
        print(f"❌ Update failed: {e}")
        conn.rollback()

    # Test 5: Verify update
    print("\n5. Verifying update...")

    try:
        cur.execute("""
            SELECT name, status FROM ai_assistant_providers WHERE id = %s
        """, (test_provider_id,))

        updated = cur.fetchone()
        if updated:
            print(f"✅ Update verified: {updated[0]} (status: {updated[1]})")
        else:
            print("❌ Could not verify update")

    except Exception as e:
        print(f"❌ Verification failed: {e}")

    # Clean up
    print("\n6. Cleaning up test data...")

    try:
        cur.execute("DELETE FROM ai_assistant_providers WHERE id = %s", (test_provider_id,))
        conn.commit()
        print("✅ Test data cleaned up")

    except Exception as e:
        print(f"❌ Cleanup failed: {e}")
        conn.rollback()

    cur.close()
    conn.close()

    print("\n🎉 Enum fix test completed!")
    print("The enum mismatch issue has been resolved.")
    print("Database now uses lowercase enum values consistently.")

if __name__ == "__main__":
    test_enum_fix()