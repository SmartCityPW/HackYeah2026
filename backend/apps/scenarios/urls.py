from django.urls import path

from apps.scenarios import views
from core.views import NotImplementedView

urlpatterns = [
    path('scenarios', views.ScenarioListView.as_view()),
    path('admin/scenarios/<str:code>', NotImplementedView.as_view(feature='edycja scenariusza (PUT /admin/scenarios/{code})')),
]
