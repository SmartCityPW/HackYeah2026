from django.urls import path

from apps.pokestops import views
from core.views import NotImplementedView

urlpatterns = [
    path('pokestops', views.PokestopListCreateView.as_view()),
    path('pokestops/<int:pk>', views.PokestopDetailView.as_view()),
    path('pokestops/<int:pk>/timeline', views.TimelineView.as_view()),
    path('pokestops/<int:pk>/updates', views.UpdatesView.as_view()),
    path('pokestops/<int:pk>/updates/<int:update_id>', views.UpdateDetailView.as_view()),
    path('pokestops/<int:pk>/vote', views.VoteView.as_view()),
    path('pokestops/<int:pk>/withdraw', views.WithdrawView.as_view()),
    path('pokestops/<int:pk>/comments', views.CommentsView.as_view()),
    path('me/interactions', views.MyInteractionsView.as_view()),
    path('pokestops/<int:pk>/survey-responses', views.SurveyResponsesView.as_view()),
    path('pokestops/<int:pk>/survey-results', views.SurveyResultsView.as_view()),
    # TODO (kolejny wycinek): zdjęcia
    path('photos', NotImplementedView.as_view(feature='wgrywanie zdjęć')),
]
