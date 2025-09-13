import json
import re
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime
import structlog
from enum import Enum

logger = structlog.get_logger()

class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class ComplianceIssue(Enum):
    MISSING_REQUIRED_FIELD = "missing_required_field"
    INVALID_RISK_LEVEL = "invalid_risk_level"
    INSUFFICIENT_CONTENT = "insufficient_content"
    MISSING_FAIRNESS_ASSESSMENT = "missing_fairness_assessment"
    MISSING_INTENT_DESCRIPTION = "missing_intent_description"
    INAPPROPRIATE_LANGUAGE = "inappropriate_language"
    BIAS_DETECTED = "bias_detected"
    PRIVACY_CONCERNS = "privacy_concerns"

class MASComplianceService:
    """Service for MAS FEAT compliance validation and reporting"""

    def __init__(self):
        # Keywords and patterns for compliance checks
        self.inappropriate_patterns = [
            r'\b(discriminat|prejudic|bias|stereotype|offens|inappropriat|unethical)\b',
            r'\b(hate|harass|threat|intimidat|bully)\b',
            r'\b(violent|abuse|harm|dangerous|illegal)\b'
        ]

        self.privacy_concern_patterns = [
            r'\b(personal|private|confidential|sensitive)\s+(information|data|details?)\b',
            r'\b(health|medical|financial|legal)\s+(information|data|records?)\b',
            r'\b(address|phone|email|ssn|passport|credit card)\b'
        ]

        self.bias_indicators = [
            r'\b(all|every|always|never)\s+\w+',
            r'\b(obviously|clearly|naturally)\b',
            r'\b(men|women|boys|girls)\s+(should|must|are)\b'
        ]

    def validate_prompt_compliance(self, prompt_data: Dict[str, Any]) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        Validate prompt against MAS FEAT requirements
        Returns (is_compliant, list_of_issues)
        """
        issues = []

        # Check required fields
        required_fields = [
            ("mas_intent", ComplianceIssue.MISSING_INTENT_DESCRIPTION),
            ("mas_fairness_notes", ComplianceIssue.MISSING_FAIRNESS_ASSESSMENT),
            ("mas_risk_level", ComplianceIssue.MISSING_REQUIRED_FIELD)
        ]

        for field, issue_type in required_fields:
            if not prompt_data.get(field):
                issues.append({
                    "type": issue_type.value,
                    "field": field,
                    "message": f"Missing required MAS FEAT field: {field}",
                    "severity": "high"
                })

        # Validate risk level
        risk_level = prompt_data.get("mas_risk_level", "").lower()
        if risk_level not in [level.value for level in RiskLevel]:
            issues.append({
                "type": ComplianceIssue.INVALID_RISK_LEVEL.value,
                "field": "mas_risk_level",
                "message": f"Invalid risk level: {risk_level}. Must be one of: {', '.join([level.value for level in RiskLevel])}",
                "severity": "high"
            })

        # Content validation
        content = prompt_data.get("content", "")
        if not content or len(content.strip()) < 20:
            issues.append({
                "type": ComplianceIssue.INSUFFICIENT_CONTENT.value,
                "field": "content",
                "message": "Prompt content is too short or empty",
                "severity": "medium"
            })

        # Content quality checks
        content_issues = self._analyze_content_quality(content)
        issues.extend(content_issues)

        # MAS FEAT field quality checks
        field_issues = self._validate_mas_fields_quality(prompt_data)
        issues.extend(field_issues)

        is_compliant = len(issues) == 0
        return is_compliant, issues

    def _analyze_content_quality(self, content: str) -> List[Dict[str, Any]]:
        """Analyze prompt content for compliance issues"""
        issues = []

        # Check for inappropriate language
        for pattern in self.inappropriate_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                issues.append({
                    "type": ComplianceIssue.INAPPROPRIATE_LANGUAGE.value,
                    "field": "content",
                    "message": f"Potentially inappropriate language detected: '{match.group()}'",
                    "severity": "high",
                    "context": content[max(0, match.start()-20):match.end()+20]
                })

        # Check for privacy concerns
        for pattern in self.privacy_concern_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                issues.append({
                    "type": ComplianceIssue.PRIVACY_CONCERNS.value,
                    "field": "content",
                    "message": f"Potential privacy concern detected: '{match.group()}'",
                    "severity": "medium",
                    "context": content[max(0, match.start()-20):match.end()+20]
                })

        # Check for bias indicators
        for pattern in self.bias_indicators:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                issues.append({
                    "type": ComplianceIssue.BIAS_DETECTED.value,
                    "field": "content",
                    "message": f"Potential bias indicator detected: '{match.group()}'",
                    "severity": "medium",
                    "context": content[max(0, match.start()-20):match.end()+20]
                })

        return issues

    def _validate_mas_fields_quality(self, prompt_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Validate the quality and completeness of MAS FEAT fields"""
        issues = []

        # Check intent description quality
        intent = prompt_data.get("mas_intent", "")
        if len(intent) < 50:
            issues.append({
                "type": ComplianceIssue.MISSING_INTENT_DESCRIPTION.value,
                "field": "mas_intent",
                "message": "Intent description is too brief (minimum 50 characters recommended)",
                "severity": "medium"
            })

        # Check fairness notes quality
        fairness_notes = prompt_data.get("mas_fairness_notes", "")
        if len(fairness_notes) < 30:
            issues.append({
                "type": ComplianceIssue.MISSING_FAIRNESS_ASSESSMENT.value,
                "field": "mas_fairness_notes",
                "message": "Fairness assessment is too brief (minimum 30 characters recommended)",
                "severity": "medium"
            })

        # Check if testing notes address specific scenarios
        testing_notes = prompt_data.get("mas_testing_notes", "")
        if testing_notes and len(testing_notes) < 20:
            issues.append({
                "type": "insufficient_testing_notes",
                "field": "mas_testing_notes",
                "message": "Testing notes should be more detailed if provided",
                "severity": "low"
            })

        return issues

    def generate_compliance_report(self, prompt_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive MAS FEAT compliance report"""
        is_compliant, issues = self.validate_prompt_compliance(prompt_data)

        # Calculate risk score
        risk_score = self._calculate_risk_score(issues)

        # Generate recommendations
        recommendations = self._generate_recommendations(issues, prompt_data)

        # Create approval status
        approval_status = self._determine_approval_status(is_compliant, risk_score)

        return {
            "prompt_id": prompt_data.get("id"),
            "version": prompt_data.get("version"),
            "validation_timestamp": datetime.utcnow().isoformat(),
            "is_compliant": is_compliant,
            "risk_score": risk_score,
            "risk_level": self._get_risk_level_from_score(risk_score),
            "approval_status": approval_status,
            "issues": issues,
            "issue_summary": {
                "total_issues": len(issues),
                "high_severity": len([i for i in issues if i["severity"] == "high"]),
                "medium_severity": len([i for i in issues if i["severity"] == "medium"]),
                "low_severity": len([i for i in issues if i["severity"] == "low"])
            },
            "recommendations": recommendations,
            "next_steps": self._get_next_steps(approval_status, issues),
            "compliance_percentage": self._calculate_compliance_percentage(issues)
        }

    def _calculate_risk_score(self, issues: List[Dict[str, Any]]) -> float:
        """Calculate risk score based on compliance issues"""
        if not issues:
            return 0.0

        score = 0.0
        for issue in issues:
            if issue["severity"] == "high":
                score += 10.0
            elif issue["severity"] == "medium":
                score += 5.0
            else:
                score += 2.0

        # Normalize to 0-100 scale
        return min(100.0, score)

    def _get_risk_level_from_score(self, score: float) -> str:
        """Convert risk score to risk level"""
        if score >= 20:
            return RiskLevel.HIGH.value
        elif score >= 10:
            return RiskLevel.MEDIUM.value
        else:
            return RiskLevel.LOW.value

    def _generate_recommendations(self, issues: List[Dict[str, Any]], prompt_data: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on compliance issues"""
        recommendations = []

        if not issues:
            recommendations.append("Prompt is fully compliant with MAS FEAT requirements")
            return recommendations

        # Group issues by type
        issue_types = {}
        for issue in issues:
            issue_type = issue["type"]
            if issue_type not in issue_types:
                issue_types[issue_type] = []
            issue_types[issue_type].append(issue)

        # Generate specific recommendations
        for issue_type, type_issues in issue_types.items():
            if issue_type == ComplianceIssue.MISSING_REQUIRED_FIELD.value:
                recommendations.append("Complete all required MAS FEAT fields: intent, fairness notes, and risk level")
            elif issue_type == ComplianceIssue.INVALID_RISK_LEVEL.value:
                recommendations.append("Select appropriate risk level: low, medium, or high")
            elif issue_type == ComplianceIssue.INSUFFICIENT_CONTENT.value:
                recommendations.append("Expand prompt content to provide sufficient context")
            elif issue_type == ComplianceIssue.MISSING_INTENT_DESCRIPTION.value:
                recommendations.append("Provide detailed intent description (minimum 50 characters)")
            elif issue_type == ComplianceIssue.MISSING_FAIRNESS_ASSESSMENT.value:
                recommendations.append("Include comprehensive fairness assessment (minimum 30 characters)")
            elif issue_type == ComplianceIssue.INAPPROPRIATE_LANGUAGE.value:
                recommendations.append("Review and remove inappropriate language")
            elif issue_type == ComplianceIssue.BIAS_DETECTED.value:
                recommendations.append("Review for potential bias and use inclusive language")
            elif issue_type == ComplianceIssue.PRIVACY_CONCERNS.value:
                recommendations.append("Remove or handle personal/sensitive information appropriately")

        # Add general recommendations based on severity
        high_severity_count = len([i for i in issues if i["severity"] == "high"])
        if high_severity_count > 0:
            recommendations.append("Address high-severity issues before submission")

        return recommendations

    def _determine_approval_status(self, is_compliant: bool, risk_score: float) -> str:
        """Determine approval status based on compliance and risk"""
        if not is_compliant:
            return "needs_review"
        elif risk_score < 5:
            return "auto_approve"
        elif risk_score < 15:
            return "human_review"
        else:
            return "rejected"

    def _get_next_steps(self, approval_status: str, issues: List[Dict[str, Any]]) -> List[str]:
        """Get next steps based on approval status"""
        if approval_status == "auto_approve":
            return ["Prompt is ready for approval", "Submit for review", "Publish after approval"]
        elif approval_status == "human_review":
            return ["Review all compliance issues", "Address high and medium severity issues", "Submit for human review"]
        elif approval_status == "needs_review":
            return ["Address all compliance issues", "Resubmit for validation", "Proceed to approval process"]
        else:
            return ["Major compliance issues found", "Significant revisions required", "Rebuild prompt with MAS FEAT guidelines"]

    def _calculate_compliance_percentage(self, issues: List[Dict[str, Any]]) -> float:
        """Calculate overall compliance percentage"""
        if not issues:
            return 100.0

        # Weight issues by severity
        total_weight = 0
        weighted_issues = 0

        for issue in issues:
            if issue["severity"] == "high":
                total_weight += 3
                weighted_issues += 3
            elif issue["severity"] == "medium":
                total_weight += 2
                weighted_issues += 2
            else:
                total_weight += 1
                weighted_issues += 1

        # Assume base of 30 points for perfect compliance
        base_score = 30
        max_score = base_score + total_weight

        return max(0, (max_score - weighted_issues) / max_score * 100)

    def batch_validate_prompts(self, prompts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Validate multiple prompts for compliance"""
        results = []
        total_issues = 0
        compliant_count = 0

        for prompt in prompts:
            report = self.generate_compliance_report(prompt)
            results.append(report)
            total_issues += len(report["issues"])
            if report["is_compliant"]:
                compliant_count += 1

        # Generate batch summary
        avg_compliance = sum(r["compliance_percentage"] for r in results) / len(results) if results else 0

        return {
            "batch_id": f"batch_{datetime.utcnow().timestamp()}",
            "total_prompts": len(prompts),
            "compliant_prompts": compliant_count,
            "non_compliant_prompts": len(prompts) - compliant_count,
            "total_issues": total_issues,
            "average_compliance_percentage": round(avg_compliance, 2),
            "results": results,
            "summary": {
                "compliance_rate": (compliant_count / len(prompts)) * 100 if prompts else 0,
                "issues_per_prompt": total_issues / len(prompts) if prompts else 0,
                "highest_risk_score": max((r["risk_score"] for r in results), default=0)
            }
        }

    def get_compliance_statistics(self, prompts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get compliance statistics for a collection of prompts"""
        if not prompts:
            return {"error": "No prompts provided"}

        # Generate reports for all prompts
        reports = [self.generate_compliance_report(prompt) for prompt in prompts]

        # Calculate statistics
        total_prompts = len(reports)
        compliant_prompts = sum(1 for r in reports if r["is_compliant"])

        # Risk level distribution
        risk_levels = {}
        for report in reports:
            level = report["risk_level"]
            risk_levels[level] = risk_levels.get(level, 0) + 1

        # Issue type distribution
        issue_types = {}
        for report in reports:
            for issue in report["issues"]:
                issue_type = issue["type"]
                issue_types[issue_type] = issue_types.get(issue_type, 0) + 1

        # Approval status distribution
        approval_statuses = {}
        for report in reports:
            status = report["approval_status"]
            approval_statuses[status] = approval_statuses.get(status, 0) + 1

        return {
            "total_prompts": total_prompts,
            "compliance_rate": (compliant_prompts / total_prompts) * 100,
            "risk_level_distribution": risk_levels,
            "issue_type_distribution": issue_types,
            "approval_status_distribution": approval_statuses,
            "average_risk_score": sum(r["risk_score"] for r in reports) / total_prompts,
            "average_compliance_percentage": sum(r["compliance_percentage"] for r in reports) / total_prompts
        }

# Global service instance
mas_compliance_service = MASComplianceService()