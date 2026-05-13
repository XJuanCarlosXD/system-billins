from django.urls import path
from .views import DocsListView, DocDetailView

urlpatterns = [
    path('docs/', DocsListView.as_view(), name='docs-list'),
    path('docs/<str:slug>/', DocDetailView.as_view(), name='docs-detail'),
]
