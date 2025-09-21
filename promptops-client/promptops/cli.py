"""
Command-line interface for PromptOps client
"""

import argparse
import asyncio
import json
import os
import sys
from typing import Dict, Any

from . import PromptOpsClient, ClientConfig, PromptVariables, ModelProvider, Environment, create_client_for_environment


def create_config_from_args(args) -> ClientConfig:
    """Create client configuration from command line arguments"""
    from .models import CacheConfig, TelemetryConfig

    # Create configuration with environment detection
    config = ClientConfig(
        base_url=args.base_url,
        api_key=args.api_key,
        timeout=args.timeout,
        auto_detect_environment=not args.environment,  # Don't auto-detect if environment is specified
        cache=CacheConfig(
            level=args.cache_level,
            ttl=args.cache_ttl,
            max_size=args.cache_size,
            redis_url=args.redis_url
        ),
        telemetry=TelemetryConfig(
            enabled=not args.disable_telemetry,
            sample_rate=args.telemetry_sample_rate
        )
    )

    # Set environment if specified
    if args.environment:
        config.environment.environment = args.environment

    return config


async def cmd_get_prompt(args):
    """Get a prompt command"""
    async with PromptOpsClient(create_config_from_args(args)) as client:
        try:
            prompt = await client.get_prompt(args.prompt_id, args.version)

            if args.output_format == 'json':
                print(json.dumps(prompt.dict(), indent=2))
            else:
                print(f"Prompt: {prompt.name}")
                print(f"ID: {prompt.id}")
                print(f"Version: {prompt.version}")
                print(f"Description: {prompt.description}")
                print(f"Content: {prompt.content}")
                print(f"Target Models: {', '.join(prompt.target_models)}")

        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)


async def cmd_render_prompt(args):
    """Render a prompt command"""
    async with PromptOpsClient(create_config_from_args(args)) as client:
        try:
            # Parse variables
            variables = {}
            if args.variables:
                for var in args.variables:
                    if '=' in var:
                        key, value = var.split('=', 1)
                        variables[key] = value

            prompt_vars = PromptVariables(variables=variables)

            rendered = await client.render_prompt(
                prompt_id=args.prompt_id,
                variables=prompt_vars,
                version=args.version,
                model_provider=args.model_provider,
                model_name=args.model_name
            )

            if args.output_format == 'json':
                print(json.dumps(rendered.dict(), indent=2))
            else:
                print(f"Rendered Content:")
                print(rendered.rendered_content)
                print(f"\nMessages:")
                for msg in rendered.messages:
                    print(f"  {msg.role}: {msg.content}")

        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)


async def cmd_list_prompts(args):
    """List prompts command"""
    async with PromptOpsClient(create_config_from_args(args)) as client:
        try:
            prompts = await client.list_prompts(
                module_id=args.module_id,
                skip=args.skip,
                limit=args.limit
            )

            if args.output_format == 'json':
                print(json.dumps([p.dict() for p in prompts], indent=2))
            else:
                print(f"Found {len(prompts)} prompts:")
                for prompt in prompts:
                    print(f"  - {prompt.name} ({prompt.id}@{prompt.version})")

        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)


async def cmd_test_connection(args):
    """Test connection command"""
    async with PromptOpsClient(create_config_from_args(args)) as client:
        try:
            result = await client.test_connection()
            if result:
                print("✓ Connection successful")
            else:
                print("✗ Connection failed")
                sys.exit(1)

        except Exception as e:
            print(f"✗ Connection error: {e}", file=sys.stderr)
            sys.exit(1)


