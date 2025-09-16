# Database Management Best Practices Guide

## Overview

This guide provides comprehensive best practices for managing database schema, migrations, and common database issues in the PromptOps application. Based on analysis of our codebase patterns and recurring issues, this document aims to prevent database-related problems and establish consistent development workflows.

## Table of Contents

1. [Root Causes of Database Issues](#root-causes-of-database-issues)
2. [Preventive Measures and Best Practices](#preventive-measures-and-best-practices)
3. [Development Workflow Recommendations](#development-workflow-recommendations)
4. [Schema Management Strategies](#schema-management-strategies)
5. [Testing Approaches](#testing-approaches)
6. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)
7. [Database Setup and Configuration](#database-setup-and-configuration)
8. [Migration Management](#migration-management)
9. [Monitoring and Maintenance](#monitoring-and-maintenance)

## Root Causes of Database Issues

### 1. Schema Mismatch Between Models and Database

**Problem**: SQLAlchemy models don't match the actual database schema, causing runtime errors.

**Evidence from codebase**:
- Multiple instances of `Base.metadata.create_all()` being called as fallback
- Exception handling patterns that suggest missing tables/columns
- Inconsistent migration application

**Common scenarios**:
- Models are updated but migrations aren't run
- Manual database changes without corresponding model updates
- Development vs production schema drift

### 2. Migration Problems

**Problem**: Alembic migrations are not properly managed or applied.

**Evidence from codebase**:
- Only one initial migration file exists (`5012a6b7d143_initial_migration.py`)
- Extensive model definitions in `models.py` (1465 lines) with minimal migration coverage
- Fallback `create_all()` calls suggest migration failures

### 3. Missing Tables and Constraints

**Problem**: Required tables or columns are missing when the application starts.

**Evidence from codebase**:
```python
# From app/routers/ai_assistant.py
except Exception as e:
    logger.error("Database error:", error=str(e))
    # If table doesn't exist, create it and proceed
    try:
        from app.database import engine
        Base.metadata.create_all(bind=engine)
```

### 4. SQLAlchemy Metadata Caching Issues

**Problem**: SQLAlchemy metadata isn't properly refreshed, leading to stale schema information.

**Evidence from codebase**:
- Models are imported in multiple places with potential import order issues
- No clear metadata refresh strategy

## Preventive Measures and Best Practices

### 1. Schema-First Development

**Always use migrations for schema changes**:

```python
# ❌ Bad: Using create_all() in production
@app.on_event("startup")
async def startup():
    Base.metadata.create_all(bind=engine)

# ✅ Good: Use migrations
@app.on_event("startup")
async def startup():
    # Run migrations if needed
    alembic_upgrade()
```

### 2. Comprehensive Migration Strategy

**Create migration for every schema change**:

```bash
# Generate migration
alembic revision --autogenerate -m "Add user_preferences table"

# Apply migration
alembic upgrade head

# Rollback if needed
alembic downgrade -1
```

### 3. Environment-Specific Database Handling

**Development**:
- Use `create_all()` for rapid iteration
- Enable automatic migration generation
- Use database seeding for test data

**Production**:
- Always use migrations
- Disable automatic schema creation
- Implement backup before migrations

### 4. Proper Exception Handling

**Handle database errors gracefully**:

```python
# ❌ Bad: Generic exception handling with create_all fallback
try:
    result = db.query(User).all()
except Exception as e:
    Base.metadata.create_all(bind=engine)
    return []

# ✅ Good: Specific error handling
try:
    result = db.query(User).all()
except SQLAlchemyError as e:
    logger.error(f"Database query failed: {e}")
    raise DatabaseOperationError("Failed to query users")
```

## Development Workflow Recommendations

### 1. Local Development Setup

```bash
# Initialize database
make db-init

# Run migrations
make db-migrate

# Create new migration
make db-migration name="add_new_column"

# Seed development data
make db-seed
```

### 2. CI/CD Pipeline Integration

```yaml
# .github/workflows/database.yml
name: Database Migration

on:
  push:
    paths:
      - 'alembic/versions/**'
      - 'app/models.py'

jobs:
  test-migrations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup test database
        run: |
          createdb promptops_test
          alembic upgrade head
      - name: Test migration integrity
        run: |
          python -m pytest tests/test_migrations.py
```

### 3. Database Change Process

1. **Model Changes**: Update SQLAlchemy models
2. **Migration Generation**: Create migration using `alembic revision --autogenerate`
3. **Migration Review**: Verify generated SQL
4. **Testing**: Test migration in staging environment
5. **Deployment**: Apply migration with backup
6. **Verification**: Confirm application functionality

### 4. Version Control Strategy

```bash
# Branch naming convention
feature/add-user-preferences-table
fix/missing-email-constraint

# Commit message format
feat(db): Add user preferences table
fix(db): Add NOT NULL constraint to email column
```

## Schema Management Strategies

### 1. Migration File Organization

```
alembic/versions/
├── 20240915_123456_initial_migration.py
├── 20240916_143257_add_users_table.py
├── 20240917_091234_add_ai_assistant_tables.py
├── 20240918_153426_add_governance_tables.py
└── 20240919_112233_add_indexes_and_constraints.py
```

### 2. Migration Best Practices

**Each migration should be**:
- **Reversible**: Include both `upgrade()` and `downgrade()` functions
- **Atomic**: Complete the entire operation or fail completely
- **Tested**: Verify in staging before production
- **Documented**: Clear description of changes

**Example migration structure**:

```python
"""Add user preferences table

Revision ID: 20240916_143257
Revises: 20240915_123456
Create Date: 2024-09-16 14:32:57.123456

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '20240916_143257'
down_revision = '20240915_123456'
branch_labels = None
depends_on = None

def upgrade():
    # Create table
    op.create_table(
        'user_preferences',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('preferences_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_user_preferences_user_id')
    )

    # Create indexes
    op.create_index('ix_user_preferences_user_id', 'user_preferences', ['user_id'])

def downgrade():
    # Drop indexes
    op.drop_index('ix_user_preferences_user_id', 'user_preferences')

    # Drop table
    op.drop_table('user_preferences')
```

### 3. Schema Validation

```python
# scripts/validate_schema.py
from sqlalchemy import inspect
from app.database import engine
from app.models import Base

def validate_schema():
    """Validate that database schema matches models"""
    inspector = inspect(engine)
    model_tables = {table.name for table in Base.metadata.tables.values()}
    db_tables = {table_name for table_name in inspector.get_table_names()}

    missing_tables = model_tables - db_tables
    extra_tables = db_tables - model_tables

    if missing_tables:
        print(f"Missing tables: {missing_tables}")

    if extra_tables:
        print(f"Extra tables: {extra_tables}")

    return len(missing_tables) == 0 and len(extra_tables) == 0
```

## Testing Approaches

### 1. Database Testing Strategy

**Unit Tests**:
```python
# tests/test_models.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, User
from app.database import get_db

@pytest.fixture
def test_db():
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    yield session
    session.close()

def test_user_creation(test_db):
    user = User(id="test", email="test@example.com", name="Test User")
    test_db.add(user)
    test_db.commit()

    assert user.id is not None
    assert user.email == "test@example.com"
```

**Migration Tests**:
```python
# tests/test_migrations.py
def test_migration_up_down():
    """Test that migrations can be applied and reverted"""
    # Get current revision
    current_rev = get_current_revision()

    # Downgrade
    alembic_downgrade(-1)

    # Upgrade
    alembic_upgrade()

    # Verify back to same revision
    assert get_current_revision() == current_rev
```

### 2. Test Database Setup

```python
# conftest.py
@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(
        "postgresql://test:test@localhost:5432/promptops_test",
        pool_pre_ping=True
    )
    yield engine
    engine.dispose()

@pytest.fixture(scope="session")
def test_db(test_engine):
    Base.metadata.create_all(test_engine)
    yield
    Base.metadata.drop_all(test_engine)
```

### 3. Integration Testing

```python
# tests/integration/test_database_operations.py
def test_user_workflow():
    """Test complete user management workflow"""
    # Create user
    user = create_user(email="test@example.com", name="Test User")

    # Update user
    update_user(user.id, name="Updated Name")

    # Query user
    retrieved_user = get_user(user.id)
    assert retrieved_user.name == "Updated Name"

    # Delete user
    delete_user(user.id)

    # Verify deletion
    assert get_user(user.id) is None
```

## Common Pitfalls and Solutions

### 1. Missing Tables/Columns

**Problem**: Application fails to start due to missing database objects.

**Solution**: Proper migration management and startup validation.

```python
# app/database.py
def validate_database_schema():
    """Validate database schema on startup"""
    try:
        # Check if critical tables exist
        inspector = inspect(engine)
        required_tables = ['users', 'templates', 'projects']

        existing_tables = set(inspector.get_table_names())
        missing_tables = set(required_tables) - existing_tables

        if missing_tables:
            raise DatabaseSchemaError(f"Missing tables: {missing_tables}")

    except Exception as e:
        logger.error(f"Schema validation failed: {e}")
        raise
```

### 2. Migration Conflicts

**Problem**: Multiple developers create conflicting migrations.

**Solution**:
- Use feature branches for database changes
- Merge migrations before deployment
- Test migration sequence in staging

### 3. Performance Issues

**Problem**: Database queries are slow due to missing indexes or poor schema design.

**Solution**:
- Add appropriate indexes
- Use query optimization
- Implement connection pooling

```python
# app/database.py
engine = create_engine(
    settings.database_url,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=3600
)
```

### 4. Connection Leaks

**Problem**: Database connections are not properly closed.

**Solution**: Use context managers and proper session management.

```python
# ❌ Bad
def get_users():
    db = SessionLocal()
    users = db.query(User).all()
    # Connection not closed

# ✅ Good
def get_users():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        return users
    finally:
        db.close()
```

## Database Setup and Configuration

### 1. Environment Configuration

```python
# app/config.py
class DatabaseSettings:
    def __init__(self):
        self.database_url = os.getenv("DATABASE_URL", "postgresql://promptops@localhost:5432/promptops")
        self.pool_size = int(os.getenv("DB_POOL_SIZE", "20"))
        self.max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "30"))
        self.pool_recycle = int(os.getenv("DB_POOL_RECYCLE", "3600"))

# alembic.ini
sqlalchemy.url = postgresql://promptops@localhost:5432/promptops
```

### 2. Database Initialization

```python
# app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from app.config import settings

# Configure engine with connection pooling
engine = create_engine(
    settings.database_url,
    poolclass=QueuePool,
    pool_size=settings.pool_size,
    max_overflow=settings.max_overflow,
    pool_recycle=settings.pool_recycle,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Database dependency for FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 3. Migration Commands

```bash
# Makefile
db-init:
	createdb promptops
	alembic upgrade head

db-migrate:
	alembic upgrade head

db-migration:
	alembic revision --autogenerate -m "$(name)"

db-rollback:
	alembic downgrade -1

db-seed:
	python scripts/seed_database.py

db-validate:
	python scripts/validate_schema.py
```

## Migration Management

### 1. Migration Generation

```python
# scripts/generate_migration.py
#!/usr/bin/env python3
import subprocess
import sys
from datetime import datetime

def generate_migration(message):
    """Generate a new migration with timestamp prefix"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    migration_name = f"{timestamp}_{message.replace(' ', '_')}"

    cmd = ['alembic', 'revision', '--autogenerate', '-m', migration_name]
    subprocess.run(cmd, check=True)

    print(f"Generated migration: {migration_name}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python generate_migration.py <message>")
        sys.exit(1)

    generate_migration(sys.argv[1])
```

### 2. Migration Testing

```python
# tests/test_migration_safety.py
def test_migration_safety():
    """Test that migrations don't drop data"""
    # Get current database state
    current_data = get_current_data()

    # Apply migration
    alembic_upgrade()

    # Verify data integrity
    new_data = get_current_data()
    assert data_integrity_preserved(current_data, new_data)

    # Rollback
    alembic_downgrade()

    # Verify rollback
    rollback_data = get_current_data()
    assert data_equal(current_data, rollback_data)
```

### 3. Migration Rollback Strategy

```python
# scripts/rollback_migration.py
def safe_rollback(target_revision):
    """Safely rollback to a specific revision"""
    # Create backup
    create_database_backup()

    try:
        # Perform rollback
        alembic_downgrade(target_revision)

        # Verify application works
        verify_application_health()

    except Exception as e:
        # Restore from backup
        restore_database_backup()
        raise e
```

## Monitoring and Maintenance

### 1. Database Health Monitoring

```python
# app/monitoring/database_health.py
def check_database_health():
    """Check database connectivity and performance"""
    try:
        # Test basic connectivity
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            assert result.scalar() == 1

        # Check connection pool
        pool_status = engine.pool.status()
        if pool_status['checkedout'] > pool_status['size'] * 0.8:
            logger.warning("Database connection pool nearly full")

        # Check slow queries
        slow_queries = get_slow_queries()
        if slow_queries:
            logger.warning(f"Found {len(slow_queries)} slow queries")

        return True

    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False
```

### 2. Performance Monitoring

```python
# app/monitoring/query_monitor.py
from sqlalchemy import event
from time import time

@event.listens_for(engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    context._query_start_time = time()

@event.listens_for(engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total = time() - context._query_start_time
    if total > 1.0:  # Log queries taking more than 1 second
        logger.warning(f"Slow query ({total:.2f}s): {statement}")
```

### 3. Regular Maintenance Tasks

```python
# scripts/database_maintenance.py
def maintenance_tasks():
    """Run regular database maintenance"""
    # Update statistics
    run_vacuum_analyze()

    # Check for unused indexes
    unused_indexes = find_unused_indexes()
    if unused_indexes:
        logger.info(f"Unused indexes: {unused_indexes}")

    # Check table sizes
    large_tables = find_large_tables()
    if large_tables:
        logger.info(f"Large tables: {large_tables}")

    # Archive old data
    archive_old_data()
```

## Conclusion

By following these best practices, we can prevent the recurring database issues that have been plaguing our development process. Key takeaways:

1. **Always use migrations** for schema changes
2. **Implement proper error handling** without fallback `create_all()` calls
3. **Test migrations thoroughly** before production deployment
4. **Monitor database health** and performance regularly
5. **Establish clear development workflows** for database changes

This guide should serve as a reference for all developers working with the PromptOps database to ensure consistency and reliability in our database management practices.

## Additional Resources

- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [SQLAlchemy Documentation](https://www.sqlalchemy.org/)
- [PostgreSQL Best Practices](https://www.postgresql.org/docs/current/best-practices.html)
- [Database Testing Strategies](https://www.testim.io/blog/database-testing-strategies/)

## Contact

For questions or suggestions about this guide, please contact the development team or create an issue in the project repository.