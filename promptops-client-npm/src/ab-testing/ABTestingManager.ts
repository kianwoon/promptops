/**
 * A/B Testing Manager for PromptOps Client
 */

import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

import {
  Experiment,
  ExperimentCreateRequest,
  ExperimentUpdateRequest,
  ExperimentAssignment,
  ExperimentEventCreateRequest,
  ExperimentEvent,
  ExperimentResult,
  FeatureFlag,
  FeatureFlagCreateRequest,
  FeatureFlagUpdateRequest,
  UserSegment,
  UserSegmentCreateRequest,
  UserSegmentUpdateRequest,
  ExperimentStats,
  VariantPerformance,
  ExperimentStatus,
  TrafficAllocationStrategy,
  EventType,
  ABTestingConfig,
  ExperimentContext,
  PromptVariant,
  ABTestPromptRequest
} from '../types/ab-testing';

import { PromptRequest, PromptResponse } from '../types';
import { PromptOpsError, createErrorFromResponse } from '../types/errors';
import { TelemetryManager } from '../telemetry/TelemetryManager';
import { CacheManager } from '../cache/CacheManager';

export class ABTestingManager {
  private client: AxiosInstance;
  private cache: CacheManager;
  private telemetry: TelemetryManager;
  private config: ABTestingConfig;
  private sessionAssignments: Map<string, Map<string, ExperimentAssignment>> = new Map();

  constructor(
    client: AxiosInstance,
    cache: CacheManager,
    telemetry: TelemetryManager,
    config?: Partial<ABTestingConfig>
  ) {
    this.client = client;
    this.cache = cache;
    this.telemetry = telemetry;

    // Set default configuration
    this.config = {
      enableAutomaticAssignment: true,
      enableEventTracking: true,
      enableResultCalculation: true,
      cacheTTL: 300000, // 5 minutes
      assignmentConsistency: true,
      defaultSessionTimeout: 3600000, // 1 hour
      ...config
    };
  }

  /**
   * Generate consistent assignment key for user/session
   */
  private generateAssignmentKey(experimentId: string, context: ExperimentContext): string {
    const keyData = {
      experimentId,
      sessionId: context.sessionId,
      userId: context.userId || 'anonymous',
      deviceId: context.deviceId || 'unknown'
    };
    return createHash('sha256').update(JSON.stringify(keyData)).digest('hex').substring(0, 16);
  }

  /**
   * Assign user to variant based on traffic allocation
   */
  private async assignToVariant(
    experiment: Experiment,
    context: ExperimentContext
  ): Promise<ExperimentAssignment> {
    const assignmentKey = this.generateAssignmentKey(experiment.id, context);

    // Check cache first for consistent assignment
    const cacheKey = `ab_assignment_${experiment.id}_${context.sessionId}`;
    const cached = await this.cache.get<ExperimentAssignment>(cacheKey);
    if (cached && this.config.assignmentConsistency) {
      return cached;
    }

    // Calculate traffic allocation
    const hashValue = parseInt(assignmentKey.substring(0, 8), 16);
    const hashPercentage = (hashValue / 0xffffffff) * 100;

    // Check if user is in traffic allocation
    if (hashPercentage > experiment.traffic_percentage) {
      // User not in experiment, assign to control
      const assignment: ExperimentAssignment = {
        id: uuidv4(),
        experiment_id: experiment.id,
        session_id: context.sessionId,
        user_id: context.userId,
        device_id: context.deviceId,
        variant_id: experiment.control_variant.id,
        variant_name: experiment.control_variant.name,
        variant_config: experiment.control_variant.prompt_config,
        assigned_at: new Date(),
        assignment_reason: 'control_fallback',
        is_consistent: true
      };

      // Cache assignment
      await this.cache.set(cacheKey, assignment, this.config.cacheTTL);
      return assignment;
    }

    // Calculate which variant based on weights
    const allVariants = [
      { ...experiment.control_variant, weight: experiment.control_variant.weight },
      ...experiment.treatment_variants
    ];

    const totalWeight = allVariants.reduce((sum, variant) => sum + variant.weight, 0);
    let accumulatedWeight = 0;
    const randomValue = (hashValue / 0xffffffff) * totalWeight;

    for (const variant of allVariants) {
      accumulatedWeight += variant.weight;
      if (randomValue <= accumulatedWeight) {
        const assignment: ExperimentAssignment = {
          id: uuidv4(),
          experiment_id: experiment.id,
          session_id: context.sessionId,
          user_id: context.userId,
          device_id: context.deviceId,
          variant_id: variant.id,
          variant_name: variant.name,
          variant_config: variant.prompt_config,
          assigned_at: new Date(),
          assignment_reason: 'weighted_allocation',
          is_consistent: true
        };

        // Cache assignment
        await this.cache.set(cacheKey, assignment, this.config.cacheTTL);
        return assignment;
      }
    }

    // Fallback to control variant
    const assignment: ExperimentAssignment = {
      id: uuidv4(),
      experiment_id: experiment.id,
      session_id: context.sessionId,
      user_id: context.userId,
      device_id: context.deviceId,
      variant_id: experiment.control_variant.id,
      variant_name: experiment.control_variant.name,
      variant_config: experiment.control_variant.prompt_config,
      assigned_at: new Date(),
      assignment_reason: 'fallback',
      is_consistent: true
    };

    await this.cache.set(cacheKey, assignment, this.config.cacheTTL);
    return assignment;
  }

