"""
A/B Testing Manager for Python Client
"""

import hashlib
import json
import math
import statistics
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

import aiohttp
import structlog

from ..auth import AuthenticationManager
from ..cache import CacheManager
from ..exceptions import PromptOpsError, NetworkError
from ..models import PromptResponse, PromptRequest
from ..telemetry import TelemetryManager
from .models import (
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
)

logger = structlog.get_logger(__name__)


class ABTestingManager:
    """A/B Testing Manager for Python PromptOps Client"""

    def __init__(
        self,
        auth_manager: AuthenticationManager,
        cache_manager: CacheManager,
        telemetry_manager: TelemetryManager,
        base_url: str,
        timeout: int = 30,
        config: Optional[ABTestingConfig] = None
    ):
        """
        Initialize AB Testing Manager

        Args:
            auth_manager: Authentication manager
            cache_manager: Cache manager
            telemetry_manager: Telemetry manager
            base_url: Base URL for API
            timeout: Request timeout in seconds
            config: A/B testing configuration
        """
        self.auth_manager = auth_manager
        self.cache_manager = cache_manager
        self.telemetry_manager = telemetry_manager
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.session = None

        # Set default configuration
        self.config = config or ABTestingConfig()

        # In-memory session assignments
        self._session_assignments: Dict[str, Dict[str, ExperimentAssignment]] = {}

    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.timeout),
            headers=self.auth_manager.get_auth_headers()
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict:
        """Make HTTP request to API"""
        if not self.session:
            raise PromptOpsError("Manager not initialized. Use async context manager.")

        url = f"{self.base_url}{endpoint}"
        headers = self.auth_manager.get_auth_headers()

        try:
            async with self.session.request(
                method,
                url,
                json=data,
                params=params,
                headers=headers
            ) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    error_text = await response.text()
                    raise PromptOpsError(f"API request failed: {response.status} - {error_text}")
        except aiohttp.ClientError as e:
            raise NetworkError(f"Network error: {str(e)}")

    def _generate_assignment_key(self, experiment_id: str, context: ExperimentContext) -> str:
        """Generate consistent assignment key for user/session"""
        key_data = {
            "experiment_id": experiment_id,
            "session_id": context.session_id,
            "user_id": context.user_id or "anonymous",
            "device_id": context.device_id or "unknown"
        }
        key_string = json.dumps(key_data, sort_keys=True)
        return hashlib.sha256(key_string.encode()).hexdigest()[:16]

    async def _assign_to_variant(
        self,
        experiment: Experiment,
        context: ExperimentContext
    ) -> ExperimentAssignment:
        """Assign user to variant based on traffic allocation strategy"""
        # Check if user meets targeting criteria first
        if not await self._meets_targeting_criteria(experiment, context):
            return self._create_control_assignment(
                experiment, context, "targeting_criteria_not_met"
            )

        # Apply traffic allocation strategy
        if experiment.allocation_strategy == TrafficAllocationStrategy.UNIFORM:
            assignment = await self._uniform_allocation(experiment, context)
        elif experiment.allocation_strategy == TrafficAllocationStrategy.WEIGHTED:
            assignment = await self._weighted_allocation(experiment, context)
        elif experiment.allocation_strategy == TrafficAllocationStrategy.STICKY:
            assignment = await self._sticky_allocation(experiment, context)
        elif experiment.allocation_strategy == TrafficAllocationStrategy.GEOGRAPHIC:
            assignment = await self._geographic_allocation(experiment, context)
        elif experiment.allocation_strategy == TrafficAllocationStrategy.USER_ATTRIBUTE:
            assignment = await self._user_attribute_allocation(experiment, context)
        else:
            # Default to uniform allocation
            assignment = await self._uniform_allocation(experiment, context)

        # Cache assignment for consistency
        cache_key = f"ab_assignment_{experiment.id}_{context.session_id}"
        await self.cache_manager.set(cache_key, assignment.__dict__, self.config.cache_ttl)

        return assignment

    async def _meets_targeting_criteria(
        self,
        experiment: Experiment,
        context: ExperimentContext
    ) -> bool:
        """Check if user meets experiment targeting criteria"""
        try:
            # Check target audience criteria
            if experiment.target_audience:
                if not await self._check_target_audience(experiment.target_audience, context):
                    return False

            # Check geographic targeting
            if experiment.geographic_targeting:
                if not await self._check_geographic_targeting(experiment.geographic_targeting, context):
                    return False

            # Check user attribute targeting
            if experiment.user_attributes:
                if not await self._check_user_attributes(experiment.user_attributes, context):
                    return False

            return True
        except Exception as e:
            logger.warning("Error checking targeting criteria, allowing user", error=str(e))
            return True

    async def _check_target_audience(
        self,
        target_audience: Dict[str, Any],
        context: ExperimentContext
    ) -> bool:
        """Check if user is in target audience"""
        # Example criteria checks (customize based on your needs)
        if "min_user_id" in target_audience and context.user_id:
            try:
                user_id_num = int(context.user_id.replace("user_", ""))
                if user_id_num < target_audience["min_user_id"]:
                    return False
            except ValueError:
                pass

        if "max_user_id" in target_audience and context.user_id:
            try:
                user_id_num = int(context.user_id.replace("user_", ""))
                if user_id_num > target_audience["max_user_id"]:
                    return False
            except ValueError:
                pass

        return True

    async def _check_geographic_targeting(
        self,
        geographic_targeting: Dict[str, Any],
        context: ExperimentContext
    ) -> bool:
        """Check geographic targeting criteria"""
        if not context.metadata or "location" not in context.metadata:
            return False

        location = context.metadata["location"]

        if "countries" in geographic_targeting:
            if location.get("country") not in geographic_targeting["countries"]:
                return False

        if "regions" in geographic_targeting:
            if location.get("region") not in geographic_targeting["regions"]:
                return False

        if "cities" in geographic_targeting:
            if location.get("city") not in geographic_targeting["cities"]:
                return False

        return True

    async def _check_user_attributes(
        self,
        user_attributes: Dict[str, Any],
        context: ExperimentContext
    ) -> bool:
        """Check user attribute targeting criteria"""
        if not context.metadata or "user_attributes" not in context.metadata:
            return False

        user_attrs = context.metadata["user_attributes"]

        for key, expected_value in user_attributes.items():
            if key not in user_attrs:
                return False

            actual_value = user_attrs[key]

            if isinstance(expected_value, dict):
                # Handle operators like $gt, $lt, $in, etc.
                for op, value in expected_value.items():
                    if op == "$gt" and actual_value <= value:
                        return False
                    elif op == "$lt" and actual_value >= value:
                        return False
                    elif op == "$gte" and actual_value < value:
                        return False
                    elif op == "$lte" and actual_value > value:
                        return False
                    elif op == "$in" and actual_value not in value:
                        return False
                    elif op == "$nin" and actual_value in value:
                        return False
            else:
                # Direct equality check
                if actual_value != expected_value:
                    return False

        return True

    async def _uniform_allocation(
        self,
        experiment: Experiment,
        context: ExperimentContext
    ) -> ExperimentAssignment:
        """Uniform random allocation"""
        assignment_key = self._generate_assignment_key(experiment.id, context)
        hash_value = int(assignment_key[:8], 16)
        hash_percentage = (hash_value / 0xffffffff) * 100

        # Check if user is in traffic allocation
        if hash_percentage > experiment.traffic_percentage:
            return self._create_control_assignment(experiment, context, "control_fallback")

        # Uniform allocation among all variants
        all_variants = [
            experiment.control_variant,
            *experiment.treatment_variants
        ]

        variant_index = hash_value % len(all_variants)
        selected_variant = all_variants[variant_index]

        return ExperimentAssignment(
            id=str(uuid.uuid4()),
            experiment_id=experiment.id,
            session_id=context.session_id,
            user_id=context.user_id,
            device_id=context.device_id,
            variant_id=selected_variant.id,
            variant_name=selected_variant.name,
            variant_config=selected_variant.prompt_config,
            assigned_at=datetime.now(),
            assignment_reason="uniform_allocation",
            is_consistent=True
        )

    async def _weighted_allocation(
        self,
        experiment: Experiment,
        context: ExperimentContext
    ) -> ExperimentAssignment:
        """Weighted random allocation based on variant weights"""
        assignment_key = self._generate_assignment_key(experiment.id, context)
        hash_value = int(assignment_key[:8], 16)
        hash_percentage = (hash_value / 0xffffffff) * 100

        # Check if user is in traffic allocation
        if hash_percentage > experiment.traffic_percentage:
            return self._create_control_assignment(experiment, context, "control_fallback")

        # Calculate which variant based on weights
        all_variants = [
            experiment.control_variant,
            *experiment.treatment_variants
        ]

        total_weight = sum(variant.weight for variant in all_variants)
        accumulated_weight = 0
        random_value = (hash_value / 0xffffffff) * total_weight

        for variant in all_variants:
            accumulated_weight += variant.weight
            if random_value <= accumulated_weight:
                return ExperimentAssignment(
                    id=str(uuid.uuid4()),
                    experiment_id=experiment.id,
                    session_id=context.session_id,
                    user_id=context.user_id,
                    device_id=context.device_id,
                    variant_id=variant.id,
                    variant_name=variant.name,
                    variant_config=variant.prompt_config,
                    assigned_at=datetime.now(),
                    assignment_reason="weighted_allocation",
                    is_consistent=True
                )

        # Fallback to control variant
        return self._create_control_assignment(experiment, context, "weighted_fallback")

    async def _sticky_allocation(
        self,
        experiment: Experiment,
        context: ExperimentContext
    ) -> ExperimentAssignment:
        """Sticky allocation - keeps users in the same variant across sessions"""
        assignment_key = self._generate_assignment_key(experiment.id, context)
        hash_value = int(assignment_key[:8], 16)
        hash_percentage = (hash_value / 0xffffffff) * 100

        # Check if user is in traffic allocation
        if hash_percentage > experiment.traffic_percentage:
            return self._create_control_assignment(experiment, context, "control_fallback")

        # Try to find existing assignment for this user
        if context.user_id:
            cache_key = f"ab_sticky_{experiment.id}_{context.user_id}"
            cached_assignment = await self.cache_manager.get(cache_key)
            if cached_assignment:
                return ExperimentAssignment(**cached_assignment)

        # Create new assignment (same as weighted)
        return await self._weighted_allocation(experiment, context)

    async def _geographic_allocation(
        self,
        experiment: Experiment,
        context: ExperimentContext
    ) -> ExperimentAssignment:
        """Geographic-based allocation"""
        if not context.metadata or "location" not in context.metadata:
            return self._create_control_assignment(experiment, context, "no_location_data")

        location = context.metadata["location"]
        geo_key = f"{location.get('country', '')}_{location.get('region', '')}"

        # Create hash based on geographic data
        geo_hash = hashlib.md5(geo_key.encode()).hexdigest()
        hash_value = int(geo_hash[:8], 16)
        hash_percentage = (hash_value / 0xffffffff) * 100

        # Check if user is in traffic allocation
        if hash_percentage > experiment.traffic_percentage:
            return self._create_control_assignment(experiment, context, "control_fallback")

        # Use geographic hash for variant assignment
        all_variants = [
            experiment.control_variant,
            *experiment.treatment_variants
        ]

        variant_index = hash_value % len(all_variants)
        selected_variant = all_variants[variant_index]

        return ExperimentAssignment(
            id=str(uuid.uuid4()),
            experiment_id=experiment.id,
            session_id=context.session_id,
            user_id=context.user_id,
            device_id=context.device_id,
            variant_id=selected_variant.id,
            variant_name=selected_variant.name,
            variant_config=selected_variant.prompt_config,
            assigned_at=datetime.now(),
            assignment_reason="geographic_allocation",
            is_consistent=True
        )

    async def _user_attribute_allocation(
        self,
        experiment: Experiment,
        context: ExperimentContext
    ) -> ExperimentAssignment:
        """User attribute-based allocation"""
        if not context.metadata or "user_attributes" not in context.metadata:
            return self._create_control_assignment(experiment, context, "no_user_attributes")

        user_attrs = context.metadata["user_attributes"]

        # Create deterministic key based on user attributes
        attr_key = json.dumps(user_attrs, sort_keys=True)
        attr_hash = hashlib.md5(attr_key.encode()).hexdigest()
        hash_value = int(attr_hash[:8], 16)
        hash_percentage = (hash_value / 0xffffffff) * 100

        # Check if user is in traffic allocation
        if hash_percentage > experiment.traffic_percentage:
            return self._create_control_assignment(experiment, context, "control_fallback")

        # Use attribute hash for variant assignment
        all_variants = [
            experiment.control_variant,
            *experiment.treatment_variants
        ]

        variant_index = hash_value % len(all_variants)
        selected_variant = all_variants[variant_index]

        return ExperimentAssignment(
            id=str(uuid.uuid4()),
            experiment_id=experiment.id,
            session_id=context.session_id,
            user_id=context.user_id,
            device_id=context.device_id,
            variant_id=selected_variant.id,
            variant_name=selected_variant.name,
            variant_config=selected_variant.prompt_config,
            assigned_at=datetime.now(),
            assignment_reason="user_attribute_allocation",
            is_consistent=True
        )

    def _create_control_assignment(
        self,
        experiment: Experiment,
        context: ExperimentContext,
        reason: str
    ) -> ExperimentAssignment:
        """Create control variant assignment"""
        return ExperimentAssignment(
            id=str(uuid.uuid4()),
            experiment_id=experiment.id,
            session_id=context.session_id,
            user_id=context.user_id,
            device_id=context.device_id,
            variant_id=experiment.control_variant.id,
            variant_name=experiment.control_variant.name,
            variant_config=experiment.control_variant.prompt_config,
            assigned_at=datetime.now(),
            assignment_reason=reason,
            is_consistent=True
        )
  
    async def get_active_experiments(
        self,
        prompt_id: str,
        project_id: Optional[str] = None
    ) -> List[Experiment]:
        """Get active experiments for a prompt"""
        cache_key = f"ab_experiments_{prompt_id}_{project_id or 'all'}"

        # Try cache first
        cached = await self.cache_manager.get(cache_key)
        if cached:
            return [Experiment(**exp) for exp in cached]

        try:
            params: Dict[str, Any] = {"prompt_id": prompt_id, "status": ExperimentStatus.RUNNING.value}
            if project_id:
                params["project_id"] = project_id

            response = await self._make_request("GET", "/v1/ab-testing/experiments", params=params)

            experiments = [Experiment(**exp) for exp in response]

            # Cache the result
            await self.cache_manager.set(
                cache_key,
                [exp.__dict__ for exp in experiments],
                self.config.cache_ttl
            )

            return experiments
        except Exception as e:
            logger.error("Failed to get active experiments", error=str(e), prompt_id=prompt_id)
            return []

    async def get_assignment(
        self,
        experiment_id: str,
        context: ExperimentContext
    ) -> Optional[ExperimentAssignment]:
        """Get or create assignment for a session"""
        try:
            # Get experiment details
            experiment = await self.get_experiment(experiment_id)
            if not experiment or experiment.status != ExperimentStatus.RUNNING:
                return None

            # Check for existing assignment in memory
            if context.session_id in self._session_assignments:
                if experiment_id in self._session_assignments[context.session_id]:
                    return self._session_assignments[context.session_id][experiment_id]

            # Create new assignment
            assignment = await self._assign_to_variant(experiment, context)

            # Store in memory
            if context.session_id not in self._session_assignments:
                self._session_assignments[context.session_id] = {}
            self._session_assignments[context.session_id][experiment_id] = assignment

            # Track assignment event
            await self.track_event(ExperimentEventCreateRequest(
                experiment_id=experiment_id,
                assignment_id=assignment.id,
                event_type=EventType.PROMPT_REQUEST,
                event_name="experiment_assignment",
                user_id=context.user_id,
                session_id=context.session_id,
                device_id=context.device_id,
                event_data={
                    "variant_id": assignment.variant_id,
                    "variant_name": assignment.variant_name,
                    "assignment_reason": assignment.assignment_reason
                }
            ))

            return assignment
        except Exception as e:
            logger.error("Failed to get assignment", error=str(e), experiment_id=experiment_id)
            await self.telemetry_manager.track_error(
                "assignment_failed",
                str(e),
                {"experiment_id": experiment_id, "session_id": context.session_id}
            )
            return None

    async def get_prompt_with_variant(
        self,
        request: ABTestPromptRequest,
        get_prompt_fn: callable
    ) -> Tuple[PromptResponse, Optional[PromptVariant], Optional[ExperimentAssignment]]:
        """Get prompt with A/B testing variant"""
        start_time = datetime.now()

        try:
            # Set up context
            context = request.context or ExperimentContext(session_id=str(uuid.uuid4()))

            assignment = None
            variant = None

            # Skip A/B testing if explicitly requested
            if not request.skip_assignment and self.config.enable_automatic_assignment:
                # Get active experiments for this prompt
                experiments = await self.get_active_experiments(request.prompt_id, request.project_id)

                # Use the first running experiment (simplified - in production you might want priority rules)
                active_experiment = experiments[0] if experiments else None
                if active_experiment and not request.force_variant:
                    assignment = await self.get_assignment(active_experiment.id, context)

                    if assignment:
                        # Create variant with modified prompt configuration
                        variant = PromptVariant(
                            variant_id=assignment.variant_id,
                            variant_name=assignment.variant_name,
                            prompt_content="",  # Will be populated by the original prompt response
                            variables={**(request.variables or {}), **assignment.variant_config.get("variables", {})},
                            model_provider=assignment.variant_config.get("model_provider") or request.model_provider,
                            model_name=assignment.variant_config.get("model_name") or request.model_name,
                            is_control=assignment.variant_id == active_experiment.control_variant.id
                        )

                        # Modify the request with variant-specific configuration
                        modified_request = PromptRequest(
                            prompt_id=request.prompt_id,
                            version=request.version,
                            variables=variant.variables,
                            model_provider=variant.model_provider,
                            model_name=variant.model_name,
                            tenant_id=request.tenant_id,
                            project_id=request.project_id
                        )

                        response = await get_prompt_fn(modified_request)

                        # Update variant with actual prompt content
                        variant.prompt_content = response.content

                        # Track successful prompt request
                        await self.track_event(ExperimentEventCreateRequest(
                            experiment_id=active_experiment.id,
                            assignment_id=assignment.id,
                            event_type=EventType.PROMPT_REQUEST,
                            event_name="prompt_request_success",
                            user_id=context.user_id,
                            session_id=context.session_id,
                            device_id=context.device_id,
                            response_time_ms=int((datetime.now() - start_time).total_seconds() * 1000),
                            event_data={
                                "prompt_id": request.prompt_id,
                                "variant_id": variant.variant_id,
                                "model_provider": variant.model_provider,
                                "model_name": variant.model_name
                            }
                        ))

                        return response, variant, assignment

            # Fallback to original request
            original_request = PromptRequest(
                prompt_id=request.prompt_id,
                version=request.version,
                variables=request.variables,
                model_provider=request.model_provider,
                model_name=request.model_name,
                tenant_id=request.tenant_id,
                project_id=request.project_id
            )
            response = await get_prompt_fn(original_request)
            return response, None, None

        except Exception as e:
            # Track error event
            if request.experiment_id:
                await self.track_event(ExperimentEventCreateRequest(
                    experiment_id=request.experiment_id,
                    event_type=EventType.ERROR,
                    event_name="prompt_request_error",
                    session_id=(request.context or ExperimentContext()).session_id,
                    user_id=(request.context or ExperimentContext()).user_id,
                    error_message=str(e)
                ))
            raise e

    async def track_event(self, event: ExperimentEventCreateRequest) -> ExperimentEvent:
        """Track an event for A/B testing analytics"""
        if not self.config.enable_event_tracking:
            raise PromptOpsError("Event tracking is disabled")

        try:
            if event.occurred_at is None:
                event.occurred_at = datetime.now()

            response = await self._make_request(
                "POST",
                "/v1/ab-testing/events",
                data={
                    "experiment_id": event.experiment_id,
                    "assignment_id": event.assignment_id,
                    "event_type": event.event_type.value,
                    "event_name": event.event_name,
                    "event_data": event.event_data,
                    "user_id": event.user_id,
                    "session_id": event.session_id,
                    "device_id": event.device_id,
                    "response_time_ms": event.response_time_ms,
                    "tokens_used": event.tokens_used,
                    "cost_usd": event.cost_usd,
                    "conversion_value": event.conversion_value,
                    "success_indicator": event.success_indicator,
                    "error_message": event.error_message,
                    "occurred_at": event.occurred_at.isoformat()
                }
            )

            tracked_event = ExperimentEvent(**response)

            # Track in telemetry
            await self.telemetry_manager.track_user_action(
                "ab_test_event_tracked",
                {
                    "experiment_id": event.experiment_id,
                    "event_type": event.event_type.value,
                    "event_name": event.event_name
                }
            )

            return tracked_event
        except Exception as e:
            logger.error("Failed to track event", error=str(e), experiment_id=event.experiment_id)
            raise PromptOpsError(f"Failed to track event: {str(e)}")

    async def track_conversion(
        self,
        experiment_id: str,
        assignment_id: str,
        conversion_value: Optional[float] = None,
        context: Optional[ExperimentContext] = None
    ) -> ExperimentEvent:
        """Track conversion event"""
        event = ExperimentEventCreateRequest(
            experiment_id=experiment_id,
            assignment_id=assignment_id,
            event_type=EventType.CONVERSION,
            event_name="conversion",
            conversion_value=str(conversion_value) if conversion_value is not None else None,
            success_indicator=True,
            user_id=context.user_id if context else None,
            session_id=context.session_id if context else str(uuid.uuid4()),
            device_id=context.device_id if context else None,
            event_data={"conversion_value": conversion_value}
        )

        return await self.track_event(event)

    # Experiment Management Methods

    async def create_experiment(self, experiment: ExperimentCreateRequest) -> Experiment:
        """Create a new experiment"""
        data = {
            "name": experiment.name,
            "description": experiment.description,
            "project_id": experiment.project_id,
            "prompt_id": experiment.prompt_id,
            "start_time": experiment.start_time.isoformat() if experiment.start_time else None,
            "end_time": experiment.end_time.isoformat() if experiment.end_time else None,
            "traffic_percentage": experiment.traffic_percentage,
            "allocation_strategy": experiment.allocation_strategy.value,
            "target_audience": experiment.target_audience,
            "geographic_targeting": experiment.geographic_targeting,
            "user_attributes": experiment.user_attributes,
            "min_sample_size": experiment.min_sample_size,
            "statistical_significance": experiment.statistical_significance,
            "primary_metric": experiment.primary_metric,
            "secondary_metrics": experiment.secondary_metrics,
            "control_variant": experiment.control_variant.__dict__,
            "treatment_variants": [v.__dict__ for v in experiment.treatment_variants]
        }

        response = await self._make_request("POST", "/v1/ab-testing/experiments", data=data)
        return Experiment(**response)

    async def get_experiment(self, experiment_id: str) -> Optional[Experiment]:
        """Get experiment details"""
        cache_key = f"ab_experiment_{experiment_id}"

        # Try cache first
        cached = await self.cache_manager.get(cache_key)
        if cached:
            return Experiment(**cached)

        try:
            response = await self._make_request("GET", f"/v1/ab-testing/experiments/{experiment_id}")
            experiment = Experiment(**response)

            # Cache the result
            await self.cache_manager.set(cache_key, experiment.__dict__, self.config.cache_ttl)

            return experiment
        except Exception as e:
            logger.error("Failed to get experiment", error=str(e), experiment_id=experiment_id)
            return None

    async def update_experiment(self, experiment_id: str, update: ExperimentUpdateRequest) -> Experiment:
        """Update an experiment"""
        data = {}
        for key, value in update.__dict__.items():
            if value is not None:
                if hasattr(value, 'value'):  # Handle enums
                    data[key] = value.value
                elif isinstance(value, datetime):
                    data[key] = value.isoformat()
                else:
                    data[key] = value

        response = await self._make_request("PUT", f"/v1/ab-testing/experiments/{experiment_id}", data=data)

        # Clear cache
        await self.cache_manager.delete(f"ab_experiment_{experiment_id}")

        return Experiment(**response)

    async def start_experiment(self, experiment_id: str) -> Dict[str, str]:
        """Start an experiment"""
        response = await self._make_request("POST", f"/v1/ab-testing/experiments/{experiment_id}/start")

        # Clear cache
        await self.cache_manager.delete(f"ab_experiment_{experiment_id}")

        return response

    async def pause_experiment(self, experiment_id: str) -> Dict[str, str]:
        """Pause an experiment"""
        response = await self._make_request("POST", f"/v1/ab-testing/experiments/{experiment_id}/pause")

        # Clear cache
        await self.cache_manager.delete(f"ab_experiment_{experiment_id}")

        return response

    async def complete_experiment(self, experiment_id: str) -> Dict[str, Any]:
        """Complete an experiment"""
        response = await self._make_request("POST", f"/v1/ab-testing/experiments/{experiment_id}/complete")

        # Clear cache
        await self.cache_manager.delete(f"ab_experiment_{experiment_id}")

        return response

    # Analytics Methods

    async def get_experiment_results(self, experiment_id: str) -> List[ExperimentResult]:
        """Get experiment results"""
        response = await self._make_request("GET", f"/v1/ab-testing/experiments/{experiment_id}/results")
        return [ExperimentResult(**result) for result in response]

    async def get_variant_performance(self, experiment_id: str) -> List[VariantPerformance]:
        """Get variant performance metrics"""
        response = await self._make_request("GET", f"/v1/ab-testing/experiments/{experiment_id}/performance")
        return [VariantPerformance(**perf) for perf in response]

    async def get_stats(self, project_id: Optional[str] = None) -> ExperimentStats:
        """Get A/B testing statistics"""
        params = {"project_id": project_id} if project_id else {}
        response = await self._make_request("GET", "/v1/ab-testing/stats", params=params)
        return ExperimentStats(**response)

    # Feature Flag Methods

    async def create_feature_flag(self, feature_flag: FeatureFlagCreateRequest) -> FeatureFlag:
        """Create a new feature flag"""
        data = {
            "name": feature_flag.name,
            "description": feature_flag.description,
            "project_id": feature_flag.project_id,
            "prompt_id": feature_flag.prompt_id,
            "enabled": feature_flag.enabled,
            "rollout_percentage": feature_flag.rollout_percentage,
            "rollout_strategy": feature_flag.rollout_strategy.value,
            "targeting_rules": feature_flag.targeting_rules,
            "is_staged_rollout": feature_flag.is_staged_rollout,
            "current_stage": feature_flag.current_stage,
            "total_stages": feature_flag.total_stages,
            "stage_rollout_percentage": feature_flag.stage_rollout_percentage,
            "is_canary_release": feature_flag.is_canary_release,
            "canary_percentage": feature_flag.canary_percentage,
            "canary_duration_hours": feature_flag.canary_duration_hours,
            "scheduled_enable_time": feature_flag.scheduled_enable_time.isoformat() if feature_flag.scheduled_enable_time else None,
            "scheduled_disable_time": feature_flag.scheduled_disable_time.isoformat() if feature_flag.scheduled_disable_time else None
        }

        response = await self._make_request("POST", "/v1/ab-testing/feature-flags", data=data)
        return FeatureFlag(**response)

    async def get_feature_flags(
        self,
        project_id: Optional[str] = None,
        enabled: Optional[bool] = None
    ) -> List[FeatureFlag]:
        """Get feature flags"""
        params = {}
        if project_id:
            params["project_id"] = project_id
        if enabled is not None:
            params["enabled"] = enabled

        response = await self._make_request("GET", "/v1/ab-testing/feature-flags", params=params)
        return [FeatureFlag(**flag) for flag in response]

    async def is_feature_enabled(
        self,
        feature_flag_name: str,
        context: Optional[ExperimentContext] = None
    ) -> bool:
        """Check if a feature is enabled"""
        try:
            feature_flags = await self.get_feature_flags()
            flag = next((f for f in feature_flags if f.name == feature_flag_name), None)

            if not flag or not flag.enabled:
                return False

            # Check rollout percentage
            if flag.rollout_percentage < 100:
                hash_key = context.session_id if context else str(uuid.uuid4())
                hash_value = int(hashlib.sha256(hash_key.encode()).hexdigest()[:8], 16)
                hash_percentage = (hash_value / 0xffffffff) * 100
                return hash_percentage <= flag.rollout_percentage

            return True
        except Exception as e:
            logger.error("Failed to check feature flag", error=str(e), feature_flag_name=feature_flag_name)
            return False

    # Statistical Analysis Methods

    async def calculate_experiment_statistics(
        self,
        experiment_id: str,
        include_confidence_intervals: bool = True,
        confidence_level: float = 0.95
    ) -> Dict[str, Any]:
        """Calculate comprehensive statistics for an experiment"""
        try:
            # Get experiment results from backend
            results = await self.get_experiment_results(experiment_id)
            if not results:
                return {"error": "No results found for experiment"}

            # Group results by variant
            variant_results = {}
            for result in results:
                variant_id = result.variant_id
                if variant_id not in variant_results:
                    variant_results[variant_id] = []
                variant_results[variant_id].append(result)

            # Calculate statistics for each variant
            statistics_data = {}
            for variant_id, variant_data in variant_results.items():
                stats = await self._calculate_variant_statistics(
                    variant_data,
                    include_confidence_intervals,
                    confidence_level
                )
                statistics_data[variant_id] = stats

            # Calculate overall experiment statistics
            experiment_stats = await self._calculate_experiment_statistics(
                statistics_data,
                confidence_level
            )

            return {
                "experiment_id": experiment_id,
                "variants": statistics_data,
                "experiment_stats": experiment_stats,
                "calculated_at": datetime.now().isoformat(),
                "confidence_level": confidence_level
            }

        except Exception as e:
            logger.error("Failed to calculate experiment statistics", error=str(e), experiment_id=experiment_id)
            return {"error": str(e)}

    async def _calculate_variant_statistics(
        self,
        variant_results: List[ExperimentResult],
        include_confidence_intervals: bool,
        confidence_level: float
    ) -> Dict[str, Any]:
        """Calculate statistics for a single variant"""
        if not variant_results:
            return {}

        # Extract basic metrics
        conversions = [r.conversion_count for r in variant_results]
        sample_sizes = [r.sample_size for r in variant_results]
        conversion_rates = [float(r.conversion_rate) for r in variant_results]

        total_conversions = sum(conversions)
        total_sample_size = sum(sample_sizes)
        overall_conversion_rate = total_conversions / total_sample_size if total_sample_size > 0 else 0

        statistics_data = {
            "total_conversions": total_conversions,
            "total_sample_size": total_sample_size,
            "conversion_rate": overall_conversion_rate,
            "conversion_rate_percentage": overall_conversion_rate * 100,
            "raw_conversion_rates": conversion_rates,
            "raw_sample_sizes": sample_sizes,
            "raw_conversions": conversions
        }

        # Calculate additional metrics if we have enough data
        if len(conversion_rates) > 1:
            statistics_data.update({
                "conversion_rate_std": statistics.stdev(conversion_rates) if len(conversion_rates) > 1 else 0,
                "conversion_rate_variance": statistics.variance(conversion_rates) if len(conversion_rates) > 1 else 0
            })

        # Calculate confidence intervals if requested
        if include_confidence_intervals and total_sample_size > 0:
            ci = self._calculate_confidence_interval(
                total_conversions,
                total_sample_size,
                confidence_level
            )
            statistics_data["confidence_interval"] = ci

        return statistics_data

    async def _calculate_experiment_statistics(
        self,
        variant_statistics: Dict[str, Dict[str, Any]],
        confidence_level: float
    ) -> Dict[str, Any]:
        """Calculate overall experiment statistics and compare variants"""
        if len(variant_statistics) < 2:
            return {"error": "Need at least 2 variants for comparison"}

        # Find control and treatment variants
        variants = list(variant_statistics.keys())
        control_variant = variants[0]  # Assume first is control
        treatment_variants = variants[1:]

        experiment_stats = {
            "control_variant": control_variant,
            "treatment_variants": treatment_variants,
            "variant_comparisons": {}
        }

        control_stats = variant_statistics[control_variant]
        control_rate = control_stats.get("conversion_rate", 0)
        control_sample_size = control_stats.get("total_sample_size", 0)
        control_conversions = control_stats.get("total_conversions", 0)

        # Compare each treatment variant with control
        for treatment_variant in treatment_variants:
            treatment_stats = variant_statistics[treatment_variant]
            treatment_rate = treatment_stats.get("conversion_rate", 0)
            treatment_sample_size = treatment_stats.get("total_sample_size", 0)
            treatment_conversions = treatment_stats.get("total_conversions", 0)

            comparison = await self._compare_variants(
                control_conversions, control_sample_size, control_rate,
                treatment_conversions, treatment_sample_size, treatment_rate,
                confidence_level
            )

            experiment_stats["variant_comparisons"][treatment_variant] = comparison

        # Determine winner if we have enough data
        if all(c.get("is_significant", False) for c in experiment_stats["variant_comparisons"].values()):
            experiment_stats["winner_determined"] = True
            experiment_stats["winner"] = self._determine_winner(experiment_stats["variant_comparisons"])
        else:
            experiment_stats["winner_determined"] = False
            experiment_stats["winner"] = None

        return experiment_stats

    async def _compare_variants(
        self,
        control_conversions: int,
        control_sample_size: int,
        control_rate: float,
        treatment_conversions: int,
        treatment_sample_size: int,
        treatment_rate: float,
        confidence_level: float
    ) -> Dict[str, Any]:
        """Compare two variants using statistical tests"""
        comparison = {
            "control_conversion_rate": control_rate,
            "treatment_conversion_rate": treatment_rate,
            "absolute_difference": treatment_rate - control_rate,
            "relative_difference": ((treatment_rate - control_rate) / control_rate * 100) if control_rate > 0 else 0,
            "control_sample_size": control_sample_size,
            "treatment_sample_size": treatment_sample_size
        }

        # Z-test for two proportions
        if control_sample_size > 0 and treatment_sample_size > 0:
            z_score, p_value = self._z_test_two_proportions(
                control_conversions, control_sample_size,
                treatment_conversions, treatment_sample_size
            )

            comparison["z_score"] = z_score
            comparison["p_value"] = p_value

            # Check statistical significance
            alpha = 1 - confidence_level
            comparison["is_significant"] = p_value < alpha
            comparison["confidence_level"] = confidence_level

            # Calculate confidence interval for difference
            ci_lower, ci_upper = self._confidence_interval_difference(
                control_conversions, control_sample_size,
                treatment_conversions, treatment_sample_size,
                confidence_level
            )
            comparison["confidence_interval_lower"] = ci_lower
            comparison["confidence_interval_upper"] = ci_upper

        # Chi-square test for independence
        chi2_stat, chi2_p_value = self._chi_square_test(
            control_conversions, control_sample_size - control_conversions,
            treatment_conversions, treatment_sample_size - treatment_conversions
        )
        comparison["chi_square_statistic"] = chi2_stat
        comparison["chi_square_p_value"] = chi2_p_value

        return comparison

    def _z_test_two_proportions(
        self,
        conv1: int, n1: int,
        conv2: int, n2: int
    ) -> Tuple[float, float]:
        """Perform Z-test for two proportions"""
        if n1 == 0 or n2 == 0:
            return 0.0, 1.0

        p1 = conv1 / n1
        p2 = conv2 / n2
        p_pooled = (conv1 + conv2) / (n1 + n2)

        if p_pooled == 0 or p_pooled == 1:
            return 0.0, 1.0

        standard_error = math.sqrt(p_pooled * (1 - p_pooled) * (1/n1 + 1/n2))

        if standard_error == 0:
            return 0.0, 1.0

        z_score = (p1 - p2) / standard_error
        p_value = 2 * (1 - self._normal_cdf(abs(z_score)))

        return z_score, p_value

    def _chi_square_test(
        self,
        a: int, b: int,  # Control: conversions, non-conversions
        c: int, d: int   # Treatment: conversions, non-conversions
    ) -> Tuple[float, float]:
        """Perform Chi-square test for independence"""
        total = a + b + c + d
        if total == 0:
            return 0.0, 1.0

        # Expected frequencies
        e11 = (a + c) * (a + b) / total
        e12 = (a + c) * (c + d) / total
        e21 = (b + d) * (a + b) / total
        e22 = (b + d) * (c + d) / total

        # Chi-square statistic
        chi2 = ((a - e11)**2 / e11 if e11 > 0 else 0) + \
               ((c - e12)**2 / e12 if e12 > 0 else 0) + \
               ((b - e21)**2 / e21 if e21 > 0 else 0) + \
               ((d - e22)**2 / e22 if e22 > 0 else 0)

        # P-value (Chi-square distribution with 1 degree of freedom)
        p_value = 1 - self._chi_square_cdf(chi2, 1)

        return chi2, p_value

    def _calculate_confidence_interval(
        self,
        conversions: int,
        sample_size: int,
        confidence_level: float
    ) -> Dict[str, float]:
        """Calculate confidence interval for conversion rate"""
        if sample_size == 0:
            return {"lower": 0, "upper": 0}

        p = conversions / sample_size
        z_critical = self._z_critical_value(confidence_level)

        # Wilson score interval for better accuracy with small samples
        z_squared = z_critical ** 2
        z_squared_over_n = z_squared / sample_size

        center = (p + z_squared_over_n / 2) / (1 + z_squared_over_n)
        margin = z_critical * math.sqrt((p * (1 - p) + z_squared_over_n / 4) / sample_size) / (1 + z_squared_over_n)

        return {
            "lower": max(0, center - margin),
            "upper": min(1, center + margin),
            "margin_of_error": margin
        }

    def _confidence_interval_difference(
        self,
        conv1: int, n1: int,
        conv2: int, n2: int,
        confidence_level: float
    ) -> Tuple[float, float]:
        """Calculate confidence interval for difference in proportions"""
        if n1 == 0 or n2 == 0:
            return 0.0, 0.0

        p1 = conv1 / n1
        p2 = conv2 / n2
        diff = p1 - p2

        z_critical = self._z_critical_value(confidence_level)
        se = math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2)
        margin = z_critical * se

        return diff - margin, diff + margin

    def _z_critical_value(self, confidence_level: float) -> float:
        """Get Z critical value for confidence level"""
        # Common Z values for typical confidence levels
        z_values = {
            0.90: 1.645,
            0.95: 1.96,
            0.98: 2.326,
            0.99: 2.576
        }
        return z_values.get(confidence_level, 1.96)

    def _normal_cdf(self, x: float) -> float:
        """Approximate standard normal cumulative distribution function"""
        # Using Taylor series approximation
        return 0.5 * (1 + math.erf(x / math.sqrt(2)))

    def _chi_square_cdf(self, x: float, df: int) -> float:
        """Approximate Chi-square cumulative distribution function"""
        # Simplified approximation for df=1 (common in A/B testing)
        if df == 1:
            return 2 * self._normal_cdf(math.sqrt(x)) - 1
        # For other degrees of freedom, would need more complex implementation
        return 0.5  # Placeholder

    def _determine_winner(self, comparisons: Dict[str, Dict[str, Any]]) -> Optional[str]:
        """Determine winning variant based on statistical significance and improvement"""
        winners = []
        for variant_id, comparison in comparisons.items():
            if comparison.get("is_significant", False):
                improvement = comparison.get("relative_difference", 0)
                if improvement > 0:
                    winners.append((variant_id, improvement))

        if winners:
            # Return variant with highest improvement
            return max(winners, key=lambda x: x[1])[0]
        return None

    async def get_required_sample_size(
        self,
        baseline_rate: float,
        minimum_detectable_effect: float,
        statistical_power: float = 0.8,
        significance_level: float = 0.05
    ) -> Dict[str, Any]:
        """Calculate required sample size for experiment"""
        try:
            # Two-sample proportion test sample size calculation
            p1 = baseline_rate
            p2 = baseline_rate + minimum_detectable_effect

            alpha = significance_level
            beta = 1 - statistical_power
            z_alpha = self._z_critical_value(1 - alpha/2)  # Two-tailed test
            z_beta = self._z_critical_value(statistical_power)

            # Pooled proportion
            p_pooled = (p1 + p2) / 2

            # Sample size per group
            n_per_group = ((z_alpha * math.sqrt(2 * p_pooled * (1 - p_pooled)) +
                           z_beta * math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2) / (minimum_detectable_effect ** 2)

            total_sample_size = 2 * n_per_group

            return {
                "baseline_rate": baseline_rate,
                "minimum_detectable_effect": minimum_detectable_effect,
                "statistical_power": statistical_power,
                "significance_level": significance_level,
                "sample_size_per_group": math.ceil(n_per_group),
                "total_sample_size": math.ceil(total_sample_size),
                "estimated_duration_days": self._estimate_experiment_duration(total_sample_size)
            }

        except Exception as e:
            logger.error("Failed to calculate required sample size", error=str(e))
            return {"error": str(e)}

    def _estimate_experiment_duration(self, total_sample_size: int, daily_traffic: int = 1000) -> int:
        """Estimate experiment duration in days"""
        # Default assumption of 1000 daily users eligible for experiment
        # This should be customized based on actual traffic patterns
        traffic_fraction = 0.1  # Assume 10% of users are in experiment
        daily_experiment_users = daily_traffic * traffic_fraction

        if daily_experiment_users == 0:
            return 30  # Default to 30 days

        return math.ceil(total_sample_size / daily_experiment_users)

    # User Segment Methods

    async def create_user_segment(self, request: UserSegmentCreateRequest) -> UserSegment:
        """Create a new user segment"""
        try:
            response = await self._make_request(
                "POST",
                "/v1/ab-testing/user-segments",
                data=request.__dict__
            )
            return UserSegment(**response)
        except Exception as e:
            logger.error("Failed to create user segment", error=str(e))
            raise PromptOpsError(f"Failed to create user segment: {str(e)}")

    async def get_user_segment(self, segment_id: str) -> Optional[UserSegment]:
        """Get user segment by ID"""
        try:
            response = await self._make_request("GET", f"/v1/ab-testing/user-segments/{segment_id}")
            return UserSegment(**response)
        except Exception as e:
            logger.error("Failed to get user segment", error=str(e), segment_id=segment_id)
            return None

    async def update_user_segment(self, segment_id: str, request: UserSegmentUpdateRequest) -> Optional[UserSegment]:
        """Update user segment"""
        try:
            response = await self._make_request(
                "PUT",
                f"/v1/ab-testing/user-segments/{segment_id}",
                data=request.__dict__
            )
            return UserSegment(**response)
        except Exception as e:
            logger.error("Failed to update user segment", error=str(e), segment_id=segment_id)
            return None

    async def delete_user_segment(self, segment_id: str) -> bool:
        """Delete user segment"""
        try:
            await self._make_request("DELETE", f"/v1/ab-testing/user-segments/{segment_id}")
            return True
        except Exception as e:
            logger.error("Failed to delete user segment", error=str(e), segment_id=segment_id)
            return False

    async def list_user_segments(
        self,
        project_id: Optional[str] = None,
        active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[UserSegment]:
        """List user segments"""
        params = {"skip": skip, "limit": limit}
        if project_id:
            params["project_id"] = project_id
        if active is not None:
            params["active"] = active

        try:
            response = await self._make_request("GET", "/v1/ab-testing/user-segments", params=params)
            return [UserSegment(**segment) for segment in response]
        except Exception as e:
            logger.error("Failed to list user segments", error=str(e))
            return []

    async def check_user_segment_membership(
        self,
        segment_id: str,
        context: ExperimentContext
    ) -> bool:
        """Check if user belongs to a segment"""
        try:
            segment = await self.get_user_segment(segment_id)
            if not segment or not segment.is_active:
                return False

            return await self._evaluate_segment_conditions(segment.segment_conditions, context)
        except Exception as e:
            logger.error("Failed to check segment membership", error=str(e), segment_id=segment_id)
            return False

    async def get_user_segments_for_context(
        self,
        context: ExperimentContext,
        project_id: Optional[str] = None
    ) -> List[UserSegment]:
        """Get all segments that the user belongs to"""
        try:
            segments = await self.list_user_segments(project_id, active=True)
            matching_segments = []

            for segment in segments:
                if await self.check_user_segment_membership(segment.id, context):
                    matching_segments.append(segment)

            return matching_segments
        except Exception as e:
            logger.error("Failed to get user segments for context", error=str(e))
            return []

    async def _evaluate_segment_conditions(
        self,
        conditions: Dict[str, Any],
        context: ExperimentContext
    ) -> bool:
        """Evaluate segment conditions against user context"""
        try:
            # Handle different segment types
            segment_type = conditions.get("type", "static")

            if segment_type == "static":
                return await self._evaluate_static_conditions(conditions.get("rules", []), context)
            elif segment_type == "behavioral":
                return await self._evaluate_behavioral_conditions(conditions.get("rules", []), context)
            elif segment_type == "demographic":
                return await self._evaluate_demographic_conditions(conditions.get("rules", []), context)
            elif segment_type == "custom":
                return await self._evaluate_custom_conditions(conditions.get("rules", []), context)
            else:
                logger.warning("Unknown segment type", segment_type=segment_type)
                return False

        except Exception as e:
            logger.error("Error evaluating segment conditions", error=str(e))
            return False

    async def _evaluate_static_conditions(
        self,
        rules: List[Dict[str, Any]],
        context: ExperimentContext
    ) -> bool:
        """Evaluate static segment conditions"""
        if not context.metadata:
            return False

        for rule in rules:
            field = rule.get("field")
            operator = rule.get("operator", "equals")
            value = rule.get("value")

            if not field:
                continue

            # Handle nested field paths (e.g., "user_attributes.tier")
            field_parts = field.split(".")
            current_value = context.metadata

            try:
                for part in field_parts:
                    if isinstance(current_value, dict) and part in current_value:
                        current_value = current_value[part]
                    else:
                        current_value = None
                        break
            except (KeyError, TypeError):
                current_value = None

            if current_value is None:
                continue

            # Apply operator
            if operator == "equals":
                if current_value != value:
                    return False
            elif operator == "not_equals":
                if current_value == value:
                    return False
            elif operator == "in":
                if current_value not in value:
                    return False
            elif operator == "not_in":
                if current_value in value:
                    return False
            elif operator == "contains":
                if value not in str(current_value):
                    return False
            elif operator == "gt":
                if float(current_value) <= float(value):
                    return False
            elif operator == "lt":
                if float(current_value) >= float(value):
                    return False
            elif operator == "gte":
                if float(current_value) < float(value):
                    return False
            elif operator == "lte":
                if float(current_value) > float(value):
                    return False

        return True

    async def _evaluate_behavioral_conditions(
        self,
        rules: List[Dict[str, Any]],
        context: ExperimentContext
    ) -> bool:
        """Evaluate behavioral segment conditions"""
        # This would typically involve checking user behavior data
        # For now, we'll implement a simple version based on context metadata
        if not context.metadata or "behavior" not in context.metadata:
            return False

        behavior = context.metadata["behavior"]

        for rule in rules:
            metric = rule.get("metric")
            operator = rule.get("operator", "gt")
            value = rule.get("value", 0)
            time_window = rule.get("time_window", "30d")

            if not metric or metric not in behavior:
                continue

            metric_value = behavior[metric]

            # Apply operator
            if operator == "gt" and metric_value <= value:
                return False
            elif operator == "lt" and metric_value >= value:
                return False
            elif operator == "gte" and metric_value < value:
                return False
            elif operator == "lte" and metric_value > value:
                return False
            elif operator == "equals" and metric_value != value:
                return False

        return True

    async def _evaluate_demographic_conditions(
        self,
        rules: List[Dict[str, Any]],
        context: ExperimentContext
    ) -> bool:
        """Evaluate demographic segment conditions"""
        return await self._evaluate_static_conditions(rules, context)

    async def _evaluate_custom_conditions(
        self,
        rules: List[Dict[str, Any]],
        context: ExperimentContext
    ) -> bool:
        """Evaluate custom segment conditions"""
        # This could be extended to support custom logic
        return await self._evaluate_static_conditions(rules, context)

    # Helper Methods

    def clear_session_assignments(self, session_id: str) -> None:
        """Clear session assignments (useful for logout/session expiry)"""
        self._session_assignments.pop(session_id, None)

    def update_config(self, config: ABTestingConfig) -> None:
        """Update A/B testing configuration"""
        self.config = config

    def get_config(self) -> ABTestingConfig:
        """Get current A/B testing configuration"""
        return self.config