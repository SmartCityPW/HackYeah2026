from django.conf import settings
from django.core.management.base import BaseCommand

from apps.accounts.models import Role, User
from core.secrets import secret


class Command(BaseCommand):
    help = (
        'Zakłada konto administratora IT (admin.email z YAML, hasło z ADMIN_PASSWORD). Idempotentne: istniejącemu kontu '
        'nie zmienia hasła, tylko dba o rolę administratora. Bez ADMIN_PASSWORD nic nie robi.'
    )

    def handle(self, *args, **options):
        password = secret('ADMIN_PASSWORD', required=False)
        admin = settings.APP.admin
        email = admin.email.lower()
        user = User.objects.filter(email=email).first()
        if user is None:
            if not password:
                self.stdout.write('Brak ADMIN_PASSWORD: konto administratora IT nie zostało założone')
                return
            User.objects.create_user(email, password, admin.display_name, role=Role.ADMIN)
            self.stdout.write(f'Utworzono konto administratora IT: {email}')
        elif user.role != Role.ADMIN:
            user.role = Role.ADMIN
            user.save(update_fields=['role', 'updated_at'])
            self.stdout.write(f'Konto {email} dostało rolę administratora')
        else:
            self.stdout.write(f'Konto administratora IT już istnieje: {email}')
