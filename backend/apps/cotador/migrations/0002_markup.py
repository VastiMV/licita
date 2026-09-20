"""Markup no lugar de margem: novos padrões (12%–45%) e rótulos.

Só troca `default` e `verbose_name` — as colunas continuam as mesmas, e os
valores já gravados continuam valendo (sempre foram percentual sobre o
custo, que é o que markup quer dizer). O teto de 100% que existia ficava no
serializer, não aqui.
"""

from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cotador', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='cotacao',
            name='lucro_maximo',
            field=models.DecimalField(decimal_places=2, default=Decimal('45'), max_digits=6, verbose_name='markup alvo (% do custo)'),
        ),
        migrations.AlterField(
            model_name='cotacao',
            name='lucro_minimo',
            field=models.DecimalField(decimal_places=2, default=Decimal('12'), max_digits=6, verbose_name='markup mínimo (% do custo)'),
        ),
        migrations.AlterField(
            model_name='itemcotacao',
            name='margem_maxima',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True, verbose_name='markup alvo (% do custo)'),
        ),
        migrations.AlterField(
            model_name='itemcotacao',
            name='margem_minima',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True, verbose_name='markup mínimo (% do custo)'),
        ),
    ]
