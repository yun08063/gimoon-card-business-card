from django.conf import settings
from django.db import models


class AccountProfile(models.Model):
    class SignupMethod(models.TextChoices):
        EMAIL = "email", "이메일 가입"
        GOOGLE = "google", "Google 가입"
        LEGACY = "legacy", "기존 계정"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="account_profile",
    )
    signup_method = models.CharField(
        max_length=16,
        choices=SignupMethod.choices,
        default=SignupMethod.LEGACY,
    )
    auth_providers = models.JSONField(default=list)
    google_subject = models.CharField(max_length=255, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email or self.user.username} ({self.get_signup_method_display()})"
