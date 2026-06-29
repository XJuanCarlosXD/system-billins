"""OllamaProvider (Task 3 Step 8).

Stub: solo placeholder hasta que haya host con compute.
"""

from apps.asistente.providers.base import BaseProvider  # noqa: F401  (futuro)


class OllamaProvider:
    async def stream(self, *args, **kwargs):
        raise NotImplementedError(
            "Pendiente de activacion - requiere host con Ollama. "
            "Spec acordo dejar la implementacion pero no desplegarla."
        )
