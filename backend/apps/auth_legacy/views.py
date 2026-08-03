from django.contrib.auth import authenticate, login, logout
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.legacy.repositories import companies_repo, permissions_repo, users_repo
from . import services


class IsLegacyAdmin(BasePermission):
    """Solo usuarios con rol DBA / Regal General en Oracle pueden administrar."""

    message = 'Solo administradores (DBA / Regal General) pueden ejecutar esta acción.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        try:
            return users_repo.is_dba(request.user.username)
        except Exception:
            return False


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''
        if not username or not password:
            return Response({'detail': 'username y password son requeridos'},
                            status=status.HTTP_400_BAD_REQUEST)
        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({'detail': 'credenciales inválidas'},
                            status=status.HTTP_401_UNAUTHORIZED)
        login(request, user)
        return Response({'username': user.username, 'is_authenticated': True})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({'detail': 'logout ok'})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        username = request.user.username
        try:
            is_admin = users_repo.is_dba(username)
        except Exception:
            is_admin = False
        try:
            profile = users_repo.get_profile(username) or {}
        except Exception:
            profile = {}
        modules = permissions_repo.list_user_modules(username)
        all_companies = companies_repo.list_active()
        if is_admin:
            companies = all_companies
        else:
            # Solo empresas en las que el usuario tiene al menos un módulo activo
            allowed_cias = {m['no_cia'] for m in modules if m.get('activo')}
            companies = [c for c in all_companies if c.no_cia in allowed_cias]
        return Response({
            'username': username,
            'is_authenticated': True,
            'is_admin': is_admin,
            'full_name': profile.get('full_name'),
            'role': profile.get('role'),
            'companies': [c.to_dict() for c in companies],
            'modules': modules,
        })


class MyPermissionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        modulo = request.query_params.get('modulo')
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto')
        if not modulo or not no_cia or not punto:
            return Response({'detail': 'modulo, no_cia y punto son requeridos'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            perms = permissions_repo.get_for(request.user.username, modulo, no_cia, punto)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        if perms is None:
            return Response({'detail': 'sin acceso'}, status=status.HTTP_403_FORBIDDEN)
        return Response(perms.to_dict())


class MyAccessView(APIView):
    """GET /api/me/access/ — payload denso con módulos, flags y tipos_docu del usuario.

    Devuelve una sola respuesta consumida por `useAccess()` en el frontend
    para evitar N requests por flag.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        username = request.user.username.upper()
        try:
            is_admin = users_repo.is_dba(username)
        except Exception:
            is_admin = False

        modules_rows = permissions_repo.list_user_modules(username)
        all_companies = {c.no_cia: c for c in companies_repo.list_active()}

        companies: dict = {}
        modules: dict = {}
        flags: dict = {}
        tipos_docu: dict = {}

        for row in modules_rows:
            if not row.get('activo'):
                continue
            mod = row['modulo']
            no_cia = row['no_cia']
            punto = row['punto']

            cia_descripcion = ''
            cia = all_companies.get(no_cia)
            if cia is not None:
                cia_descripcion = cia.descripcion or ''
            if no_cia not in companies:
                companies[no_cia] = {
                    'no_cia': no_cia,
                    'descripcion': cia_descripcion,
                    'puntos': set(),
                }
            companies[no_cia]['puntos'].add(punto)

            if mod not in modules:
                modules[mod] = {'no_cias': set(), 'puntos': {}}
            modules[mod]['no_cias'].add(no_cia)
            modules[mod]['puntos'].setdefault(no_cia, set()).add(punto)

            key = f'{mod}:{no_cia}:{punto}'
            try:
                flag_map = permissions_repo.get_user_flags(username, mod, no_cia, punto)
                flags[key] = sorted([f for f, v in flag_map.items() if v])
            except Exception:
                flags[key] = []
            try:
                docs = permissions_repo.list_user_doc_perms(username, mod, no_cia, punto)
                tipos_docu[key] = [d['tipo_docu'] for d in docs]
            except Exception:
                tipos_docu[key] = []

        return Response({
            'username': username,
            'is_admin': is_admin,
            'companies': [
                {'no_cia': c['no_cia'], 'descripcion': c['descripcion'],
                 'puntos': sorted(c['puntos'])}
                for c in sorted(companies.values(), key=lambda x: x['no_cia'])
            ],
            'modules': {
                m: {'no_cias': sorted(v['no_cias']),
                    'puntos': {k: sorted(p) for k, p in v['puntos'].items()}}
                for m, v in modules.items()
            },
            'flags': flags,
            'tipos_docu': tipos_docu,
        })


class ChangeOwnPasswordView(APIView):
    """POST /api/auth/change-password/ — el usuario logueado cambia su propia clave."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current = request.data.get('current_password') or ''
        new = request.data.get('new_password') or ''
        confirm = request.data.get('confirm_password') or ''
        if new != confirm:
            return Response({'detail': 'la confirmación no coincide'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            services.change_password(request.user.username, new, current_password=current)
        except (services.InvalidPassword, services.InvalidUsername) as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'detail': 'contraseña actualizada'})


# ---------- Admin endpoints ----------

class AdminUserListView(APIView):
    permission_classes = [IsAuthenticated, IsLegacyAdmin]

    def get(self, request):
        search = request.query_params.get('q') or None
        include_locked = request.query_params.get('include_locked', '1') != '0'
        try:
            page = int(request.query_params.get('page', '1'))
            page_size = int(request.query_params.get('page_size', '25'))
        except ValueError:
            return Response({'detail': 'page y page_size deben ser enteros'},
                            status=status.HTTP_400_BAD_REQUEST)
        order_by = request.query_params.get('order_by', 'created')
        direction = request.query_params.get('direction', 'desc')
        result = users_repo.list_humans(
            include_locked=include_locked,
            search=search,
            page=page,
            page_size=page_size,
            order_by=order_by,
            direction=direction,
        )
        # Compat: dejar también `users` y `count` para clientes viejos.
        return Response({
            **result,
            'users': result['items'],
            'count': result['total'],
        })

    def post(self, request):
        username = request.data.get('username') or ''
        password = request.data.get('password') or ''
        full_name = (request.data.get('full_name') or '').strip()
        role = (request.data.get('role') or '').strip()
        try:
            res = services.create_user(username, password)
        except (services.InvalidPassword, services.InvalidUsername) as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        if full_name:
            try:
                users_repo.upsert_profile(res['username'], full_name, role, request.user.username)
            except Exception:
                pass  # el usuario Oracle ya se creó; el nombre/rol se puede completar luego
        return Response(res, status=status.HTTP_201_CREATED)


class AdminUserDetailView(APIView):
    permission_classes = [IsAuthenticated, IsLegacyAdmin]

    def get(self, request, username):
        det = users_repo.get_detail(username)
        if det is None:
            return Response({'detail': 'usuario no existe'}, status=status.HTTP_404_NOT_FOUND)
        return Response(det)

    def patch(self, request, username):
        new_password = request.data.get('new_password')
        locked = request.data.get('locked')
        full_name = request.data.get('full_name')
        role = request.data.get('role')
        # Salvaguarda: nadie puede bloquearse a sí mismo (te dejaría sin acceso al loguear de nuevo).
        if locked is True and username.upper() == request.user.username.upper():
            return Response(
                {'detail': 'No puedes bloquear tu propia cuenta.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            if new_password:
                services.change_password(username, new_password)
            if locked is not None:
                services.set_account_status(username, bool(locked))
            if full_name is not None or role is not None:
                current = users_repo.get_profile(username) or {}
                fname = full_name if full_name is not None else current.get('full_name')
                frole = role if role is not None else current.get('role')
                users_repo.upsert_profile(username, fname, frole, request.user.username)
        except (services.InvalidPassword, services.InvalidUsername) as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(users_repo.get_detail(username))


class AdminUserAccessView(APIView):
    """Gestiona accesos de un usuario por módulo/empresa/punto.

    GET    /api/admin/users/<u>/access/   → lista actual
    POST   /api/admin/users/<u>/access/   {modulo, no_cia, punto, activo?, por_defecto?}
    DELETE /api/admin/users/<u>/access/?modulo=&no_cia=&punto=
    """
    permission_classes = [IsAuthenticated, IsLegacyAdmin]

    def get(self, request, username):
        return Response({
            'username': username.upper(),
            'access': permissions_repo.list_user_modules(username),
        })

    def post(self, request, username):
        modulo = (request.data.get('modulo') or '').lower()
        no_cia = request.data.get('no_cia')
        punto = request.data.get('punto') or '01'
        activo = bool(request.data.get('activo', True))
        por_defecto = bool(request.data.get('por_defecto', False))
        if not modulo or not no_cia:
            return Response({'detail': 'modulo y no_cia son requeridos'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            res = permissions_repo.grant_access(username, modulo, no_cia, punto,
                                                activo=activo, por_defecto=por_defecto)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(res, status=status.HTTP_201_CREATED)

    def delete(self, request, username):
        modulo = (request.query_params.get('modulo') or '').lower()
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto') or '01'
        if not modulo or not no_cia:
            return Response({'detail': 'modulo y no_cia son requeridos'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            res = permissions_repo.revoke_access(username, modulo, no_cia, punto)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(res)


# ---------- Document permissions endpoints ----------

class AdminUserDocPermsView(APIView):
    """Permisos por tipo de documento de un usuario en un módulo/empresa/punto.

    GET    /api/admin/users/<u>/access/<modulo>/docs/?no_cia=&punto=
    POST   /api/admin/users/<u>/access/<modulo>/docs/   {no_cia, punto, tipo_docu, por_defecto?}
    DELETE /api/admin/users/<u>/access/<modulo>/docs/?no_cia=&punto=&tipo_docu=
    """
    permission_classes = [IsAuthenticated, IsLegacyAdmin]

    def get(self, request, username, modulo):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            assigned = permissions_repo.list_user_doc_perms(username, modulo, no_cia, punto)
            available = permissions_repo.list_available_doc_types(modulo, no_cia)
            return Response({
                'username': username.upper(),
                'modulo': modulo.lower(),
                'no_cia': no_cia,
                'punto': punto,
                'available': available,
                'assigned': assigned,
            })
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request, username, modulo):
        no_cia = request.data.get('no_cia')
        punto = request.data.get('punto', '01')
        tipo_docu = request.data.get('tipo_docu')
        por_defecto = bool(request.data.get('por_defecto', False))
        if not no_cia or not tipo_docu:
            return Response({'detail': 'no_cia y tipo_docu son requeridos'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            res = permissions_repo.grant_doc_access(username, modulo, no_cia, punto,
                                                    tipo_docu, por_defecto)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(res, status=status.HTTP_201_CREATED)

    def delete(self, request, username, modulo):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        tipo_docu = request.query_params.get('tipo_docu')
        if not no_cia or not tipo_docu:
            return Response({'detail': 'no_cia y tipo_docu son requeridos'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            res = permissions_repo.revoke_doc_access(username, modulo, no_cia, punto, tipo_docu)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(res)


# ---------- Module flags endpoints ----------

class AdminUserModuleFlagsView(APIView):
    """Flags S/N de un usuario en un módulo/empresa/punto.

    GET   /api/admin/users/<u>/access/<modulo>/flags/?no_cia=&punto=
    PATCH /api/admin/users/<u>/access/<modulo>/flags/?no_cia=&punto=  {flag: str, value: bool}
    """
    permission_classes = [IsAuthenticated, IsLegacyAdmin]

    def get(self, request, username, modulo):
        no_cia = request.query_params.get('no_cia')
        punto = request.query_params.get('punto', '01')
        if not no_cia:
            return Response({'detail': 'no_cia es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            flags = permissions_repo.get_user_flags(username, modulo, no_cia, punto)
            return Response({'username': username.upper(), 'modulo': modulo.lower(),
                             'no_cia': no_cia, 'punto': punto, 'flags': flags})
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request, username, modulo):
        no_cia = request.data.get('no_cia')
        punto = request.data.get('punto', '01')
        flag = request.data.get('flag')
        value = request.data.get('value')
        if not no_cia or not flag or value is None:
            return Response({'detail': 'no_cia, flag y value son requeridos'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            res = permissions_repo.set_user_flag(username, modulo, no_cia, punto, flag, bool(value))
            return Response(res)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ---------- Companies endpoints ----------

class AdminCompaniesListView(APIView):
    """GET /api/admin/companies/ — lista de empresas activas."""
    permission_classes = [IsAuthenticated, IsLegacyAdmin]

    def get(self, request):
        try:
            companies = companies_repo.list_active()
            return Response({
                'companies': [c.to_dict() for c in companies]
            })
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminCompanyModulesView(APIView):
    """GET /api/admin/companies/<no_cia>/modules/ — módulos disponibles en empresa."""
    permission_classes = [IsAuthenticated, IsLegacyAdmin]

    def get(self, request, no_cia):
        try:
            modules = permissions_repo.supported_modules()
            return Response({
                'no_cia': no_cia,
                'modules': modules
            })
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
