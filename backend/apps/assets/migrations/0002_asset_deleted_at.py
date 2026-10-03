from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assets", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="asset",
            name="deleted_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
    ]