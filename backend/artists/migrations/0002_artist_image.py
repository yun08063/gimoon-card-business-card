from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("artists", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="artist",
            name="image",
            field=models.ImageField(blank=True, null=True, upload_to="artists/profiles/"),
        ),
    ]
