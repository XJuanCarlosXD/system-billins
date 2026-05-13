from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('apps.core.urls')),
    path('api/', include('apps.auth_legacy.urls')),
    path('api/', include('apps.fat.urls')),
    path('api/', include('apps.docs.urls')),
]
