from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def classify_existing_users(apps, schema_editor):
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    AccountProfile = apps.get_model("accounts", "AccountProfile")
    for user in User.objects.all().iterator():
        if user.username.startswith("google_"):
            method = "google"
            providers = ["google"]
            google_subject = user.username.removeprefix("google_")
        elif user.username.startswith("user_"):
            method = "email"
            providers = ["email"]
            google_subject = None
        else:
            method = "legacy"
            providers = []
            google_subject = None
        AccountProfile.objects.create(
            user_id=user.pk,
            signup_method=method,
            auth_providers=providers,
            google_subject=google_subject,
        )


class Migration(migrations.Migration):
    initial = True

    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name="AccountProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("signup_method", models.CharField(choices=[("email", "이메일 가입"), ("google", "Google 가입"), ("legacy", "기존 계정")], default="legacy", max_length=16)),
                ("auth_providers", models.JSONField(default=list)),
                ("google_subject", models.CharField(blank=True, max_length=255, null=True, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="account_profile", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.RunPython(classify_existing_users, migrations.RunPython.noop),
    ]
