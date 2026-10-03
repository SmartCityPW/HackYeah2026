from django.urls import path

from apps.moderation import views

urlpatterns = [
    path('admin/moderation-log', views.ModerationLogView.as_view()),
]
