"""Agent loop (Task 5).

Stub. Implementacion real en Task 5:
- AgentLoop.run(conv_id, user_message) async generator que yieldea SSE events.
- dispatch_tool(user, name, args) con las 4 capas de gate:
  registry -> no_cia -> punto -> USUARIOD.
- pause-on-write con asyncio.Future indexed por sig.
"""
