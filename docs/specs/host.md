# OpenCode v2 host adapter

Status: planned v0.1 contract. Existing research and scaffold utilities do not establish full acceptance.

## Target and session behavior

The v0.1 target is OpenCode desktop 2.1.4 and its bundled v2 server. Other versions and surfaces are unsupported until tested. The [desktop experiment](../v2-product-feasibility.md) showed a native `ctx.session.switchModel` call changing the visible picker and actual model, with the change retained for the following turn. Auto mode may change a manually chosen model or variant; users retain manual control by disabling routing or using an explicit router pin. A switch is session state, not a temporary per-turn override. When routing is disabled, the plugin makes no new selection changes and does not undo earlier switches.

The current v2 [server API](https://opencode.ai/v2/docs/build/plugins/server/) and the pinned 2.1.4 types differ in some details. The pinned prompt hook can be invoked more than once for concurrent admissions and its metadata may contain the desktop's selected pair without indicating user intent. Do not infer explicit intent or rely on a draft model setter. The plugin must not modify prompt content or submit a second prompt.

## Application contract

1. For each supported eligible OpenAI user admission, capture identity, current selection, agent/pin status, control generation and deadline; assess task demand without recording prompts. A router pin, disabled mode, protected configured agent model, unknown required state or unsupported host keeps the current selection. Manual picker selection is not a pin while auto mode is enabled.
2. Compute a validated recommendation with fresh inventory within the decision budget. A recommendation alone does not alter host state. Recheck controls, generation, session identity, pin, catalog and activity immediately before applying. Do not switch an active or queued turn unless host-specific tests prove the timing and interaction are safe; unknown state keeps.
3. Apply at most one native session switch for an eligible admission, using the target model and supported variant. The switch may persist. Avoid unnecessary calls when the current pair already matches. Do not silently restore a previous model or retry with another model. Observe host results separately from proposals; an unknown result is not success.
4. Serialize decisions and switch issuance for a session. Deduplicate repeat events by admission identity where available. Late results, cancellation, changed configuration and unloaded state cannot start a new switch. Independent sessions do not share locks or pins. A disable accepted before a switch is issued prevents it; a switch already issued may finish, so disabling does not promise rollback. Report actual control state and do not claim the host offers an atomic cancellation guarantee.

A native session switch may have side effects on an active or future turn; verification must establish the supported admission conditions. If host APIs do not expose enough state to prove those conditions, keep rather than apply. Other plugins can change state later; do not claim exclusive ownership. OpenCode handles provider errors and retries.

## Acceptance

- In the actual packaged plugin, scripted provider and desktop, observe a real model switch and separate effort-only selection, including the actual request and UI. Verify persistence and the behavior of the next eligible turn rather than asserting turn-local restoration.
- While auto is enabled, test that an explicit picker selection may be superseded by an eligible policy decision. While off or pinned, verify new decisions cannot change the model; re-enable permits evaluation again. Agent-model protection must be established or treated as unknown/keep.
- Test idle, active, steer and queued work, concurrent admissions in one and multiple sessions, retries and duplicates, cancellation, timeout, delayed switch response, disabling before and after issuance, unload/reload and plugin ordering. Verify that a later turn cannot receive a stale decision.
- Check actual message and provider metadata, no extra user turn, no unrelated provider option change, and no mutation when catalog, status or controls are unknown. Model calls within a tool loop are not duplicate admissions.
