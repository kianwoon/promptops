#!/usr/bin/env node

/**
 * PromptOps CLI - Command-line interface for PromptOps JavaScript Client
 */

const { Command } = require('commander');
const { PromptOpsClient } = require('../dist/index.js');
const fs = require('fs');
const path = require('path');
const process = require('process');

class PromptOpsCLI {
    constructor() {
        this.program = new Command();
        this.setupCommands();
    }

    setupCommands() {
        this.program
            .name('promptops')
            .description('PromptOps CLI - Command-line interface for PromptOps API')
            .version(require('../package.json').version);

        // Global options
        this.program
            .option('-k, --api-key <key>', 'API key (or set PROMPTOPS_API_KEY env var)')
            .option('-b, --base-url <url>', 'PromptOps API base URL (auto-detected if not provided)', process.env.PROMPTOPS_BASE_URL)
            .option('-e, --environment <env>', 'Target environment (development|staging|production)', process.env.PROMPTOPS_ENVIRONMENT)
            .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '30000')
            .option('-f, --format <format>', 'Output format', 'json')
            .option('-v, --verbose', 'Enable verbose output')
            .option('--redis-url <url>', 'Redis URL for caching')
            .option('--disable-cache', 'Disable caching')
            .option('--disable-telemetry', 'Disable telemetry')
            .option('--no-auto-detect', 'Disable automatic environment detection');

        // Get prompt command
        this.program
            .command('get <prompt-id>')
            .description('Get a prompt')
            .option('-v, --version <version>', 'Prompt version')
            .action(async (promptId, options) => {
                await this.executeCommand('get', { promptId, ...options });
            });

        // Render prompt command
        this.program
            .command('render <prompt-id>')
            .description('Render a prompt with variables')
            .option('-v, --version <version>', 'Prompt version')
            .option('--variables <vars>', 'Variables as JSON string', '{}')
            .option('--model-provider <provider>', 'Target model provider')
            .option('--model-name <name>', 'Target model name')
            .action(async (promptId, options) => {
                await this.executeCommand('render', { promptId, ...options });
            });

        // List prompts command
        this.program
            .command('list')
            .description('List available prompts')
            .option('-m, --module-id <id>', 'Filter by module ID')
            .option('-l, --limit <number>', 'Maximum number of items', '100')
            .action(async (options) => {
                await this.executeCommand('list', options);
            });

        // Test connection command
        this.program
            .command('test')
            .description('Test connection to PromptOps API')
            .action(async (options) => {
                await this.executeCommand('test', options);
            });

        // Validate prompt command
        this.program
            .command('validate <prompt-id>')
            .description('Validate if a prompt exists')
            .option('-v, --version <version>', 'Prompt version')
            .action(async (promptId, options) => {
                await this.executeCommand('validate', { promptId, ...options });
            });

        // Health check command
        this.program
            .command('health')
            .description('Check client health status')
            .action(async (options) => {
                await this.executeCommand('health', options);
            });

        // Clear cache command
        this.program
            .command('clear-cache')
            .description('Clear client cache')
            .option('-p, --prompt-id <id>', 'Clear cache for specific prompt')
            .action(async (options) => {
                await this.executeCommand('clear-cache', options);
            });

        // Cache stats command
        this.program
            .command('cache-stats')
            .description('Show cache statistics')
            .action(async (options) => {
                await this.executeCommand('cache-stats', options);
            });

        // Environment info command
        this.program
            .command('env')
            .description('Show environment information')
            .option('--detect', 'Auto-detect environment')
            .action(async (options) => {
                await this.executeCommand('env', options);
            });

        // Health check command
        this.program
            .command('health')
            .description('Perform comprehensive health check')
            .option('--format <format>', 'Output format', 'text')
            .action(async (options) => {
                await this.executeCommand('health', options);
            });

