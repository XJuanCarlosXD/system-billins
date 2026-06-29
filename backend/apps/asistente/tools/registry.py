"""Tool registry (Task 4 Steps 1-2, 6).

Stub. Implementacion real:
- ToolSpec dataclass(name, description, input_schema, handler, write,
  modules_required).
- REGISTRY: dict[str, ToolSpec].
- list_for_user(user): filtra por get_user_module_flags + modules_required.
- register_tool(spec): helper para que cada modulo registre los suyos.

En este punto el REGISTRY arranca vacio; los modulos (memoria, doc_types,
skills, FAT, CHC, ...) lo pueblan via side-effect cuando se importan.
"""

REGISTRY: dict = {}


def register_tool(spec) -> None:
    REGISTRY[spec.name] = spec
