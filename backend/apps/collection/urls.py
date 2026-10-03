from django.urls import path

from apps.collection import views

urlpatterns = [
    path('catalog', views.CatalogView.as_view()),
    path('me/collection', views.MyCollectionView.as_view()),
    path('me/pokemons', views.MyPokemonsView.as_view()),
]