async def cmd_stats(args):
    """Show statistics command"""
    async with PromptOpsClient(create_config_from_args(args)) as client:
        try:
            stats = client.get_stats()
            cache_stats = client.get_cache_stats()

            print("Client Statistics:")
            print(f"  Total Requests: {stats.total_requests}")
            print(f"  Successful Requests: {stats.successful_requests}")
            print(f"  Failed Requests: {stats.failed_requests}")
            print(f"  Success Rate: {stats.success_rate:.2%}")

            print("\nCache Statistics:")
            if cache_stats.get('enabled', False):
                print(f"  Cache Level: {cache_stats.get('level', 'unknown')}")
                print(f"  Hits: {cache_stats.get('hits', 0)}")
                print(f"  Misses: {cache_stats.get('misses', 0)}")
                print(f"  Hit Rate: {cache_stats.get('hit_rate', 0):.2%}")
                print(f"  Size: {cache_stats.get('size', 0)}")
            else:
                print("  Cache disabled")

            print("\nTelemetry:")
            telemetry_summary = client.get_telemetry_summary()
            print(f"  Enabled: {telemetry_summary.get('enabled', False)}")
            print(f"  Pending Events: {telemetry_summary.get('pending_events', 0)}")

        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)


async def cmd_create_prompt(args):
    """Create a prompt command"""
    async with PromptOpsClient(create_config_from_args(args)) as client:
        try:
            # Read prompt data from file or stdin
            if args.file:
                with open(args.file, 'r') as f:
                    prompt_data = json.load(f)
            else:
                prompt_data = json.loads(sys.stdin.read())

            prompt = await client.create_prompt(prompt_data)

            if args.output_format == 'json':
                print(json.dumps(prompt.dict(), indent=2))
            else:
                print(f"Created prompt: {prompt.name} ({prompt.id}@{prompt.version})")

        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)


def create_parser():
    """Create command line argument parser"""
    parser = argparse.ArgumentParser(
        description='PromptOps CLI - Command-line interface for PromptOps API',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    # Global arguments
    parser.add_argument('--base-url', default=os.environ.get('PROMPTOPS_BASE_URL'),
                        help='PromptOps API base URL (auto-detected if not provided)')
    parser.add_argument('--api-key',
                        help='API key (or set PROMPTOPS_API_KEY environment variable)')
    parser.add_argument('--environment', choices=['development', 'staging', 'production'],
                        default=os.environ.get('PROMPTOPS_ENVIRONMENT'),
                        help='Target environment (auto-detected if not provided)')
    parser.add_argument('--timeout', type=float, default=30.0,
                        help='Request timeout in seconds')
    parser.add_argument('--output-format', choices=['json', 'text'], default='text',
                        help='Output format')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Enable verbose output')

    # Cache arguments
    cache_group = parser.add_argument_group('Cache Options')
    cache_group.add_argument('--cache-level', choices=['none', 'memory', 'redis', 'hybrid'],
                            default='memory', help='Cache level')
    cache_group.add_argument('--cache-ttl', type=int, default=300,
                            help='Cache TTL in seconds')
    cache_group.add_argument('--cache-size', type=int, default=1000,
                            help='Maximum cache size')
    cache_group.add_argument('--redis-url',
                            help='Redis URL for Redis caching')

    # Telemetry arguments
    telemetry_group = parser.add_argument_group('Telemetry Options')
    telemetry_group.add_argument('--disable-telemetry', action='store_true',
                               help='Disable telemetry')
    telemetry_group.add_argument('--telemetry-sample-rate', type=float, default=1.0,
                               help='Telemetry sample rate (0.0-1.0)')

    # Subcommands
    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Get prompt command
    get_parser = subparsers.add_parser('get', help='Get a prompt')
    get_parser.add_argument('prompt_id', help='Prompt ID')
    get_parser.add_argument('--version', help='Prompt version')

    # Render prompt command
    render_parser = subparsers.add_parser('render', help='Render a prompt')
    render_parser.add_argument('prompt_id', help='Prompt ID')
    render_parser.add_argument('--version', help='Prompt version')
    render_parser.add_argument('--variables', '-v', nargs='*',
                             help='Variables in key=value format')
    render_parser.add_argument('--model-provider', choices=['openai', 'anthropic', 'google', 'cohere', 'huggingface', 'local'],
                             help='Target model provider')
    render_parser.add_argument('--model-name', help='Target model name')

    # List prompts command
    list_parser = subparsers.add_parser('list', help='List prompts')
    list_parser.add_argument('--module-id', help='Filter by module ID')
    list_parser.add_argument('--skip', type=int, default=0, help='Number of items to skip')
    list_parser.add_argument('--limit', type=int, default=100, help='Maximum number of items')

    # Test connection command
    test_parser = subparsers.add_parser('test', help='Test connection to PromptOps API')

    # Stats command
    stats_parser = subparsers.add_parser('stats', help='Show client statistics')

    # Create prompt command
    create_parser = subparsers.add_parser('create', help='Create a new prompt')
    create_parser.add_argument('--file', '-f', help='Read prompt data from file')

    # Environment detection command
    env_parser = subparsers.add_parser('env', help='Show environment information')
    env_parser.add_argument('--detect', action='store_true',
                           help='Auto-detect environment and show recommendations')

    # Health check command
    health_parser = subparsers.add_parser('health', help='Perform comprehensive health check')
    health_parser.add_argument('--format', choices=['json', 'text'], default='text',
                              help='Output format')

    return parser


def main():
    """Main CLI entry point"""
    parser = create_parser()
    args = parser.parse_args()

    # Get API key from environment if not provided
    if not args.api_key:
        args.api_key = os.environ.get('PROMPTOPS_API_KEY')
        # API key is optional for environment detection commands
        if not args.api_key and args.command not in ['env', 'health']:
            print("Error: API key is required. Use --api-key or set PROMPTOPS_API_KEY environment variable.",
                  file=sys.stderr)
            sys.exit(1)

    # Set up logging
    import logging
    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    # Execute command
    command_map = {
        'get': cmd_get_prompt,
        'render': cmd_render_prompt,
        'list': cmd_list_prompts,
        'test': cmd_test_connection,
        'stats': cmd_stats,
        'create': cmd_create_prompt,
        'env': cmd_env_info,
        'health': cmd_health_check,
    }

    if not args.command:
        parser.print_help()
        sys.exit(1)

    try:
        asyncio.run(command_map[args.command](args))
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)


