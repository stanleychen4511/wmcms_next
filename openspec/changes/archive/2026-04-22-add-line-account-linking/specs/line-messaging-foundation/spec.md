## MODIFIED Requirements

### Requirement: Phase 1 webhook handler is log-only

The webhook handler SHALL write an audit row per received event regardless of binding outcome. The handler MAY perform business logic depending on event type and binding state:

- For `follow` events, the handler SHALL write audit and MAY reply with a guidance message (welcome + instructions to bind).
- For `message` events, the handler SHALL write audit and dispatch by binding state per the `line-account-linking` capability's `Webhook resolves binding state on message events` requirement (Phase 2 behavior).
- For other event types, the handler SHALL write audit and take no further action.

The original "Phase 1 log-only" prohibition on business logic SHALL no longer apply once Phase 2 is in place.

#### Scenario: Follow event still audited

- **WHEN** a user adds the LINE Official Account as friend
- **THEN** the endpoint SHALL write audit `line.webhook_received` with `detail.event_type = 'follow'` and `detail.line_user_id`
- **AND** the bot MAY reply with the welcome / binding guidance text

#### Scenario: Message event audited and dispatched

- **WHEN** a user sends a text message to the bot
- **THEN** the endpoint SHALL write audit with `detail.event_type = 'message'` including `detail.message_text` (truncated to 200 chars)
- **AND** the bot SHALL act according to the binding state dispatch rules defined in the `line-account-linking` capability
