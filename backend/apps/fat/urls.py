from django.urls import path
from .views import FatNCFListView, FatNCFAlertsView, FatSearchView, FatDocumentTypesView

urlpatterns = [
    path('fat/ncf/', FatNCFListView.as_view(), name='fat-ncf-list'),
    path('fat/documents/', FatDocumentTypesView.as_view(), name='fat-document-types'),
    path('fat/ncf/alerts/', FatNCFAlertsView.as_view(), name='fat-ncf-alerts'),
    path('fat/search/', FatSearchView.as_view(), name='fat-search'),
]
