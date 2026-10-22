from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assets", "0004_asset_richer_metadata"),
    ]

    operations = [
        migrations.AddField(
            model_name="asset",
            name="file_hash",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
    ]
