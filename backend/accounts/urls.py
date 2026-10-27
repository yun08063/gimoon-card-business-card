from django.urls import path

from .views import AuthView, GoogleCallbackView, GoogleStartView

urlpatterns = [
    path("csrf/", AuthView.as_view(operation="csrf"), name="auth-csrf"),
    path("config/", AuthView.as_view(operation="config"), name="auth-config"),
    path("me/", AuthView.as_view(operation="me"), name="auth-me"),
    path("register/", AuthView.as_view(operation="register"), name="auth-register"),
    path("login/", AuthView.as_view(operation="login"), name="auth-login"),
    path("logout/", AuthView.as_view(operation="logout"), name="auth-logout"),
    path("claim/", AuthView.as_view(operation="claim"), name="auth-claim"),
    path("google/start/", GoogleStartView.as_view(), name="google-start"),
    path("google/callback/", GoogleCallbackView.as_view(), name="google-callback"),
]
