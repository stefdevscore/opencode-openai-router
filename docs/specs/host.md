# OpenCode v2 host adapter

Status: cut 3 is in progress. An unregistered adapter implements the decision and issuance boundary and has unit tests. A 2.2 CLI fixture observed native model and effort switches and subsequent-turn persistence, using synthetic safety evidence; it does not establish the required host activity/identity checks or desktop acceptance. See the [host investigation](../evidence/v2-host-adapter-2.2.0.md) for the pinned API limitations. The installed plugin remains non-routing.

## Target and session behavior

The v0.1 development target is OpenCode desktop 2.2.0 and its bundled v2 server. No per-turn recommendation workflow or manual selection protection is required while auto mode is enabled. Other versions and surfaces are unsupported until tested. The earlier [desktop experiment](../v2-product-feasibility.md) on 2.1.4 showed a native `ctx.session.switchModel` call changing the visible picker and actual model, with the change retained for the following turn; repeat the switching and safety tests on 2.2.0. Auto mode may change a manually chosen model or variant; users retain manual control by disabling routing. A switch is session state, not a temporary per-turn override. When routing is disabled, the plugin makes no new selection changes and does not undo earlier switches.

The current v2 [server API](https://opencode.ai/v2/docs/build/plugins/server/) and the pinned 2.1.4 types differ in some details. The pinned prompt hook can be invoked more than once for concurrent admissions and its metadata may contain the desktop's selected pair without indicating user intent. Do not infer explicit intent or rely on a draft model setter. Routing must not modify prompt content or submit a second coding prompt. An optional model-classifier generation is a separately budgeted background operation with verified session isolation and recursion exclusion; see [model evidence](model-evidence.md).

## Application contract

1. For each supported eligible OpenAI user admission, capture identity, current selection, agent context, control generation and deadline; assess task demand without recording prompts. Disabled mode, unknown required state or unsupported host keeps the current selection. Manual picker selection is not a pin while auto mode is enabled.
2. Compute a validated decision with fresh inventory within the decision budget. A decision is applied only after validation. Recheck controls, generation, session identity, catalog/evidence generation and activity immediately before applying. Do not switch an active or queued turn unless host-specific tests prove the timing and interaction are safe; unknown state keeps.
3. Apply at most one native session switch for an eligible admission, using the target model and supported variant. The switch may persist. Avoid unnecessary calls when the current pair already matches. Do not silently restore a previous model or retry with another model. Observe host results separately from proposals; an unknown result is not success.
4. Serialize decisions and switch issuance for a session. Deduplicate repeat events by admission identity where available. Late results, cancellation, changed configuration and unloaded state cannot start a new switch. Independent sessions do not share locks. A disable accepted before a switch is issued prevents it; a switch already issued may finish, so disabling does not promise rollback. Report actual control state and do not claim the host offers an atomic cancellation guarantee.

A native session switch may have side effects on an active or future turn; verification must establish the supported admission conditions. If host APIs do not expose enough state to prove those conditions, keep rather than apply. Other plugins can change state later; do not claim exclusive ownership. OpenCode handles provider errors and retries.

## Acceptance

- In the actual packaged plugin, scripted provider and desktop, observe a real model switch and separate effort-only selection, including the actual request and UI. Verify persistence and the behavior of the next eligible turn rather than asserting turn-local restoration.
- While auto is enabled, test that an explicit picker selection may be superseded by an eligible policy decision. While off, verify new decisions cannot change the model; re-enable permits evaluation again. Test configured agents as task context, not model pins.
- Test idle, active, steer and queued work, concurrent admissions in one and multiple sessions, retries and duplicates, cancellation, timeout, delayed switch response, disabling before and after issuance, unload/reload and plugin ordering. Verify that a later turn cannot receive a stale decision.
- Check actual message and provider metadata, no extra user turn, no unrelated provider option change, and no mutation when catalog, status or controls are unknown. Model calls within a tool loop are not duplicate admissions.
