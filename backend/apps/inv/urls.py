from django.urls import path
from . import views

urlpatterns = [
    path('inv/almacenes/', views.AlmacenesView.as_view(), name='inv-almacenes'),
    path('inv/productos/', views.ProductosView.as_view(), name='inv-productos'),
    path('inv/existencia/', views.ExistenciaView.as_view(), name='inv-existencia'),
    path('inv/transacciones/', views.TransaccionesView.as_view(), name='inv-transacciones'),
]
