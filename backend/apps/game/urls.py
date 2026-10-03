from django.urls import path

from apps.game import views

urlpatterns = [
    path('me/progress', views.MyProgressView.as_view()),
    path('encounters', views.EncounterListView.as_view()),
    path('encounters/<int:pk>/attack', views.AttackView.as_view()),
]
