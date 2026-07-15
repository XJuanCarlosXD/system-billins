from django.urls import path

from apps.asistente import (
    views_admin,
    views_chat,
    views_conversaciones,
    views_skills,
)

app_name = "asistente"

urlpatterns = [
    path(
        "asistente/conversaciones/",
        views_conversaciones.ConversacionesView.as_view(),
        name="conversaciones-list",
    ),
    path(
        "asistente/conversaciones/<str:conv_id>/",
        views_conversaciones.ConversacionDetailView.as_view(),
        name="conversaciones-detail",
    ),
    path(
        "asistente/conversaciones/<str:conv_id>/chat/",
        views_chat.ChatStreamView.as_view(),
        name="chat-stream",
    ),
    path(
        "asistente/confirm/<str:sig>/",
        views_chat.ConfirmView.as_view(),
        name="confirm",
    ),
    path(
        "asistente/status/",
        views_admin.StatusView.as_view(),
        name="status",
    ),
    path(
        "asistente/tools/",
        views_admin.ToolsView.as_view(),
        name="tools-list",
    ),
    path(
        "asistente/skills/",
        views_skills.SkillsListView.as_view(),
        name="skills-list",
    ),
    path(
        "asistente/skills/<str:name>/",
        views_skills.SkillDetailView.as_view(),
        name="skills-detail",
    ),
    path(
        "admin/asistente/auditoria/",
        views_admin.AuditoriaView.as_view(),
        name="auditoria",
    ),
]
