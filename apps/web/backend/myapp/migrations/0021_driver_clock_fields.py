from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('myapp', '0020_driverlocation'),
    ]

    operations = [
        migrations.AddField(
            model_name='driver',
            name='is_clocked_in',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='driver',
            name='last_clocked_in_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='driver',
            name='last_clocked_out_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
