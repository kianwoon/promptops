# Framework‑Agnostic PromptOps: Tech Design Spec (Registry + Reuse) — Revised v0.2

**Owner:** Platform / AI Enablement  
**Authors:** Platform Eng, MLOps, Security  
**Status:** Draft v0.2  
**Last Updated:** 2025‑09‑12 (Asia/Singapore)

---

## 1) Purpose & Scope

Build a **product‑agnostic PromptOps platform** for enterprise AI that centralises prompt storage, composition, governance, and reuse across heterogeneous frameworks (LangChain, LangGraph, custom SDKs, agents) and heterogeneous model providers (OpenAI, Anthropic, Alibaba/Qwen, local models).

The platform must provide:

- **Registry** for templates, modules, variants, policies, aliases, and metadata.
- **Composition** (imports/slots) and **parameterisation** (variables/defaults) with schema contracts.
- **Runtime APIs** to render fully‑materialised messages (system/user/developer/tools), independent of orchestration frameworks.
- **Governance** (RBAC, audit, approvals, org policies), **observability** (tracing/metrics), **evaluation** (pre‑promotion tests), and **safe rollout** (canary/AB, rollback).
- **Performance** (edge/local caching, LKG fallback) and **resilience**.

### In‑Scope
- Prompt lifecycle mgmt (design → review → test → promote → monitor → iterate).
- Multi‑tenant and multi‑region support.
- Integration hooks for RAG, tools, guardrails, and observability systems like Langfuse/PromptLayer.

### Out‑of‑Scope (for v1)
- WYSIWYG authoring UI beyond basic admin console.
- Human labeling platforms (HITL) — integrate later.
- Automatic prompt optimisation (LLM‑as‑optimizer) — roadmap.

---

## 2) Goals / Non‑Goals

**Goals**
- Vendor‑neutral, framework‑agnostic; thin clients only.
- **Register once, call by alias everywhere.**
- Reuse without duplication via **modules + slots + overrides + variants**.
- Deterministic build → render: same inputs produce same messages + content hash.
- First‑class **governance**: RBAC by slot, audit trail, approvals for protected prompts.
- **Operational**: p95 render < 25 ms from cache; 99.95% monthly availability.

**Non‑Goals**
- Forcing a single orchestration stack.
- Owning RAG retrieval; we define **contracts** for retrieved fields.

---

## 3) High‑Level Architecture
```
+-------------------+        +----------------------+      +---------------------+
| Authoring (Git)   |  PRs   | CI (GH Actions/CI)   |  API  | Prompt Registry Svc |
| YAML/JSON + tests +------->| lint/validate/eval   +------->| FastAPI + PG + Redis|
+-------------------+        +----------+-----------+        +----------+----------+
                                           |                             |
                                           | Webhooks                    |
                                           v                             v
                                    Policy Engine (OPA/Rego)      Observability (OTel)
```

---

## 4) Developer Experience (DX)

### Register
- Author prompt templates/modules in Git as YAML.
- Push PR → CI lints, runs evals, computes content hash.
- On success → publish immutable version (e.g. `support/summary@3.1.0`).
- Map alias `support/summary:prod` to version.

### Use in Code
- Always call by alias (e.g. `:prod`) in app code:
```python
resp = requests.post("/v1/render", json={
  "id": "support/summary",
  "alias": "prod",
  "inputs": {...},
  "tenant": "acme-apac"
})
llm(messages=resp.json()["messages"])
```

### Change Safely
- Ship `3.2.0`, run CI evals.
- Canary rollout by adjusting alias weights.
- Promote after metrics pass.
- **No app redeploy needed.**

---

## 5) Template & Module Spec (YAML)

- **Templates** define system/user/tool messages and import modules for tone, format, safety.
- **Modules** target named slots (`tone`, `safety`, `format`, `toolspec`).
- **Variants** and **tenant overlays** provide per-brand/local tweaks without forks.
- **Policies** attach to templates/modules to enforce limits and disclaimers.
- **Inputs** validated with JSON‑Schema Draft 2020‑12.

---

## 6) API Design (REST first; GraphQL optional)

**Authentication:** OIDC (AzureAD/Entra ID/Okta). JWT with tenant + roles.  
**Authorisation:** OPA/Rego policies; RBAC per namespace/slot.

### Endpoints
- `GET /v1/templates/{id}` → list versions, metadata.
- `GET /v1/templates/{id}/{version}` → raw YAML + computed dependency graph/hash.
- `GET /v1/aliases/{alias}` → resolved target + weights.
- `PATCH /v1/aliases/{alias}/weights` → weighted canary/AB updates (approval gated).
- `POST /v1/render` → **Render API**.
- `POST /v1/compose` → resolve imports/slots, return materialised template.
- `POST /v1/validate` → schema validation of inputs.
- `POST /v1/evals/run` → run eval suite against candidate version.
- `GET /v1/evals/{id}` → eval status + metrics.
- `POST /v1/aliases/{alias}/promote` → update traffic weights or retarget (requires approvals).
- `GET /v1/graph/{id}` → dependency DAG.
- `POST /v1/policies/evaluate` → dry‑run policy decisions for a render request.

**Message Format Returned**
```json
{
  "messages": [
    {"role": "system", "content": "...inlined tone/safety/format..."},
    {"role": "user",   "content": "...filled user text..."}
  ],
  "hash": "sha256:…",
  "template_id": "support/summary",
  "version": "3.1.0",
  "inputs_used": {...},
  "applied_policies": ["policy:max_tokens_2k@1"]
}
```

