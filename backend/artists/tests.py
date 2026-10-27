from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from .models import Artist


class ArtistPermissionsTests(APITestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user(username="owner", password="test-password")
        self.other = get_user_model().objects.create_user(username="other", password="test-password")
        Artist.objects.create(name="Public", slug="public", owner=self.owner, is_published=True)
        Artist.objects.create(name="Draft", slug="draft", owner=self.owner)

    def test_anonymous_sees_only_published(self):
        response = self.client.get("/api/artists/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(self.client.get("/api/artists/draft/").status_code, 404)

    def test_other_user_cannot_edit_public_profile(self):
        self.client.force_authenticate(self.other)
        response = self.client.patch("/api/artists/public/", {"name": "Changed"})
        self.assertEqual(response.status_code, 403)

    def test_owner_can_read_and_publish_draft(self):
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get("/api/artists/draft/").status_code, 200)
        response = self.client.patch("/api/artists/draft/", {"is_published": True})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Artist.objects.get(slug="draft").is_published)

    def test_create_assigns_current_owner(self):
        self.client.force_authenticate(self.other)
        response = self.client.post("/api/artists/", {"name": "New", "slug": "new"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Artist.objects.get(slug="new").owner, self.other)
