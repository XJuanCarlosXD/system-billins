from django.urls import path
from .views import HealthView, OracleHealthView, SidebarBadgesView

urlpatterns = [
    path('health/', HealthView.as_view(), name='health'),
    path('health/oracle/', OracleHealthView.as_view(), name='health-oracle'),
    path('sidebar/badges/', SidebarBadgesView.as_view(), name='sidebar-badges'),
]
