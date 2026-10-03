from django.urls import path

from core.views import NotImplementedView

# TODO: wydarzenia (modele są gotowe, brakuje serwisów i widoków)
urlpatterns = [
    path('events', NotImplementedView.as_view(feature='wydarzenia (lista i dodawanie)')),
    path('events/<int:pk>', NotImplementedView.as_view(feature='wydarzenie (szczegóły i odwołanie)')),
    path('events/<int:pk>/check-in', NotImplementedView.as_view(feature='zameldowanie na wydarzeniu')),
]
