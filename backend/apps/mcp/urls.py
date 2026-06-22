from django.urls import path

from .views_admin import TokensCollectionView, TokenDetailView, TokenUsageView
from .views_usage import UsageView

urlpatterns = [
    path("admin/mcp/tokens/", TokensCollectionView.as_view(), name="mcp-admin-tokens"),
    path("admin/mcp/tokens/<str:token_id>/", TokenDetailView.as_view(), name="mcp-admin-token-detail"),
    path("admin/mcp/tokens/<str:token_id>/usage/", TokenUsageView.as_view(), name="mcp-admin-token-usage"),
    path("admin/mcp/usage/", UsageView.as_view(), name="mcp-admin-usage"),
]
