"""Serializery z nazwami pól w camelCase (kontrakt), bez globalnej transformacji danych.

Pola deklarujemy w snake_case, a JSON ma camelCase. Zawartość słowników (np. `details`, `answers`) pozostaje
nietknięta: jej klucze to klucze pól scenariusza i nie wolno ich zmieniać.
"""
from rest_framework import serializers


def to_camel(name: str) -> str:
    head, *rest = name.split('_')
    return head + ''.join(part.title() for part in rest)


class CamelCaseMixin:
    def get_fields(self):
        renamed = {}
        for name, field in super().get_fields().items():
            camel = to_camel(name)
            if camel != name and field.source is None:
                field.source = name
            if isinstance(field, serializers.SerializerMethodField) and field.method_name is None:
                field.method_name = f'get_{name}'  # metoda zostaje w snake_case, nazwa w JSON w camelCase
            renamed[camel] = field
        return renamed


class CamelSerializer(CamelCaseMixin, serializers.Serializer):
    pass


class CamelModelSerializer(CamelCaseMixin, serializers.ModelSerializer):
    pass
