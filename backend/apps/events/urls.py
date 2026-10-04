from django.urls import path

from apps.events import views

urlpatterns = [
    path('events', views.EventListCreateView.as_view()),
    path('events/<int:pk>', views.EventDetailView.as_view()),
    path('events/<int:pk>/check-in', views.CheckInView.as_view()),
]
