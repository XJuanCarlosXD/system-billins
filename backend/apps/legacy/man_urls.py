from django.urls import path
from apps.legacy import man_views

urlpatterns = [
    path('manuales/', man_views.man_manuales),
    path('csc/', man_views.man_csc),
]
