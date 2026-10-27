from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin

from .models import AccountProfile

User = get_user_model()


class AccountProfileInline(admin.StackedInline):
    model = AccountProfile
    can_delete = False
    extra = 0
    readonly_fields = ["signup_method", "auth_providers", "google_subject", "created_at"]


class AccountUserAdmin(UserAdmin):
    inlines = [*UserAdmin.inlines, AccountProfileInline]
    list_display = (*UserAdmin.list_display, "signup_method")
    list_filter = (*UserAdmin.list_filter, "account_profile__signup_method")
    list_select_related = ("account_profile",)

    @admin.display(description="가입 방식")
    def signup_method(self, user):
        profile = getattr(user, "account_profile", None)
        return profile.get_signup_method_display() if profile else "프로필 없음"


admin.site.unregister(User)
admin.site.register(User, AccountUserAdmin)
