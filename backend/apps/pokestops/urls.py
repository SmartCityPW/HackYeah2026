from django.urls import path

from apps.pokestops import views
from core.views import NotImplementedView

urlpatterns = [
    path('pokestops', views.PokestopListCreateView.as_view()),
    path('pokestops/<int:pk>', views.PokestopDetailView.as_view()),
    path('pokestops/<int:pk>/vote', views.VoteView.as_view()),
    path('pokestops/<int:pk>/withdraw', views.WithdrawView.as_view()),
    path('pokestops/<int:pk>/comments', views.CommentsView.as_view()),
    path('me/interactions', views.MyInteractionsView.as_view()),
    # TODO (kolejne wycinki): ankiety i zdjęcia
    path('pokestops/<int:pk>/survey-responses', NotImplementedView.as_view(feature='wypełnianie ankiety')),
    path('pokestops/<int:pk>/survey-results', NotImplementedView.as_view(feature='wyniki ankiety')),
    path('photos', NotImplementedView.as_view(feature='wgrywanie zdjęć')),
]