  /**
   * Get active experiments for a prompt
   */
  async getActiveExperiments(promptId: string, projectId?: string): Promise<Experiment[]> {
    const cacheKey = `ab_experiments_${promptId}_${projectId || 'all'}`;

    // Try cache first
    const cached = await this.cache.get<Experiment[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params: any = { prompt_id: promptId };
      if (projectId) {
        params.project_id = projectId;
      }

      const response = await this.client.get('/v1/ab-testing/experiments', {
        params: {
          ...params,
          status: ExperimentStatus.RUNNING
        }
      });

      const experiments: Experiment[] = response.data;

      // Cache the result
      await this.cache.set(cacheKey, experiments, this.config.cacheTTL);

      return experiments;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw createErrorFromResponse(
          error.response?.status || 500,
          error.response?.data?.message || error.message,
          error.response?.data
        );
      }
      throw error;
    }
  }

  /**
   * Get or create assignment for a session
   */
  async getAssignment(
    experimentId: string,
    context: ExperimentContext
  ): Promise<ExperimentAssignment | null> {
    try {
      // Get experiment details
      const experiment = await this.getExperiment(experimentId);
      if (!experiment || experiment.status !== ExperimentStatus.RUNNING) {
        return null;
      }

      // Check for existing assignment in memory
      if (this.sessionAssignments.has(context.sessionId)) {
        const sessionMap = this.sessionAssignments.get(context.sessionId)!;
        if (sessionMap.has(experimentId)) {
          return sessionMap.get(experimentId)!;
        }
      }

      // Create new assignment
      const assignment = await this.assignToVariant(experiment, context);

      // Store in memory
      if (!this.sessionAssignments.has(context.sessionId)) {
        this.sessionAssignments.set(context.sessionId, new Map());
      }
      this.sessionAssignments.get(context.sessionId)!.set(experimentId, assignment);

      // Track assignment event
      await this.trackEvent({
        experiment_id: experimentId,
        assignment_id: assignment.id,
        event_type: EventType.PROMPT_REQUEST,
        event_name: 'experiment_assignment',
        user_id: context.userId,
        session_id: context.sessionId,
        device_id: context.deviceId,
        event_data: {
          variant_id: assignment.variant_id,
          variant_name: assignment.variant_name,
          assignment_reason: assignment.assignment_reason
        }
      });

      return assignment;
    } catch (error) {
      // Log error but don't fail the request
      await this.telemetry.trackError(
        'assignment_failed',
        error instanceof Error ? error.message : String(error),
        undefined,
        { experimentId, sessionId: context.sessionId }
      );
      return null;
    }
  }

  /**
   * Get prompt with A/B testing variant
   */
  async getPromptWithVariant(
    request: ABTestPromptRequest,
    getPromptFn: (request: PromptRequest) => Promise<PromptResponse>
  ): Promise<{ response: PromptResponse; variant?: PromptVariant; assignment?: ExperimentAssignment }> {
    const startTime = Date.now();

    try {
      // Set up context
      const context: ExperimentContext = {
        sessionId: request.context?.sessionId || uuidv4(),
        userId: request.context?.userId,
        deviceId: request.context?.deviceId,
        userAgent: request.context?.userAgent,
        timestamp: new Date(),
        metadata: request.context?.metadata
      };

      let assignment: ExperimentAssignment | null = null;
      let variant: PromptVariant | null = null;

      // Skip A/B testing if explicitly requested
      if (!request.skipAssignment && this.config.enableAutomaticAssignment) {
        // Get active experiments for this prompt
        const experiments = await this.getActiveExperiments(request.promptId, request.projectId);

        // Use the first running experiment (simplified - in production you might want priority rules)
        const activeExperiment = experiments[0];
        if (activeExperiment && !request.forceVariant) {
          assignment = await this.getAssignment(activeExperiment.id, context);

          if (assignment) {
            // Create variant with modified prompt configuration
            variant = {
              variantId: assignment.variant_id,
              variantName: assignment.variant_name,
              promptContent: '', // Will be populated by the original prompt response
              variables: { ...request.variables, ...assignment.variant_config.variables },
              modelProvider: assignment.variant_config.modelProvider || request.modelProvider,
              modelName: assignment.variant_config.modelName || request.modelName,
              isControl: assignment.variant_id === activeExperiment.control_variant.id
            };

            // Modify the request with variant-specific configuration
            const modifiedRequest: PromptRequest = {
              ...request,
              variables: variant.variables,
              modelProvider: variant.modelProvider,
              modelName: variant.modelName
            };

            const response = await getPromptFn(modifiedRequest);

            // Update variant with actual prompt content
            variant.promptContent = response.content;

            // Track successful prompt request
            await this.trackEvent({
              experiment_id: activeExperiment.id,
              assignment_id: assignment.id,
              event_type: EventType.PROMPT_REQUEST,
              event_name: 'prompt_request_success',
              user_id: context.userId,
              session_id: context.sessionId,
              device_id: context.deviceId,
              response_time_ms: Date.now() - startTime,
              event_data: {
                prompt_id: request.promptId,
                variant_id: variant.variantId,
                model_provider: variant.modelProvider,
                model_name: variant.modelName
              }
            });

            return { response, variant, assignment };
          }
        }
      }

      // Fallback to original request
      const response = await getPromptFn(request);
      return { response, variant: undefined, assignment: undefined };

    } catch (error) {
      // Track error event
      if (request.experimentId) {
        await this.trackEvent({
          experiment_id: request.experimentId,
          event_type: EventType.ERROR,
          event_name: 'prompt_request_error',
          session_id: request.context?.sessionId || uuidv4(),
          user_id: request.context?.userId,
          error_message: error instanceof Error ? error.message : String(error)
        });
      }
      throw error;
    }
  }

  /**
   * Track an event for A/B testing analytics
   */
  async trackEvent(event: ExperimentEventCreateRequest): Promise<ExperimentEvent> {
    if (!this.config.enableEventTracking) {
      throw new PromptOpsError('Event tracking is disabled');
    }

    try {
      const response = await this.client.post('/v1/ab-testing/events', event);
      const trackedEvent: ExperimentEvent = response.data;

      // Track in telemetry
      await this.telemetry.trackUserAction('ab_test_event_tracked', {
        experiment_id: event.experiment_id,
        event_type: event.event_type,
        event_name: event.event_name,
        variant_id: event.assignment_id ? (await this.getAssignmentForId(event.assignment_id))?.variant_id : undefined
      });

      return trackedEvent;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw createErrorFromResponse(
          error.response?.status || 500,
          error.response?.data?.message || error.message,
          error.response?.data
        );
      }
      throw error;
    }
  }

  /**
   * Track conversion event
   */
  async trackConversion(
    experimentId: string,
    assignmentId: string,
    conversionValue?: number,
    context?: Partial<ExperimentContext>
  ): Promise<ExperimentEvent> {
    return this.trackEvent({
      experiment_id: experimentId,
      assignment_id: assignmentId,
      event_type: EventType.CONVERSION,
      event_name: 'conversion',
      conversion_value: conversionValue?.toString(),
      success_indicator: true,
      user_id: context?.userId,
      session_id: context?.sessionId || uuidv4(),
      device_id: context?.deviceId,
      event_data: { conversion_value }
    });
  }

  // Experiment Management Methods

  async createExperiment(experiment: ExperimentCreateRequest): Promise<Experiment> {
    const response = await this.client.post('/v1/ab-testing/experiments', experiment);
    return response.data;
  }

  async getExperiment(experimentId: string): Promise<Experiment> {
    const cacheKey = `ab_experiment_${experimentId}`;

    // Try cache first
    const cached = await this.cache.get<Experiment>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.client.get(`/v1/ab-testing/experiments/${experimentId}`);
    const experiment: Experiment = response.data;

    // Cache the result
    await this.cache.set(cacheKey, experiment, this.config.cacheTTL);

    return experiment;
  }

  async updateExperiment(experimentId: string, update: ExperimentUpdateRequest): Promise<Experiment> {
    const response = await this.client.put(`/v1/ab-testing/experiments/${experimentId}`, update);

    // Clear cache
    await this.cache.delete(`ab_experiment_${experimentId}`);

    return response.data;
  }

  async startExperiment(experimentId: string): Promise<{ message: string }> {
    const response = await this.client.post(`/v1/ab-testing/experiments/${experimentId}/start`);

    // Clear cache
    await this.cache.delete(`ab_experiment_${experimentId}`);

    return response.data;
  }

  async pauseExperiment(experimentId: string): Promise<{ message: string }> {
    const response = await this.client.post(`/v1/ab-testing/experiments/${experimentId}/pause`);

    // Clear cache
    await this.cache.delete(`ab_experiment_${experimentId}`);

    return response.data;
  }

  async completeExperiment(experimentId: string): Promise<{ message: string; results: any }> {
    const response = await this.client.post(`/v1/ab-testing/experiments/${experimentId}/complete`);

    // Clear cache
    await this.cache.delete(`ab_experiment_${experimentId}`);

    return response.data;
  }

  // Analytics Methods

  async getExperimentResults(experimentId: string): Promise<ExperimentResult[]> {
    const response = await this.client.get(`/v1/ab-testing/experiments/${experimentId}/results`);
    return response.data;
  }

  async getVariantPerformance(experimentId: string): Promise<VariantPerformance[]> {
    const response = await this.client.get(`/v1/ab-testing/experiments/${experimentId}/performance`);
    return response.data;
  }

  async getStats(projectId?: string): Promise<ExperimentStats> {
    const params = projectId ? { project_id: projectId } : {};
    const response = await this.client.get('/v1/ab-testing/stats', { params });
    return response.data;
  }

  // Feature Flag Methods

  async createFeatureFlag(featureFlag: FeatureFlagCreateRequest): Promise<FeatureFlag> {
    const response = await this.client.post('/v1/ab-testing/feature-flags', featureFlag);
    return response.data;
  }

  async getFeatureFlags(projectId?: string, enabled?: boolean): Promise<FeatureFlag[]> {
    const params: any = {};
    if (projectId) params.project_id = projectId;
    if (enabled !== undefined) params.enabled = enabled;

    const response = await this.client.get('/v1/ab-testing/feature-flags', { params });
    return response.data;
  }

  async isFeatureEnabled(featureFlagName: string, context?: ExperimentContext): Promise<boolean> {
    try {
      const featureFlags = await this.getFeatureFlags();
      const flag = featureFlags.find(f => f.name === featureFlagName);

      if (!flag || !flag.enabled) {
        return false;
      }

      // Check rollout percentage
      if (flag.rollout_percentage < 100) {
        const hashKey = context ? this.generateAssignmentKey(flag.id, context) : uuidv4();
        const hashValue = parseInt(hashKey.substring(0, 8), 16);
        const hashPercentage = (hashValue / 0xffffffff) * 100;
        return hashPercentage <= flag.rollout_percentage;
      }

      return true;
    } catch (error) {
      // Fail safe - if we can't determine, return false
      return false;
    }
  }

  // Helper Methods

  private async getAssignmentForId(assignmentId: string): Promise<ExperimentAssignment | null> {
    try {
      const response = await this.client.get(`/v1/ab-testing/assignments?assignment_id=${assignmentId}`);
      return response.data[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Clear session assignments (useful for logout/session expiry)
   */
  clearSessionAssignments(sessionId: string): void {
    this.sessionAssignments.delete(sessionId);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ABTestingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ABTestingConfig {
    return { ...this.config };
  }
}