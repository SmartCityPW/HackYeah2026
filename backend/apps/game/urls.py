from django.urls import path

from apps.game import views
from core.views import NotImplementedView

urlpatterns = [
    path('me/progress', views.MyProgressView.as_view()),
    # TODO: walka (modele są gotowe, brakuje generowania przeciwników i rozstrzygania walk)
    path('encounters', NotImplementedView.as_view(feature='przeciwnicy w okolicy')),
    path('encounters/<int:pk>/attack', NotImplementedView.as_view(feature='atak na przeciwnika')),
]