async def cmd_env_info(args):
    """Show environment information"""
    try:
        if args.detect:
            # Use auto-detection
            from .environment import create_environment_config
            env_config = create_environment_config()
            print(f"Auto-detected Environment: {env_config.environment}")
            print(f"Base URL: {env_config.base_url}")
            print(f"Recommendations: {json.dumps(env_config.get_recommendations(), indent=2)}")
        else:
            # Use provided configuration
            config = create_config_from_args(args)
            print(f"Environment: {config.environment.environment}")
            print(f"Base URL: {config.base_url}")
            print(f"Auto-detection: {config.auto_detect_environment}")
            print(f"Connection Test: {config.environment.enable_connection_test}")
            print(f"Recommendations: {json.dumps(config.environment.get_recommendations(), indent=2)}")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


async def cmd_health_check(args):
    """Perform comprehensive health check"""
    try:
        config = create_config_from_args(args)
        async with PromptOpsClient(config) as client:
            health_result = await client.health_check()

            if args.format == 'json':
                print(json.dumps(health_result, indent=2, default=str))
            else:
                print("Health Check Results:")
                print(f"  Environment: {health_result['environment']}")
                print(f"  Base URL: {health_result['baseUrl']}")
                print(f"  Client Initialized: {health_result['clientInitialized']}")
                print(f"  Connection: {'✓' if health_result['connection']['healthy'] else '✗'}")
                print(f"  Authentication: {'✓' if health_result['authentication'] else '✗'}")
                print(f"  Cache: {'✓' if not health_result['cache']['enabled'] or health_result['cache']['healthy'] else '✗'}")
                print(f"  Overall: {'✓' if health_result['overall'] else '✗'}")

                if health_result['connection'].get('error'):
                    print(f"  Connection Error: {health_result['connection']['error']}")

                if health_result['cache'].get('error'):
                    print(f"  Cache Error: {health_result['cache']['error']}")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()