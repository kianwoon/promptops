import json
from typing import Dict, Any, List, Optional
from datetime import datetime
import structlog
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Prompt, ModelCompatibility
from app.services.model_service import ModelProviderService, CompatibilityStatus

logger = structlog.get_logger()

class CompatibilityService:
    """Service for managing prompt compatibility testing"""

    def __init__(self):
        self.model_service = ModelProviderService()

    async def test_prompt_compatibility(
        self,
        prompt_id: str,
        version: str,
        providers: Optional[List[str]] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """Test compatibility of a specific prompt with model providers"""
        db = next(get_db())

        # Get the prompt from database
        prompt = db.query(Prompt).filter(
            Prompt.id == prompt_id,
            Prompt.version == version
        ).first()

        if not prompt:
            raise ValueError(f"Prompt {prompt_id}@{version} not found")

        # Use all providers if not specified
        if providers is None:
            providers = self.model_service.get_supported_providers()

        # Check if we need to run tests (based on cache age or force refresh)
        if not force_refresh:
            cached_results = self._get_cached_results(prompt_id, version, providers)
            if cached_results:
                return cached_results

        # Run compatibility tests
        test_results = await self.model_service.run_compatibility_tests(prompt.content)

        # Store results in database
        await self._store_compatibility_results(prompt_id, version, test_results)

        logger.info(
            "Compatibility tests completed",
            prompt_id=prompt_id,
            version=version,
            working_count=len(test_results["summary"]["working_providers"])
        )

        return test_results

    async def _store_compatibility_results(
        self,
        prompt_id: str,
        version: str,
        test_results: Dict[str, Any]
    ):
        """Store compatibility test results in database"""
        db = next(get_db())

        try:
            # Clear existing results for this prompt
            db.query(ModelCompatibility).filter(
                ModelCompatibility.prompt_id == prompt_id
            ).delete()

            # Store new results
            for provider, result in test_results["results"].items():
                compatibility = ModelCompatibility(
                    id=f"{prompt_id}_{provider}_{datetime.utcnow().timestamp()}",
                    prompt_id=prompt_id,
                    provider_name=provider,
                    provider_type=provider,  # Using provider as type for now
                    is_compatible=result["status"] in [CompatibilityStatus.WORKS.value, CompatibilityStatus.NEEDS_TUNING.value],
                    compatibility_notes=json.dumps({
                        "status": result["status"],
                        "response_time": result.get("response_time", 0),
                        "quality_score": result.get("quality_score", 0),
                        "estimated_cost": result.get("estimated_cost", 0),
                        "error": result.get("error")
                    })
                )
                db.add(compatibility)

            db.commit()
            logger.info("Compatibility results stored", prompt_id=prompt_id, results_count=len(test_results["results"]))

        except Exception as e:
            db.rollback()
            logger.error("Failed to store compatibility results", error=str(e), prompt_id=prompt_id)
            raise

    def _get_cached_results(
        self,
        prompt_id: str,
        version: str,
        providers: List[str]
    ) -> Optional[Dict[str, Any]]:
        """Get cached compatibility results if recent enough"""
        db = next(get_db())

        # Get recent results (last 24 hours)
        from datetime import timedelta
        cutoff_time = datetime.utcnow() - timedelta(hours=24)

        results = db.query(ModelCompatibility).filter(
            ModelCompatibility.prompt_id == prompt_id,
            ModelCompatibility.created_at >= cutoff_time
        ).all()

        if not results or len(results) < len(providers):
            return None

        # Convert to expected format
        formatted_results = {}
        for result in results:
            try:
                notes = json.loads(result.compatibility_notes or "{}")
                formatted_results[result.provider_name] = {
                    "status": notes.get("status", "not_supported"),
                    "response_time": notes.get("response_time", 0),
                    "quality_score": notes.get("quality_score", 0),
                    "estimated_cost": notes.get("estimated_cost", 0),
                    "error": notes.get("error")
                }
            except:
                formatted_results[result.provider_name] = {
                    "status": "not_supported",
                    "error": "Invalid cached data"
                }

        # Generate summary
        working = [p for p, r in formatted_results.items() if r["status"] == CompatibilityStatus.WORKS.value]
        needs_tuning = [p for p, r in formatted_results.items() if r["status"] == CompatibilityStatus.NEEDS_TUNING.value]
        not_supported = [p for p, r in formatted_results.items() if r["status"] == CompatibilityStatus.NOT_SUPPORTED.value]

        return {
            "prompt_preview": "Cached results",
            "results": formatted_results,
            "summary": {
                "total_providers": len(providers),
                "working_count": len(working),
                "needs_tuning_count": len(needs_tuning),
                "not_supported_count": len(not_supported),
                "working_providers": working,
                "needs_tuning": needs_tuning,
                "not_supported": not_supported
            },
            "recommendations": self.model_service._generate_recommendations(formatted_results),
            "cached": True
        }

    async def get_prompt_compatibility_matrix(
        self,
        prompt_id: str,
        version: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get compatibility matrix for a prompt"""
        db = next(get_db())

        if version:
            # Get specific version
            results = db.query(ModelCompatibility).filter(
                ModelCompatibility.prompt_id == prompt_id
            ).all()
        else:
            # Get all versions
            # This would need to be implemented based on your versioning strategy
            results = db.query(ModelCompatibility).filter(
                ModelCompatibility.prompt_id == prompt_id
            ).all()

        if not results:
            return {"error": "No compatibility data found for this prompt"}

        # Group by version and provider
        matrix = {}
        for result in results:
            try:
                notes = json.loads(result.compatibility_notes or "{}")
                matrix.setdefault(result.provider_name, {})[result.provider_type] = {
                    "status": notes.get("status", "not_supported"),
                    "is_compatible": result.is_compatible,
                    "response_time": notes.get("response_time", 0),
                    "quality_score": notes.get("quality_score", 0),
                    "estimated_cost": notes.get("estimated_cost", 0),
                    "last_tested": result.created_at.isoformat(),
                    "notes": notes.get("error", "")
                }
            except Exception as e:
                logger.error("Failed to parse compatibility notes", error=str(e), compatibility_id=result.id)

        return {
            "prompt_id": prompt_id,
            "version": version,
            "matrix": matrix,
            "providers_tested": list(matrix.keys()),
            "last_updated": max(r.created_at for r in results).isoformat() if results else None
        }

    async def get_project_compatibility_summary(self, project_id: str) -> Dict[str, Any]:
        """Get compatibility summary for all prompts in a project"""
        db = next(get_db())

        # This would need to join with prompts, modules, and projects
        # For now, we'll implement a simpler version
        query = db.query(
            ModelCompatibility.provider_name,
            ModelCompatibility.is_compatible,
            db.func.count(ModelCompatibility.id).label('count')
        ).group_by(
            ModelCompatibility.provider_name,
            ModelCompatibility.is_compatible
        ).all()

        summary = {}
        for provider, is_compatible, count in query:
            if provider not in summary:
                summary[provider] = {"compatible": 0, "incompatible": 0}
            key = "compatible" if is_compatible else "incompatible"
            summary[provider][key] = count

        return {
            "project_id": project_id,
            "provider_summary": summary,
            "total_tests": sum(r.count for r in query)
        }

    async def run_batch_compatibility_tests(
        self,
        prompt_ids: List[str],
        versions: Optional[List[str]] = None,
        providers: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Run compatibility tests for multiple prompts"""
        if versions and len(versions) != len(prompt_ids):
            raise ValueError("If versions provided, must match prompt_ids length")

        results = {}
        errors = {}

        for i, prompt_id in enumerate(prompt_ids):
            version = versions[i] if versions else None
            try:
                # Get latest version if not specified
                if not version:
                    db = next(get_db())
                    latest = db.query(Prompt).filter(
                        Prompt.id == prompt_id
                    ).order_by(Prompt.updated_at.desc()).first()
                    if not latest:
                        errors[prompt_id] = "Prompt not found"
                        continue
                    version = latest.version

                result = await self.test_prompt_compatibility(prompt_id, version, providers)
                results[f"{prompt_id}@{version}"] = result

            except Exception as e:
                logger.error("Batch compatibility test failed", prompt_id=prompt_id, error=str(e))
                errors[f"{prompt_id}@{version or 'latest'}"] = str(e)

        # Generate batch summary
        total_tests = len(results)
        all_providers = set()
        working_counts = {}
        needs_tuning_counts = {}

        for result in results.values():
            all_providers.update(result["summary"]["working_providers"])
            all_providers.update(result["summary"]["needs_tuning"])

            for provider in all_providers:
                if provider in result["summary"]["working_providers"]:
                    working_counts[provider] = working_counts.get(provider, 0) + 1
                elif provider in result["summary"]["needs_tuning"]:
                    needs_tuning_counts[provider] = needs_tuning_counts.get(provider, 0) + 1

        return {
            "batch_id": f"batch_{datetime.utcnow().timestamp()}",
            "total_prompts_tested": total_tests,
            "results": results,
            "errors": errors,
            "summary": {
                "providers_tested": list(all_providers),
                "provider_success_rates": {
                    provider: working_counts.get(provider, 0) / total_tests
                    for provider in all_providers
                },
                "best_overall_provider": max(working_counts, key=working_counts.get) if working_counts else None
            }
        }

    async def get_compatibility_trends(
        self,
        prompt_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get compatibility trends over time for a prompt"""
        db = next(get_db())

        from datetime import timedelta
        cutoff_time = datetime.utcnow() - timedelta(days=days)

        results = db.query(ModelCompatibility).filter(
            ModelCompatibility.prompt_id == prompt_id,
            ModelCompatibility.created_at >= cutoff_time
        ).order_by(ModelCompatibility.created_at).all()

        if not results:
            return {"error": "No historical data found"}

        trends = {}
        for result in results:
            date = result.created_at.strftime("%Y-%m-%d")
            if date not in trends:
                trends[date] = {}

            try:
                notes = json.loads(result.compatibility_notes or "{}")
                trends[date][result.provider_name] = {
                    "status": notes.get("status", "not_supported"),
                    "quality_score": notes.get("quality_score", 0),
                    "response_time": notes.get("response_time", 0)
                }
            except:
                pass

        return {
            "prompt_id": prompt_id,
            "period_days": days,
            "trends": trends,
            "data_points": len(results)
        }

# Global service instance
compatibility_service = CompatibilityService()