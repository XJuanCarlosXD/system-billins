"""ClaudeProvider (Task 3 Steps 3-7).

Stub. Implementacion real:
- anthropic.AsyncAnthropic + messages.stream().
- Prompt cache via cache_control={"type":"ephemeral"} en system y ultimo tool.
- Convierte RawContentBlockDeltaEvent / ContentBlockStartEvent / etc. en
  ProviderEvent.TextDelta / ToolUse / MessageComplete.
"""