        // Interactive mode
        this.program
            .command('interactive')
            .alias('i')
            .description('Start interactive mode')
            .action(async (options) => {
                await this.startInteractiveMode(options);
            });
    }

    async executeCommand(command, options) {
        try {
            // Some commands don't require API key or full client initialization
            if (command === 'env' && options.detect) {
                await this.envInfo(options);
                return;
            }

            const client = this.createClient(options);
            await client.initialize();

            switch (command) {
                case 'get':
                    await this.getPrompt(client, options);
                    break;
                case 'render':
                    await this.renderPrompt(client, options);
                    break;
                case 'list':
                    await this.listPrompts(client, options);
                    break;
                case 'test':
                    await this.testConnection(client, options);
                    break;
                case 'validate':
                    await this.validatePrompt(client, options);
                    break;
                case 'health':
                    await this.healthCheck(client, options);
                    break;
                case 'clear-cache':
                    await this.clearCache(client, options);
                    break;
                case 'cache-stats':
                    await this.cacheStats(client, options);
                    break;
                case 'env':
                    await this.envInfo(options);
                    break;
                case 'health':
                    await this.comprehensiveHealthCheck(options);
                    break;
                default:
                    console.error(`Unknown command: ${command}`);
                    process.exit(1);
            }

            await client.shutdown();
        } catch (error) {
            console.error(`Error: ${error.message}`);
            if (options.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    createClient(options) {
        const config = {
            baseUrl: options.baseUrl,
            apiKey: options.apiKey,
            timeout: parseInt(options.timeout),
            enableCache: !options.disableCache,
            enableTelemetry: !options.disableTelemetry,
            redisUrl: options.redisUrl,
            environment: options.environment,
            autoDetectEnvironment: options.autoDetect !== false,
            connectionTimeout: options.connectionTimeout || 5,
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1,
            enableConnectionTest: options.enableConnectionTest !== false,
        };

        return new PromptOpsClient(config);
    }

    async getPrompt(client, options) {
        const prompt = await client.getPrompt({
            promptId: options.promptId,
            version: options.version,
        });

        if (options.format === 'json') {
            console.log(JSON.stringify(prompt, null, 2));
        } else {
            console.log(`Prompt: ${prompt.name}`);
            console.log(`ID: ${prompt.id}`);
            console.log(`Version: ${prompt.version}`);
            console.log(`Description: ${prompt.description || 'No description'}`);
            console.log(`Content: ${prompt.content}`);
        }
    }

    async renderPrompt(client, options) {
        let variables;
        try {
            variables = JSON.parse(options.variables);
        } catch (error) {
            throw new Error('Invalid JSON in variables parameter');
        }

        const content = await client.getPromptContent({
            promptId: options.promptId,
            version: options.version,
            variables: variables,
            modelProvider: options.modelProvider,
            modelName: options.modelName,
        });

        if (options.format === 'json') {
            console.log(JSON.stringify({ content }, null, 2));
        } else {
            console.log(content);
        }
    }

    async listPrompts(client, options) {
        const prompts = await client.listPrompts(
            options.moduleId,
            parseInt(options.limit)
        );

        if (options.format === 'json') {
            console.log(JSON.stringify(prompts, null, 2));
        } else {
            console.log(`Found ${prompts.length} prompts:`);
            prompts.forEach(prompt => {
                console.log(`  - ${prompt.name} (${prompt.id}@${prompt.version})`);
            });
        }
    }

    async testConnection(client, options) {
        const health = await client.healthCheck();

        if (health.status === 'healthy') {
            console.log('✓ Connection successful');
        } else {
            console.log('✗ Connection issue detected');
            console.log(`Status: ${health.status}`);
            if (options.verbose) {
                console.log('Details:', health.details);
            }
            process.exit(1);
        }
    }

    async validatePrompt(client, options) {
        const isValid = await client.validatePrompt(options.promptId, options.version);

        if (isValid) {
            console.log('✓ Prompt is valid');
        } else {
            console.log('✗ Prompt is not valid or does not exist');
            process.exit(1);
        }
    }

    async healthCheck(client, options) {
        const health = await client.healthCheck();

        if (options.format === 'json') {
            console.log(JSON.stringify(health, null, 2));
        } else {
            console.log(`Status: ${health.status}`);
            console.log('Details:');
            console.log(`  Auth: ${health.details.auth ? '✓' : '✗'}`);
            console.log(`  Cache: ${health.details.cache ? '✓' : '✗'}`);
            console.log(`  Telemetry: ${health.details.telemetry ? '✓' : '✗'}`);
        }
    }

    async clearCache(client, options) {
        await client.clearCache(options.promptId);

        if (options.promptId) {
            console.log(`✓ Cache cleared for prompt: ${options.promptId}`);
        } else {
            console.log('✓ All cache cleared');
        }
    }

    async cacheStats(client, options) {
        const stats = client.getCacheStats();

        if (options.format === 'json') {
            console.log(JSON.stringify(stats, null, 2));
        } else {
            console.log('Cache Statistics:');
            console.log(`  Hits: ${stats.hits}`);
            console.log(`  Misses: ${stats.misses}`);
            console.log(`  Hit Rate: ${((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2)}%`);
            console.log(`  Size: ${stats.size}`);
        }
    }

    async envInfo(options) {
        try {
            if (options.detect) {
                // Use auto-detection
                const { createEnvironmentConfig } = require('../dist/index.js');
                const envConfig = createEnvironmentConfig();
                console.log(`Auto-detected Environment: ${envConfig.environment}`);
                console.log(`Base URL: ${envConfig.baseUrl}`);
                console.log('Recommendations:', JSON.stringify(envConfig.getRecommendations(), null, 2));
            } else {
                // Use provided configuration
                const client = this.createClient(options);
                await client.initialize();
                const envInfo = client.getEnvironmentInfo();
                console.log(`Environment: ${envInfo.environment}`);
                console.log(`Base URL: ${envInfo.baseUrl}`);
                console.log(`Auto-detection: ${envInfo.autoDetected}`);
                console.log(`Connection Test: ${envInfo.connectionTestEnabled}`);
                console.log('Recommendations:', JSON.stringify(envInfo.recommendations, null, 2));
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    }

    async comprehensiveHealthCheck(options) {
        try {
            const client = this.createClient(options);
            await client.initialize();
            const healthResult = await client.healthCheck();

            if (options.format === 'json') {
                console.log(JSON.stringify(healthResult, null, 2));
            } else {
                console.log('Health Check Results:');
                console.log(`  Environment: ${healthResult.environment}`);
                console.log(`  Base URL: ${healthResult.baseUrl}`);
                console.log(`  Client Initialized: ${healthResult.clientInitialized}`);
                console.log(`  Connection: ${healthResult.connection.healthy ? '✓' : '✗'}`);
                console.log(`  Authentication: ${healthResult.authentication ? '✓' : '✗'}`);
                console.log(`  Cache: ${!healthResult.cache.enabled || healthResult.cache.healthy ? '✓' : '✗'}`);
                console.log(`  Overall: ${healthResult.overall ? '✓' : '✗'}`);

                if (healthResult.connection.error) {
                    console.log(`  Connection Error: ${healthResult.connection.error}`);
                }

                if (healthResult.cache.error) {
                    console.log(`  Cache Error: ${healthResult.cache.error}`);
                }
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    }

    async startInteractiveMode(options) {
        console.log('🚀 Welcome to PromptOps Interactive Mode!');
        console.log('Type "help" for available commands or "exit" to quit.');
        console.log('');

        const client = this.createClient(options);
        await client.initialize();

        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'promptops> '
        });

        rl.prompt();

        rl.on('line', async (input) => {
            const command = input.trim();

            if (command === 'exit' || command === 'quit') {
                await client.shutdown();
                rl.close();
                process.exit(0);
            } else if (command === 'help') {
                this.showInteractiveHelp();
            } else if (command === '') {
                // Empty input, continue
            } else {
                try {
                    await this.handleInteractiveCommand(client, command);
                } catch (error) {
                    console.error(`Error: ${error.message}`);
                }
            }

            rl.prompt();
        });

        rl.on('close', async () => {
            await client.shutdown();
            console.log('\n👋 Goodbye!');
            process.exit(0);
        });
    }

    showInteractiveHelp() {
        console.log('Available commands:');
        console.log('  get <prompt-id> [version]    - Get a prompt');
        console.log('  render <prompt-id> [vars]   - Render a prompt with variables');
        console.log('  list [module-id]            - List prompts');
        console.log('  validate <prompt-id> [ver] - Validate a prompt');
        console.log('  health                      - Check health status');
        console.log('  cache                       - Show cache stats');
        console.log('  clear                       - Clear cache');
        console.log('  help                        - Show this help');
        console.log('  exit                        - Exit interactive mode');
        console.log('');
    }

    async handleInteractiveCommand(client, command) {
        const parts = command.split(' ');
        const cmd = parts[0];
        const args = parts.slice(1);

        switch (cmd) {
            case 'get':
                await this.getPrompt(client, { promptId: args[0], version: args[1], format: 'text' });
                break;
            case 'render':
                await this.renderPrompt(client, { promptId: args[0], variables: args[1] || '{}', format: 'text' });
                break;
            case 'list':
                await this.listPrompts(client, { moduleId: args[0], limit: '100', format: 'text' });
                break;
            case 'validate':
                await this.validatePrompt(client, { promptId: args[0], version: args[1] });
                break;
            case 'health':
                await this.healthCheck(client, { format: 'text' });
                break;
            case 'cache':
                await this.cacheStats(client, { format: 'text' });
                break;
            case 'clear':
                await this.clearCache(client, {});
                break;
            default:
                console.log(`Unknown command: ${cmd}. Type "help" for available commands.`);
        }
    }

    async run() {
        // Parse command line arguments
        this.program.parse();
    }
}

// Run the CLI
if (require.main === module) {
    const cli = new PromptOpsCLI();
    cli.run().catch(error => {
        console.error('CLI Error:', error);
        process.exit(1);
    });
}

module.exports = { PromptOpsCLI };