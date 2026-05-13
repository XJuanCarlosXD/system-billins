from django.urls import path
from .views import (
    LoginView, LogoutView, MeView, MyPermissionsView,
    ChangeOwnPasswordView, AdminUserListView, AdminUserDetailView,
    AdminUserAccessView, AdminUserDocPermsView, AdminUserModuleFlagsView,
    AdminCompaniesListView, AdminCompanyModulesView,
)

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='legacy-login'),
    path('auth/logout/', LogoutView.as_view(), name='legacy-logout'),
    path('auth/change-password/', ChangeOwnPasswordView.as_view(), name='legacy-change-password'),
    path('me/', MeView.as_view(), name='me'),
    path('me/permissions/', MyPermissionsView.as_view(), name='me-permissions'),
    path('admin/users/', AdminUserListView.as_view(), name='admin-users'),
    path('admin/users/<str:username>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/users/<str:username>/access/', AdminUserAccessView.as_view(), name='admin-user-access'),
    path('admin/users/<str:username>/access/<str:modulo>/docs/', AdminUserDocPermsView.as_view(), name='admin-user-doc-perms'),
    path('admin/users/<str:username>/access/<str:modulo>/flags/', AdminUserModuleFlagsView.as_view(), name='admin-user-module-flags'),
    path('admin/companies/', AdminCompaniesListView.as_view(), name='admin-companies'),
    path('admin/companies/<str:no_cia>/modules/', AdminCompanyModulesView.as_view(), name='admin-company-modules'),
]
