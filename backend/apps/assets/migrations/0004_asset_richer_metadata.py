from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assets", "0003_asset_file"),
    ]

    operations = [
        migrations.AddField(
            model_name="asset",
            name="tags",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="asset",
            name="description",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="asset",
            name="alt_text",
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="asset",
            name="creator",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="asset",
            name="campaign",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="asset",
            name="license",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="asset",
            name="custom_fields",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]