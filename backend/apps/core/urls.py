from django.urls import path
from .views import HealthView, OracleHealthView

urlpatterns = [
    path('health/', HealthView.as_view(), name='health'),
    path('health/oracle/', OracleHealthView.as_view(), name='health-oracle'),
]
