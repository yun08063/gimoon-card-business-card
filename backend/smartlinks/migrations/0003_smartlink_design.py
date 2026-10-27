from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("smartlinks", "0002_resolution_owner"),
    ]

    operations = [
        migrations.AddField(
            model_name="smartlink",
            name="design",
            field=models.CharField(
                choices=[("classic", "Classic"), ("split", "Album left")],
                default="classic",
                max_length=20,
            ),
        ),
    ]