---

## 7) Composition & Reuse Mechanics
- **Imports**: templates import modules by semantic version (`@^1`). Resolver pins versions at publish time.
- **Slots**: modules target named slots; base templates reference slot variables.
- **Overrides**: callers may override allowed slots/vars (enforced by policy) without forking.
- **Variants**: overlays stored in `variants` table; merged at render time.
- **Tenant overlays**: per‑tenant tweaks without duplicating base.

---

## 8) Evaluation Pipeline
- Eval suite defined in JSON; includes datasets and thresholds.
- CI runs evals before publish; publish blocked if fail.
- Canary: adjust alias weights gradually; metrics monitored.
- Drift detection: weekly evals; auto‑reduce alias weight if drift detected.

---

## 9) Governance & Policy
- **RBAC** down to slot level (who may edit `safety` vs `format`).
- **Policy packs** for BFSI/healthcare: PII handling, disclaimers, jurisdiction toggles.
- **Fail‑closed**: if policy engine times out, request denied.
- **Audit Trail**: every promotion/change logged.

---

## 10) Observability Integration
- Emit OTel spans/metrics with template_id, version, alias, hash, policy_decisions, eval_run_id.
- Integrate with Langfuse/PromptLayer seamlessly.
- Registry remains source of truth; observability is plug‑and‑play.

---

## 11) Data Model (Key Tables)
- `templates(id, version, owner, hash, metadata_json, created_by, created_at)`
- `aliases(alias, target_version, weights_json, etag, updated_by, updated_at)`
- `modules(id, version, slot, render_body, metadata_json)`
- `variants(template_id, name, overlay_json)`
- `policies(id, version, type, config_json)`
- `evaluation_runs(id, template_id, version, suite_id, metrics_json, passed, created_at)`
- `audit_logs(id, actor, action, subject, before_json, after_json, ts)`
- `tenant_overlays(tenant_id, template_id, version, overrides_json)`

---

## 12) Deployment Topology
- Regions: AP‑Southeast‑1 (primary), failover to another region.
- Pods: 3 replicas min; HPA on CPU + RPS; Redis clustered; PG HA with streaming replicas.
- Ingress: API Gateway with JWT validation; WAF; mTLS for internal.
- Backups: PG PITR; S3 object‑lock; Redis snapshot hourly.
- RTO ≤ 15m; RPO ≤ 5m.

---

## 13) CI/CD Workflow (GitHub Actions example)
1. **Lint/Schema**: validate YAML against template/module schemas; check imports resolvable.
2. **Security scan**: PII/secret detection in bodies.
3. **Compose**: produce materialised preview + compute `sha256` hash.
4. **Golden tests**: run evals against staging models; collect metrics.
5. **Publish**: write to PG/S3 on success; create aliases change PR for promotion.
6. **Promotion**: protected workflow requiring approvals; updates alias/weights; notifies subscribers.

---

## 14) Failure Modes & Mitigations
- **Registry outage**: Clients use LKG by `hash/version`; alias changes paused.
- **Cache stampede**: single‑flight locks per key.
- **Policy engine latency**: compile Rego bundles; cache decisions; cap evaluation time with fallback deny.
- **Circular imports**: detected in compose step; publish blocked.
- **Prompt drift**: weekly drift evals; alert + auto‑reduce alias weight.

---

## 15) Admin Console (v1)
- Browse templates/versions; view dependency DAG; compare diffs.
- View & edit alias weights (approval gated).
- Run eval suites on a version; show pass/fail & metric deltas.
- Per-slot RBAC editor.

---

## 16) Prompt Lint Rules
- Placeholder tokens required.
- No model-specific jargon in base templates.
- Mandatory safety slot.
- Max line length for system prompts.
- Banned phrases list.
- Enforce in CI before publish.

---

## 17) Migration Playbook
- Wrap existing prompts as v1.0.0 templates; set environment aliases to match current behaviour.
- Identify common text blocks → extract to slots/modules.
- Introduce tenant overlays to eliminate forks.

---

## 18) Security Posture
- Encryption at rest (PG, Redis, S3), KMS-managed keys; per-tenant key option.
- Secret scanning in CI; documented deny rules and remediation.
- Optional customer-managed keys roadmap.

---

## 19) Roadmap (Post‑v1)
- Authoring UX: rich diff, slot‑scoped editing, localisation assistance.
- Auto‑optimisation: bandits over variants, LLM‑proposed diffs gated by evals.
- Content fingerprints: detect near‑duplicates; suggest dedupe.
- Policy packs: finance/healthcare guardrail bundles.
- Model adapters: automatic toolspec translation across providers.

---

## 20) Appendix: JSON‑Schema for Template Inputs (Draft)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "support/summary inputs",
  "type": "object",
  "required": ["ticket_text", "user_tier"],
  "properties": {
    "ticket_text": { "type": "string", "minLength": 1 },
    "user_tier": { "type": "string", "enum": ["free","pro","enterprise"] },
    "locale": { "type": "string", "default": "en-SG" }
  },
  "additionalProperties": false
}
```

---

**Decision:** This revised spec elevates alias/weights, eval pipelines, and policy packs to first-class. It provides a neutral observability contract, clarifies admin console v1, and hardens SLOs and failure semantics. All frameworks remain clients. Governance and evals are first‑class to defuse the “hidden time bomb” of uncontrolled system prompts.

