from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('apps.core.urls')),
    path('api/', include('apps.auth_legacy.urls')),
    path('api/', include('apps.fat.urls')),
    path('api/', include('apps.docs.urls')),
    path('api/', include('apps.cnt.urls')),
    path('api/inv/', include('apps.legacy.inv_urls')),
    path('api/cxp/', include('apps.legacy.cxp_urls')),
    path('api/cxc/', include('apps.legacy.cxc_urls')),
    path('api/odc/', include('apps.legacy.odc_urls')),
    path('api/acc/', include('apps.legacy.acc_urls')),
    path('api/chc/', include('apps.legacy.chc_urls')),
    path('api/sdn/', include('apps.legacy.sdn_urls')),
    path('api/acf/', include('apps.legacy.acf_urls')),
    path('api/man/', include('apps.legacy.man_urls')),
]
