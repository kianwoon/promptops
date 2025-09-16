"""
Security Monitoring Middleware

This middleware provides real-time threat detection and security monitoring capabilities
including anomaly detection, rate limiting, suspicious activity detection, and automatic alerting.
"""

import time
import json
import uuid
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.database import get_db
from app.models import (
    SecurityEvent, SecurityAlert, SecurityIncident, SecurityMetrics,
    SecurityEventType, SecuritySeverity, SecurityAlertType, SecurityAlertStatus,
    AnomalyDetectionRule, AnomalyDetectionResult, ThreatIndicator,
    User, AuditLog
)
from app.auth.rbac import rbac_service

class SecurityMonitoringMiddleware(BaseHTTPMiddleware):
    """
    Security monitoring middleware for real-time threat detection and alerting.

    Features:
    - Rate limiting and burst detection
    - Suspicious IP/User pattern detection
    - Anomaly detection for API behavior
    - Automatic security event creation
    - Real-time alert generation
    - Threat intelligence integration
    """

    def __init__(self, app):
        super().__init__(app)
        self.request_times = {}  # Track request times for rate limiting
        self.failed_logins = {}  # Track failed login attempts
        self.suspicious_ips = set()  # Track suspicious IP addresses
        self.ip_reputation_cache = {}  # Cache IP reputation data

    async def dispatch(self, request: Request, call_next):
        """Process each request through security monitoring"""
        start_time = time.time()
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")
        path = request.url.path
        method = request.method

        # Get database session
        db = next(get_db())

        try:
            # Security checks before processing
            await self._pre_request_checks(request, db, client_ip, user_agent)

            # Process the request
            response = await call_next(request)

            # Security checks after processing
            await self._post_request_checks(request, response, db, client_ip, user_agent, start_time)

            return response

        except Exception as e:
            # Handle security-related exceptions
            await self._handle_security_exception(e, request, db, client_ip)
            raise
        finally:
            db.close()

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request"""
        # Check for forwarded IP first (proxy/load balancer)
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()

        # Check for real IP header
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        # Use direct connection IP
        return request.client.host if request.client else "unknown"

    async def _pre_request_checks(self, request: Request, db: Session, client_ip: str, user_agent: str):
        """Perform security checks before request processing"""

        # Check IP reputation
        if await self._is_malicious_ip(client_ip, db):
            await self._create_security_event(
                db=db,
                event_type=SecurityEventType.API_KEY_COMPROMISE,
                severity=SecuritySeverity.HIGH,
                description=f"Malicious IP detected: {client_ip}",
                resource_type="ip_address",
                resource_id=client_ip,
                ip_address=client_ip,
                user_agent=user_agent,
                details_json={"reason": "known_malicious_ip", "source": "threat_intelligence"}
            )
            raise HTTPException(status_code=403, detail="Access denied - suspicious IP")

        # Rate limiting check
        if await self._is_rate_limited(client_ip, request.url.path, db):
            await self._create_security_event(
                db=db,
                event_type=SecurityEventType.RATE_LIMIT_EXCEEDED,
                severity=SecuritySeverity.MEDIUM,
                description=f"Rate limit exceeded for IP: {client_ip}",
                resource_type="ip_address",
                resource_id=client_ip,
                ip_address=client_ip,
                user_agent=user_agent,
                details_json={"path": request.url.path, "method": request.method}
            )
            raise HTTPException(status_code=429, detail="Rate limit exceeded")

        # Suspicious pattern detection
        if await self._detect_suspicious_pattern(request, db):
            await self._create_security_event(
                db=db,
                event_type=SecurityEventType.SUSPICIOUS_ACTIVITY,
                severity=SecuritySeverity.MEDIUM,
                description=f"Suspicious request pattern detected from IP: {client_ip}",
                resource_type="ip_address",
                resource_id=client_ip,
                ip_address=client_ip,
                user_agent=user_agent,
                details_json={"path": request.url.path, "method": request.method}
            )

    async def _post_request_checks(self, request: Request, response: Response, db: Session,
                                 client_ip: str, user_agent: str, start_time: float):
        """Perform security checks after request processing"""

        response_time = (time.time() - start_time) * 1000  # Convert to milliseconds

        # Check for unusual response times
        if response_time > 5000:  # 5 seconds
            await self._create_security_event(
                db=db,
                event_type=SecurityEventType.SUSPICIOUS_ACTIVITY,
                severity=SecuritySeverity.LOW,
                description=f"Slow response time detected: {response_time:.2f}ms",
                resource_type="api_endpoint",
                resource_id=request.url.path,
                ip_address=client_ip,
                user_agent=user_agent,
                details_json={"response_time_ms": response_time, "path": request.url.path}
            )

        # Check for authentication failures
        if response.status_code == 401:
            await self._track_failed_auth(client_ip, db)

        # Check for permission denied
        elif response.status_code == 403:
            await self._create_security_event(
                db=db,
                event_type=SecurityEventType.PERMISSION_DENIED,
                severity=SecuritySeverity.MEDIUM,
                description=f"Permission denied for {request.method} {request.url.path}",
                resource_type="api_endpoint",
                resource_id=request.url.path,
                ip_address=client_ip,
                user_agent=user_agent
            )

        # Track request metrics for anomaly detection
        await self._track_request_metrics(client_ip, request.url.path, response_time, db)

    async def _is_malicious_ip(self, ip_address: str, db: Session) -> bool:
        """Check if IP address is known to be malicious"""
        # Check local threat intelligence database
        indicator = db.query(ThreatIndicator).filter(
            and_(
                ThreatIndicator.indicator_type == "ip",
                ThreatIndicator.indicator_value == ip_address,
                ThreatIndicator.is_active == True,
                or_(
                    ThreatIndicator.expires_at.is_(None),
                    ThreatIndicator.expires_at > datetime.utcnow()
                )
            )
        ).first()

        if indicator:
            return True

        # Check in-memory suspicious IP cache
        if ip_address in self.suspicious_ips:
            return True

        return False

    async def _is_rate_limited(self, ip_address: str, path: str, db: Session) -> bool:
        """Check if IP address has exceeded rate limits"""
        now = time.time()
        key = f"{ip_address}:{path}"

        # Initialize tracking if not exists
        if key not in self.request_times:
            self.request_times[key] = []

        # Clean old requests (older than 1 minute)
        cutoff_time = now - 60
        self.request_times[key] = [t for t in self.request_times[key] if t > cutoff_time]

        # Check rate limits (adjust as needed)
        rate_limits = {
            "/api/": 100,  # 100 requests per minute
            "/api/auth/": 10,  # 10 auth requests per minute
            "/api/governance/": 50,  # 50 governance requests per minute
        }

        for prefix, limit in rate_limits.items():
            if path.startswith(prefix):
                if len(self.request_times[key]) >= limit:
                    return True
                break

        # Add current request
        self.request_times[key].append(now)
        return False

    async def _detect_suspicious_pattern(self, request: Request, db: Session) -> bool:
        """Detect suspicious request patterns"""
        path = request.url.path
        method = request.method
        user_agent = request.headers.get("user-agent", "")

        # Check for common attack patterns
        suspicious_patterns = [
            ("admin", "GET"),  # Admin page access
            ("/wp-admin", "GET"),  # WordPress admin
            ("/phpmyadmin", "GET"),  # phpMyAdmin
            ("/.env", "GET"),  # Environment file access
            ("/config", "GET"),  # Config file access
            ("/backup", "GET"),  # Backup file access
            ("SELECT", "GET"),  # SQL injection attempt
            ("UNION", "GET"),  # SQL injection attempt
            ("script", "GET"),  # XSS attempt
            ("<script", "GET"),  # XSS attempt
            ("javascript:", "GET"),  # XSS attempt
        ]

        for pattern, suspicious_method in suspicious_patterns:
            if method == suspicious_method and pattern.lower() in path.lower():
                return True

        # Check for missing or suspicious user agents
        if not user_agent or user_agent in ["", "-", "curl", "wget", "python-requests"]:
            return True

        # Check for unusual headers
        suspicious_headers = ["x-forwarded-for", "x-real-ip", "via"]
        header_count = sum(1 for header in suspicious_headers if header in request.headers)
        if header_count > 2:  # Multiple proxy headers might indicate spoofing
            return True

        return False

    async def _track_failed_auth(self, ip_address: str, db: Session):
        """Track failed authentication attempts"""
        key = f"failed_auth:{ip_address}"
        now = time.time()

        if key not in self.failed_logins:
            self.failed_logins[key] = []

        # Clean old attempts (older than 15 minutes)
        cutoff_time = now - 900
        self.failed_logins[key] = [t for t in self.failed_logins[key] if t > cutoff_time]

        # Add current attempt
        self.failed_logins[key].append(now)

        # Check for brute force (5 failed attempts in 15 minutes)
        if len(self.failed_logins[key]) >= 5:
            await self._create_security_event(
                db=db,
                event_type=SecurityEventType.LOGIN_FAILURE,
                severity=SecuritySeverity.HIGH,
                description=f"Brute force attack detected from IP: {ip_address}",
                resource_type="ip_address",
                resource_id=ip_address,
                ip_address=ip_address,
                details_json={"failed_attempts": len(self.failed_logins[key]), "time_window": "15_minutes"}
            )

            # Add to suspicious IPs
            self.suspicious_ips.add(ip_address)

    async def _track_request_metrics(self, ip_address: str, path: str, response_time: float, db: Session):
        """Track request metrics for anomaly detection"""
        # Get active anomaly detection rules
        rules = db.query(AnomalyDetectionRule).filter(
            AnomalyDetectionRule.is_active == True,
            AnomalyDetectionRule.target_metric.in_([
                "response_time", "request_rate", "error_rate"
            ])
        ).all()

        for rule in rules:
            if rule.target_metric == "response_time" and response_time > 0:
                await self._evaluate_anomaly_rule(
                    rule=rule,
                    metric_value=response_time,
                    entity_type="ip_address",
                    entity_id=ip_address,
                    context_data={"path": path, "response_time_ms": response_time},
                    db=db
                )

    async def _evaluate_anomaly_rule(self, rule: AnomalyDetectionRule, metric_value: float,
                                   entity_type: str, entity_id: str, context_data: Dict[str, Any], db: Session):
        """Evaluate an anomaly detection rule"""
        try:
            threshold_config = rule.threshold_config
            detection_config = rule.detection_config

            # Calculate baseline and threshold
            baseline_value = detection_config.get("baseline", 100.0)
            threshold_percent = threshold_config.get("threshold_percent", 50.0)

            # Calculate deviation
            if baseline_value > 0:
                deviation_percent = abs((metric_value - baseline_value) / baseline_value) * 100
            else:
                deviation_percent = 0

            # Determine if it's an anomaly
            is_anomaly = deviation_percent > threshold_percent

            if is_anomaly:
                # Create anomaly detection result
                anomaly_result = AnomalyDetectionResult(
                    id=str(uuid.uuid4()),
                    rule_id=rule.id,
                    anomaly_score=str(deviation_percent),
                    baseline_value=str(baseline_value),
                    actual_value=str(metric_value),
                    deviation_percentage=str(deviation_percent),
                    is_anomaly=True,
                    severity=rule.alert_severity,
                    confidence_level="medium",
                    entity_type=entity_type,
                    entity_id=entity_id,
                    metric_name=rule.target_metric,
                    time_window_start=datetime.utcnow(),
                    time_window_end=datetime.utcnow(),
                    detection_details={
                        "threshold_percent": threshold_percent,
                        "deviation_percent": deviation_percent,
                        "baseline_value": baseline_value,
                        "actual_value": metric_value,
                        "context_data": context_data
                    },
                    tenant_id="default"  # Should be extracted from context
                )

                db.add(anomaly_result)

                # Generate alert if configured
                if rule.alert_on_detection:
                    alert = SecurityAlert(
                        id=str(uuid.uuid4()),
                        alert_type=SecurityAlertType.ANOMALY_DETECTED,
                        severity=rule.alert_severity or SecuritySeverity.MEDIUM,
                        title=f"Anomaly Detected: {rule.name}",
                        description=f"Anomaly detected in {rule.target_metric}: {metric_value} (baseline: {baseline_value})",
                        source="anomaly_detection",
                        source_id=rule.id,
                        detection_details=anomaly_result.detection_details,
                        risk_score=str(deviation_percent),
                        confidence_score="medium",
                        tenant_id="default",  # Should be extracted from context
                        ip_address=context_data.get("ip_address") if context_data else None,
                        user_agent=context_data.get("user_agent") if context_data else None
                    )

                    db.add(alert)
                    anomaly_result.alert_generated = True
                    anomaly_result.alert_id = alert.id

                # Update rule statistics
                rule.total_detections += 1
                rule.true_positives += 1
                rule.last_detection_at = datetime.utcnow()

                db.commit()

        except Exception as e:
            db.rollback()
            print(f"Error evaluating anomaly rule: {e}")

    async def _create_security_event(self, db: Session, event_type: SecurityEventType,
                                   severity: SecuritySeverity, description: str,
                                   resource_type: str, resource_id: str,
                                   ip_address: str = None, user_agent: str = None,
                                   details_json: Dict[str, Any] = None):
        """Create a security event record"""
        try:
            security_event = SecurityEvent(
                id=str(uuid.uuid4()),
                event_type=event_type,
                severity=severity,
                resource_type=resource_type,
                resource_id=resource_id,
                action="request_processing",
                description=description,
                details_json=details_json or {},
                ip_address=ip_address,
                user_agent=user_agent,
                tenant_id="default"  # Should be extracted from context
            )

            db.add(security_event)
            db.commit()

        except Exception as e:
            db.rollback()
            print(f"Error creating security event: {e}")

    async def _handle_security_exception(self, exception: Exception, request: Request, db: Session, client_ip: str):
        """Handle security-related exceptions"""
        if isinstance(exception, HTTPException):
            # Log security-related HTTP exceptions
            if exception.status_code in [401, 403, 429]:
                await self._create_security_event(
                    db=db,
                    event_type=SecurityEventType.PERMISSION_DENIED,
                    severity=SecuritySeverity.MEDIUM,
                    description=f"Security exception: {exception.detail}",
                    resource_type="api_endpoint",
                    resource_id=request.url.path,
                    ip_address=client_ip,
                    user_agent=request.headers.get("user-agent", ""),
                    details_json={"status_code": exception.status_code, "detail": exception.detail}
                )


class SecurityMetricsCollector:
    """Collects and aggregates security metrics"""

    @staticmethod
    def collect_daily_metrics(db: Session, tenant_id: str, date: datetime) -> SecurityMetrics:
        """Collect security metrics for a specific date"""

        # Calculate date range
        start_date = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=1)

        # Get security events counts
        total_events = db.query(SecurityEvent).filter(
            SecurityEvent.tenant_id == tenant_id,
            SecurityEvent.created_at >= start_date,
            SecurityEvent.created_at < end_date
        ).count()

        critical_events = db.query(SecurityEvent).filter(
            SecurityEvent.tenant_id == tenant_id,
            SecurityEvent.created_at >= start_date,
            SecurityEvent.created_at < end_date,
            SecurityEvent.severity == SecuritySeverity.CRITICAL
        ).count()

        high_severity_events = db.query(SecurityEvent).filter(
            SecurityEvent.tenant_id == tenant_id,
            SecurityEvent.created_at >= start_date,
            SecurityEvent.created_at < end_date,
            SecurityEvent.severity == SecuritySeverity.HIGH
        ).count()

        medium_severity_events = db.query(SecurityEvent).filter(
            SecurityEvent.tenant_id == tenant_id,
            SecurityEvent.created_at >= start_date,
            SecurityEvent.created_at < end_date,
            SecurityEvent.severity == SecuritySeverity.MEDIUM
        ).count()

        low_severity_events = db.query(SecurityEvent).filter(
            SecurityEvent.tenant_id == tenant_id,
            SecurityEvent.created_at >= start_date,
            SecurityEvent.created_at < end_date,
            SecurityEvent.severity == SecuritySeverity.LOW
        ).count()

        # Get security alerts counts
        total_alerts = db.query(SecurityAlert).filter(
            SecurityAlert.tenant_id == tenant_id,
            SecurityAlert.detected_at >= start_date,
            SecurityAlert.detected_at < end_date
        ).count()

        open_alerts = db.query(SecurityAlert).filter(
            SecurityAlert.tenant_id == tenant_id,
            SecurityAlert.status.in_([SecurityAlertStatus.OPEN, SecurityAlertStatus.INVESTIGATING]),
            SecurityAlert.detected_at >= start_date,
            SecurityAlert.detected_at < end_date
        ).count()

        resolved_alerts = db.query(SecurityAlert).filter(
            SecurityAlert.tenant_id == tenant_id,
            SecurityAlert.status == SecurityAlertStatus.RESOLVED,
            SecurityAlert.detected_at >= start_date,
            SecurityAlert.detected_at < end_date
        ).count()

        # Get security incidents counts
        total_incidents = db.query(SecurityIncident).filter(
            SecurityIncident.tenant_id == tenant_id,
            SecurityIncident.detected_at >= start_date,
            SecurityIncident.detected_at < end_date
        ).count()

        active_incidents = db.query(SecurityIncident).filter(
            SecurityIncident.tenant_id == tenant_id,
            SecurityIncident.status.in_([
                SecurityIncidentStatus.DETECTED,
                SecurityIncidentStatus.INVESTIGATING,
                SecurityIncidentStatus.CONTAINED
            ]),
            SecurityIncident.detected_at >= start_date,
            SecurityIncident.detected_at < end_date
        ).count()

        # Get threat intelligence metrics
        threat_indicators = db.query(ThreatIndicator).filter(
            ThreatIndicator.tenant_id == tenant_id,
            ThreatIndicator.is_active == True
        ).count()

        # Get user activity metrics
        unique_active_users = db.query(User).filter(
            User.tenant_id == tenant_id,
            User.is_active == True
        ).count()

        # Create metrics record
        metrics = SecurityMetrics(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            metric_date=date,
            total_security_events=total_events,
            critical_events=critical_events,
            high_severity_events=high_severity_events,
            medium_severity_events=medium_severity_events,
            low_severity_events=low_severity_events,
            total_alerts=total_alerts,
            open_alerts=open_alerts,
            resolved_alerts=resolved_alerts,
            false_positive_alerts=0,  # To be calculated based on resolution
            total_incidents=total_incidents,
            active_incidents=active_incidents,
            resolved_incidents=0,  # To be calculated
            unique_active_users=unique_active_users,
            suspicious_user_activities=0,  # To be calculated
            threat_indicators_detected=threat_indicators,
            known_threats_blocked=0,  # To be calculated
            suspicious_ips_blocked=0,  # To be calculated
            anomaly_detection_count=0,  # To be calculated from anomaly detection results
        )

        return metrics