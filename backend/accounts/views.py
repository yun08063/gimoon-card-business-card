import secrets
from urllib.parse import urlencode

import httpx
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core import signing
from django.http import HttpResponseRedirect
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from rest_framework import permissions, status
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from smartlinks.models import Resolution
from smartlinks.views import TOKEN_SALT
from .models import AccountProfile

User = get_user_model()


def user_payload(user):
    profile = getattr(user, "account_profile", None)
    return {
        "id": user.pk,
        "email": user.email,
        "name": user.get_full_name() or user.email,
        "signup_method": profile.signup_method if profile else AccountProfile.SignupMethod.LEGACY,
        "auth_providers": profile.auth_providers if profile else [],
    }


class AuthView(APIView):
    operation = None
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_read"

    def get_throttles(self):
        self.throttle_scope = {
            "register": "auth_register",
            "login": "auth_login",
        }.get(self.operation, "auth_read")
        return super().get_throttles()

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        operation = self.operation
        if operation == "csrf":
            return Response({"csrfToken": get_token(request)})
        if operation == "config":
            return Response({"googleAvailable": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET), "passwordMaxLength": 16})
        if operation == "me":
            if not request.user.is_authenticated:
                raise AuthenticationFailed("로그인이 필요합니다.")
            return Response({"user": user_payload(request.user)})
        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @method_decorator(csrf_protect)
    def post(self, request):
        operation = self.operation
        if operation == "register":
            return self.register(request)
        if operation == "login":
            return self.login_user(request)
        if operation == "logout":
            logout(request)
            return Response({"ok": True})
        if operation == "claim":
            return self.claim_links(request)
        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def register(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        password = request.data.get("password", "")
        if not email or len(email) > 254 or "@" not in email:
            raise ValidationError({"email": "올바른 이메일 주소를 입력해 주세요."})
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError({"email": "이미 가입된 이메일입니다."})
        if not isinstance(password, str) or not 8 <= len(password) <= 16:
            raise ValidationError({"password": "비밀번호는 8자 이상 16자 이하여야 합니다."})
        try:
            password_validation.validate_password(password)
        except DjangoValidationError as error:
            raise ValidationError({"password": list(error.messages)})
        user = User.objects.create_user(username=f"user_{secrets.token_hex(16)}", email=email, password=password)
        account = user.account_profile
        account.signup_method = AccountProfile.SignupMethod.EMAIL
        account.auth_providers = ["email"]
        account.save(update_fields=["signup_method", "auth_providers"])
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        return Response({"user": user_payload(user)}, status=status.HTTP_201_CREATED)

    def login_user(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        password = request.data.get("password", "")
        if not isinstance(password, str) or len(password) > 16:
            raise ValidationError({"password": "비밀번호는 16자까지 입력할 수 있습니다."})
        user_record = User.objects.filter(email__iexact=email).first()
        user = authenticate(request, username=user_record.username if user_record else "", password=password)
        if not user:
            raise AuthenticationFailed("이메일 또는 비밀번호가 올바르지 않습니다.")
        login(request, user)
        return Response({"user": user_payload(user)})

    def claim_links(self, request):
        if not request.user.is_authenticated:
            raise AuthenticationFailed("로그인이 필요합니다.")
        claimed = 0
        for token in request.headers.get("X-Edit-Tokens", "").split(","):
            if not token:
                continue
            try:
                identifier = signing.loads(token, salt=TOKEN_SALT, max_age=7 * 86400)
            except signing.BadSignature:
                continue
            updated = Resolution.objects.filter(pk=identifier, owner__isnull=True).update(owner=request.user)
            claimed += updated
        return Response({"claimed": claimed})


class GoogleStartView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?google=not-configured")
        state = secrets.token_urlsafe(32)
        request.session["google_oauth_state"] = state
        query = urlencode({
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "prompt": "select_account",
        })
        return HttpResponseRedirect(f"https://accounts.google.com/o/oauth2/v2/auth?{query}")


class GoogleCallbackView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        expected_state = request.session.pop("google_oauth_state", "")
        received_state = request.query_params.get("state", "")
        if not expected_state or not secrets.compare_digest(expected_state, received_state):
            return self.fail("state")
        if request.query_params.get("error") or not request.query_params.get("code"):
            return self.fail("cancelled")
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            return self.fail("not-configured")
        try:
            token_response = httpx.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": request.query_params["code"],
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
                timeout=10,
                follow_redirects=False,
            )
            token_response.raise_for_status()
            access_token = token_response.json()["access_token"]
            profile_response = httpx.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10,
                follow_redirects=False,
            )
            profile_response.raise_for_status()
            profile = profile_response.json()
        except (httpx.HTTPError, KeyError, ValueError):
            return self.fail("provider-error")
        email = str(profile.get("email", "")).strip().lower()
        subject = str(profile.get("sub", ""))
        if not subject or not email or profile.get("email_verified") is not True:
            return self.fail("unverified-email")
        users = User.objects.filter(email__iexact=email)
        if users.count() > 1:
            return self.fail("account-conflict")
        user = users.first()
        created = False
        if user is None:
            username = f"google_{subject}"
            existing = User.objects.filter(username=username).first()
            if existing and existing.email.lower() != email:
                return self.fail("account-conflict")
            user = existing or User.objects.create_user(username=username, email=email)
            created = existing is None
            if profile.get("given_name"):
                user.first_name = str(profile["given_name"])[:150]
                user.save(update_fields=["first_name"])
        if not user.is_active:
            return self.fail("inactive")
        account, _ = AccountProfile.objects.get_or_create(user=user)
        if account.google_subject and account.google_subject != subject:
            return self.fail("account-conflict")
        if created:
            account.signup_method = AccountProfile.SignupMethod.GOOGLE
        providers = list(account.auth_providers or [])
        if "google" not in providers:
            providers.append("google")
        account.auth_providers = providers
        account.google_subject = subject
        account.save(update_fields=["signup_method", "auth_providers", "google_subject"])
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?google=success")

    def fail(self, reason):
        return HttpResponseRedirect(f"{settings.FRONTEND_URL}/login?google={reason}")
