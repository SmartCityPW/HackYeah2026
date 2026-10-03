from django.urls import path

from apps.accounts import views

urlpatterns = [
    path('auth/guest', views.GuestView.as_view()),
    path('auth/register', views.RegisterView.as_view()),
    path('auth/register-organization', views.RegisterOrganizationView.as_view()),
    path('auth/login', views.LoginView.as_view()),
    path('auth/refresh', views.RefreshView.as_view()),
    path('auth/upgrade', views.UpgradeView.as_view()),
    path('me', views.MeView.as_view()),
    path('me/organization', views.MyOrganizationView.as_view()),
    path('organizations/<int:pk>', views.OrganizationPublicView.as_view()),
    path('admin/organizations', views.AdminOrganizationsView.as_view()),
    path('admin/organizations/<int:pk>', views.AdminOrganizationDetailView.as_view()),
]
