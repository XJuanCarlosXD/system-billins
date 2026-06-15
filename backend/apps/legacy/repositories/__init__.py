"""Repositorios de lectura del sistema legado.

Convención:
- 1 archivo por módulo del ERP (fat_repo, cxc_repo, etc.).
- Funciones puras: entran args → salen DTOs (no side effects).
- NUNCA escriben en Oracle. Para escrituras se usan packages PL/SQL del legado.
"""
from . import (  # noqa: F401
    users_repo, companies_repo, permissions_repo,
    fat_repo, cxc_repo, cxp_repo, inv_repo, cnt_repo,
    sdn_repo, chc_repo, odc_repo, acc_repo,
)
